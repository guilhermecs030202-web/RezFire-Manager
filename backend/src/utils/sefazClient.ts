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

