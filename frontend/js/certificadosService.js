/**
 * RezFire Manager — Serviço de Certificados & Selo Inmetro
 * 
 * Gerencia a vinculação, validação e persistência (Front-end/localStorage)
 * de documentos de certificação Inmetro para Produtos e Anúncios.
 * 
 * Mantém isolamento estrito entre documentos de produtos e de anúncios.
 * 
 * Diretrizes para futuro Backend:
 *  - Armazenamento físico: Pasta em disco local no servidor do gestor (ex: /uploads/certificados/),
 *    com proteção de rotas e download autenticado.
 *  - Finalidade: Auditoria técnica e comprovação de conformidade interna do gestor
 *    perante o Mercado Livre e órgãos fiscalizadores (sem envio automático via API do ML no momento).
 *  - Tabela planejada (MySQL): documentos_certificados (id_documento, tipo_entidade, entidade_id,
 *    tipo_documento, numero_registro, nome_arquivo, formato, tamanho_bytes, caminho_disco, created_at).
 */

(function () {
  const STORAGE_KEY = "rezfire.documentos_certificados";
  const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB

  const FORMATOS_ACEITOS = {
    pdf: {
      extensoes: ["pdf"],
      mimes: ["application/pdf"],
      rotulo: "PDF",
      icone: "📄",
    },
    jpg: {
      extensoes: ["jpg", "jpeg"],
      mimes: ["image/jpeg", "image/pjpeg"],
      rotulo: "JPG / JPEG",
      icone: "🖼️",
    },
    png: {
      extensoes: ["png"],
      mimes: ["image/png"],
      rotulo: "PNG",
      icone: "🖼️",
    },
  };

  // SVG de Selo Inmetro em Data URL para exibição mockada realista
  function gerarMockImagemSelo(registro, titulo) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
        <rect width="600" height="400" fill="#f8fafc" rx="12" stroke="#cbd5e1" stroke-width="4"/>
        <rect x="20" y="20" width="560" height="70" fill="#1e3a8a" rx="8"/>
        <text x="300" y="62" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">
          CERTIFICAÇÃO DE CONFORMIDADE INMETRO
        </text>
        <circle cx="120" cy="220" r="70" fill="#ffffff" stroke="#e85c2a" stroke-width="6"/>
        <text x="120" y="215" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#e85c2a" text-anchor="middle">
          INMETRO
        </text>
        <text x="120" y="240" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#334155" text-anchor="middle">
          SEGURANÇA
        </text>
        <rect x="220" y="140" width="340" height="180" fill="#ffffff" rx="8" stroke="#e2e8f0" stroke-width="2"/>
        <text x="240" y="175" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#475569">
          REGISTRO DO PRODUTO:
        </text>
        <text x="240" y="205" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#0f172a">
          ${registro || "002450/2021"}
        </text>
        <text x="240" y="240" font-family="Arial, sans-serif" font-size="13" fill="#64748b">
          DOCUMENTO: ${titulo || "Selo de Conformidade Operacional"}
        </text>
        <text x="240" y="265" font-family="Arial, sans-serif" font-size="12" fill="#16a34a" font-weight="bold">
          ✓ STATUS: HOMOLOGADO & VÁLIDO
        </text>
        <text x="240" y="295" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">
          ORGANISMO DE CERTIFICAÇÃO ACREDITADO (OCP) · REZFIRE MANAGER
        </text>
        <rect x="20" y="350" width="560" height="30" fill="#e2e8f0" rx="4"/>
        <text x="300" y="370" font-family="Arial, sans-serif" font-size="11" fill="#475569" text-anchor="middle">
          Documento para comprovação de conformidade técnica e jurídica perante o Mercado Livre.
        </text>
      </svg>
    `;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // PDF sintético minimalista (válido) codificado em Base64
  // Cria um PDF mínimo legível com mensagem de conformidade
  function gerarMockPDF(registro, titulo) {
    // PDF padrão com texto legível em visualizadores
    const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 420 >> stream
BT
/F1 18 Tf
50 720 Td
(CERTIFICADO DE CONFORMIDADE INMETRO - REZFIRE) Tj
/F1 12 Tf
0 -35 Td
(Registro Inmetro: ${registro || "002450/2021"}) Tj
0 -25 Td
(Titulo: ${titulo || "Certificado de Homologacao Tecnica"}) Tj
0 -25 Td
(Status: ATIVO E VALIDO PARA VENDA NO MERCADO LIVRE) Tj
0 -35 Td
(Este documento digital comprova o atendimento as portarias vigentes do Inmetro) Tj
0 -20 Td
(para extintores de incendio e equipamentos de prevencao.) Tj
0 -40 Td
(Data de emissao: 12/01/2023 - Validade operacional: 5 anos) Tj
0 -20 Td
(Emissor: OCP Acreditado Inmetro / RezFire Equipamentos de Seguranca) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000329 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
801
%%EOF`;
    return "data:application/pdf;base64," + btoa(unescape(encodeURIComponent(pdfContent)));
  }

  // Certificados padrão para popular inicialmente o sistema
  const DEFAULT_CERTIFICADOS = [
  {
    "id_documento": "doc_prod_1_inmetro_cert",
    "tipo_entidade": "produto",
    "entidade_id": "1",
    "tipo_documento": "Certificado Inmetro",
    "numero_registro": "003180/2021",
    "nome_arquivo": "Certificado_Inmetro_003180_Resil_PQS_4KG.pdf",
    "formato": "pdf",
    "tamanho_bytes": 425100,
    "tamanho_formatado": "415 KB",
    "data_upload": "2024-03-08T10:15:00.000Z",
    "conteudo_url": gerarMockPDF("003180/2021", "Extintor Pó Químico ABC 4kg - Resil Comercial"),
    "observacoes": "Certificado de conformidade Inmetro / OCP Resil."
  },
  {
    "id_documento": "doc_prod_1_inmetro_selo",
    "tipo_entidade": "produto",
    "entidade_id": "1",
    "tipo_documento": "Selo de Conformidade",
    "numero_registro": "003180/2021",
    "nome_arquivo": "Selo_Inmetro_INM-552190.png",
    "formato": "png",
    "tamanho_bytes": 264000,
    "tamanho_formatado": "257 KB",
    "data_upload": "2024-03-09T11:20:00.000Z",
    "conteudo_url": gerarMockImagemSelo("003180/2021", "Selo Inmetro Lacre L-332910"),
    "observacoes": "Foto em alta definição do selo de conformidade afixado ao cilindro."
  },
  {
    "id_documento": "doc_prod_2_inmetro_cert",
    "tipo_entidade": "produto",
    "entidade_id": "2",
    "tipo_documento": "Certificado Inmetro",
    "numero_registro": "002450/2021",
    "nome_arquivo": "Certificado_Inmetro_002450_Resil_10L.pdf",
    "formato": "pdf",
    "tamanho_bytes": 412580,
    "tamanho_formatado": "403 KB",
    "data_upload": "2024-03-10T14:22:00.000Z",
    "conteudo_url": gerarMockPDF("002450/2021", "Extintor Água Pressurizada 10L - Resil"),
    "observacoes": "Certificação de conformidade de lote e projeto Resil."
  },
  {
    "id_documento": "doc_prod_2_inmetro_selo",
    "tipo_entidade": "produto",
    "entidade_id": "2",
    "tipo_documento": "Selo de Conformidade",
    "numero_registro": "002450/2021",
    "nome_arquivo": "Selo_Inmetro_INM-994120.png",
    "formato": "png",
    "tamanho_bytes": 285400,
    "tamanho_formatado": "278 KB",
    "data_upload": "2024-03-11T09:15:00.000Z",
    "conteudo_url": gerarMockImagemSelo("002450/2021", "Selo Inmetro Lacre L-849201"),
    "observacoes": "Foto em alta definição do selo de conformidade afixado ao cilindro."
  },
  {
    "id_documento": "doc_prod_3_inmetro_cert",
    "tipo_entidade": "produto",
    "entidade_id": "3",
    "tipo_documento": "Certificado Inmetro",
    "numero_registro": "001891/2020",
    "nome_arquivo": "Homologacao_Inmetro_CO2_6KG_Extang.pdf",
    "formato": "pdf",
    "tamanho_bytes": 524100,
    "tamanho_formatado": "511 KB",
    "data_upload": "2024-02-18T16:40:00.000Z",
    "conteudo_url": gerarMockPDF("001891/2020", "Extintor CO2 6kg - Extang"),
    "observacoes": "Certificado emitido pelo OCP para cilindro de alta pressão CO2."
  },
  {
    "id_documento": "doc_anuncio_1_cert",
    "tipo_entidade": "anuncio",
    "entidade_id": "1",
    "tipo_documento": "Certificado de Homologação ML",
    "numero_registro": "003180/2021",
    "nome_arquivo": "Certificado_Anuncio_MLB2894012110_Kit_ABC_4kg.pdf",
    "formato": "pdf",
    "tamanho_bytes": 618400,
    "tamanho_formatado": "604 KB",
    "data_upload": "2024-04-02T11:00:00.000Z",
    "conteudo_url": gerarMockPDF("003180/2021", "Kit Extintor Pó ABC 4kg + Suporte - MLB-2894012110"),
    "observacoes": "Documento anexado para auditoria do catálogo do Mercado Livre."
  },
  {
    "id_documento": "doc_anuncio_1_selo",
    "tipo_entidade": "anuncio",
    "entidade_id": "1",
    "tipo_documento": "Selo de Conformidade",
    "numero_registro": "003180/2021",
    "nome_arquivo": "Foto_Selo_Inmetro_Anuncio_1.jpg",
    "formato": "jpg",
    "tamanho_bytes": 342100,
    "tamanho_formatado": "334 KB",
    "data_upload": "2024-04-03T10:30:00.000Z",
    "conteudo_url": gerarMockImagemSelo("003180/2021", "Foto do Selo Inmetro Anúncio MLB-2894012110"),
    "observacoes": "Foto frontal do selo no extintor montado."
  },
  {
    "id_documento": "doc_anuncio_3_cert",
    "tipo_entidade": "anuncio",
    "entidade_id": "3",
    "tipo_documento": "Certificado de Homologação ML",
    "numero_registro": "001891/2020",
    "nome_arquivo": "Certificado_Inmetro_CO2_6kg_MLB2894012185.pdf",
    "formato": "pdf",
    "tamanho_bytes": 489200,
    "tamanho_formatado": "477 KB",
    "data_upload": "2024-04-05T14:10:00.000Z",
    "conteudo_url": gerarMockPDF("001891/2020", "Extintor CO2 6kg - MLB-2894012185"),
    "observacoes": "Comprovante de aprovação de cilindro e válvula de descarga para anúncio."
  }
];

  /**
   * Obtém a lista atual de documentos do localStorage ou inicializa os dados mockados
   */
  function carregarDocumentos() {
    try {
      if (localStorage.getItem("rezfire.mock_version") !== "rezfire_v2_2026") {
        localStorage.setItem("rezfire.mock_version", "rezfire_v2_2026");
        salvarDocumentos(DEFAULT_CERTIFICADOS);
        return [...DEFAULT_CERTIFICADOS];
      }
    } catch {}
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        salvarDocumentos(DEFAULT_CERTIFICADOS);
        return [...DEFAULT_CERTIFICADOS];
      }
      return JSON.parse(data);
    } catch (err) {
      console.warn("Falha ao ler certificados do localStorage, utilizando fallback em memória:", err);
      return [...DEFAULT_CERTIFICADOS];
    }
  }

  /**
   * Salva os documentos no localStorage e emite evento customizado
   */
  function salvarDocumentos(docs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    } catch (err) {
      console.error("Erro ao salvar certificados no localStorage:", err);
    }
  }

  /**
   * Dispara notificação de atualização para manter as telas sincronizadas
   */
  function emitirMudanca(tipoEntidade, entidadeId) {
    const event = new CustomEvent("rezfire:certificados-mudaram", {
      detail: { tipoEntidade, entidadeId },
    });
    window.dispatchEvent(event);
  }

  /**
   * Formata bytes em formato amigável (KB, MB)
   */
  function formatarBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  /**
   * Formata data ISO para pt-BR
   */
  function formatarDataHora(isoString) {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  /**
   * Valida o arquivo antes do upload
   */
  function validarArquivo(file) {
    if (!file) {
      return { valido: false, erro: "Nenhum arquivo foi selecionado." };
    }

    // Identifica extensão
    const nome = file.name || "";
    const partes = nome.split(".");
    const ext = partes.length > 1 ? partes.pop().toLowerCase() : "";

    let formatoEncontrado = null;
    for (const [key, conf] of Object.entries(FORMATOS_ACEITOS)) {
      if (conf.extensoes.includes(ext) || conf.mimes.includes(file.type)) {
        formatoEncontrado = key;
        break;
      }
    }

    if (!formatoEncontrado) {
      return {
        valido: false,
        erro: `Formato de arquivo "${ext ? "." + ext : "desconhecido"}" não permitido. Apenas documentos em PDF e imagens (JPG, JPEG e PNG) são aceitos.`,
      };
    }

    if (file.size > TAMANHO_MAXIMO_BYTES) {
      return {
        valido: false,
        erro: `O arquivo selecionado (${formatarBytes(file.size)}) excede o limite máximo permitido de ${formatarBytes(TAMANHO_MAXIMO_BYTES)}.`,
      };
    }

    return {
      valido: true,
      formato: formatoEncontrado,
      tamanhoFormatado: formatarBytes(file.size),
    };
  }

  /**
   * Lê um arquivo File/Blob e converte para Data URL (Base64)
   */
  function lerComoDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Erro ao ler o conteúdo do arquivo."));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Lista certificados associados a uma entidade (produto ou anúncio)
   * Garante a separação estrita por tipo_entidade e entidade_id
   */
  function listarDocumentos(tipoEntidade, entidadeId) {
    const docs = carregarDocumentos();
    if (!tipoEntidade || entidadeId === undefined || entidadeId === null || entidadeId === "") {
      return [...docs];
    }
    const idNormalizado = String(entidadeId).trim();
    const tipoNormalizado = String(tipoEntidade).toLowerCase().trim();

    return docs.filter(
      (d) =>
        String(d.tipo_entidade).toLowerCase().trim() === tipoNormalizado &&
        String(d.entidade_id).trim() === idNormalizado
    );
  }

  /**
   * Verifica se a entidade possui ao menos um certificado vinculado
   */
  function temCertificado(tipoEntidade, entidadeId) {
    const list = listarDocumentos(tipoEntidade, entidadeId);
    return list.length > 0;
  }

  /**
   * Obtém detalhes de status de certificação para badges e resumos
   */
  function obterStatus(tipoEntidade, entidadeId) {
    const docs = listarDocumentos(tipoEntidade, entidadeId);
    return {
      possuiCertificado: docs.length > 0,
      quantidade: docs.length,
      documentos: docs,
      registros: [...new Set(docs.map((d) => d.numero_registro).filter(Boolean))],
      tipos: [...new Set(docs.map((d) => d.tipo_documento).filter(Boolean))],
    };
  }

  /**
   * Anexa um novo documento à entidade (Produto ou Anúncio)
   */
  async function anexarDocumento({
    tipoEntidade,
    entidadeId,
    file,
    tipoDocumento = "Certificado Inmetro",
    numeroRegistro = "",
    observacoes = "",
  }) {
    if (!tipoEntidade || !entidadeId) {
      throw new Error("Tipo de entidade e identificador são obrigatórios.");
    }

    const validacao = validarArquivo(file);
    if (!validacao.valido) {
      throw new Error(validacao.erro);
    }

    const dataUrl = await lerComoDataURL(file);
    const docs = carregarDocumentos();

    const novoId = `doc_${tipoEntidade}_${entidadeId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const novoDoc = {
      id_documento: novoId,
      tipo_entidade: String(tipoEntidade).toLowerCase().trim(),
      entidade_id: String(entidadeId).trim(),
      tipo_documento: tipoDocumento || "Certificado Inmetro",
      numero_registro: numeroRegistro ? String(numeroRegistro).trim() : "",
      nome_arquivo: file.name,
      formato: validacao.formato,
      tamanho_bytes: file.size,
      tamanho_formatado: validacao.tamanhoFormatado,
      data_upload: new Date().toISOString(),
      conteudo_url: dataUrl,
      observacoes: observacoes ? String(observacoes).trim() : "",
    };

    docs.unshift(novoDoc);
    salvarDocumentos(docs);
    emitirMudanca(tipoEntidade, entidadeId);

    return novoDoc;
  }

  /**
   * Remove um documento pelo ID
   * Regra de negócio: A remoção de um documento do produto NUNCA remove
   * documentos vinculados individualmente a anúncios, e vice-versa.
   */
  function removerDocumento(idDocumento) {
    if (!idDocumento) return false;

    const docs = carregarDocumentos();
    const doc = docs.find((d) => d.id_documento === idDocumento);
    if (!doc) return false;

    const novosDocs = docs.filter((d) => d.id_documento !== idDocumento);
    salvarDocumentos(novosDocs);
    emitirMudanca(doc.tipo_entidade, doc.entidade_id);

    return true;
  }

  /**
   * Busca um documento individual por ID
   */
  function obterPorId(idDocumento) {
    const docs = carregarDocumentos();
    return docs.find((d) => d.id_documento === idDocumento) || null;
  }

  // -------------------------------------------------------------
  // UI Globais: Modal de Visualização & Modal de Confirmação
  // -------------------------------------------------------------

  let modalVisualizadorEl = null;
  let modalConfirmacaoEl = null;

  function criarModaisGlobais() {
    if (document.getElementById("modal-certificados-viewer")) return;

    // Modal de Visualização
    const viewerHTML = `
      <div class="modal-backdrop" id="modal-certificados-viewer" role="dialog" aria-modal="true" style="z-index: 10000; align-items: center; justify-content: center; padding: 16px;">
        <div class="modal" style="width: min(850px, 95vw); max-height: 92vh; display: flex; flex-direction: column; background: #ffffff; border-radius: 14px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden;">
          <!-- Header do Visualizador -->
          <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; background: #fafaf9;">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
              <div id="viewer-icon" style="width: 38px; height: 38px; border-radius: 8px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                📄
              </div>
              <div style="min-width: 0;">
                <h3 id="viewer-title" style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #1c1917; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  Certificado
                </h3>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: #78716c; margin-top: 2px; flex-wrap: wrap;">
                  <span id="viewer-tipo" style="font-weight: 600; color: #c2410c; background: #fff7ed; padding: 1px 6px; border-radius: 4px; border: 1px solid #ffedd5;">
                    Certificado Inmetro
                  </span>
                  <span id="viewer-meta"></span>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <a id="viewer-btn-download" href="#" download="documento" class="btn-ghost" style="padding: 6px 12px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px; text-decoration: none;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Baixar
              </a>
              <button id="viewer-btn-fechar" class="icon-btn" type="button" title="Fechar visualizador" style="width: 32px; height: 32px;">
                ✕
              </button>
            </div>
          </div>

          <!-- Corpo do Visualizador com Suporte a PDF e Imagens -->
          <div id="viewer-body" style="flex: 1; min-height: 400px; max-height: calc(85vh - 130px); background: #0f172a; display: flex; align-items: center; justify-content: center; overflow: auto; position: relative;">
            <!-- Conteúdo dinâmico inserido via JS -->
          </div>

          <!-- Rodapé com Metadados & Conformidade -->
          <div style="padding: 10px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #64748b; flex-wrap: wrap; gap: 8px;">
            <div id="viewer-footer-info" style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 999px; background: #10b981;"></span>
              <span>Documento válido para auditoria de conformidade</span>
            </div>
            <div id="viewer-footer-registro" style="font-family: monospace; font-weight: 600; color: #0f172a;"></div>
          </div>
        </div>
      </div>
    `;

    // Modal de Confirmação de Exclusão
    const confirmHTML = `
      <div class="modal-backdrop" id="modal-certificados-confirm" role="dialog" aria-modal="true" style="z-index: 10001; align-items: center; justify-content: center; padding: 16px;">
        <div class="modal" style="width: min(440px, 95vw); background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
          <div style="display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
              ⚠️
            </div>
            <div>
              <h3 id="confirm-title" style="margin: 0 0 6px; font-size: 1.05rem; font-weight: 700; color: #111827;">
                Confirmar Remoção
              </h3>
              <p id="confirm-message" style="margin: 0; font-size: 0.85rem; color: #4b5563; line-height: 1.45;">
                Tem certeza que deseja desvincular e remover este certificado?
              </p>
            </div>
          </div>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin-bottom: 18px; font-size: 0.76rem; color: #6b7280;">
            ℹ️ <strong>Independência:</strong> Remover este documento não afetará certificados vinculados individualmente a outros produtos ou anúncios.
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="confirm-btn-cancelar" type="button" class="btn-ghost" style="padding: 8px 16px;">
              Cancelar
            </button>
            <button id="confirm-btn-remover" type="button" class="btn-primary" style="padding: 8px 16px; background: #dc2626; border-color: #dc2626; color: #ffffff;">
              Sim, Remover
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", viewerHTML);
    document.body.insertAdjacentHTML("beforeend", confirmHTML);

    // Eventos do viewer
    document.getElementById("viewer-btn-fechar").addEventListener("click", fecharVisualizador);
    document.getElementById("modal-certificados-viewer").addEventListener("click", (e) => {
      if (e.target.id === "modal-certificados-viewer") fecharVisualizador();
    });

    // Eventos do confirm
    document.getElementById("confirm-btn-cancelar").addEventListener("click", fecharConfirmacao);
  }

  function abrirVisualizador(doc) {
    criarModaisGlobais();
    if (!doc) return;

    const modal = document.getElementById("modal-certificados-viewer");
    const icon = document.getElementById("viewer-icon");
    const title = document.getElementById("viewer-title");
    const tipo = document.getElementById("viewer-tipo");
    const meta = document.getElementById("viewer-meta");
    const body = document.getElementById("viewer-body");
    const btnDownload = document.getElementById("viewer-btn-download");
    const footerRegistro = document.getElementById("viewer-registro");

    title.textContent = doc.nome_arquivo || "Documento de Certificação";
    tipo.textContent = doc.tipo_documento || "Certificado Inmetro";
    meta.textContent = `· ${doc.formato.toUpperCase()} · ${doc.tamanho_formatado} · Enviado em ${formatarDataHora(doc.data_upload)}`;

    btnDownload.href = doc.conteudo_url;
    btnDownload.download = doc.nome_arquivo;

    const regSpan = document.getElementById("viewer-footer-registro");
    if (regSpan) {
      regSpan.textContent = doc.numero_registro ? `Registro Inmetro: ${doc.numero_registro}` : "Sem registro informado";
    }

    if (doc.formato === "pdf") {
      icon.innerHTML = "📄";
      icon.style.background = "#fee2e2";
      icon.style.color = "#dc2626";
      body.style.background = "#334155";
      body.innerHTML = `
        <iframe src="${doc.conteudo_url}" style="width: 100%; height: 550px; border: none; background: #ffffff;" title="Pré-visualização do PDF"></iframe>
      `;
    } else {
      // Imagens (PNG, JPG, SVG)
      icon.innerHTML = "🖼️";
      icon.style.background = "#e0e7ff";
      icon.style.color = "#4338ca";
      body.style.background = "#09090b";
      body.innerHTML = `
        <div style="padding: 20px; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
          <img src="${doc.conteudo_url}" alt="${doc.nome_arquivo}" style="max-width: 100%; max-height: 520px; object-fit: contain; border-radius: 6px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);" />
        </div>
      `;
    }

    modal.classList.add("is-open");
  }

  function fecharVisualizador() {
    const modal = document.getElementById("modal-certificados-viewer");
    if (modal) modal.classList.remove("is-open");
    const body = document.getElementById("viewer-body");
    if (body) body.innerHTML = "";
  }

  let onConfirmarCallback = null;

  function solicitarConfirmacaoRemocao({ nomeArquivo, tipoEntidade, onConfirmar }) {
    criarModaisGlobais();
    const modal = document.getElementById("modal-certificados-confirm");
    const msg = document.getElementById("confirm-message");
    const btnRemover = document.getElementById("confirm-btn-remover");

    const rotuloEntidade = tipoEntidade === "produto" ? "deste produto" : "deste anúncio";
    msg.innerHTML = `Tem certeza que deseja desvincular o documento <strong>"${nomeArquivo || "este certificado"}"</strong> ${rotuloEntidade}?`;

    onConfirmarCallback = onConfirmar;

    btnRemover.onclick = () => {
      fecharConfirmacao();
      if (typeof onConfirmarCallback === "function") {
        onConfirmarCallback();
      }
    };

    modal.classList.add("is-open");
  }

  function fecharConfirmacao() {
    const modal = document.getElementById("modal-certificados-confirm");
    if (modal) modal.classList.remove("is-open");
    onConfirmarCallback = null;
  }

  // -------------------------------------------------------------
  // Componente de Renderização da Seção de Certificados
  // Pode ser inserido em qualquer container HTML de Produtos ou Anúncios
  // -------------------------------------------------------------

  /**
   * Renderiza o componente completo de gerenciamento de certificados dentro do container informado
   */
  function renderizarGerenciadorCertificados(containerEl, {
    tipoEntidade,
    entidadeId,
    titulo = "Documentos de Certificação (Selo Inmetro)",
    subtitulo = "Anexe e gerencie certificados em PDF ou imagem para comprovação de conformidade.",
    registroInmetroPadrao = "",
    modo = "completo", // 'completo' (com upload) ou 'leitura' (apenas visualização)
  }) {
    if (!containerEl) return;
    criarModaisGlobais();

    const idUnico = `cert-mgr-${tipoEntidade}-${entidadeId}`;
    const docs = listarDocumentos(tipoEntidade, entidadeId);
    const temDocs = docs.length > 0;

    let html = `
      <div id="${idUnico}" class="certificados-manager-box" style="background: #ffffff; border: 1px solid var(--line, #e2e8f0); border-radius: 12px; padding: 18px; margin-top: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; background: ${temDocs ? "#ecfdf5" : "#fff7ed"}; color: ${temDocs ? "#059669" : "#d97706"}; font-size: 0.95rem;">
                ${temDocs ? "🛡️" : "⚠️"}
              </span>
              <h4 style="margin: 0; font-size: 0.92rem; font-weight: 700; color: #1c1917;">
                ${titulo}
              </h4>
              <span class="status-pill ${temDocs ? "on" : ""}" style="font-size: 0.7rem; padding: 2px 8px;">
                ${temDocs ? `${docs.length} Anexado${docs.length > 1 ? "s" : ""}` : "Sem Certificado"}
              </span>
            </div>
            <p style="margin: 4px 0 0; font-size: 0.78rem; color: #78716c;">
              ${subtitulo}
            </p>
          </div>
          ${modo === "completo" ? `
            <button type="button" class="btn-ghost btn-toggle-upload" data-target="${idUnico}-form-upload" style="padding: 6px 12px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 5px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Anexar Certificado
            </button>
          ` : ""}
        </div>

        <!-- Área de Upload (Colapsável / Form) -->
        ${modo === "completo" ? `
          <div id="${idUnico}-form-upload" class="cert-upload-panel" style="display: none; background: #fafaf9; border: 1px dashed #d6d3d1; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <strong style="font-size: 0.82rem; color: #292524;">Novo Documento de Certificação</strong>
              <button type="button" class="btn-close-upload" style="background: none; border: none; cursor: pointer; color: #a8a29e; font-size: 0.9rem;">✕</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px;">
              <div>
                <label style="display: block; font-size: 0.72rem; font-weight: 700; color: #57534e; margin-bottom: 4px; text-transform: uppercase;">
                  Tipo de Documento *
                </label>
                <select class="input-cert-tipo search-input" style="width: 100%; font-size: 0.8rem; padding: 6px 10px;">
                  <option value="Certificado Inmetro">Certificado Inmetro</option>
                  <option value="Selo de Conformidade">Selo de Conformidade</option>
                  <option value="Portaria de Homologação">Portaria de Homologação</option>
                  <option value="Relatório de Ensaio">Relatório de Ensaio</option>
                  <option value="Outro Documento de Conformidade">Outro Documento</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.72rem; font-weight: 700; color: #57534e; margin-bottom: 4px; text-transform: uppercase;">
                  Nº Registro Inmetro
                </label>
                <input type="text" class="input-cert-registro search-input" placeholder="Ex: 002450/2021" value="${registroInmetroPadrao || ""}" style="width: 100%; font-size: 0.8rem; padding: 6px 10px;" />
              </div>
            </div>

            <!-- Dropzone / Input de Arquivo -->
            <div class="cert-dropzone" style="border: 2px dashed #cbd5e1; background: #ffffff; border-radius: 8px; padding: 18px 12px; text-align: center; cursor: pointer; transition: all 0.2s ease;">
              <input type="file" class="input-cert-file" accept=".pdf, .jpg, .jpeg, .png, application/pdf, image/jpeg, image/png" style="display: none;" />
              <div class="dropzone-prompt">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e85c2a" stroke-width="1.8" style="margin: 0 auto 6px; display: block;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span style="font-size: 0.82rem; font-weight: 600; color: #1e293b; display: block;">
                  Clique para selecionar ou arraste o arquivo aqui
                </span>
                <span style="font-size: 0.72rem; color: #64748b; display: block; margin-top: 3px;">
                  Formatos aceitos: <strong>PDF, JPG, JPEG e PNG</strong> (máx. 5 MB)
                </span>
              </div>
              <div class="dropzone-file-info" style="display: none; align-items: center; justify-content: center; gap: 8px;">
                <span class="file-icon" style="font-size: 1.2rem;">📄</span>
                <strong class="file-name" style="font-size: 0.82rem; color: #0f172a;"></strong>
                <span class="file-size" style="font-size: 0.72rem; color: #64748b;"></span>
                <button type="button" class="btn-clear-file" style="color: #ef4444; background: none; border: none; cursor: pointer; font-size: 0.8rem;">✕ Trocar</button>
              </div>
            </div>

            <!-- Mensagem de erro de validação -->
            <div class="cert-upload-error" style="display: none; margin-top: 8px; font-size: 0.76rem; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 6px 10px;"></div>

            <!-- Botões de ação do upload -->
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
              <button type="button" class="btn-ghost btn-cancel-upload" style="padding: 6px 12px; font-size: 0.78rem;">Cancelar</button>
              <button type="button" class="btn-primary btn-submit-upload" style="padding: 6px 14px; font-size: 0.78rem;" disabled>
                Salvar e Vincular
              </button>
            </div>
          </div>
        ` : ""}

        <!-- Lista de Documentos Anexados ou Estado Vazio -->
        <div class="cert-list-container">
          ${temDocs ? `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${docs.map((d) => `
                <div class="cert-item-card" data-id="${d.id_documento}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; transition: background 0.15s ease;">
                  <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                    <div style="width: 34px; height: 34px; border-radius: 6px; background: ${d.formato === "pdf" ? "#fee2e2" : "#e0e7ff"}; color: ${d.formato === "pdf" ? "#dc2626" : "#4338ca"}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
                      ${d.formato === "pdf" ? "📄" : "🖼️"}
                    </div>
                    <div style="min-width: 0;">
                      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <strong style="font-size: 0.84rem; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px;">
                          ${d.nome_arquivo}
                        </strong>
                        <span style="font-size: 0.7rem; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5;">
                          ${d.tipo_documento}
                        </span>
                        ${d.numero_registro ? `
                          <span style="font-size: 0.7rem; font-family: monospace; color: #1e40af; background: #eff6ff; padding: 1px 6px; border-radius: 4px;">
                            Inmetro: ${d.numero_registro}
                          </span>
                        ` : ""}
                      </div>
                      <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">
                        ${d.formato.toUpperCase()} · ${d.tamanho_formatado} · Vinculado em ${formatarDataHora(d.data_upload)}
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: 12px;">
                    <button type="button" class="btn-view-cert btn-ghost" data-id="${d.id_documento}" title="Visualizar documento" style="padding: 5px 10px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                      Visualizar
                    </button>
                    <a href="${d.conteudo_url}" download="${d.nome_arquivo}" class="btn-ghost" title="Baixar arquivo" style="padding: 5px 8px; font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center;">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </a>
                    ${modo === "completo" ? `
                      <button type="button" class="btn-remove-cert icon-btn" data-id="${d.id_documento}" data-nome="${d.nome_arquivo}" title="Remover certificado" style="color: #ef4444; width: 28px; height: 28px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    ` : ""}
                  </div>
                </div>
              `).join("")}
            </div>
          ` : `
            <!-- Estado Vazio Informativo -->
            <div class="empty-cert-state" style="padding: 20px 16px; background: #fafaf9; border: 1px dashed #e7e5e4; border-radius: 8px; text-align: center;">
              <span style="font-size: 1.6rem; display: block; margin-bottom: 6px;">📂</span>
              <strong style="font-size: 0.85rem; color: #44403c; display: block;">
                Nenhum certificado vinculado
              </strong>
              <p style="margin: 4px auto 0; font-size: 0.76rem; color: #78716c; max-width: 420px; line-height: 1.4;">
                ${tipoEntidade === "produto"
                  ? "Este produto ainda não possui certificados Inmetro cadastrados. A vinculação é indispensável para comprovação técnica e auditoria de vendas."
                  : "Este anúncio não possui documentação específica vinculada diretamente. Você pode anexar os certificados do fabricante ou do conjunto montado."}
              </p>
            </div>
          `}
        </div>
      </div>
    `;

    containerEl.innerHTML = html;

    // Vincula comportamentos e eventos dentro do container
    conectarEventosGerenciador(containerEl, {
      idUnico,
      tipoEntidade,
      entidadeId,
      titulo,
      subtitulo,
      registroInmetroPadrao,
      modo,
    });
  }

  /**
   * Conecta os event listeners do componente de certificados
   */
  function conectarEventosGerenciador(containerEl, config) {
    const { idUnico, tipoEntidade, entidadeId } = config;
    const box = containerEl.querySelector(`#${idUnico}`);
    if (!box) return;

    // Alternar painel de upload
    const btnToggle = box.querySelector(".btn-toggle-upload");
    const formUpload = box.querySelector(`#${idUnico}-form-upload`);
    const btnCloseUpload = box.querySelector(".btn-close-upload");
    const btnCancelUpload = box.querySelector(".btn-cancel-upload");

    if (btnToggle && formUpload) {
      btnToggle.onclick = () => {
        formUpload.style.display = formUpload.style.display === "none" ? "block" : "none";
      };
      if (btnCloseUpload) btnCloseUpload.onclick = () => (formUpload.style.display = "none");
      if (btnCancelUpload) btnCancelUpload.onclick = () => (formUpload.style.display = "none");
    }

    // Controle do Dropzone / File input
    const dropzone = box.querySelector(".cert-dropzone");
    const fileInput = box.querySelector(".input-cert-file");
    const dropPrompt = box.querySelector(".dropzone-prompt");
    const dropFileInfo = box.querySelector(".dropzone-file-info");
    const fileNameEl = box.querySelector(".file-name");
    const fileSizeEl = box.querySelector(".file-size");
    const btnClearFile = box.querySelector(".btn-clear-file");
    const btnSubmit = box.querySelector(".btn-submit-upload");
    const errorBox = box.querySelector(".cert-upload-error");

    let arquivoSelecionado = null;

    function resetarDropzone() {
      arquivoSelecionado = null;
      if (fileInput) fileInput.value = "";
      if (dropPrompt) dropPrompt.style.display = "block";
      if (dropFileInfo) dropFileInfo.style.display = "none";
      if (btnSubmit) btnSubmit.disabled = true;
      if (errorBox) {
        errorBox.textContent = "";
        errorBox.style.display = "none";
      }
    }

    function processarArquivo(file) {
      if (!file) return;
      const validacao = validarArquivo(file);

      if (!validacao.valido) {
        resetarDropzone();
        if (errorBox) {
          errorBox.textContent = validacao.erro;
          errorBox.style.display = "block";
        }
        return;
      }

      arquivoSelecionado = file;
      if (errorBox) {
        errorBox.textContent = "";
        errorBox.style.display = "none";
      }

      if (dropPrompt) dropPrompt.style.display = "none";
      if (dropFileInfo) dropFileInfo.style.display = "flex";
      if (fileNameEl) fileNameEl.textContent = file.name;
      if (fileSizeEl) fileSizeEl.textContent = `(${validacao.tamanhoFormatado})`;
      if (btnSubmit) btnSubmit.disabled = false;
    }

    if (dropzone && fileInput) {
      dropzone.onclick = (e) => {
        if (e.target.closest(".btn-clear-file")) return;
        fileInput.click();
      };

      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          processarArquivo(e.target.files[0]);
        }
      };

      // Drag and drop
      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "#e85c2a";
        dropzone.style.background = "#fff7ed";
      };

      dropzone.ondragleave = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "#cbd5e1";
        dropzone.style.background = "#ffffff";
      };

      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "#cbd5e1";
        dropzone.style.background = "#ffffff";
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          processarArquivo(e.dataTransfer.files[0]);
        }
      };

      if (btnClearFile) {
        btnClearFile.onclick = (e) => {
          e.stopPropagation();
          resetarDropzone();
        };
      }
    }

    // Salvar e Vincular
    if (btnSubmit) {
      btnSubmit.onclick = async () => {
        if (!arquivoSelecionado) return;
        const tipoSelect = box.querySelector(".input-cert-tipo");
        const regInput = box.querySelector(".input-cert-registro");

        btnSubmit.disabled = true;
        btnSubmit.textContent = "Processando...";

        try {
          await anexarDocumento({
            tipoEntidade,
            entidadeId,
            file: arquivoSelecionado,
            tipoDocumento: tipoSelect ? tipoSelect.value : "Certificado Inmetro",
            numeroRegistro: regInput ? regInput.value : "",
          });

          // Re-renderiza o componente com o novo arquivo
          renderizarGerenciadorCertificados(containerEl, config);
        } catch (err) {
          if (errorBox) {
            errorBox.textContent = err.message || "Erro ao anexar arquivo.";
            errorBox.style.display = "block";
          }
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Salvar e Vincular";
        }
      };
    }

    // Ação: Visualizar
    box.querySelectorAll(".btn-view-cert").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const doc = obterPorId(id);
        if (doc) abrirVisualizador(doc);
      };
    });

    // Ação: Remover com Confirmação
    box.querySelectorAll(".btn-remove-cert").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const nome = btn.dataset.nome;
        solicitarConfirmacaoRemocao({
          nomeArquivo: nome,
          tipoEntidade,
          onConfirmar: () => {
            removerDocumento(id);
            renderizarGerenciadorCertificados(containerEl, config);
          },
        });
      };
    });
  }

  // Exporta a API global do serviço
  window.RezFireCertificados = {
    FORMATOS_ACEITOS,
    TAMANHO_MAXIMO_BYTES,
    listarDocumentos,
    temCertificado,
    obterStatus,
    validarArquivo,
    anexarDocumento,
    removerDocumento,
    obterPorId,
    formatarBytes,
    formatarDataHora,
    abrirVisualizador,
    solicitarConfirmacaoRemocao,
    renderizarGerenciadorCertificados,
  };
})();

