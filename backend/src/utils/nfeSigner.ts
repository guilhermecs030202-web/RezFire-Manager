import crypto from 'crypto';
import forge from 'node-forge';

export interface AssinaturaNFeResultado {
  xml_assinado: string;
  digest_value: string;
  assinatura_valida: boolean;
  certificado_serial: string;
}

export interface VerificacaoAssinaturaResultado {
  valida: boolean;
  motivo?: string;
  digest_calculado?: string;
  digest_xml?: string;
}

function extrairCredenciaisPkcs12(pfxBuffer: Buffer, senha: string): {
  privateKeyPem: string;
  x509DerBase64: string;
  serial: string;
} {
  const derBytes = pfxBuffer.toString('binary');
  const asn1 = forge.asn1.fromDer(derBytes);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);

  const shroudedBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] || [];
  const plainKeyBags =
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [];
  const privateKey = [...shroudedBags, ...plainKeyBags].find((b) => Boolean(b.key))?.key;

  if (!privateKey) {
    throw new Error('Chave privada não encontrada no certificado A1.');
  }

  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const certs = certBags
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => Boolean(c));

  if (certs.length === 0) {
    throw new Error('Certificado X.509 não encontrado no arquivo PKCS#12.');
  }

  const privAny = privateKey as any;
  let leafCert = certs[0];
  if (privAny && privAny.n) {
    const privN = privAny.n.toString(16);
    const matched = certs.find((c) => {
      const pubAny = c.publicKey as any;
      return pubAny && pubAny.n && pubAny.n.toString(16) === privN;
    });
    if (matched) leafCert = matched;
  } else {
    const nonCa = certs.find((c) => {
      const bc: any = c.getExtension('basicConstraints');
      return !bc || !bc.cA;
    });
    if (nonCa) leafCert = nonCa;
  }

  const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
  const certAsn1 = forge.pki.certificateToAsn1(leafCert);
  const certDer = forge.asn1.toDer(certAsn1).getBytes();
  const x509DerBase64 = forge.util.encode64(certDer);

  return {
    privateKeyPem,
    x509DerBase64,
    serial: leafCert.serialNumber || '',
  };
}

/**
 * Canonicaliza <infNFe> conforme Inclusive C14N 1.0 com namespace herdado de <NFe>.
 */
function canonicalizarInfNFe(xml: string): string {
  const match = xml.match(/<infNFe\s+([^>]+)>([\s\S]*?)<\/infNFe>/);
  if (!match) {
    throw new Error('Tag <infNFe> não localizada no XML para assinatura.');
  }

  const attrsRaw = match[1].trim();
  const inner = match[2];

  if (attrsRaw.includes('xmlns="http://www.portalfiscal.inf.br/nfe"')) {
    return `<infNFe ${attrsRaw}>${inner}</infNFe>`;
  }
  return `<infNFe xmlns="http://www.portalfiscal.inf.br/nfe" ${attrsRaw}>${inner}</infNFe>`;
}

function canonicalizarSignedInfo(signedInfoXml: string): string {
  const match = signedInfoXml.match(/<SignedInfo([^>]*)>([\s\S]*?)<\/SignedInfo>/);
  if (!match) {
    throw new Error('Tag <SignedInfo> não localizada para assinatura/verificação.');
  }
  const attrs = match[1];
  const inner = match[2];
  if (attrs.includes('xmlns="http://www.w3.org/2000/09/xmldsig#"')) {
    return `<SignedInfo${attrs}>${inner}</SignedInfo>`;
  }
  return `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"${attrs}>${inner}</SignedInfo>`;
}

/**
 * Assina o XML NF-e v4.00 no padrão XMLDSig enveloped RSA-SHA1 utilizando o certificado A1.
 */
export function assinarXmlNFe(
  xmlGerado: string,
  chaveAcesso: string,
  pfxBuffer: Buffer,
  senha: string
): AssinaturaNFeResultado {
  const { privateKeyPem, x509DerBase64, serial } = extrairCredenciaisPkcs12(pfxBuffer, senha);

  const infNFeCanonico = canonicalizarInfNFe(xmlGerado);
  const digestValue = crypto
    .createHash('sha1')
    .update(infNFeCanonico, 'utf8')
    .digest('base64');

  const signedInfoInterno =
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#NFe${chaveAcesso}">` +
      `<Transforms>` +
        `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
        `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
      `</Transforms>` +
      `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
      `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>`;

  const signedInfoCanonico = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoInterno}</SignedInfo>`;

  const signer = crypto.createSign('RSA-SHA1');
  signer.update(signedInfoCanonico, 'utf8');
  const signatureValue = signer.sign(privateKeyPem, 'base64');

  const signatureXml =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      `<SignedInfo>${signedInfoInterno}</SignedInfo>` +
      `<SignatureValue>${signatureValue}</SignatureValue>` +
      `<KeyInfo><X509Data><X509Certificate>${x509DerBase64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;

  if (!xmlGerado.includes('</NFe>')) {
    throw new Error('Tag de fechamento </NFe> não encontrada no XML gerado.');
  }

  const xmlAssinado = xmlGerado.replace('</NFe>', `${signatureXml}</NFe>`);

  const verificacao = verificarAssinaturaXmlNFe(xmlAssinado);
  if (!verificacao.valida) {
    throw new Error(`Falha na auto-verificação da assinatura XMLDSig: ${verificacao.motivo}`);
  }

  return {
    xml_assinado: xmlAssinado,
    digest_value: digestValue,
    assinatura_valida: true,
    certificado_serial: serial,
  };
}

/**
 * Verifica criptograficamente a integridade do DigestValue (SHA-1 de infNFe)
 * e a assinatura RSA-SHA1 do SignedInfo com a chave pública contida em X509Certificate.
 */
export function verificarAssinaturaXmlNFe(xmlAssinado: string): VerificacaoAssinaturaResultado {
  try {
    const digestMatch = xmlAssinado.match(/<DigestValue>([^<]+)<\/DigestValue>/);
    const sigValMatch = xmlAssinado.match(/<SignatureValue>([^<]+)<\/SignatureValue>/);
    const certMatch = xmlAssinado.match(/<X509Certificate>([^<]+)<\/X509Certificate>/);
    const signedInfoMatch = xmlAssinado.match(/<SignedInfo[^>]*>[\s\S]*?<\/SignedInfo>/);

    if (!digestMatch || !sigValMatch || !certMatch || !signedInfoMatch) {
      return { valida: false, motivo: 'Estrutura XMLDSig incompleta (<Signature> ausente ou malformada).' };
    }

    const digestXml = digestMatch[1].trim();
    const signatureValue = sigValMatch[1].trim();
    const certBase64 = certMatch[1].replace(/\s+/g, '');

    const infNFeCanonico = canonicalizarInfNFe(xmlAssinado);
    const digestCalculado = crypto
      .createHash('sha1')
      .update(infNFeCanonico, 'utf8')
      .digest('base64');

    if (digestCalculado !== digestXml) {
      return {
        valida: false,
        motivo: 'DigestValue não corresponde ao conteúdo atual de <infNFe>.',
        digest_calculado: digestCalculado,
        digest_xml: digestXml,
      };
    }

    const signedInfoCanonico = canonicalizarSignedInfo(signedInfoMatch[0]);
    const linhasBase64 = certBase64.match(/.{1,64}/g)?.join('\n') || certBase64;
    const certPem = `-----BEGIN CERTIFICATE-----\n${linhasBase64}\n-----END CERTIFICATE-----\n`;

    const verifier = crypto.createVerify('RSA-SHA1');
    verifier.update(signedInfoCanonico, 'utf8');
    const rsaOk = verifier.verify(certPem, signatureValue, 'base64');

    if (!rsaOk) {
      return {
        valida: false,
        motivo: 'Assinatura RSA-SHA1 inválida para <SignedInfo>.',
        digest_calculado: digestCalculado,
        digest_xml: digestXml,
      };
    }

    return {
      valida: true,
      digest_calculado: digestCalculado,
      digest_xml: digestXml,
    };
  } catch (err: any) {
    return { valida: false, motivo: err?.message || 'Erro ao verificar assinatura XML.' };
  }
}

function assinarBlocoXmlEnveloped(
  xmlCompleto: string,
  tagAlvo: 'infEvento' | 'infInut',
  tagFechamentoPai: '</evento>' | '</inutNFe>',
  idAtributo: string,
  pfxBuffer: Buffer,
  senha: string
): AssinaturaNFeResultado {
  const { privateKeyPem, x509DerBase64, serial } = extrairCredenciaisPkcs12(pfxBuffer, senha);

  const rxTag = new RegExp(`<${tagAlvo}\\s+([^>]+)>([\\s\\S]*?)<\\/${tagAlvo}>`);
  const m = xmlCompleto.match(rxTag);
  if (!m) {
    throw new Error(`Elemento <${tagAlvo}> não encontrado no XML.`);
  }

  const attrsRaw = m[1].trim();
  const body = m[2];
  const canonico = attrsRaw.includes('xmlns="http://www.portalfiscal.inf.br/nfe"')
    ? `<${tagAlvo} ${attrsRaw}>${body}</${tagAlvo}>`
    : `<${tagAlvo} xmlns="http://www.portalfiscal.inf.br/nfe" ${attrsRaw}>${body}</${tagAlvo}>`;

  const digestValue = crypto.createHash('sha1').update(canonico, 'utf8').digest('base64');
  const signedInfoBody =
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#${idAtributo}">` +
      `<Transforms>` +
        `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
        `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
      `</Transforms>` +
      `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
      `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>`;

  const signedInfoCanonico = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoBody}</SignedInfo>`;
  const signer = crypto.createSign('RSA-SHA1');
  signer.update(signedInfoCanonico, 'utf8');
  const signatureValue = signer.sign(privateKeyPem, 'base64');

  const signatureXml =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      `<SignedInfo>${signedInfoBody}</SignedInfo>` +
      `<SignatureValue>${signatureValue}</SignatureValue>` +
      `<KeyInfo><X509Data><X509Certificate>${x509DerBase64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;

  if (!xmlCompleto.includes(tagFechamentoPai)) {
    throw new Error(`Tag ${tagFechamentoPai} ausente no XML.`);
  }

  return {
    xml_assinado: xmlCompleto.replace(tagFechamentoPai, `${signatureXml}${tagFechamentoPai}`),
    digest_value: digestValue,
    assinatura_valida: true,
    certificado_serial: serial,
  };
}

export function assinarXmlEventoNFe(
  xmlEventoSemAssinatura: string,
  idInfEvento: string,
  pfxBuffer: Buffer,
  senha: string
): AssinaturaNFeResultado {
  return assinarBlocoXmlEnveloped(
    xmlEventoSemAssinatura,
    'infEvento',
    '</evento>',
    idInfEvento,
    pfxBuffer,
    senha
  );
}

export function assinarXmlInutilizacaoNFe(
  xmlInutSemAssinatura: string,
  idInfInut: string,
  pfxBuffer: Buffer,
  senha: string
): AssinaturaNFeResultado {
  return assinarBlocoXmlEnveloped(
    xmlInutSemAssinatura,
    'infInut',
    '</inutNFe>',
    idInfInut,
    pfxBuffer,
    senha
  );
}

