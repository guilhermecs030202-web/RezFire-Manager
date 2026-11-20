import { NotaFiscal } from '../entities/NotaFiscal';

/**
 * Tabela oficial ISO/IEC 15417 (Code-128) — larguras intercaladas [B1, S1, B2, S2, B3, S3].
 * Índices 0..105 somam 11 módulos; Stop (106) soma 13 módulos [B1..B4].
 */
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const CODE128_START_C = 105;
const CODE128_STOP = 106;

function escapeHtml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extrairTagXml(xml: string | null | undefined, tag: string): string | null {
  if (!xml) return null;
  const rx = new RegExp(`<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`, 'i');
  const m = rx.exec(xml);
  return m ? m[1].trim() : null;
}

export function formatarChaveAcesso(chave: string | null | undefined): string {
  const digits = String(chave || '').replace(/\D/g, '');
  if (!digits) return '—';
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatarCnpjCpf(doc: string | null | undefined): string {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return d || '—';
}

export function formatarCep(cep: string | null | undefined): string {
  const d = String(cep || '').replace(/\D/g, '');
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return d || '—';
}

export function formatarNumeroNFe(numero: number | string | null | undefined): string {
  const n = String(Number(numero || 0)).padStart(9, '0');
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}`;
}

export function formatarMoedaBr(val: number | string | null | undefined): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatarQtdBr(val: number | string | null | undefined): string {
  const n = Number(val || 0);
  return Number.isInteger(n)
    ? n.toLocaleString('pt-BR')
    : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function formatarDataBr(input: Date | string | null | undefined): string {
  if (!input) return '—';
  const dt = typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)
    ? new Date(`${input}T12:00:00Z`)
    : new Date(input);
  if (Number.isNaN(dt.getTime())) return String(input);
  return dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function formatarDataHoraBr(input: Date | string | null | undefined): { data: string; hora: string; completo: string } {
  if (!input) return { data: '—', hora: '—', completo: '—' };
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return { data: String(input), hora: '', completo: String(input) };
  const data = dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const hora = dt.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return { data, hora, completo: `${data} ${hora}` };
}

function descreverModFrete(codigo: string | null): string {
  switch (codigo) {
    case '0':
      return '0 - Por conta do Remetente (CIF)';
    case '1':
      return '1 - Por conta do Destinatário (FOB)';
    case '2':
      return '2 - Por conta de Terceiros';
    case '3':
      return '3 - Transporte Próprio Remetente';
    case '4':
      return '4 - Transporte Próprio Destinatário';
    case '9':
      return '9 - Sem Ocorrência de Transporte';
    default:
      return '0 - Por conta do Remetente';
  }
}

function descreverRegime(crt: string | undefined): string {
  if (crt === '1') return '1 - Simples Nacional';
  if (crt === '2') return '2 - Simples Nacional (Excesso Sublimite)';
  if (crt === '3') return '3 - Regime Normal';
  if (crt === '4') return '4 - Simples Nacional - MEI';
  return crt || '1 - Simples Nacional';
}

/**
 * Gera código de barras ISO/IEC 15417 Code-128 Set C em SVG vetorial puro
 * para a Chave de Acesso NF-e de 44 dígitos (22 pares numéricos).
 */
export function gerarBarcodeCode128CSvg(chave44: string): string {
  const digits = String(chave44 || '').replace(/\D/g, '');
  if (!/^\d{44}$/.test(digits)) {
    throw new Error('Chave de acesso inválida para geração do código de barras Code-128C.');
  }

  const codes: number[] = [CODE128_START_C];
  let checksum = CODE128_START_C;

  for (let i = 0; i < 22; i++) {
    const val = parseInt(digits.slice(i * 2, i * 2 + 2), 10);
    codes.push(val);
    checksum += (i + 1) * val;
  }

  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(CODE128_STOP);

  const quietZone = 10;
  let cursorX = quietZone;
  const height = 46;
  const rects: string[] = [];

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let idx = 0; idx < pattern.length; idx++) {
      const width = Number(pattern[idx]);
      if (idx % 2 === 0) {
        rects.push(`<rect x="${cursorX}" y="0" width="${width}" height="${height}" fill="#111827"/>`);
      }
      cursorX += width;
    }
  }

  const totalWidth = cursorX + quietZone;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" ` +
    `preserveAspectRatio="none" role="img" aria-label="Código de barras Code-128C da Chave de Acesso" ` +
    `style="width:100%;height:38px;display:block;background:#ffffff;">` +
    rects.join('') +
    `</svg>`
  );
}

/**
 * Gera HTML A4 oficial de DANFE (MOC NF-e v4.00) utilizando exclusivamente os snapshots
 * imutáveis persistidos na entidade NotaFiscal (sem depender de dados mutáveis do Pedido/Produto).
 */
export function gerarHtmlDanfe(nota: NotaFiscal): string {
  if (!nota.chave_acesso || !/^\d{44}$/.test(nota.chave_acesso)) {
    throw new Error('NF-e não possui chave de acesso válida de 44 dígitos para gerar DANFE.');
  }
  if (!nota.protocolo_autorizacao) {
    throw new Error('NF-e ainda não possui protocolo de autorização da SEFAZ para gerar DANFE.');
  }

  const emit = (nota.emitente_snapshot || {}) as Record<string, any>;
  const dest = (nota.destinatario_snapshot || {}) as Record<string, any>;
  const tot = (nota.totais_snapshot || {}) as Record<string, any>;
  const imp = (nota.impostos_snapshot || {}) as Record<string, any>;
  const itens = Array.isArray(nota.itens) ? nota.itens : [];

  const xmlFonte = nota.xml_autorizado || nota.xml_assinado || '';
  const natOp = extrairTagXml(xmlFonte, 'natOp') || 'VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS';
  const modFrete = extrairTagXml(xmlFonte, 'modFrete');
  const dhEmiXml = extrairTagXml(xmlFonte, 'dhEmi');
  const dhRecbtoXml = extrairTagXml(xmlFonte, 'dhRecbto');
  const infCplXml = extrairTagXml(xmlFonte, 'infCpl');

  const emissaoBr = formatarDataHoraBr(dhEmiXml || nota.emitida_em || nota.assinada_em || nota.created_at);
  const autBr = formatarDataHoraBr(dhRecbtoXml || nota.autorizada_em || nota.emitida_em);
  const chaveFormatada = formatarChaveAcesso(nota.chave_acesso);
  const barcodeSvg = gerarBarcodeCode128CSvg(nota.chave_acesso);
  const numeroFormatado = formatarNumeroNFe(nota.numero);
  const serieFormatada = String(nota.serie || 1).padStart(3, '0');
  const isHomologacao = nota.ambiente === 'homologacao';
  const isCancelada = nota.status === 'cancelada';

  const marcaDaguaTexto = isCancelada
    ? 'NF-e CANCELADA — SEM VALOR FISCAL'
    : isHomologacao
      ? 'SEM VALOR FISCAL — EMITIDA EM HOMOLOGAÇÃO'
      : '';

  const linhasItensHtml = itens.length > 0
    ? itens
        .map((it) => {
          const icmsUnit = Number(it.valor_total || 0) * 0;
          return `
            <tr>
              <td class="mono">${escapeHtml(it.sku_snapshot)}</td>
              <td>${escapeHtml(it.nome_snapshot)}</td>
              <td class="mono tc">${escapeHtml(it.ncm_snapshot)}</td>
              <td class="mono tc">${escapeHtml(it.origem_snapshot || '0')}${escapeHtml(it.cst_csosn_snapshot)}</td>
              <td class="mono tc">${escapeHtml(it.cfop_snapshot)}</td>
              <td class="tc">${escapeHtml(it.unidade_snapshot || 'UN')}</td>
              <td class="tr">${formatarQtdBr(it.quantidade)}</td>
              <td class="tr">${formatarMoedaBr(it.valor_unitario)}</td>
              <td class="tr">${formatarMoedaBr(it.valor_total)}</td>
              <td class="tr">${formatarMoedaBr(icmsUnit)}</td>
              <td class="tr">0,00</td>
              <td class="tr">0,00</td>
              <td class="tr">0,00</td>
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="13" class="tc" style="padding:12px;">Nenhum item registrado no snapshot desta nota.</td></tr>`;

  const infoComplementarPartes = [
    infCplXml || null,
    nota.codigo_pedido_snapshot ? `Pedido de Origem: ${nota.codigo_pedido_snapshot}` : null,
    `Regime Tributário: ${descreverRegime(emit.regime_tributario)}`,
    Number(tot.vTotTrib || 0) > 0
      ? `Val Aprox dos Tributos: R$ ${formatarMoedaBr(tot.vTotTrib)} (Fonte IBPT/Simples - Lei 12.741/2012)`
      : null,
    nota.guarda_legal_ate ? `Guarda legal obrigatória até ${formatarDataBr(nota.guarda_legal_ate)}` : null,
    nota.xml_autorizado_sha256 ? `SHA-256 XML: ${nota.xml_autorizado_sha256}` : null,
    imp?.nota ? String(imp.nota) : null,
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DANFE NF-e Nº ${escapeHtml(numeroFormatado)} Série ${escapeHtml(serieFormatada)} · RezFire</title>
  <style>
    @page { size: A4 portrait; margin: 6mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      background: #e5e7eb;
      font-size: 9px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print-bar {
      position: sticky;
      top: 0;
      z-index: 30;
      background: #1a1412;
      color: #f4efe8;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    }
    .no-print-title {
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .no-print-badge {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 999px;
      background: ${isCancelada ? '#991b1b' : isHomologacao ? '#b45309' : '#065f46'};
      color: #fff;
      font-weight: 800;
    }
    .no-print-actions {
      display: flex;
      gap: 8px;
    }
    .toolbar-btn {
      border: 1px solid rgba(255,255,255,0.22);
      background: #2b221e;
      color: #fff;
      padding: 7px 14px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .toolbar-btn.primary {
      background: #e85c2a;
      border-color: #e85c2a;
    }
    .danfe-page {
      width: 210mm;
      min-height: 297mm;
      margin: 14px auto;
      padding: 6mm;
      background: #ffffff;
      position: relative;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
      overflow: hidden;
    }
    .watermark {
      position: fixed;
      top: 46%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-32deg);
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 2px;
      color: rgba(185, 28, 28, 0.14);
      border: 4px solid rgba(185, 28, 28, 0.14);
      padding: 10px 24px;
      pointer-events: none;
      text-align: center;
      white-space: nowrap;
      z-index: 10;
    }
    .homolog-strip {
      background: ${isCancelada ? '#fef2f2' : '#fffbeb'};
      border: 1px solid ${isCancelada ? '#dc2626' : '#d97706'};
      color: ${isCancelada ? '#991b1b' : '#92400e'};
      text-align: center;
      font-size: 9px;
      font-weight: 800;
      padding: 3px 6px;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .grid-box {
      border: 1px solid #111827;
      width: 100%;
      border-collapse: collapse;
    }
    .canhoto-wrap {
      display: grid;
      grid-template-columns: 1fr 38mm;
      border: 1px solid #111827;
    }
    .canhoto-left {
      display: grid;
      grid-template-rows: auto auto;
      border-right: 1px solid #111827;
    }
    .canhoto-texto {
      padding: 3px 5px;
      border-bottom: 1px solid #111827;
      font-size: 7.5px;
    }
    .canhoto-assinatura {
      display: grid;
      grid-template-columns: 38mm 1fr;
    }
    .canhoto-assinatura > div:first-child {
      border-right: 1px solid #111827;
    }
    .canhoto-right {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 3px 5px;
      text-align: center;
    }
    .cut-line {
      border-top: 1px dashed #4b5563;
      margin: 4px 0;
    }
    .campo {
      padding: 2px 4px;
      vertical-align: top;
      border: 1px solid #111827;
    }
    .lbl {
      display: block;
      font-size: 6.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #374151;
      margin-bottom: 1px;
      letter-spacing: 0.2px;
    }
    .val {
      font-size: 8.5px;
      font-weight: 600;
      color: #111827;
      word-break: break-word;
    }
    .mono {
      font-family: "Courier New", Courier, monospace;
    }
    .tc { text-align: center; }
    .tr { text-align: right; }
    .section-title {
      font-size: 7.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin: 5px 0 2px;
      color: #111827;
    }
    .header-main {
      display: grid;
      grid-template-columns: 42% 18% 40%;
      border: 1px solid #111827;
    }
    .header-col {
      padding: 4px 6px;
    }
    .header-col + .header-col {
      border-left: 1px solid #111827;
    }
    .emit-brand {
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    .danfe-quadro {
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .danfe-quadro h1 {
      margin: 0;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .danfe-quadro .sub {
      font-size: 7px;
      line-height: 1.2;
      margin-bottom: 4px;
    }
    .tipo-op-row {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      margin: 3px 0;
      font-size: 7.5px;
    }
    .tipo-op-box {
      border: 1.5px solid #111827;
      padding: 2px 7px;
      font-size: 11px;
      font-weight: 800;
    }
    .row-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .row-table + .row-table {
      margin-top: -1px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5px;
    }
    .items-table th,
    .items-table td {
      border: 1px solid #111827;
      padding: 2.5px 3px;
      vertical-align: top;
    }
    .items-table th {
      background: #f3f4f6;
      font-size: 6.5px;
      font-weight: 800;
      text-transform: uppercase;
      text-align: center;
    }
    .adicionais-grid {
      display: grid;
      grid-template-columns: 65% 35%;
      border: 1px solid #111827;
      min-height: 22mm;
    }
    .adicionais-left {
      padding: 3px 5px;
      border-right: 1px solid #111827;
    }
    .adicionais-right {
      padding: 3px 5px;
    }
    @media print {
      html, body {
        background: #ffffff;
      }
      .no-print-bar {
        display: none !important;
      }
      .danfe-page {
        margin: 0;
        padding: 0;
        width: auto;
        min-height: auto;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div class="no-print-title">
      <span>DANFE · NF-e Nº ${escapeHtml(numeroFormatado)} (Série ${escapeHtml(serieFormatada)})</span>
      <span class="no-print-badge">${isCancelada ? 'CANCELADA' : isHomologacao ? 'HOMOLOGAÇÃO (SEM VALOR FISCAL)' : 'PRODUÇÃO · AUTORIZADA'}</span>
    </div>
    <div class="no-print-actions">
      <button type="button" class="toolbar-btn primary" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
      <button type="button" class="toolbar-btn" onclick="window.close()">✕ Fechar</button>
    </div>
  </div>

  <div class="danfe-page">
    ${marcaDaguaTexto ? `<div class="watermark">${escapeHtml(marcaDaguaTexto)}</div>` : ''}
    ${marcaDaguaTexto ? `<div class="homolog-strip">${escapeHtml(marcaDaguaTexto)}</div>` : ''}

    <!-- Canhoto destacável -->
    <div class="canhoto-wrap">
      <div class="canhoto-left">
        <div class="canhoto-texto">
          RECEBEMOS DE <strong>${escapeHtml(emit.razao_social || 'REZFIRE')}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA ABAIXO.
          EMISSÃO: <strong>${escapeHtml(emissaoBr.data)}</strong> — VALOR TOTAL: <strong>R$ ${formatarMoedaBr(tot.vNF)}</strong> — DESTINATÁRIO: <strong>${escapeHtml(dest.nome || '—')}</strong>
        </div>
        <div class="canhoto-assinatura">
          <div style="padding:2px 4px;height:8.5mm"><span class="lbl">DATA DE RECEBIMENTO</span></div>
          <div style="padding:2px 4px;height:8.5mm"><span class="lbl">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span></div>
        </div>
      </div>
      <div class="canhoto-right">
        <strong style="font-size:10px;letter-spacing:0.6px;">NF-e</strong>
        <span style="font-size:8.5px;font-weight:700;">Nº ${escapeHtml(numeroFormatado)}</span>
        <span style="font-size:8px;">Série ${escapeHtml(serieFormatada)}</span>
      </div>
    </div>

    <div class="cut-line"></div>

    <!-- Cabeçalho DANFE 3 colunas -->
    <div class="header-main">
      <div class="header-col">
        <span class="lbl">IDENTIFICAÇÃO DO EMITENTE</span>
        <div class="emit-brand">
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink:0;margin-top:2px;">
            <rect width="24" height="24" rx="5" fill="#1a1412"/>
            <path fill="#e85c2a" d="M12.9 3.7c.4 2.4 2.1 3.7 2.4 5.9.2 1.1-.2 2-1 2.7.9-.4 1.5-1.1 1.8-2.1.8 1.4 1.3 2.8 1.3 4.3 0 3.8-2.9 6.7-7.4 6.7s-7.4-2.9-7.4-6.7c0-3 1.7-5 3.4-6.9 1.3-1.4 2-2.4 2.2-3.8 1.3 1.1 2.6 2.9 3.8 2.2-.2-.9-.5-1.6.9-2.3z"/>
          </svg>
          <div>
            <div style="font-size:10px;font-weight:800;line-height:1.15;">${escapeHtml(emit.razao_social || '—')}</div>
            ${emit.nome_fantasia ? `<div style="font-size:8px;color:#4b5563;">${escapeHtml(emit.nome_fantasia)}</div>` : ''}
            <div style="font-size:7.5px;margin-top:3px;">
              ${escapeHtml(emit.endereco || '')}<br/>
              ${escapeHtml(emit.bairro || '')} — CEP ${escapeHtml(formatarCep(emit.cep))}<br/>
              ${escapeHtml(emit.municipio || '')} / ${escapeHtml(emit.uf || '')}
            </div>
          </div>
        </div>
      </div>

      <div class="header-col danfe-quadro">
        <div>
          <h1>DANFE</h1>
          <div class="sub">Documento Auxiliar da Nota Fiscal Eletrônica</div>
        </div>
        <div class="tipo-op-row">
          <div style="text-align:left;font-size:7px;">0 - ENTRADA<br/>1 - SAÍDA</div>
          <div class="tipo-op-box">1</div>
        </div>
        <div style="font-size:8.5px;font-weight:800;">Nº ${escapeHtml(numeroFormatado)}</div>
        <div style="font-size:8px;font-weight:700;">Série ${escapeHtml(serieFormatada)} · Folha 1/1</div>
      </div>

      <div class="header-col">
        <div style="border-bottom:1px solid #cbd5e1;padding-bottom:3px;margin-bottom:3px;">
          ${barcodeSvg}
        </div>
        <span class="lbl">CHAVE DE ACESSO</span>
        <div class="val mono tc" style="font-size:8px;font-weight:700;margin-bottom:4px;">${escapeHtml(chaveFormatada)}</div>
        <div style="font-size:7px;color:#374151;text-align:center;">
          Consulta de autenticidade no portal nacional da NF-e<br/>
          <strong>www.nfe.fazenda.gov.br/portal</strong> ou no site da SEFAZ Autorizadora
        </div>
      </div>
    </div>

    <!-- Natureza da Operação + Protocolo + CNPJ/IE -->
    <table class="row-table" style="margin-top:-1px;">
      <tr>
        <td class="campo" style="width:58%;"><span class="lbl">NATUREZA DA OPERAÇÃO</span><span class="val">${escapeHtml(natOp)}</span></td>
        <td class="campo" style="width:42%;"><span class="lbl">PROTOCOLO DE AUTORIZAÇÃO DE USO</span><span class="val mono">${escapeHtml(nota.protocolo_autorizacao)} — ${escapeHtml(autBr.completo)}</span></td>
      </tr>
    </table>
    <table class="row-table">
      <tr>
        <td class="campo" style="width:34%;"><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val mono">${escapeHtml(emit.inscricao_estadual || 'ISENTO')}</span></td>
        <td class="campo" style="width:33%;"><span class="lbl">INSCRIÇÃO ESTADUAL DO SUBST. TRIB.</span><span class="val">&nbsp;</span></td>
        <td class="campo" style="width:33%;"><span class="lbl">CNPJ</span><span class="val mono">${escapeHtml(formatarCnpjCpf(emit.cnpj))}</span></td>
      </tr>
    </table>

    <!-- Destinatário / Remetente -->
    <div class="section-title">DESTINATÁRIO / REMETENTE</div>
    <table class="row-table">
      <tr>
        <td class="campo" style="width:58%;"><span class="lbl">NOME / RAZÃO SOCIAL</span><span class="val">${escapeHtml(dest.nome || '—')}</span></td>
        <td class="campo" style="width:24%;"><span class="lbl">CNPJ / CPF</span><span class="val mono">${escapeHtml(formatarCnpjCpf(dest.documento))}</span></td>
        <td class="campo" style="width:18%;"><span class="lbl">DATA DA EMISSÃO</span><span class="val tc">${escapeHtml(emissaoBr.data)}</span></td>
      </tr>
    </table>
    <table class="row-table">
      <tr>
        <td class="campo" style="width:48%;"><span class="lbl">ENDEREÇO</span><span class="val">${escapeHtml(dest.logradouro || '')}, ${escapeHtml(dest.numero || 'S/N')}${dest.complemento ? ' - ' + escapeHtml(dest.complemento) : ''}</span></td>
        <td class="campo" style="width:22%;"><span class="lbl">BAIRRO / DISTRITO</span><span class="val">${escapeHtml(dest.bairro || '—')}</span></td>
        <td class="campo" style="width:12%;"><span class="lbl">CEP</span><span class="val mono">${escapeHtml(formatarCep(dest.cep))}</span></td>
        <td class="campo" style="width:18%;"><span class="lbl">DATA DE SAÍDA / ENTRADA</span><span class="val tc">${escapeHtml(emissaoBr.data)}</span></td>
      </tr>
    </table>
    <table class="row-table">
      <tr>
        <td class="campo" style="width:42%;"><span class="lbl">MUNICÍPIO</span><span class="val">${escapeHtml(dest.municipio || '—')}</span></td>
        <td class="campo" style="width:16%;"><span class="lbl">FONE / E-MAIL</span><span class="val" style="font-size:7.5px;">${escapeHtml(dest.email || '—')}</span></td>
        <td class="campo" style="width:6%;"><span class="lbl">UF</span><span class="val tc">${escapeHtml(dest.uf || '—')}</span></td>
        <td class="campo" style="width:18%;"><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val mono">${escapeHtml(dest.ie || 'ISENTO')}</span></td>
        <td class="campo" style="width:18%;"><span class="lbl">HORA DE SAÍDA</span><span class="val tc">${escapeHtml(emissaoBr.hora)}</span></td>
      </tr>
    </table>

    <!-- Cálculo do Imposto -->
    <div class="section-title">CÁLCULO DO IMPOSTO</div>
    <table class="row-table">
      <tr>
        <td class="campo"><span class="lbl">BASE DE CÁLC. DO ICMS</span><span class="val tr" style="display:block;">${formatarMoedaBr(tot.vBC)}</span></td>
        <td class="campo"><span class="lbl">VALOR DO ICMS</span><span class="val tr" style="display:block;">${formatarMoedaBr(tot.vICMS)}</span></td>
        <td class="campo"><span class="lbl">BASE DE CÁLC. ICMS S.T.</span><span class="val tr" style="display:block;">0,00</span></td>
        <td class="campo"><span class="lbl">VALOR DO ICMS SUBST.</span><span class="val tr" style="display:block;">0,00</span></td>
        <td class="campo"><span class="lbl">V. APROX. TRIBUTOS</span><span class="val tr" style="display:block;">${formatarMoedaBr(tot.vTotTrib)}</span></td>
        <td class="campo"><span class="lbl">VALOR TOTAL DOS PRODUTOS</span><span class="val tr" style="display:block;">${formatarMoedaBr(tot.vProd)}</span></td>
      </tr>
    </table>
    <table class="row-table">
      <tr>
        <td class="campo"><span class="lbl">VALOR DO FRETE</span><span class="val tr" style="display:block;">${formatarMoedaBr(tot.vFrete)}</span></td>
        <td class="campo"><span class="lbl">VALOR DO SEGURO</span><span class="val tr" style="display:block;">0,00</span></td>
        <td class="campo"><span class="lbl">DESCONTO</span><span class="val tr" style="display:block;">${formatarMoedaBr(tot.vDesc)}</span></td>
        <td class="campo"><span class="lbl">OUTRAS DESPESAS</span><span class="val tr" style="display:block;">0,00</span></td>
        <td class="campo"><span class="lbl">VALOR TOTAL IPI</span><span class="val tr" style="display:block;">0,00</span></td>
        <td class="campo" style="background:#f9fafb;"><span class="lbl">VALOR TOTAL DA NOTA</span><span class="val tr" style="display:block;font-weight:800;font-size:10px;">R$ ${formatarMoedaBr(tot.vNF)}</span></td>
      </tr>
    </table>

    <!-- Transportador -->
    <div class="section-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
    <table class="row-table">
      <tr>
        <td class="campo" style="width:45%;"><span class="lbl">RAZÃO SOCIAL</span><span class="val">—</span></td>
        <td class="campo" style="width:28%;"><span class="lbl">FRETE POR CONTA</span><span class="val">${escapeHtml(descreverModFrete(modFrete))}</span></td>
        <td class="campo" style="width:15%;"><span class="lbl">CÓDIGO ANTT</span><span class="val">&nbsp;</span></td>
        <td class="campo" style="width:12%;"><span class="lbl">UF</span><span class="val">&nbsp;</span></td>
      </tr>
    </table>

    <!-- Itens / Produtos -->
    <div class="section-title">DADOS DOS PRODUTOS / SERVIÇOS</div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:11%;">CÓDIGO</th>
          <th style="width:29%;">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
          <th style="width:8%;">NCM/SH</th>
          <th style="width:6%;">CSOSN/CST</th>
          <th style="width:5%;">CFOP</th>
          <th style="width:4%;">UN</th>
          <th style="width:6%;">QUANT.</th>
          <th style="width:8%;">V. UNIT</th>
          <th style="width:8%;">V. TOTAL</th>
          <th style="width:5%;">BC ICMS</th>
          <th style="width:4%;">V. ICMS</th>
          <th style="width:3%;">V. IPI</th>
          <th style="width:3%;">ALQ</th>
        </tr>
      </thead>
      <tbody>
        ${linhasItensHtml}
      </tbody>
    </table>

    <!-- Dados Adicionais -->
    <div class="section-title">DADOS ADICIONAIS</div>
    <div class="adicionais-grid">
      <div class="adicionais-left">
        <span class="lbl">INFORMAÇÕES COMPLEMENTARES</span>
        <div style="font-size:7.5px;line-height:1.35;word-break:break-word;">
          ${infoComplementarPartes.map((p) => escapeHtml(p)).join(' | ')}
        </div>
      </div>
      <div class="adicionais-right">
        <span class="lbl">RESERVADO AO FISCO</span>
        <div style="font-size:7px;color:#4b5563;">
          ${isCancelada ? 'Nota fiscal cancelada na SEFAZ.' : isHomologacao ? 'Emitida em ambiente de homologação sem valor fiscal.' : 'Documento fiscal autenticado pela SEFAZ.'}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

