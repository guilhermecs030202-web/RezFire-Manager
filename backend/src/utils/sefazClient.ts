import https from 'https';
import { env } from '../config/env';
import {
  interpretarCodigoSefaz,
  InterpretacaoCodigoSefaz,
} from './sefazCodigos';

export type AmbienteSefaz = 'homologacao' | 'producao';
export type ServicoSefaz = 'NFeAutorizacao4' | 'NFeConsultaProtocolo4' | 'NFeStatusServico4';
export type ModoTransporteSefaz = 'simulado' | 'sefaz_soap';

export type CenarioSimulacaoSefaz =
  | 'autorizada'
  | 'rejeitada'
  | 'rejeitada_duplicidade'
  | 'denegada'
  | 'processamento'
  | 'nao_consta'
  | 'indisponivel';

export interface SefazResponseParsed {
  cStat: string | null;
  xMotivo: string | null;
  nProt: string | null;
  nRec: string | null;
  dhRecbto: string | null;
  chNFe: string | null;
  digVal: string | null;
  cUF: string | null;
  xmlProtNFe: string | null;
  interpretacao: InterpretacaoCodigoSefaz;
}

export interface ResultadoChamadaSefaz {
  modoTransporte: ModoTransporteSefaz;
  servico: ServicoSefaz;
  endpointUrl: string;
  httpStatus: number | null;
  indisponivel: boolean;
  duracaoMs: number;
  xmlRequisicao: string;
  xmlResposta: string | null;
  xmlAutorizado: string | null;
  erroRede: string | null;
  parsed: SefazResponseParsed;
}

const CODIGOS_UF_IBGE: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35',
  PR: '41', SC: '42', RS: '43',
  MS: '50', MT: '51', GO: '52', DF: '53',
};

const ENDPOINTS_SEFAZ_V4: Record<
  string,
  Record<AmbienteSefaz, Record<ServicoSefaz, string>>
> = {
  SP: {
    homologacao: {
      NFeAutorizacao4: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
      NFeConsultaProtocolo4: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
      NFeStatusServico4: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    },
    producao: {
      NFeAutorizacao4: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
      NFeConsultaProtocolo4: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
      NFeStatusServico4: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    },
  },
  MG: {
    homologacao: {
      NFeAutorizacao4: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
      NFeConsultaProtocolo4: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
      NFeStatusServico4: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4',
    },
    producao: {
      NFeAutorizacao4: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
      NFeConsultaProtocolo4: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
      NFeStatusServico4: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4',
    },
  },
  PR: {
    homologacao: {
      NFeAutorizacao4: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4',
      NFeConsultaProtocolo4: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4',
      NFeStatusServico4: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeStatusServico4',
    },
    producao: {
      NFeAutorizacao4: 'https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4',
      NFeConsultaProtocolo4: 'https://nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4',
      NFeStatusServico4: 'https://nfe.sefa.pr.gov.br/nfe/NFeStatusServico4',
    },
  },
  RS: {
    homologacao: {
      NFeAutorizacao4: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      NFeConsultaProtocolo4: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      NFeStatusServico4: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    },
    producao: {
      NFeAutorizacao4: 'https://nfe.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      NFeConsultaProtocolo4: 'https://nfe.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      NFeStatusServico4: 'https://nfe.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    },
  },
  BA: {
    homologacao: {
      NFeAutorizacao4: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
      NFeConsultaProtocolo4: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
      NFeStatusServico4: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeStatusServico4/NFeStatusServico4.asmx',
    },
    producao: {
      NFeAutorizacao4: 'https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
      NFeConsultaProtocolo4: 'https://nfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
      NFeStatusServico4: 'https://nfe.sefaz.ba.gov.br/webservices/NFeStatusServico4/NFeStatusServico4.asmx',
    },
  },
  SVRS: {
    homologacao: {
      NFeAutorizacao4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      NFeConsultaProtocolo4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      NFeStatusServico4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    },
    producao: {
      NFeAutorizacao4: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      NFeConsultaProtocolo4: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      NFeStatusServico4: 'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    },
  },
};

export function resolverUrlSefaz(
  ufInput: string | null | undefined,
  ambiente: AmbienteSefaz,
  servico: ServicoSefaz
): string {
  const uf = String(ufInput || 'SP').trim().toUpperCase();
  const tabelaUf = ENDPOINTS_SEFAZ_V4[uf] || ENDPOINTS_SEFAZ_V4.SVRS;
  return tabelaUf[ambiente][servico];
}

export function obterCodigoIbgeUf(ufInput: string | null | undefined): string {
  const uf = String(ufInput || 'SP').trim().toUpperCase();
  return CODIGOS_UF_IBGE[uf] || '35';
}

function removerDeclaracaoXml(xml: string): string {
  return xml.replace(/^\s*<\?xml[^?]*\?>\s*/i, '').trim();
}

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extrairTagSimples(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function extrairBlocoCompleto(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:[\\w.-]+:)?${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[0].trim() : null;
}

function formatarDataHoraSefaz(data = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const brOffsetMs = -3 * 60 * 60 * 1000;
  const dt = new Date(data.getTime() + brOffsetMs);
  return (
    `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())}-03:00`
  );
}

function resolverModoTransporte(
  ambiente: AmbienteSefaz,
  cenarioTeste?: CenarioSimulacaoSefaz | null,
  modoExplicito?: ModoTransporteSefaz
): ModoTransporteSefaz {
  const modoConfigurado: ModoTransporteSefaz =
    modoExplicito || (env.SEFAZ_MODO_TRANSPORTE === 'sefaz_soap' ? 'sefaz_soap' : 'simulado');

  if (ambiente === 'producao') {
    if (cenarioTeste) {
      throw Object.assign(
        new Error('Cenário simulado de SEFAZ não pode ser utilizado no ambiente de produção.'),
        { statusCode: 400 }
      );
    }
    if (modoConfigurado === 'simulado') {
      throw Object.assign(
        new Error(
          'Ambiente de produção não permite transmissão simulada. Configure SEFAZ_MODO_TRANSPORTE=sefaz_soap para comunicar com a SEFAZ real.'
        ),
        { statusCode: 400 }
      );
    }
  }

  return modoConfigurado;
}

export function montarEnvelopeSoapAutorizacao(xmlAssinado: string, idLote?: string): string {
  const nfeSemDeclaracao = removerDeclaracaoXml(xmlAssinado);
  const lote = (idLote || String(Date.now()).slice(-15)).replace(/\D/g, '').slice(0, 15) || '1';
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
    `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `<idLote>${lote}</idLote>` +
    `<indSinc>1</indSinc>` +
    `${nfeSemDeclaracao}` +
    `</enviNFe>` +
    `</nfeDadosMsg>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}

export function montarEnvelopeSoapConsultaProtocolo(
  chaveAcesso: string,
  ambiente: AmbienteSefaz
): string {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const chNFeLimpa = chaveAcesso.replace(/\D/g, '');
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">` +
    `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<xServ>CONSULTAR</xServ>` +
    `<chNFe>${chNFeLimpa}</chNFe>` +
    `</consSitNFe>` +
    `</nfeDadosMsg>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}

export function montarEnvelopeSoapStatusServico(
  uf: string,
  ambiente: AmbienteSefaz
): string {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const cUF = obterCodigoIbgeUf(uf);
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">` +
    `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<cUF>${cUF}</cUF>` +
    `<xServ>STATUS</xServ>` +
    `</consStatServ>` +
    `</nfeDadosMsg>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}

export function montarXmlNfeProc(xmlAssinado: string, xmlProtNFe: string): string {
  const nfeLimpa = removerDeclaracaoXml(xmlAssinado);
  const protLimpo = removerDeclaracaoXml(xmlProtNFe);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `${nfeLimpa}` +
    `${protLimpo}` +
    `</nfeProc>`
  );
}

export function parsearRetornoSefazXml(xmlResposta: string): SefazResponseParsed {
  const xmlProtNFe = extrairBlocoCompleto(xmlResposta, 'protNFe');
  const blocoInfProt = xmlProtNFe ? extrairBlocoCompleto(xmlProtNFe, 'infProt') : null;
  const blocoInfRec = extrairBlocoCompleto(xmlResposta, 'infRec');

  // Quando há protNFe/infProt dentro de retEnviNFe ou retConsSitNFe, o cStat da NF-e prevalece sobre o cStat do lote (ex: 104)
  const cStat = blocoInfProt
    ? extrairTagSimples(blocoInfProt, 'cStat')
    : extrairTagSimples(xmlResposta, 'cStat');
  const xMotivo = blocoInfProt
    ? extrairTagSimples(blocoInfProt, 'xMotivo')
    : extrairTagSimples(xmlResposta, 'xMotivo');

  const nProt = blocoInfProt
    ? extrairTagSimples(blocoInfProt, 'nProt')
    : extrairTagSimples(xmlResposta, 'nProt');
  const nRec = blocoInfRec
    ? extrairTagSimples(blocoInfRec, 'nRec')
    : extrairTagSimples(xmlResposta, 'nRec');
  const dhRecbto = blocoInfProt
    ? extrairTagSimples(blocoInfProt, 'dhRecbto')
    : extrairTagSimples(xmlResposta, 'dhRecbto');
  const chNFe = blocoInfProt
    ? extrairTagSimples(blocoInfProt, 'chNFe')
    : extrairTagSimples(xmlResposta, 'chNFe');
  const digVal = blocoInfProt
    ? extrairTagSimples(blocoInfProt, 'digVal')
    : extrairTagSimples(xmlResposta, 'digVal');
  const cUF = extrairTagSimples(xmlResposta, 'cUF');

  const interpretacao = interpretarCodigoSefaz(cStat || '000', xMotivo);

  return {
    cStat,
    xMotivo,
    nProt,
    nRec,
    dhRecbto,
    chNFe,
    digVal,
    cUF,
    xmlProtNFe,
    interpretacao,
  };
}

async function enviarSoapMtls(params: {
  endpointUrl: string;
  soapXml: string;
  pfxBuffer: Buffer;
  senha: string;
  timeoutMs?: number;
}): Promise<{ httpStatus: number | null; body: string | null; erroRede: string | null; indisponivel: boolean }> {
  const timeoutMs = params.timeoutMs || env.SEFAZ_TIMEOUT_MS || 15000;
  const url = new URL(params.endpointUrl);
  const payloadBuffer = Buffer.from(params.soapXml, 'utf8');

  return new Promise((resolve) => {
    let finalizado = false;
    const concluir = (res: {
      httpStatus: number | null;
      body: string | null;
      erroRede: string | null;
      indisponivel: boolean;
    }) => {
      if (finalizado) return;
      finalizado = true;
      resolve(res);
    };

    try {
      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port ? Number(url.port) : 443,
          path: `${url.pathname}${url.search}`,
          method: 'POST',
          pfx: params.pfxBuffer,
          passphrase: params.senha,
          rejectUnauthorized: true,
          timeout: timeoutMs,
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            'Content-Length': String(payloadBuffer.length),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            const httpStatus = res.statusCode ?? null;
            const indisponivel = httpStatus === null || httpStatus >= 500 || !body.trim();
            concluir({
              httpStatus,
              body,
              erroRede: indisponivel ? `SEFAZ respondeu HTTP ${httpStatus ?? 'desconhecido'}.` : null,
              indisponivel,
            });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        concluir({
          httpStatus: null,
          body: null,
          erroRede: `Timeout na comunicação com a SEFAZ após ${timeoutMs}ms.`,
          indisponivel: true,
        });
      });

      req.on('error', (err) => {
        concluir({
          httpStatus: null,
          body: null,
          erroRede: `Falha de rede/TLS ao conectar à SEFAZ: ${err.message}`,
          indisponivel: true,
        });
      });

      req.write(payloadBuffer);
      req.end();
    } catch (err: any) {
      concluir({
        httpStatus: null,
        body: null,
        erroRede: `Erro ao preparar requisição TLS mTLS para SEFAZ: ${err?.message || String(err)}`,
        indisponivel: true,
      });
    }
  });
}

function gerarNumeroProtocoloSimulado(uf: string): string {
  const cUF = obterCodigoIbgeUf(uf);
  const agora = Date.now().toString();
  const base = `${cUF}${agora}`;
  return base.slice(0, 15).padEnd(15, '0');
}

function gerarNumeroReciboSimulado(uf: string): string {
  const cUF = obterCodigoIbgeUf(uf);
  return `${cUF}1${Date.now().toString().slice(-12)}`.padEnd(15, '7').slice(0, 15);
}

function gerarXmlProtNFe(params: {
  tpAmb: '1' | '2';
  chNFe: string;
  dhRecbto: string;
  nProt?: string;
  digVal?: string | null;
  cStat: string;
  xMotivo: string;
}): string {
  return (
    `<protNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `<infProt>` +
    `<tpAmb>${params.tpAmb}</tpAmb>` +
    `<verAplic>SP_NFE_PL009_V4</verAplic>` +
    `<chNFe>${escaparXml(params.chNFe)}</chNFe>` +
    `<dhRecbto>${escaparXml(params.dhRecbto)}</dhRecbto>` +
    (params.nProt ? `<nProt>${escaparXml(params.nProt)}</nProt>` : '') +
    (params.digVal ? `<digVal>${escaparXml(params.digVal)}</digVal>` : '') +
    `<cStat>${escaparXml(params.cStat)}</cStat>` +
    `<xMotivo>${escaparXml(params.xMotivo)}</xMotivo>` +
    `</infProt>` +
    `</protNFe>`
  );
}

function executarSimulacaoAutorizacao(params: {
  endpointUrl: string;
  soapXml: string;
  uf: string;
  chaveAcesso: string;
  xmlAssinado: string;
  digestValue?: string | null;
  cenarioTeste?: CenarioSimulacaoSefaz;
  cStatSimulado?: string;
  xMotivoSimulado?: string;
}): ResultadoChamadaSefaz {
  const inicio = Date.now();
  const cenario: CenarioSimulacaoSefaz = params.cenarioTeste || 'autorizada';
  const dhRecbto = formatarDataHoraSefaz();
  const cUF = obterCodigoIbgeUf(params.uf);

  if (cenario === 'indisponivel') {
    const erroRede = 'SEFAZ Homologação simulada temporariamente indisponível (HTTP 503 / cStat 108).';
    const xmlResposta =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
      `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
      `<retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
      `<tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><cStat>108</cStat>` +
      `<xMotivo>Servico Paralisado Momentaneamente (curto prazo) - Simulado</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto>` +
      `</retEnviNFe></nfeResultMsg></soap12:Body></soap12:Envelope>`;

    return {
      modoTransporte: 'simulado',
      servico: 'NFeAutorizacao4',
      endpointUrl: params.endpointUrl,
      httpStatus: 503,
      indisponivel: true,
      duracaoMs: Date.now() - inicio,
      xmlRequisicao: params.soapXml,
      xmlResposta,
      xmlAutorizado: null,
      erroRede,
      parsed: parsearRetornoSefazXml(xmlResposta),
    };
  }

  if (cenario === 'processamento') {
    const nRec = gerarNumeroReciboSimulado(params.uf);
    const xmlResposta =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
      `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
      `<retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
      `<tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><cStat>103</cStat>` +
      `<xMotivo>Lote recebido com sucesso - Simulado</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto>` +
      `<infRec><nRec>${nRec}</nRec><tMed>2</tMed></infRec>` +
      `</retEnviNFe></nfeResultMsg></soap12:Body></soap12:Envelope>`;

    return {
      modoTransporte: 'simulado',
      servico: 'NFeAutorizacao4',
      endpointUrl: params.endpointUrl,
      httpStatus: 200,
      indisponivel: false,
      duracaoMs: Date.now() - inicio,
      xmlRequisicao: params.soapXml,
      xmlResposta,
      xmlAutorizado: null,
      erroRede: null,
      parsed: parsearRetornoSefazXml(xmlResposta),
    };
  }

  if (cenario === 'rejeitada' || cenario === 'rejeitada_duplicidade' || cenario === 'denegada') {
    const cStat =
      params.cStatSimulado ||
      (cenario === 'rejeitada_duplicidade' ? '539' : cenario === 'denegada' ? '302' : '778');
    const xMotivo =
      params.xMotivoSimulado ||
      (cenario === 'rejeitada_duplicidade'
        ? 'Rejeicao: Duplicidade de NF-e, com diferenca na Chave de Acesso [Simulado]'
        : cenario === 'denegada'
          ? 'Uso Denegado: Irregularidade fiscal do destinatario [Simulado]'
          : 'Rejeicao: Informado NCM inexistente [nItem:1] [Simulado]');

    const protNFe = gerarXmlProtNFe({
      tpAmb: '2',
      chNFe: params.chaveAcesso,
      dhRecbto,
      digVal: params.digestValue || null,
      cStat,
      xMotivo,
    });

    const xmlResposta =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
      `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
      `<retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
      `<tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><cStat>104</cStat>` +
      `<xMotivo>Lote processado</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto>` +
      `${protNFe}` +
      `</retEnviNFe></nfeResultMsg></soap12:Body></soap12:Envelope>`;

    return {
      modoTransporte: 'simulado',
      servico: 'NFeAutorizacao4',
      endpointUrl: params.endpointUrl,
      httpStatus: 200,
      indisponivel: false,
      duracaoMs: Date.now() - inicio,
      xmlRequisicao: params.soapXml,
      xmlResposta,
      xmlAutorizado: null,
      erroRede: null,
      parsed: parsearRetornoSefazXml(xmlResposta),
    };
  }

  // Cenário padrão: autorizada (100)
  const nProt = gerarNumeroProtocoloSimulado(params.uf);
  const protNFe = gerarXmlProtNFe({
    tpAmb: '2',
    chNFe: params.chaveAcesso,
    dhRecbto,
    nProt,
    digVal: params.digestValue || 'SimuladoDigestValue==',
    cStat: params.cStatSimulado || '100',
    xMotivo: params.xMotivoSimulado || 'Autorizado o uso da NF-e',
  });

  const xmlResposta =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
    `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
    `<retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `<tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><cStat>104</cStat>` +
    `<xMotivo>Lote processado</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto>` +
    `${protNFe}` +
    `</retEnviNFe></nfeResultMsg></soap12:Body></soap12:Envelope>`;

  const xmlAutorizado = montarXmlNfeProc(params.xmlAssinado, protNFe);

  return {
    modoTransporte: 'simulado',
    servico: 'NFeAutorizacao4',
    endpointUrl: params.endpointUrl,
    httpStatus: 200,
    indisponivel: false,
    duracaoMs: Date.now() - inicio,
    xmlRequisicao: params.soapXml,
    xmlResposta,
    xmlAutorizado,
    erroRede: null,
    parsed: parsearRetornoSefazXml(xmlResposta),
  };
}

function executarSimulacaoConsultaProtocolo(params: {
  endpointUrl: string;
  soapXml: string;
  uf: string;
  chaveAcesso: string;
  xmlAssinado?: string | null;
  digestValue?: string | null;
  cenarioTeste?: CenarioSimulacaoSefaz;
  cStatSimulado?: string;
  xMotivoSimulado?: string;
}): ResultadoChamadaSefaz {
  const inicio = Date.now();
  const cenario: CenarioSimulacaoSefaz = params.cenarioTeste || 'autorizada';
  const dhRecbto = formatarDataHoraSefaz();
  const cUF = obterCodigoIbgeUf(params.uf);

  if (cenario === 'indisponivel') {
    return {
      modoTransporte: 'simulado',
      servico: 'NFeConsultaProtocolo4',
      endpointUrl: params.endpointUrl,
      httpStatus: 503,
      indisponivel: true,
      duracaoMs: Date.now() - inicio,
      xmlRequisicao: params.soapXml,
      xmlResposta: null,
      xmlAutorizado: null,
      erroRede: 'Timeout ao consultar protocolo na SEFAZ (Simulado HTTP 503).',
      parsed: parsearRetornoSefazXml('<retConsSitNFe><cStat>108</cStat><xMotivo>Servico Paralisado Momentaneamente</xMotivo></retConsSitNFe>'),
    };
  }

  if (cenario === 'processamento') {
    const xmlResposta =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
      `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">` +
      `<retConsSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
      `<tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><cStat>105</cStat>` +
      `<xMotivo>Lote em processamento - Simulado</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto>` +
      `<chNFe>${params.chaveAcesso}</chNFe>` +
      `</retConsSitNFe></nfeResultMsg></soap12:Body></soap12:Envelope>`;

    return {
      modoTransporte: 'simulado',
      servico: 'NFeConsultaProtocolo4',
      endpointUrl: params.endpointUrl,
      httpStatus: 200,
      indisponivel: false,
      duracaoMs: Date.now() - inicio,
      xmlRequisicao: params.soapXml,
      xmlResposta,
      xmlAutorizado: null,
      erroRede: null,
      parsed: parsearRetornoSefazXml(xmlResposta),
    };
  }

  if (cenario === 'nao_consta') {
    const xmlResposta =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
      `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">` +
      `<retConsSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
      `<tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><cStat>217</cStat>` +
      `<xMotivo>Rejeicao: NF-e nao consta na base de dados da SEFAZ</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto>` +
      `<chNFe>${params.chaveAcesso}</chNFe>` +
      `</retConsSitNFe></nfeResultMsg></soap12:Body></soap12:Envelope>`;

    return {
      modoTransporte: 'simulado',
      servico: 'NFeConsultaProtocolo4',
      endpointUrl: params.endpointUrl,
      httpStatus: 200,
      indisponivel: false,
      duracaoMs: Date.now() - inicio,
      xmlRequisicao: params.soapXml,
      xmlResposta,
      xmlAutorizado: null,
      erroRede: null,
      parsed: parsearRetornoSefazXml(xmlResposta),
    };
  }

  if (cenario === 'rejeitada' || cenario === 'rejeitada_duplicidade' || cenario === 'denegada') {
    const cStat =
      params.cStatSimulado ||
      (cenario === 'rejeitada_duplicidade' ? '539' : cenario === 'denegada' ? '302' : '528');
    const xMotivo =
      params.xMotivoSimulado ||
      (cenario === 'rejeitada_duplicidade'
        ? 'Rejeicao: Duplicidade de NF-e, com diferenca na Chave de Acesso [Consulta Simulada]'
        : cenario === 'denegada'
          ? 'Uso Denegado: Irregularidade fiscal do destinatario [Consulta Simulada]'
          : 'Rejeicao: Valor do ICMS difere do produto BC e Aliquota [Consulta Simulada]');

    const protNFe = gerarXmlProtNFe({
      tpAmb: '2',
      chNFe: params.chaveAcesso,
      dhRecbto,
      digVal: params.digestValue || null,
      cStat,
      xMotivo,
    });

    const xmlResposta =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
      `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">` +
      `<retConsSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
      `<tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><cStat>${cStat}</cStat>` +
      `<xMotivo>${escaparXml(xMotivo)}</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto>` +
      `<chNFe>${params.chaveAcesso}</chNFe>${protNFe}` +
      `</retConsSitNFe></nfeResultMsg></soap12:Body></soap12:Envelope>`;

    return {
      modoTransporte: 'simulado',
      servico: 'NFeConsultaProtocolo4',
      endpointUrl: params.endpointUrl,
      httpStatus: 200,
      indisponivel: false,
      duracaoMs: Date.now() - inicio,
      xmlRequisicao: params.soapXml,
      xmlResposta,
      xmlAutorizado: null,
      erroRede: null,
      parsed: parsearRetornoSefazXml(xmlResposta),
    };
  }

  // autorizada (100)
  const nProt = gerarNumeroProtocoloSimulado(params.uf);
  const protNFe = gerarXmlProtNFe({
    tpAmb: '2',
    chNFe: params.chaveAcesso,
    dhRecbto,
    nProt,
    digVal: params.digestValue || 'SimuladoDigestValue==',
    cStat: params.cStatSimulado || '100',
    xMotivo: params.xMotivoSimulado || 'Autorizado o uso da NF-e',
  });

  const xmlResposta =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
    `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">` +
    `<retConsSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `<tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><cStat>100</cStat>` +
    `<xMotivo>Autorizado o uso da NF-e</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto>` +
    `<chNFe>${params.chaveAcesso}</chNFe>${protNFe}` +
    `</retConsSitNFe></nfeResultMsg></soap12:Body></soap12:Envelope>`;

  const xmlAutorizado = params.xmlAssinado ? montarXmlNfeProc(params.xmlAssinado, protNFe) : null;

  return {
    modoTransporte: 'simulado',
    servico: 'NFeConsultaProtocolo4',
    endpointUrl: params.endpointUrl,
    httpStatus: 200,
    indisponivel: false,
    duracaoMs: Date.now() - inicio,
    xmlRequisicao: params.soapXml,
    xmlResposta,
    xmlAutorizado,
    erroRede: null,
    parsed: parsearRetornoSefazXml(xmlResposta),
  };
}

export async function enviarAutorizacaoSefaz(params: {
  uf: string;
  ambiente: AmbienteSefaz;
  chaveAcesso: string;
  xmlAssinado: string;
  digestValue?: string | null;
  idLote?: string;
  pfxBuffer?: Buffer;
  senha?: string;
  cenarioTeste?: CenarioSimulacaoSefaz;
  cStatSimulado?: string;
  xMotivoSimulado?: string;
  modoTransporte?: ModoTransporteSefaz;
}): Promise<ResultadoChamadaSefaz> {
  const modo = resolverModoTransporte(params.ambiente, params.cenarioTeste, params.modoTransporte);
  const endpointUrl = resolverUrlSefaz(params.uf, params.ambiente, 'NFeAutorizacao4');
  const soapXml = montarEnvelopeSoapAutorizacao(params.xmlAssinado, params.idLote);

  if (modo === 'simulado') {
    return executarSimulacaoAutorizacao({
      endpointUrl,
      soapXml,
      uf: params.uf,
      chaveAcesso: params.chaveAcesso,
      xmlAssinado: params.xmlAssinado,
      digestValue: params.digestValue,
      cenarioTeste: params.cenarioTeste,
      cStatSimulado: params.cStatSimulado,
      xMotivoSimulado: params.xMotivoSimulado,
    });
  }

  if (!params.pfxBuffer || !params.senha) {
    throw Object.assign(
      new Error('Certificado A1 (PFX e senha) é obrigatório para comunicação real mTLS com a SEFAZ.'),
      { statusCode: 400 }
    );
  }

  const inicio = Date.now();
  const resp = await enviarSoapMtls({
    endpointUrl,
    soapXml,
    pfxBuffer: params.pfxBuffer,
    senha: params.senha,
  });
  const duracaoMs = Date.now() - inicio;

  if (resp.indisponivel || !resp.body) {
    return {
      modoTransporte: 'sefaz_soap',
      servico: 'NFeAutorizacao4',
      endpointUrl,
      httpStatus: resp.httpStatus,
      indisponivel: true,
      duracaoMs,
      xmlRequisicao: soapXml,
      xmlResposta: resp.body,
      xmlAutorizado: null,
      erroRede: resp.erroRede,
      parsed: {
        cStat: '108',
        xMotivo: resp.erroRede || 'SEFAZ indisponível',
        nProt: null,
        nRec: null,
        dhRecbto: null,
        chNFe: params.chaveAcesso,
        digVal: null,
        cUF: obterCodigoIbgeUf(params.uf),
        xmlProtNFe: null,
        interpretacao: interpretarCodigoSefaz('108', resp.erroRede),
      },
    };
  }

  const parsed = parsearRetornoSefazXml(resp.body);
  const ehIndisponivel = parsed.interpretacao.categoria === 'indisponivel';
  const ehAutorizada = parsed.interpretacao.categoria === 'autorizada';
  const xmlAutorizado =
    ehAutorizada && parsed.xmlProtNFe ? montarXmlNfeProc(params.xmlAssinado, parsed.xmlProtNFe) : null;

  return {
    modoTransporte: 'sefaz_soap',
    servico: 'NFeAutorizacao4',
    endpointUrl,
    httpStatus: resp.httpStatus,
    indisponivel: ehIndisponivel,
    duracaoMs,
    xmlRequisicao: soapXml,
    xmlResposta: resp.body,
    xmlAutorizado,
    erroRede: ehIndisponivel ? parsed.xMotivo || 'SEFAZ temporariamente indisponível' : null,
    parsed,
  };
}

export async function consultarProtocoloSefaz(params: {
  uf: string;
  ambiente: AmbienteSefaz;
  chaveAcesso: string;
  xmlAssinado?: string | null;
  digestValue?: string | null;
  pfxBuffer?: Buffer;
  senha?: string;
  cenarioTeste?: CenarioSimulacaoSefaz;
  cStatSimulado?: string;
  xMotivoSimulado?: string;
  modoTransporte?: ModoTransporteSefaz;
}): Promise<ResultadoChamadaSefaz> {
  const modo = resolverModoTransporte(params.ambiente, params.cenarioTeste, params.modoTransporte);
  const endpointUrl = resolverUrlSefaz(params.uf, params.ambiente, 'NFeConsultaProtocolo4');
  const soapXml = montarEnvelopeSoapConsultaProtocolo(params.chaveAcesso, params.ambiente);

  if (modo === 'simulado') {
    return executarSimulacaoConsultaProtocolo({
      endpointUrl,
      soapXml,
      uf: params.uf,
      chaveAcesso: params.chaveAcesso,
      xmlAssinado: params.xmlAssinado,
      digestValue: params.digestValue,
      cenarioTeste: params.cenarioTeste,
      cStatSimulado: params.cStatSimulado,
      xMotivoSimulado: params.xMotivoSimulado,
    });
  }

  if (!params.pfxBuffer || !params.senha) {
    throw Object.assign(
      new Error('Certificado A1 (PFX e senha) é obrigatório para consultar protocolo na SEFAZ.'),
      { statusCode: 400 }
    );
  }

  const inicio = Date.now();
  const resp = await enviarSoapMtls({
    endpointUrl,
    soapXml,
    pfxBuffer: params.pfxBuffer,
    senha: params.senha,
  });
  const duracaoMs = Date.now() - inicio;

  if (resp.indisponivel || !resp.body) {
    return {
      modoTransporte: 'sefaz_soap',
      servico: 'NFeConsultaProtocolo4',
      endpointUrl,
      httpStatus: resp.httpStatus,
      indisponivel: true,
      duracaoMs,
      xmlRequisicao: soapXml,
      xmlResposta: resp.body,
      xmlAutorizado: null,
      erroRede: resp.erroRede,
      parsed: {
        cStat: '108',
        xMotivo: resp.erroRede || 'SEFAZ indisponível',
        nProt: null,
        nRec: null,
        dhRecbto: null,
        chNFe: params.chaveAcesso,
        digVal: null,
        cUF: obterCodigoIbgeUf(params.uf),
        xmlProtNFe: null,
        interpretacao: interpretarCodigoSefaz('108', resp.erroRede),
      },
    };
  }

  const parsed = parsearRetornoSefazXml(resp.body);
  const ehIndisponivel = parsed.interpretacao.categoria === 'indisponivel';
  const ehAutorizada = parsed.interpretacao.categoria === 'autorizada';
  const xmlAutorizado =
    ehAutorizada && parsed.xmlProtNFe && params.xmlAssinado
      ? montarXmlNfeProc(params.xmlAssinado, parsed.xmlProtNFe)
      : null;

  return {
    modoTransporte: 'sefaz_soap',
    servico: 'NFeConsultaProtocolo4',
    endpointUrl,
    httpStatus: resp.httpStatus,
    indisponivel: ehIndisponivel,
    duracaoMs,
    xmlRequisicao: soapXml,
    xmlResposta: resp.body,
    xmlAutorizado,
    erroRede: ehIndisponivel ? parsed.xMotivo || 'SEFAZ temporariamente indisponível' : null,
    parsed,
  };
}

export async function consultarStatusServicoSefaz(params: {
  uf: string;
  ambiente: AmbienteSefaz;
  pfxBuffer?: Buffer;
  senha?: string;
  cenarioTeste?: CenarioSimulacaoSefaz;
  modoTransporte?: ModoTransporteSefaz;
}): Promise<ResultadoChamadaSefaz> {
  const modo = resolverModoTransporte(params.ambiente, params.cenarioTeste, params.modoTransporte);
  const endpointUrl = resolverUrlSefaz(params.uf, params.ambiente, 'NFeStatusServico4');
  const soapXml = montarEnvelopeSoapStatusServico(params.uf, params.ambiente);

  if (modo === 'simulado') {
    const inicio = Date.now();
    const dhRecbto = formatarDataHoraSefaz();
    const cUF = obterCodigoIbgeUf(params.uf);

    if (params.cenarioTeste === 'indisponivel') {
      const xmlResposta =
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
        `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">` +
        `<retConsStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
        `<tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><cStat>108</cStat>` +
        `<xMotivo>Servico Paralisado Momentaneamente (Simulado)</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto>` +
        `</retConsStatServ></nfeResultMsg></soap12:Body></soap12:Envelope>`;
      return {
        modoTransporte: 'simulado',
        servico: 'NFeStatusServico4',
        endpointUrl,
        httpStatus: 503,
        indisponivel: true,
        duracaoMs: Date.now() - inicio,
        xmlRequisicao: soapXml,
        xmlResposta,
        xmlAutorizado: null,
        erroRede: 'Serviço SEFAZ indisponível (Simulado).',
        parsed: parsearRetornoSefazXml(xmlResposta),
      };
    }

    const xmlResposta =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
      `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">` +
      `<retConsStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
      `<tpAmb>2</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><cStat>107</cStat>` +
      `<xMotivo>Servico em Operacao (Homologacao Simulada)</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto><tMed>1</tMed>` +
      `</retConsStatServ></nfeResultMsg></soap12:Body></soap12:Envelope>`;

    return {
      modoTransporte: 'simulado',
      servico: 'NFeStatusServico4',
      endpointUrl,
      httpStatus: 200,
      indisponivel: false,
      duracaoMs: Date.now() - inicio,
      xmlRequisicao: soapXml,
      xmlResposta,
      xmlAutorizado: null,
      erroRede: null,
      parsed: parsearRetornoSefazXml(xmlResposta),
    };
  }

  if (!params.pfxBuffer || !params.senha) {
    throw Object.assign(
      new Error('Certificado A1 (PFX e senha) é obrigatório para testar conexão real com a SEFAZ.'),
      { statusCode: 400 }
    );
  }

  const inicio = Date.now();
  const resp = await enviarSoapMtls({
    endpointUrl,
    soapXml,
    pfxBuffer: params.pfxBuffer,
    senha: params.senha,
  });
  const duracaoMs = Date.now() - inicio;

  if (resp.indisponivel || !resp.body) {
    return {
      modoTransporte: 'sefaz_soap',
      servico: 'NFeStatusServico4',
      endpointUrl,
      httpStatus: resp.httpStatus,
      indisponivel: true,
      duracaoMs,
      xmlRequisicao: soapXml,
      xmlResposta: resp.body,
      xmlAutorizado: null,
      erroRede: resp.erroRede,
      parsed: {
        cStat: '108',
        xMotivo: resp.erroRede || 'SEFAZ indisponível',
        nProt: null,
        nRec: null,
        dhRecbto: null,
        chNFe: null,
        digVal: null,
        cUF: obterCodigoIbgeUf(params.uf),
        xmlProtNFe: null,
        interpretacao: interpretarCodigoSefaz('108', resp.erroRede),
      },
    };
  }

  const parsed = parsearRetornoSefazXml(resp.body);
  const ehIndisponivel = parsed.interpretacao.categoria === 'indisponivel';

  return {
    modoTransporte: 'sefaz_soap',
    servico: 'NFeStatusServico4',
    endpointUrl,
    httpStatus: resp.httpStatus,
    indisponivel: ehIndisponivel,
    duracaoMs,
    xmlRequisicao: soapXml,
    xmlResposta: resp.body,
    xmlAutorizado: null,
    erroRede: ehIndisponivel ? parsed.xMotivo || 'SEFAZ indisponível' : null,
    parsed,
  };
}

// ─── Eventos (Cancelamento / Carta de Correção) e Inutilização (Story 33f) ─────

export const CONDICAO_USO_CCE_OFICIAL =
  'A Carta de Correcao destina-se a regularizar erro em campos especificos da NF-e, vedada alteracao de variaveis de calculo do imposto, dados cadastrais que mudem remetente ou destinatario, ou data de emissao e saida.';

export function resolverUrlEventoOuInutilizacao(
  ufInput: string | null | undefined,
  ambiente: AmbienteSefaz,
  tipo: 'evento' | 'inutilizacao'
): string {
  const statusUrl = resolverUrlSefaz(ufInput, ambiente, 'NFeStatusServico4');
  if (statusUrl.includes('nfestatusservico4')) {
    return statusUrl.replace(
      'nfestatusservico4',
      tipo === 'evento' ? 'nferecepcaoevento4' : 'nfeinutilizacao4'
    );
  }
  if (statusUrl.includes('/NfeStatusServico/')) {
    return statusUrl.replace(
      '/NfeStatusServico/NFeStatusServico4.asmx',
      tipo === 'evento'
        ? '/recepcaoEvento/recepcaoEvento4.asmx'
        : '/NfeInutilizacao/NFeInutilizacao4.asmx'
    );
  }
  return statusUrl.replace(
    /NFeStatusServico4/g,
    tipo === 'evento' ? 'NFeRecepcaoEvento4' : 'NFeInutilizacao4'
  );
}

export function montarXmlEventoNFe(params: {
  ambiente: AmbienteSefaz;
  uf: string;
  cnpj: string;
  chaveAcesso: string;
  tpEvento: '110111' | '110110';
  nSeqEvento: number;
  descEvento: string;
  protocoloNFe?: string | null;
  justificativa?: string | null;
  textoCorrecao?: string | null;
}): { idInfEvento: string; xmlEvento: string } {
  const tpAmb = params.ambiente === 'producao' ? '1' : '2';
  const cOrgao = obterCodigoIbgeUf(params.uf);
  const cnpj = params.cnpj.replace(/\D/g, '').padStart(14, '0').slice(-14);
  const chNFe = params.chaveAcesso.replace(/\D/g, '');
  const seqStr = String(params.nSeqEvento).padStart(2, '0');
  const idInfEvento = `ID${params.tpEvento}${chNFe}${seqStr}`;
  const dhEvento = formatarDataHoraSefaz();

  const detInterno =
    params.tpEvento === '110111'
      ? `<nProt>${escaparXml(params.protocoloNFe || '')}</nProt>` +
        `<xJust>${escaparXml((params.justificativa || '').trim())}</xJust>`
      : `<xCorrecao>${escaparXml((params.textoCorrecao || '').trim())}</xCorrecao>` +
        `<xCondUso>${escaparXml(CONDICAO_USO_CCE_OFICIAL)}</xCondUso>`;

  const xmlEvento =
    `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
      `<infEvento Id="${idInfEvento}">` +
        `<cOrgao>${cOrgao}</cOrgao>` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<CNPJ>${cnpj}</CNPJ>` +
        `<chNFe>${chNFe}</chNFe>` +
        `<dhEvento>${dhEvento}</dhEvento>` +
        `<tpEvento>${params.tpEvento}</tpEvento>` +
        `<nSeqEvento>${params.nSeqEvento}</nSeqEvento>` +
        `<verEvento>1.00</verEvento>` +
        `<detEvento versao="1.00">` +
          `<descEvento>${escaparXml(params.descEvento)}</descEvento>` +
          `${detInterno}` +
        `</detEvento>` +
      `</infEvento>` +
    `</evento>`;

  return { idInfEvento, xmlEvento };
}

export function montarXmlInutilizacaoNFe(params: {
  ambiente: AmbienteSefaz;
  uf: string;
  ano: string;
  cnpj: string;
  serie: number;
  numeroInicial: number;
  numeroFinal: number;
  justificativa: string;
}): { idInfInut: string; xmlInut: string } {
  const tpAmb = params.ambiente === 'producao' ? '1' : '2';
  const cUF = obterCodigoIbgeUf(params.uf);
  const ano = String(params.ano).replace(/\D/g, '').slice(-2).padStart(2, '0');
  const cnpj = params.cnpj.replace(/\D/g, '').padStart(14, '0').slice(-14);
  const seriePad = String(params.serie).padStart(3, '0');
  const iniPad = String(params.numeroInicial).padStart(9, '0');
  const fimPad = String(params.numeroFinal).padStart(9, '0');
  const idInfInut = `ID${cUF}${ano}${cnpj}55${seriePad}${iniPad}${fimPad}`;

  const xmlInut =
    `<inutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
      `<infInut Id="${idInfInut}">` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<xServ>INUTILIZAR</xServ>` +
        `<cUF>${cUF}</cUF>` +
        `<ano>${ano}</ano>` +
        `<CNPJ>${cnpj}</CNPJ>` +
        `<mod>55</mod>` +
        `<serie>${params.serie}</serie>` +
        `<nNFIni>${params.numeroInicial}</nNFIni>` +
        `<nNFFin>${params.numeroFinal}</nNFFin>` +
        `<xJust>${escaparXml(params.justificativa.trim())}</xJust>` +
      `</infInut>` +
    `</inutNFe>`;

  return { idInfInut, xmlInut };
}

function montarEnvelopeSoapRecepcaoEvento(xmlEventoAssinado: string, idLote?: string): string {
  const eventoSemDecl = removerDeclaracaoXml(xmlEventoAssinado);
  const lote = (idLote || String(Date.now()).slice(-15)).replace(/\D/g, '').slice(0, 15) || '1';
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">` +
    `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
    `<idLote>${lote}</idLote>` +
    `${eventoSemDecl}` +
    `</envEvento>` +
    `</nfeDadosMsg>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}

function montarEnvelopeSoapInutilizacao(xmlInutAssinado: string): string {
  const inutSemDecl = removerDeclaracaoXml(xmlInutAssinado);
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4">` +
    `${inutSemDecl}` +
    `</nfeDadosMsg>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}

function montarXmlProcEventoNFe(xmlEventoAssinado: string, xmlRetEvento: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
    `${removerDeclaracaoXml(xmlEventoAssinado)}` +
    `${removerDeclaracaoXml(xmlRetEvento)}` +
    `</procEventoNFe>`
  );
}

function montarXmlProcInutNFe(xmlInutAssinado: string, xmlRetInutNFe: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<procInutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `${removerDeclaracaoXml(xmlInutAssinado)}` +
    `${removerDeclaracaoXml(xmlRetInutNFe)}` +
    `</procInutNFe>`
  );
}

export function parsearRetornoEventoSefazXml(xmlResposta: string) {
  const xmlRetEvento = extrairBlocoCompleto(xmlResposta, 'retEvento');
  const blocoInf = xmlRetEvento ? extrairBlocoCompleto(xmlRetEvento, 'infEvento') : xmlResposta;
  const target = blocoInf || xmlResposta;
  const cStat = extrairTagSimples(target, 'cStat') || extrairTagSimples(xmlResposta, 'cStat');
  const xMotivo = extrairTagSimples(target, 'xMotivo') || extrairTagSimples(xmlResposta, 'xMotivo');
  const nProt = extrairTagSimples(target, 'nProt');
  const dhRegEvento = extrairTagSimples(target, 'dhRegEvento');
  const chNFe = extrairTagSimples(target, 'chNFe');

  return {
    cStat,
    xMotivo,
    nProt,
    dhRegEvento,
    chNFe,
    xmlRetEvento,
    interpretacao: interpretarCodigoSefaz(cStat || '000', xMotivo),
  };
}

export function parsearRetornoInutilizacaoSefazXml(xmlResposta: string) {
  const xmlRetInut = extrairBlocoCompleto(xmlResposta, 'retInutNFe');
  const blocoInf = xmlRetInut ? extrairBlocoCompleto(xmlRetInut, 'infInut') : xmlResposta;
  const target = blocoInf || xmlResposta;
  const cStat = extrairTagSimples(target, 'cStat') || extrairTagSimples(xmlResposta, 'cStat');
  const xMotivo = extrairTagSimples(target, 'xMotivo') || extrairTagSimples(xmlResposta, 'xMotivo');
  const nProt = extrairTagSimples(target, 'nProt');
  const dhRecbto = extrairTagSimples(target, 'dhRecbto');

  return {
    cStat,
    xMotivo,
    nProt,
    dhRecbto,
    xmlRetInut,
    interpretacao: interpretarCodigoSefaz(cStat || '000', xMotivo),
  };
}

export interface ResultadoEventoOuInutSefaz {
  modoTransporte: ModoTransporteSefaz;
  endpointUrl: string;
  httpStatus: number | null;
  indisponivel: boolean;
  duracaoMs: number;
  xmlRequisicao: string;
  xmlResposta: string | null;
  xmlProcAutorizado: string | null;
  erroRede: string | null;
  cStat: string | null;
  xMotivo: string | null;
  nProt: string | null;
  interpretacao: ReturnType<typeof interpretarCodigoSefaz>;
}

export async function enviarEventoSefaz(params: {
  uf: string;
  ambiente: AmbienteSefaz;
  chaveAcesso: string;
  tpEvento: '110111' | '110110';
  nSeqEvento: number;
  xmlEventoAssinado: string;
  pfxBuffer?: Buffer;
  senha?: string;
  cenarioTeste?: CenarioSimulacaoSefaz;
  cStatSimulado?: string;
  xMotivoSimulado?: string;
  modoTransporte?: ModoTransporteSefaz;
}): Promise<ResultadoEventoOuInutSefaz> {
  const modo = resolverModoTransporte(params.ambiente, params.cenarioTeste, params.modoTransporte);
  const endpointUrl = resolverUrlEventoOuInutilizacao(params.uf, params.ambiente, 'evento');
  const soapXml = montarEnvelopeSoapRecepcaoEvento(params.xmlEventoAssinado);

  if (modo === 'simulado') {
    const inicio = Date.now();
    const dhRegEvento = formatarDataHoraSefaz();
    const cOrgao = obterCodigoIbgeUf(params.uf);

    if (params.cenarioTeste === 'indisponivel') {
      const errMsg = 'SEFAZ Recepção Evento indisponível (Simulado HTTP 503).';
      return {
        modoTransporte: 'simulado',
        endpointUrl,
        httpStatus: 503,
        indisponivel: true,
        duracaoMs: Date.now() - inicio,
        xmlRequisicao: soapXml,
        xmlResposta: null,
        xmlProcAutorizado: null,
        erroRede: errMsg,
        cStat: '108',
        xMotivo: errMsg,
        nProt: null,
        interpretacao: interpretarCodigoSefaz('108', errMsg),
      };
    }

    if (params.cenarioTeste === 'rejeitada') {
      const cStat = params.cStatSimulado || (params.tpEvento === '110111' ? '501' : '573');
      const xMotivo =
        params.xMotivoSimulado ||
        (cStat === '501'
          ? 'Rejeicao: Prazo de Cancelamento Superior ao Previsto na Legislacao [Simulado]'
          : 'Rejeicao: Duplicidade de Evento [Simulado]');
      const retEvt =
        `<retEvento versao="1.00"><infEvento>` +
        `<tpAmb>2</tpAmb><verAplic>SP_EVENTOS_V1</verAplic><cOrgao>${cOrgao}</cOrgao>` +
        `<cStat>${cStat}</cStat><xMotivo>${escaparXml(xMotivo)}</xMotivo>` +
        `<chNFe>${params.chaveAcesso}</chNFe><tpEvento>${params.tpEvento}</tpEvento>` +
        `<nSeqEvento>${params.nSeqEvento}</nSeqEvento><dhRegEvento>${dhRegEvento}</dhRegEvento>` +
        `</infEvento></retEvento>`;
      const xmlResposta =
        `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
        `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">` +
        `<retEnvEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><cStat>128</cStat><xMotivo>Lote de Evento Processado</xMotivo>${retEvt}</retEnvEvento>` +
        `</nfeResultMsg></soap12:Body></soap12:Envelope>`;
      const parsed = parsearRetornoEventoSefazXml(xmlResposta);
      return {
        modoTransporte: 'simulado',
        endpointUrl,
        httpStatus: 200,
        indisponivel: false,
        duracaoMs: Date.now() - inicio,
        xmlRequisicao: soapXml,
        xmlResposta,
        xmlProcAutorizado: null,
        erroRede: null,
        cStat: parsed.cStat,
        xMotivo: parsed.xMotivo,
        nProt: null,
        interpretacao: parsed.interpretacao,
      };
    }

    const nProt = gerarNumeroProtocoloSimulado(params.uf);
    const cStat = params.cStatSimulado || '135';
    const xMotivo = params.xMotivoSimulado || 'Evento registrado e vinculado a NF-e';
    const retEvt =
      `<retEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento>` +
      `<tpAmb>2</tpAmb><verAplic>SP_EVENTOS_V1</verAplic><cOrgao>${cOrgao}</cOrgao>` +
      `<cStat>${cStat}</cStat><xMotivo>${escaparXml(xMotivo)}</xMotivo>` +
      `<chNFe>${params.chaveAcesso}</chNFe><tpEvento>${params.tpEvento}</tpEvento>` +
      `<nSeqEvento>${params.nSeqEvento}</nSeqEvento><dhRegEvento>${dhRegEvento}</dhRegEvento>` +
      `<nProt>${nProt}</nProt></infEvento></retEvento>`;
    const xmlResposta =
      `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
      `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">` +
      `<retEnvEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><cStat>128</cStat><xMotivo>Lote de Evento Processado</xMotivo>${retEvt}</retEnvEvento>` +
      `</nfeResultMsg></soap12:Body></soap12:Envelope>`;
    const parsed = parsearRetornoEventoSefazXml(xmlResposta);

    return {
      modoTransporte: 'simulado',
      endpointUrl,
      httpStatus: 200,
      indisponivel: false,
      duracaoMs: Date.now() - inicio,
      xmlRequisicao: soapXml,
      xmlResposta,
      xmlProcAutorizado: montarXmlProcEventoNFe(params.xmlEventoAssinado, retEvt),
      erroRede: null,
      cStat: parsed.cStat,
      xMotivo: parsed.xMotivo,
      nProt: parsed.nProt,
      interpretacao: parsed.interpretacao,
    };
  }

  if (!params.pfxBuffer || !params.senha) {
    throw Object.assign(
      new Error('Certificado A1 (PFX e senha) obrigatório para enviar eventos à SEFAZ.'),
      { statusCode: 400 }
    );
  }

  const inicio = Date.now();
  const resp = await enviarSoapMtls({
    endpointUrl,
    soapXml,
    pfxBuffer: params.pfxBuffer,
    senha: params.senha,
  });
  const duracaoMs = Date.now() - inicio;

  if (resp.indisponivel || !resp.body) {
    return {
      modoTransporte: 'sefaz_soap',
      endpointUrl,
      httpStatus: resp.httpStatus,
      indisponivel: true,
      duracaoMs,
      xmlRequisicao: soapXml,
      xmlResposta: resp.body,
      xmlProcAutorizado: null,
      erroRede: resp.erroRede,
      cStat: '108',
      xMotivo: resp.erroRede || 'SEFAZ indisponível',
      nProt: null,
      interpretacao: interpretarCodigoSefaz('108', resp.erroRede),
    };
  }

  const parsed = parsearRetornoEventoSefazXml(resp.body);
  const ehIndisponivel = parsed.interpretacao.categoria === 'indisponivel';
  const ehAutorizada = parsed.interpretacao.categoria === 'autorizada';

  return {
    modoTransporte: 'sefaz_soap',
    endpointUrl,
    httpStatus: resp.httpStatus,
    indisponivel: ehIndisponivel,
    duracaoMs,
    xmlRequisicao: soapXml,
    xmlResposta: resp.body,
    xmlProcAutorizado:
      ehAutorizada && parsed.xmlRetEvento
        ? montarXmlProcEventoNFe(params.xmlEventoAssinado, parsed.xmlRetEvento)
        : null,
    erroRede: ehIndisponivel ? parsed.xMotivo || 'SEFAZ indisponível' : null,
    cStat: parsed.cStat,
    xMotivo: parsed.xMotivo,
    nProt: parsed.nProt,
    interpretacao: parsed.interpretacao,
  };
}

export async function enviarInutilizacaoSefaz(params: {
  uf: string;
  ambiente: AmbienteSefaz;
  xmlInutAssinado: string;
  pfxBuffer?: Buffer;
  senha?: string;
  cenarioTeste?: CenarioSimulacaoSefaz;
  cStatSimulado?: string;
  xMotivoSimulado?: string;
  modoTransporte?: ModoTransporteSefaz;
}): Promise<ResultadoEventoOuInutSefaz> {
  const modo = resolverModoTransporte(params.ambiente, params.cenarioTeste, params.modoTransporte);
  const endpointUrl = resolverUrlEventoOuInutilizacao(params.uf, params.ambiente, 'inutilizacao');
  const soapXml = montarEnvelopeSoapInutilizacao(params.xmlInutAssinado);

  if (modo === 'simulado') {
    const inicio = Date.now();
    const dhRecbto = formatarDataHoraSefaz();
    const cUF = obterCodigoIbgeUf(params.uf);

    if (params.cenarioTeste === 'indisponivel') {
      const errMsg = 'SEFAZ Inutilização indisponível (Simulado HTTP 503).';
      return {
        modoTransporte: 'simulado',
        endpointUrl,
        httpStatus: 503,
        indisponivel: true,
        duracaoMs: Date.now() - inicio,
        xmlRequisicao: soapXml,
        xmlResposta: null,
        xmlProcAutorizado: null,
        erroRede: errMsg,
        cStat: '108',
        xMotivo: errMsg,
        nProt: null,
        interpretacao: interpretarCodigoSefaz('108', errMsg),
      };
    }

    if (params.cenarioTeste === 'rejeitada') {
      const cStat = params.cStatSimulado || '563';
      const xMotivo =
        params.xMotivoSimulado ||
        'Rejeicao: Ja existe pedido de Inutilizacao com a mesma faixa de inutilizacao [Simulado]';
      const retInut =
        `<retInutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><infInut>` +
        `<tpAmb>2</tpAmb><verAplic>SP_NFE_V4</verAplic><cStat>${cStat}</cStat>` +
        `<xMotivo>${escaparXml(xMotivo)}</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto>` +
        `</infInut></retInutNFe>`;
      const xmlResposta =
        `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
        `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4">${retInut}</nfeResultMsg>` +
        `</soap12:Body></soap12:Envelope>`;
      const parsed = parsearRetornoInutilizacaoSefazXml(xmlResposta);
      return {
        modoTransporte: 'simulado',
        endpointUrl,
        httpStatus: 200,
        indisponivel: false,
        duracaoMs: Date.now() - inicio,
        xmlRequisicao: soapXml,
        xmlResposta,
        xmlProcAutorizado: null,
        erroRede: null,
        cStat: parsed.cStat,
        xMotivo: parsed.xMotivo,
        nProt: null,
        interpretacao: parsed.interpretacao,
      };
    }

    const nProt = gerarNumeroProtocoloSimulado(params.uf);
    const cStat = params.cStatSimulado || '102';
    const xMotivo = params.xMotivoSimulado || 'Inutilizacao de numero homologado';
    const retInut =
      `<retInutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><infInut>` +
      `<tpAmb>2</tpAmb><verAplic>SP_NFE_V4</verAplic><cStat>${cStat}</cStat>` +
      `<xMotivo>${escaparXml(xMotivo)}</xMotivo><cUF>${cUF}</cUF><dhRecbto>${dhRecbto}</dhRecbto>` +
      `<nProt>${nProt}</nProt></infInut></retInutNFe>`;
    const xmlResposta =
      `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>` +
      `<nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4">${retInut}</nfeResultMsg>` +
      `</soap12:Body></soap12:Envelope>`;
    const parsed = parsearRetornoInutilizacaoSefazXml(xmlResposta);

    return {
      modoTransporte: 'simulado',
      endpointUrl,
      httpStatus: 200,
      indisponivel: false,
      duracaoMs: Date.now() - inicio,
      xmlRequisicao: soapXml,
      xmlResposta,
      xmlProcAutorizado: montarXmlProcInutNFe(params.xmlInutAssinado, retInut),
      erroRede: null,
      cStat: parsed.cStat,
      xMotivo: parsed.xMotivo,
      nProt: parsed.nProt,
      interpretacao: parsed.interpretacao,
    };
  }

  if (!params.pfxBuffer || !params.senha) {
    throw Object.assign(
      new Error('Certificado A1 (PFX e senha) obrigatório para inutilizar numeração na SEFAZ.'),
      { statusCode: 400 }
    );
  }

  const inicio = Date.now();
  const resp = await enviarSoapMtls({
    endpointUrl,
    soapXml,
    pfxBuffer: params.pfxBuffer,
    senha: params.senha,
  });
  const duracaoMs = Date.now() - inicio;

  if (resp.indisponivel || !resp.body) {
    return {
      modoTransporte: 'sefaz_soap',
      endpointUrl,
      httpStatus: resp.httpStatus,
      indisponivel: true,
      duracaoMs,
      xmlRequisicao: soapXml,
      xmlResposta: resp.body,
      xmlProcAutorizado: null,
      erroRede: resp.erroRede,
      cStat: '108',
      xMotivo: resp.erroRede || 'SEFAZ indisponível',
      nProt: null,
      interpretacao: interpretarCodigoSefaz('108', resp.erroRede),
    };
  }

  const parsed = parsearRetornoInutilizacaoSefazXml(resp.body);
  const ehIndisponivel = parsed.interpretacao.categoria === 'indisponivel';
  const ehAutorizada = parsed.interpretacao.categoria === 'autorizada';

  return {
    modoTransporte: 'sefaz_soap',
    endpointUrl,
    httpStatus: resp.httpStatus,
    indisponivel: ehIndisponivel,
    duracaoMs,
    xmlRequisicao: soapXml,
    xmlResposta: resp.body,
    xmlProcAutorizado:
      ehAutorizada && parsed.xmlRetInut
        ? montarXmlProcInutNFe(params.xmlInutAssinado, parsed.xmlRetInut)
        : null,
    erroRede: ehIndisponivel ? parsed.xMotivo || 'SEFAZ indisponível' : null,
    cStat: parsed.cStat,
    xMotivo: parsed.xMotivo,
    nProt: parsed.nProt,
    interpretacao: parsed.interpretacao,
  };
}

