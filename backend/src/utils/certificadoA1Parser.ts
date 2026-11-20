import forge from 'node-forge';
import { formatarCnpj, limparDigitos } from './fiscalValidator';

export interface CertificadoA1Metadados {
  titular: string;
  emissor: string;
  cnpj: string;
  serial: string;
  valido_de: Date;
  valido_ate: Date;
}

const OID_ICP_BRASIL_CNPJ = '2.16.76.1.3.3';

function formatarDataBr(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function getAttrValue(
  attrs: forge.pki.CertificateField[],
  shortNameOrName: string
): string {
  const found = attrs.find(
    (a) => a.shortName === shortNameOrName || a.name === shortNameOrName
  );
  return found && typeof found.value === 'string' ? found.value : '';
}

function extrairStringsAsn1(node: forge.asn1.Asn1): string[] {
  const result: string[] = [];
  if (typeof node.value === 'string') {
    result.push(node.value);
  } else if (Array.isArray(node.value)) {
    for (const child of node.value) {
      result.push(...extrairStringsAsn1(child));
    }
  }
  return result;
}

function encontrarOidCnpjNoAsn1(node: forge.asn1.Asn1): string | null {
  if (Array.isArray(node.value) && node.value.length >= 2) {
    const primeiro = node.value[0];
    if (
      primeiro.type === forge.asn1.Type.OID &&
      typeof primeiro.value === 'string'
    ) {
      const oid = forge.asn1.derToOid(primeiro.value);
      if (oid === OID_ICP_BRASIL_CNPJ) {
        const textos = extrairStringsAsn1(node.value[1]);
        for (const txt of textos) {
          const match = txt.match(/(\d{14})/);
          if (match) return match[1];
        }
      }
    }
    for (const child of node.value) {
      const found = encontrarOidCnpjNoAsn1(child);
      if (found) return found;
    }
  }
  return null;
}

function extrairCnpjDoCertificado(cert: forge.pki.Certificate): string | null {
  // 1. Padrão ICP-Brasil e-CNPJ: OID 2.16.76.1.3.3 dentro de subjectAltName -> otherName
  const sanExt: any = cert.getExtension('subjectAltName');
  if (sanExt) {
    if (typeof sanExt.value === 'string' && sanExt.value.length > 0) {
      try {
        const asn1 = forge.asn1.fromDer(sanExt.value);
        const cnpjSan = encontrarOidCnpjNoAsn1(asn1);
        if (cnpjSan) return cnpjSan;
      } catch {
        // Fallback para inspeção dos altNames parseados
      }
    }
    if (Array.isArray(sanExt.altNames)) {
      for (const alt of sanExt.altNames) {
        if (alt && typeof alt.value === 'string') {
          const match = alt.value.match(/(\d{14})/);
          if (match) return match[1];
        } else if (alt && alt.value && typeof alt.value === 'object') {
          try {
            const cnpjObj = encontrarOidCnpjNoAsn1(alt.value);
            if (cnpjObj) return cnpjObj;
          } catch {
            // continua
          }
        }
      }
    }
  }

  // 2. Padrão comum em CN ICP-Brasil: "RAZAO SOCIAL:11222333000181"
  const cn = getAttrValue(cert.subject.attributes, 'CN');
  if (cn) {
    const matchColon = cn.match(/:(\d{14})\b/);
    if (matchColon) return matchColon[1];
    const matchAny = cn.match(/\b(\d{14})\b/);
    if (matchAny) return matchAny[1];
  }

  // 3. Campo serialNumber no subject
  const serialSubject = getAttrValue(cert.subject.attributes, 'serialNumber');
  if (serialSubject) {
    const matchSerial = serialSubject.match(/(\d{14})/);
    if (matchSerial) return matchSerial[1];
  }

  return null;
}

function selecionarCertificadoFolha(
  certBags: forge.pkcs12.Bag[],
  privateKey: forge.pki.PrivateKey | null
): forge.pki.Certificate {
  const certs = certBags
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => Boolean(c));

  if (certs.length === 0) {
    throw new Error('O arquivo PKCS#12 não contém nenhum certificado X.509.');
  }

  // Tenta casar pelo módulo da chave RSA (chave pública do certificado === chave privada)
  const privAny = privateKey as any;
  if (privAny && privAny.n) {
    const privN = privAny.n.toString(16);
    const matching = certs.find((c) => {
      const pubAny = c.publicKey as any;
      return pubAny && pubAny.n && pubAny.n.toString(16) === privN;
    });
    if (matching) return matching;
  }

  // Fallback: certificado que não é Autoridade Certificadora (basicConstraints.cA !== true)
  const nonCa = certs.find((c) => {
    const bc: any = c.getExtension('basicConstraints');
    return !bc || !bc.cA;
  });

  return nonCa || certs[0];
}

/**
 * Lê e valida um arquivo PKCS#12 (.pfx / .p12) de certificado digital A1.
 * Valida: senha correta, presença de chave privada, janela de validade e compatibilidade do CNPJ.
 */
export function validarCertificadoA1(
  pfxBuffer: Buffer,
  senha: string,
  cnpjEsperado: string
): CertificadoA1Metadados {
  if (!pfxBuffer || pfxBuffer.length === 0) {
    throw new Error('Arquivo do certificado digital A1 (.pfx / .p12) não foi enviado ou está vazio.');
  }
  if (!senha || typeof senha !== 'string') {
    throw new Error('A senha do certificado digital A1 é obrigatória.');
  }

  const cnpjEmitenteLimpo = limparDigitos(cnpjEsperado);
  if (cnpjEmitenteLimpo.length !== 14) {
    throw new Error('CNPJ do emitente inválido para validar compatibilidade do certificado.');
  }

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const derBytes = pfxBuffer.toString('binary');
    const asn1 = forge.asn1.fromDer(derBytes);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
  } catch {
    throw new Error('Senha do certificado digital incorreta ou arquivo PKCS#12 (.pfx/.p12) inválido/corrompido.');
  }

  // Extrai chave privada
  const shroudedBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] || [];
  const plainKeyBags =
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [];
  const keyBags = [...shroudedBags, ...plainKeyBags];
  const privateKey = keyBags.find((b) => Boolean(b.key))?.key || null;

  if (!privateKey) {
    throw new Error('O certificado enviado não contém uma chave privada válida para assinatura digital A1.');
  }

  // Extrai certificado X.509 folha
  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const cert = selecionarCertificadoFolha(certBags, privateKey);

  // Valida datas de validade
  const agora = new Date();
  const validoDe = new Date(cert.validity.notBefore);
  const validoAte = new Date(cert.validity.notAfter);

  if (agora > validoAte) {
    throw new Error(
      `Certificado digital vencido em ${formatarDataBr(validoAte)}. Envie um certificado A1 válido.`
    );
  }
  if (agora < validoDe) {
    throw new Error(
      `Certificado digital ainda não está vigente (início em ${formatarDataBr(validoDe)}).`
    );
  }

  // Valida CNPJ do certificado contra CNPJ do emitente
  const cnpjCertificado = extrairCnpjDoCertificado(cert);
  if (!cnpjCertificado) {
    throw new Error(
      'Não foi possível identificar o CNPJ no certificado digital enviado. Utilize um certificado e-CNPJ ICP-Brasil (modelo A1).'
    );
  }
  if (cnpjCertificado !== cnpjEmitenteLimpo) {
    throw new Error(
      `O CNPJ do certificado (${formatarCnpj(cnpjCertificado)}) não corresponde ao CNPJ do emitente cadastrado (${formatarCnpj(cnpjEmitenteLimpo)}).`
    );
  }

  const titular =
    getAttrValue(cert.subject.attributes, 'CN') ||
    getAttrValue(cert.subject.attributes, 'O') ||
    'Titular não informado';
  const emissor =
    getAttrValue(cert.issuer.attributes, 'CN') ||
    getAttrValue(cert.issuer.attributes, 'O') ||
    'Autoridade Certificadora não informada';

  return {
    titular,
    emissor,
    cnpj: cnpjCertificado,
    serial: cert.serialNumber || '',
    valido_de: validoDe,
    valido_ate: validoAte,
  };
}

