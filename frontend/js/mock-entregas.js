/**
 * mock-entregas.js
 * Dados simulados para a página de Entregas — RezFire Manager.
 *
 * Este módulo centraliza todos os dados fictícios relacionados ao
 * acompanhamento logístico dos pedidos. Estruturado para facilitar a
 * substituição futura por dados reais da API do Mercado Livre ou de
 * uma transportadora.
 *
 * SIMULAÇÃO: Os dados aqui representam uma demonstração operacional.
 * Não refletem vendas reais da empresa.
 */

// ─── Lotes simulados disponíveis no estoque ──────────────────────────────────
// Estes lotes correspondem às entradas de estoque registradas nas movimentações.
// Em uma integração real, seriam gerenciados pelo módulo de Estoque.
const LOTES_SIMULADOS = [
  { id_lote: "LT-2024/01", id_produto: 2, sku: "EXT-H2O-10L",  validade: "2028-04-10", lacre: "L-849201", quantidade_disponivel: 38 },
  { id_lote: "LT-2024/02", id_produto: 7, sku: "EXT-PQS-4KG",  validade: "2024-08-10", lacre: "L-332910", quantidade_disponivel: 55 },
  { id_lote: "LT-2024/03", id_produto: 8, sku: "EXT-PQS-6KG",  validade: "2024-09-01", lacre: "L-332945", quantidade_disponivel: 12 },
  { id_lote: "LT-2024/05", id_produto: 5, sku: "EXT-CO2-6KG",  validade: "2027-12-05", lacre: "L-993044", quantidade_disponivel: 48 },
  { id_lote: "LT-2024/06", id_produto: 3, sku: "EXT-K-6L",     validade: "2028-06-15", lacre: "L-220194", quantidade_disponivel: 7  },
  { id_lote: "LT-2024/08", id_produto: 9, sku: "EXT-PQS-12KG", validade: "2024-03-25", lacre: "L-771029", quantidade_disponivel: 64 },
  { id_lote: "LT-2024/10", id_produto: 7, sku: "EXT-PQS-4KG",  validade: "2024-08-10", lacre: "L-332910", quantidade_disponivel: 90 },
  { id_lote: "LT-2024/12", id_produto: 8, sku: "EXT-PQS-6KG",  validade: "2024-09-01", lacre: "L-332945", quantidade_disponivel: 38 },
];

// ─── Referência de data para dados simulados ─────────────────────────────────
// Alinhado com a data de referência usada no mock-data.js
const ENTREGAS_REF_DATE = new Date("2024-10-15T18:00:00Z");

function diasAtras(n) {
  const d = new Date(ENTREGAS_REF_DATE);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function horasAtras(n) {
  const d = new Date(ENTREGAS_REF_DATE);
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

function diasAFrente(n) {
  const d = new Date(ENTREGAS_REF_DATE);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

// ─── Status internos possíveis ────────────────────────────────────────────────
const STATUS_INTERNO = {
  A_SEPARAR:           "A separar",
  EM_SEPARACAO:        "Separação em andamento",
  PRONTO_DESPACHO:     "Pronto para despacho",
  DESPACHO_REGISTRADO: "Despacho registrado",
  CANCELADO:           "Cancelado",
};

// ─── Status logísticos possíveis ─────────────────────────────────────────────
const STATUS_LOGISTICO = {
  AGUARDANDO_ENVIO:  "Aguardando envio",
  ENVIADO:           "Enviado",
  EM_TRANSITO:       "Em trânsito",
  SAIU_ENTREGA:      "Saiu para entrega",
  ENTREGUE:          "Entregue",
  ATRASADO:          "Com atraso",
  OCORRENCIA:        "Com ocorrência",
  CANCELADO:         "Cancelado",
};

// ─── Dados simulados de entregas ─────────────────────────────────────────────
// Cada registro representa um pedido no pipeline logístico da RezFire.
// Os campos seguem uma estrutura que permitirá mapeamento futuro com a API do ML.
const ENTREGAS_MOCK = [
  // ── 1. Pedido recém recebido — aguardando separação ───────────────────────
  {
    id_entrega: "ENT-001",
    id_pedido_interno: 201,
    codigo_pedido_ml: "MLB-2894012110",    // Identificador externo (ML)
    codigo_pedido_direto: null,
    canal: "Mercado Livre",
    cliente: "Condomínio Solar das Palmeiras",
    uf: "SP",
    data_venda: horasAtras(3),
    prazo_despacho: diasAFrente(1),       // Despachar até amanhã
    modalidade_envio: "Mercado Envios Coleta",
    id_envio_ml: null,                    // Preenchido na futura integração
    codigo_rastreio: null,
    data_despacho: null,
    previsao_entrega: diasAFrente(5),
    data_entrega: null,
    status_interno: STATUS_INTERNO.A_SEPARAR,
    status_logistico: STATUS_LOGISTICO.AGUARDANDO_ENVIO,
    ocorrencias: [],
    itens: [
      { id_produto: 7, sku: "EXT-PQS-4KG", nome: "Extintor Pó Químico ABC 4kg", quantidade: 3, preco_unitario: 169.90, subtotal: 509.70 },
      { id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente", quantidade: 3, preco_unitario: 34.90, subtotal: 104.70 },
    ],
    valor_total: 614.40,
    separacao: null,                      // null = separação ainda não iniciada
    historico: [
      { data: horasAtras(3), evento: "Pedido recebido", descricao: "Pedido aprovado no Mercado Livre. Aguardando separação.", tipo: "info" },
    ],
  },

  // ── 2. Separação em andamento ─────────────────────────────────────────────
  {
    id_entrega: "ENT-002",
    id_pedido_interno: 202,
    codigo_pedido_ml: "MLB-2894012148",
    codigo_pedido_direto: null,
    canal: "Mercado Livre",
    cliente: "Indústria Metalúrgica Alvorada",
    uf: "SP",
    data_venda: horasAtras(18),
    prazo_despacho: diasAFrente(1),
    modalidade_envio: "Mercado Envios Full",
    id_envio_ml: null,
    codigo_rastreio: null,
    data_despacho: null,
    previsao_entrega: diasAFrente(4),
    data_entrega: null,
    status_interno: STATUS_INTERNO.EM_SEPARACAO,
    status_logistico: STATUS_LOGISTICO.AGUARDANDO_ENVIO,
    ocorrencias: [],
    itens: [
      { id_produto: 2, sku: "EXT-H2O-10L", nome: "Extintor Água Pressurizada 10L", quantidade: 2, preco_unitario: 159.90, subtotal: 319.80 },
      { id_produto: 9, sku: "EXT-PQS-12KG", nome: "Extintor Pó Químico BC 12kg", quantidade: 1, preco_unitario: 329.00, subtotal: 329.00 },
      { id_produto: 10, sku: "MAN-MANG-15", nome: "Mangueira de Incêndio 1½\" 15m", quantidade: 1, preco_unitario: 389.00, subtotal: 389.00 },
    ],
    valor_total: 1037.80,
    separacao: {
      iniciada_em: horasAtras(14),
      itens: [
        {
          id_produto: 2, sku: "EXT-H2O-10L", nome: "Extintor Água Pressurizada 10L",
          quantidade_solicitada: 2,
          lotes: [
            { id_lote: "LT-2024/01", quantidade: 2, validade: "2028-04-10" },
          ],
          quantidade_separada: 2,
          conferido: true,
        },
        {
          id_produto: 9, sku: "EXT-PQS-12KG", nome: "Extintor Pó Químico BC 12kg",
          quantidade_solicitada: 1,
          lotes: [],
          quantidade_separada: 0,
          conferido: false,
        },
        {
          id_produto: 10, sku: "MAN-MANG-15", nome: "Mangueira de Incêndio 1½\" 15m",
          quantidade_solicitada: 1,
          lotes: [],           // Produto sem rastreio por lote
          quantidade_separada: 0,
          conferido: false,
        },
      ],
    },
    historico: [
      { data: horasAtras(18), evento: "Pedido recebido", descricao: "Pedido aprovado no Mercado Livre.", tipo: "info" },
      { data: horasAtras(14), evento: "Separação iniciada", descricao: "Gestor iniciou a conferência dos itens.", tipo: "info" },
    ],
  },

  // ── 3. Pronto para despacho ───────────────────────────────────────────────
  {
    id_entrega: "ENT-003",
    id_pedido_interno: 203,
    codigo_pedido_ml: "MLB-2894012185",
    codigo_pedido_direto: null,
    canal: "Mercado Livre",
    cliente: "Restaurante Família & Sabor",
    uf: "RJ",
    data_venda: diasAtras(2),
    prazo_despacho: ENTREGAS_REF_DATE.toISOString(),   // Hoje — no limite
    modalidade_envio: "Mercado Envios Coleta",
    id_envio_ml: null,
    codigo_rastreio: null,
    data_despacho: null,
    previsao_entrega: diasAFrente(6),
    data_entrega: null,
    status_interno: STATUS_INTERNO.PRONTO_DESPACHO,
    status_logistico: STATUS_LOGISTICO.AGUARDANDO_ENVIO,
    ocorrencias: [],
    itens: [
      { id_produto: 3, sku: "EXT-K-6L", nome: "Extintor Classe K 6L (Cozinhas)", quantidade: 1, preco_unitario: 749.00, subtotal: 749.00 },
      { id_produto: 5, sku: "EXT-CO2-6KG", nome: "Extintor CO2 6kg", quantidade: 1, preco_unitario: 549.00, subtotal: 549.00 },
      { id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente", quantidade: 2, preco_unitario: 34.90, subtotal: 69.80 },
    ],
    valor_total: 1367.80,
    separacao: {
      iniciada_em: diasAtras(1),
      concluida_em: horasAtras(5),
      itens: [
        {
          id_produto: 3, sku: "EXT-K-6L", nome: "Extintor Classe K 6L (Cozinhas)",
          quantidade_solicitada: 1,
          lotes: [{ id_lote: "LT-2024/06", quantidade: 1, validade: "2028-06-15" }],
          quantidade_separada: 1,
          conferido: true,
        },
        {
          id_produto: 5, sku: "EXT-CO2-6KG", nome: "Extintor CO2 6kg",
          quantidade_solicitada: 1,
          lotes: [{ id_lote: "LT-2024/05", quantidade: 1, validade: "2027-12-05" }],
          quantidade_separada: 1,
          conferido: true,
        },
        {
          id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente",
          quantidade_solicitada: 2,
          lotes: [],
          quantidade_separada: 2,
          conferido: true,
        },
      ],
    },
    historico: [
      { data: diasAtras(2), evento: "Pedido recebido", descricao: "Pedido aprovado no Mercado Livre.", tipo: "info" },
      { data: diasAtras(1), evento: "Separação iniciada", descricao: "Gestor iniciou a conferência dos itens.", tipo: "info" },
      { data: horasAtras(5), evento: "Separação concluída", descricao: "Todos os itens conferidos. Pedido pronto para despacho.", tipo: "sucesso" },
    ],
  },

  // ── 4. Enviado — em trânsito ──────────────────────────────────────────────
  {
    id_entrega: "ENT-004",
    id_pedido_interno: 204,
    codigo_pedido_ml: "MLB-2893940210",
    codigo_pedido_direto: null,
    canal: "Mercado Livre",
    cliente: "Colégio Futuro Brilhante",
    uf: "SP",
    data_venda: diasAtras(5),
    prazo_despacho: diasAtras(4),
    modalidade_envio: "Mercado Envios Full",
    id_envio_ml: "SHP-20241010-00042",
    codigo_rastreio: "BR123456789BR",
    data_despacho: diasAtras(4),
    previsao_entrega: diasAFrente(1),
    data_entrega: null,
    status_interno: STATUS_INTERNO.DESPACHO_REGISTRADO,
    status_logistico: STATUS_LOGISTICO.EM_TRANSITO,
    ocorrencias: [],
    itens: [
      { id_produto: 7, sku: "EXT-PQS-4KG", nome: "Extintor Pó Químico ABC 4kg", quantidade: 4, preco_unitario: 169.90, subtotal: 679.60 },
      { id_produto: 12, sku: "SUP-EXT-01", nome: "Suporte de Parede p/ Extintor", quantidade: 4, preco_unitario: 42.00, subtotal: 168.00 },
    ],
    valor_total: 847.60,
    separacao: {
      iniciada_em: diasAtras(5),
      concluida_em: diasAtras(4),
      itens: [
        {
          id_produto: 7, sku: "EXT-PQS-4KG", nome: "Extintor Pó Químico ABC 4kg",
          quantidade_solicitada: 4,
          lotes: [
            { id_lote: "LT-2024/02", quantidade: 2, validade: "2024-08-10" },
            { id_lote: "LT-2024/10", quantidade: 2, validade: "2024-08-10" },
          ],
          quantidade_separada: 4,
          conferido: true,
        },
        {
          id_produto: 12, sku: "SUP-EXT-01", nome: "Suporte de Parede p/ Extintor",
          quantidade_solicitada: 4,
          lotes: [],
          quantidade_separada: 4,
          conferido: true,
        },
      ],
    },
    historico: [
      { data: diasAtras(5), evento: "Pedido recebido", descricao: "Pedido aprovado no Mercado Livre.", tipo: "info" },
      { data: diasAtras(5), evento: "Separação iniciada", descricao: "Gestor iniciou a conferência dos itens.", tipo: "info" },
      { data: diasAtras(4), evento: "Separação concluída", descricao: "Todos os itens conferidos. 4 un. EXT-PQS-4KG em 2 lotes.", tipo: "sucesso" },
      { data: diasAtras(4), evento: "Despacho registrado", descricao: "Pedido despachado. Código de rastreio: BR123456789BR.", tipo: "sucesso" },
      { data: diasAtras(3), evento: "Em trânsito", descricao: "Objeto postado no sistema dos Correios.", tipo: "info" },
    ],
  },

  // ── 5. Enviado — saiu para entrega ────────────────────────────────────────
  {
    id_entrega: "ENT-005",
    id_pedido_interno: 205,
    codigo_pedido_ml: "MLB-2893940330",
    codigo_pedido_direto: null,
    canal: "Mercado Livre",
    cliente: "Academia Fisio & Saúde",
    uf: "RS",
    data_venda: diasAtras(8),
    prazo_despacho: diasAtras(7),
    modalidade_envio: "Mercado Envios Coleta",
    id_envio_ml: "SHP-20241007-00031",
    codigo_rastreio: "BR987654321BR",
    data_despacho: diasAtras(7),
    previsao_entrega: ENTREGAS_REF_DATE.toISOString(),
    data_entrega: null,
    status_interno: STATUS_INTERNO.DESPACHO_REGISTRADO,
    status_logistico: STATUS_LOGISTICO.SAIU_ENTREGA,
    ocorrencias: [],
    itens: [
      { id_produto: 8, sku: "EXT-PQS-6KG", nome: "Extintor Pó Químico ABC 6kg", quantidade: 3, preco_unitario: 219.90, subtotal: 659.70 },
    ],
    valor_total: 659.70,
    separacao: {
      iniciada_em: diasAtras(8),
      concluida_em: diasAtras(7),
      itens: [
        {
          id_produto: 8, sku: "EXT-PQS-6KG", nome: "Extintor Pó Químico ABC 6kg",
          quantidade_solicitada: 3,
          lotes: [
            { id_lote: "LT-2024/03", quantidade: 1, validade: "2024-09-01" },
            { id_lote: "LT-2024/12", quantidade: 2, validade: "2024-09-01" },
          ],
          quantidade_separada: 3,
          conferido: true,
        },
      ],
    },
    historico: [
      { data: diasAtras(8), evento: "Pedido recebido", descricao: "Pedido aprovado no Mercado Livre.", tipo: "info" },
      { data: diasAtras(8), evento: "Separação iniciada", descricao: "Gestor iniciou a conferência dos itens.", tipo: "info" },
      { data: diasAtras(7), evento: "Separação concluída", descricao: "3 un. EXT-PQS-6KG em 2 lotes conferidas.", tipo: "sucesso" },
      { data: diasAtras(7), evento: "Despacho registrado", descricao: "Pedido despachado. Código: BR987654321BR.", tipo: "sucesso" },
      { data: diasAtras(5), evento: "Em trânsito", descricao: "Objeto em trânsito para a cidade de destino.", tipo: "info" },
      { data: horasAtras(6), evento: "Saiu para entrega", descricao: "Objeto saiu para entrega ao destinatário.", tipo: "info" },
    ],
  },

  // ── 6. Entregue ───────────────────────────────────────────────────────────
  {
    id_entrega: "ENT-006",
    id_pedido_interno: 206,
    codigo_pedido_ml: "MLB-2893801440",
    codigo_pedido_direto: null,
    canal: "Mercado Livre",
    cliente: "Supermercado Bom Preço Ltda",
    uf: "PR",
    data_venda: diasAtras(14),
    prazo_despacho: diasAtras(13),
    modalidade_envio: "Mercado Envios Full",
    id_envio_ml: "SHP-20241001-00021",
    codigo_rastreio: "BR555444333BR",
    data_despacho: diasAtras(13),
    previsao_entrega: diasAtras(8),
    data_entrega: diasAtras(9),
    status_interno: STATUS_INTERNO.DESPACHO_REGISTRADO,
    status_logistico: STATUS_LOGISTICO.ENTREGUE,
    ocorrencias: [],
    itens: [
      { id_produto: 7, sku: "EXT-PQS-4KG", nome: "Extintor Pó Químico ABC 4kg", quantidade: 3, preco_unitario: 169.90, subtotal: 509.70 },
      { id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente", quantidade: 3, preco_unitario: 34.90, subtotal: 104.70 },
      { id_produto: 12, sku: "SUP-EXT-01", nome: "Suporte de Parede p/ Extintor", quantidade: 3, preco_unitario: 42.00, subtotal: 126.00 },
    ],
    valor_total: 740.40,
    separacao: {
      iniciada_em: diasAtras(14),
      concluida_em: diasAtras(13),
      itens: [
        {
          id_produto: 7, sku: "EXT-PQS-4KG", nome: "Extintor Pó Químico ABC 4kg",
          quantidade_solicitada: 3,
          lotes: [{ id_lote: "LT-2024/02", quantidade: 3, validade: "2024-08-10" }],
          quantidade_separada: 3,
          conferido: true,
        },
        {
          id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente",
          quantidade_solicitada: 3,
          lotes: [],
          quantidade_separada: 3,
          conferido: true,
        },
        {
          id_produto: 12, sku: "SUP-EXT-01", nome: "Suporte de Parede p/ Extintor",
          quantidade_solicitada: 3,
          lotes: [],
          quantidade_separada: 3,
          conferido: true,
        },
      ],
    },
    historico: [
      { data: diasAtras(14), evento: "Pedido recebido", descricao: "Pedido aprovado no Mercado Livre.", tipo: "info" },
      { data: diasAtras(14), evento: "Separação iniciada", descricao: "Gestor iniciou a conferência dos itens.", tipo: "info" },
      { data: diasAtras(13), evento: "Separação concluída", descricao: "Todos os itens conferidos.", tipo: "sucesso" },
      { data: diasAtras(13), evento: "Despacho registrado", descricao: "Código de rastreio: BR555444333BR.", tipo: "sucesso" },
      { data: diasAtras(11), evento: "Em trânsito", descricao: "Objeto em trânsito.", tipo: "info" },
      { data: diasAtras(9), evento: "Entregue", descricao: "Entrega confirmada ao destinatário (simulação).", tipo: "sucesso" },
    ],
  },

  // ── 7. Pedido ATRASADO — prazo de despacho vencido ───────────────────────
  {
    id_entrega: "ENT-007",
    id_pedido_interno: 207,
    codigo_pedido_ml: "MLB-2894000099",
    codigo_pedido_direto: null,
    canal: "Mercado Livre",
    cliente: "Hotel Fazenda Recanto Verde",
    uf: "MG",
    data_venda: diasAtras(4),
    prazo_despacho: diasAtras(2),      // Prazo vencido há 2 dias
    modalidade_envio: "Mercado Envios Coleta",
    id_envio_ml: null,
    codigo_rastreio: null,
    data_despacho: null,
    previsao_entrega: diasAFrente(3),
    data_entrega: null,
    status_interno: STATUS_INTERNO.A_SEPARAR,
    status_logistico: STATUS_LOGISTICO.AGUARDANDO_ENVIO,
    ocorrencias: [
      { data: diasAtras(1), tipo: "atraso_despacho", descricao: "Prazo de despacho vencido. O pedido deveria ter sido despachado em " + new Date(diasAtras(2)).toLocaleDateString("pt-BR") + "." },
    ],
    itens: [
      { id_produto: 5, sku: "EXT-CO2-6KG", nome: "Extintor CO2 6kg", quantidade: 2, preco_unitario: 549.00, subtotal: 1098.00 },
      { id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente", quantidade: 2, preco_unitario: 34.90, subtotal: 69.80 },
    ],
    valor_total: 1167.80,
    separacao: null,
    historico: [
      { data: diasAtras(4), evento: "Pedido recebido", descricao: "Pedido aprovado no Mercado Livre.", tipo: "info" },
      { data: diasAtras(1), evento: "Alerta: prazo vencido", descricao: "Prazo de despacho expirado. Pedido ainda não foi separado.", tipo: "alerta" },
    ],
  },

  // ── 8. Pedido com ocorrência logística ────────────────────────────────────
  {
    id_entrega: "ENT-008",
    id_pedido_interno: 208,
    codigo_pedido_ml: "MLB-2893850222",
    codigo_pedido_direto: null,
    canal: "Mercado Livre",
    cliente: "Distribuidora de Alimentos União",
    uf: "SC",
    data_venda: diasAtras(10),
    prazo_despacho: diasAtras(9),
    modalidade_envio: "Mercado Envios Full",
    id_envio_ml: "SHP-20241005-00018",
    codigo_rastreio: "BR112233445BR",
    data_despacho: diasAtras(9),
    previsao_entrega: diasAtras(4),
    data_entrega: null,
    status_interno: STATUS_INTERNO.DESPACHO_REGISTRADO,
    status_logistico: STATUS_LOGISTICO.OCORRENCIA,
    ocorrencias: [
      { data: diasAtras(3), tipo: "ocorrencia_logistica", descricao: "Objeto retido na unidade de distribuição. Tentativa de entrega sem sucesso: destinatário ausente." },
    ],
    itens: [
      { id_produto: 6, sku: "EXT-ESP-9L", nome: "Extintor Espuma Mecânica 9L", quantidade: 2, preco_unitario: 289.00, subtotal: 578.00 },
      { id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente", quantidade: 2, preco_unitario: 34.90, subtotal: 69.80 },
    ],
    valor_total: 647.80,
    separacao: {
      iniciada_em: diasAtras(10),
      concluida_em: diasAtras(9),
      itens: [
        {
          id_produto: 6, sku: "EXT-ESP-9L", nome: "Extintor Espuma Mecânica 9L",
          quantidade_solicitada: 2,
          lotes: [],
          quantidade_separada: 2,
          conferido: true,
        },
        {
          id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente",
          quantidade_solicitada: 2,
          lotes: [],
          quantidade_separada: 2,
          conferido: true,
        },
      ],
    },
    historico: [
      { data: diasAtras(10), evento: "Pedido recebido", descricao: "Pedido aprovado no Mercado Livre.", tipo: "info" },
      { data: diasAtras(10), evento: "Separação iniciada", descricao: "Gestor iniciou a conferência dos itens.", tipo: "info" },
      { data: diasAtras(9), evento: "Separação concluída", descricao: "Todos os itens conferidos.", tipo: "sucesso" },
      { data: diasAtras(9), evento: "Despacho registrado", descricao: "Código: BR112233445BR.", tipo: "sucesso" },
      { data: diasAtras(7), evento: "Em trânsito", descricao: "Objeto em trânsito para destino.", tipo: "info" },
      { data: diasAtras(3), evento: "Ocorrência registrada", descricao: "Tentativa de entrega sem sucesso. Destinatário ausente.", tipo: "alerta" },
    ],
  },

  // ── 9. Cancelado ─────────────────────────────────────────────────────────
  {
    id_entrega: "ENT-009",
    id_pedido_interno: 209,
    codigo_pedido_ml: "MLB-2893890555",
    codigo_pedido_direto: null,
    canal: "Mercado Livre",
    cliente: "Padaria e Confeitaria Central",
    uf: "RJ",
    data_venda: diasAtras(12),
    prazo_despacho: diasAtras(11),
    modalidade_envio: "Mercado Envios Coleta",
    id_envio_ml: null,
    codigo_rastreio: null,
    data_despacho: null,
    previsao_entrega: null,
    data_entrega: null,
    status_interno: STATUS_INTERNO.CANCELADO,
    status_logistico: STATUS_LOGISTICO.CANCELADO,
    ocorrencias: [
      { data: diasAtras(11), tipo: "cancelamento", descricao: "Pedido cancelado pelo comprador antes do despacho." },
    ],
    itens: [
      { id_produto: 3, sku: "EXT-K-6L", nome: "Extintor Classe K 6L (Cozinhas)", quantidade: 1, preco_unitario: 749.00, subtotal: 749.00 },
    ],
    valor_total: 749.00,
    separacao: null,
    historico: [
      { data: diasAtras(12), evento: "Pedido recebido", descricao: "Pedido aprovado no Mercado Livre.", tipo: "info" },
      { data: diasAtras(11), evento: "Pedido cancelado", descricao: "Pedido cancelado pelo comprador antes do despacho.", tipo: "erro" },
    ],
  },

  // ── 10. Venda direta — multi-produto ─────────────────────────────────────
  {
    id_entrega: "ENT-010",
    id_pedido_interno: 210,
    codigo_pedido_ml: null,
    codigo_pedido_direto: "DIR-2024-042",
    canal: "Venda Direta",
    cliente: "Galpão Armazéns Gerais",
    uf: "GO",
    data_venda: diasAtras(3),
    prazo_despacho: diasAFrente(2),
    modalidade_envio: "Transportadora Parceira",
    id_envio_ml: null,
    codigo_rastreio: null,
    data_despacho: null,
    previsao_entrega: diasAFrente(7),
    data_entrega: null,
    status_interno: STATUS_INTERNO.PRONTO_DESPACHO,
    status_logistico: STATUS_LOGISTICO.AGUARDANDO_ENVIO,
    ocorrencias: [],
    itens: [
      { id_produto: 2, sku: "EXT-H2O-10L", nome: "Extintor Água Pressurizada 10L", quantidade: 3, preco_unitario: 159.90, subtotal: 479.70 },
      { id_produto: 7, sku: "EXT-PQS-4KG", nome: "Extintor Pó Químico ABC 4kg", quantidade: 3, preco_unitario: 169.90, subtotal: 509.70 },
      { id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente", quantidade: 6, preco_unitario: 34.90, subtotal: 209.40 },
    ],
    valor_total: 1198.80,
    separacao: {
      iniciada_em: diasAtras(2),
      concluida_em: diasAtras(1),
      itens: [
        {
          id_produto: 2, sku: "EXT-H2O-10L", nome: "Extintor Água Pressurizada 10L",
          quantidade_solicitada: 3,
          lotes: [{ id_lote: "LT-2024/01", quantidade: 3, validade: "2028-04-10" }],
          quantidade_separada: 3,
          conferido: true,
        },
        {
          id_produto: 7, sku: "EXT-PQS-4KG", nome: "Extintor Pó Químico ABC 4kg",
          quantidade_solicitada: 3,
          lotes: [{ id_lote: "LT-2024/10", quantidade: 3, validade: "2024-08-10" }],
          quantidade_separada: 3,
          conferido: true,
        },
        {
          id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente",
          quantidade_solicitada: 6,
          lotes: [],
          quantidade_separada: 6,
          conferido: true,
        },
      ],
    },
    historico: [
      { data: diasAtras(3), evento: "Pedido recebido", descricao: "Venda direta registrada pelo gestor.", tipo: "info" },
      { data: diasAtras(2), evento: "Separação iniciada", descricao: "Gestor iniciou a conferência dos itens.", tipo: "info" },
      { data: diasAtras(1), evento: "Separação concluída", descricao: "Todos os itens conferidos. Pedido pronto para despacho.", tipo: "sucesso" },
    ],
  },

  // ── 11. Pedido com muitas unidades de um mesmo produto ───────────────────
  {
    id_entrega: "ENT-011",
    id_pedido_interno: 211,
    codigo_pedido_ml: "MLB-2894050999",
    codigo_pedido_direto: null,
    canal: "Mercado Livre",
    cliente: "Centro Logístico Bandeirantes",
    uf: "SP",
    data_venda: horasAtras(8),
    prazo_despacho: diasAFrente(2),
    modalidade_envio: "Mercado Envios Full",
    id_envio_ml: null,
    codigo_rastreio: null,
    data_despacho: null,
    previsao_entrega: diasAFrente(6),
    data_entrega: null,
    status_interno: STATUS_INTERNO.A_SEPARAR,
    status_logistico: STATUS_LOGISTICO.AGUARDANDO_ENVIO,
    ocorrencias: [],
    itens: [
      { id_produto: 7, sku: "EXT-PQS-4KG", nome: "Extintor Pó Químico ABC 4kg", quantidade: 10, preco_unitario: 169.90, subtotal: 1699.00 },
      { id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente", quantidade: 10, preco_unitario: 34.90, subtotal: 349.00 },
    ],
    valor_total: 2048.00,
    separacao: null,
    historico: [
      { data: horasAtras(8), evento: "Pedido recebido", descricao: "Pedido aprovado no Mercado Livre.", tipo: "info" },
    ],
  },

  // ── 12. Pedido recente — entrega concluída ────────────────────────────────
  {
    id_entrega: "ENT-012",
    id_pedido_interno: 212,
    codigo_pedido_ml: "MLB-2893750119",
    codigo_pedido_direto: null,
    canal: "Mercado Livre",
    cliente: "Transportadora Rodoviária Rápida",
    uf: "SP",
    data_venda: diasAtras(21),
    prazo_despacho: diasAtras(20),
    modalidade_envio: "Mercado Envios Coleta",
    id_envio_ml: "SHP-20240924-00011",
    codigo_rastreio: "BR771122334BR",
    data_despacho: diasAtras(20),
    previsao_entrega: diasAtras(15),
    data_entrega: diasAtras(16),
    status_interno: STATUS_INTERNO.DESPACHO_REGISTRADO,
    status_logistico: STATUS_LOGISTICO.ENTREGUE,
    ocorrencias: [],
    itens: [
      { id_produto: 1, sku: "DET-FUM-01", nome: "Detector de Fumaça Óptico", quantidade: 4, preco_unitario: 89.90, subtotal: 359.60 },
      { id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente", quantidade: 10, preco_unitario: 34.90, subtotal: 349.00 },
    ],
    valor_total: 708.60,
    separacao: {
      iniciada_em: diasAtras(21),
      concluida_em: diasAtras(20),
      itens: [
        {
          id_produto: 1, sku: "DET-FUM-01", nome: "Detector de Fumaça Óptico",
          quantidade_solicitada: 4,
          lotes: [],
          quantidade_separada: 4,
          conferido: true,
        },
        {
          id_produto: 11, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente",
          quantidade_solicitada: 10,
          lotes: [],
          quantidade_separada: 10,
          conferido: true,
        },
      ],
    },
    historico: [
      { data: diasAtras(21), evento: "Pedido recebido", descricao: "Pedido aprovado no Mercado Livre.", tipo: "info" },
      { data: diasAtras(21), evento: "Separação iniciada", descricao: "Gestor iniciou a conferência.", tipo: "info" },
      { data: diasAtras(20), evento: "Separação concluída", descricao: "Todos os itens conferidos.", tipo: "sucesso" },
      { data: diasAtras(20), evento: "Despacho registrado", descricao: "Código: BR771122334BR.", tipo: "sucesso" },
      { data: diasAtras(18), evento: "Em trânsito", descricao: "Objeto em trânsito para o destino.", tipo: "info" },
      { data: diasAtras(16), evento: "Entregue", descricao: "Entrega confirmada ao destinatário (simulação).", tipo: "sucesso" },
    ],
  },
];

// ─── Chave de armazenamento local ─────────────────────────────────────────────
const ENTREGAS_STORAGE_KEY = "rezfire.entregas";

// ─── Funções de acesso aos dados ──────────────────────────────────────────────

/**
 * Carrega as entregas do localStorage.
 * Na primeira execução, persiste os dados simulados.
 */
function loadEntregas() {
  try {
    const raw = localStorage.getItem(ENTREGAS_STORAGE_KEY);
    if (!raw) {
      const initial = ENTREGAS_MOCK.map((e) => ({ ...e }));
      localStorage.setItem(ENTREGAS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ENTREGAS_MOCK.map((e) => ({ ...e }));
  } catch {
    return ENTREGAS_MOCK.map((e) => ({ ...e }));
  }
}

/**
 * Persiste as entregas no localStorage.
 */
function saveEntregas(entregas) {
  localStorage.setItem(ENTREGAS_STORAGE_KEY, JSON.stringify(entregas));
}

/**
 * Retorna os lotes disponíveis para um determinado produto (por id_produto).
 * Combina os lotes pré-definidos com o lote configurado no cadastro de produtos.
 */
function getLotesPorProduto(id_produto) {
  const lotes = [...LOTES_SIMULADOS.filter((l) => l.id_produto === id_produto)];

  // Se o gestor cadastrou/editou um produto com detalhes de lote e validade na tela de Produtos:
  if (window.RezFireData && typeof window.RezFireData.loadProducts === "function") {
    const produtos = window.RezFireData.loadProducts();
    const prod = produtos.find((p) => p.id_produto === id_produto);
    if (prod && prod.detalhes_extintor) {
      const d = prod.detalhes_extintor;
      const loteId = d.id_lote || (d.numero_lacre ? `LT-${d.numero_lacre}` : null);
      if (loteId && !lotes.some((l) => l.id_lote === loteId)) {
        lotes.unshift({
          id_lote: loteId,
          id_produto: prod.id_produto,
          sku: prod.sku,
          validade: d.data_validade || "2028-12-31",
          lacre: d.numero_lacre || "L-000000",
          quantidade_disponivel: Number(prod.quantidade_atual || 0),
        });
      }
    }
  }

  return lotes;
}

/**
 * Verifica se um pedido está atrasado para despacho.
 * Um pedido é considerado atrasado se:
 * - Tem prazo de despacho definido
 * - Ainda não foi despachado (sem data_despacho)
 * - O prazo já expirou em relação à data de referência
 */
function isAtrasadoDespacho(entrega) {
  if (!entrega.prazo_despacho || entrega.data_despacho) return false;
  if (entrega.status_interno === STATUS_INTERNO.CANCELADO) return false;
  const prazo = new Date(entrega.prazo_despacho).getTime();
  const ref = ENTREGAS_REF_DATE.getTime();
  return ref > prazo;
}

/**
 * Verifica se um pedido está com entrega atrasada.
 * Só considera atrasado se tiver previsão de entrega definida e
 * o pedido ainda não foi entregue.
 */
function isAtrasadoEntrega(entrega) {
  if (!entrega.previsao_entrega || entrega.data_entrega) return false;
  if (entrega.status_logistico === STATUS_LOGISTICO.CANCELADO) return false;
  if (entrega.status_logistico === STATUS_LOGISTICO.ENTREGUE) return false;
  const previsao = new Date(entrega.previsao_entrega).getTime();
  const ref = ENTREGAS_REF_DATE.getTime();
  return ref > previsao;
}

/**
 * Retorna true se o pedido exige atenção do gestor.
 */
function temProblema(entrega) {
  if (entrega.ocorrencias && entrega.ocorrencias.length > 0) return true;
  if (isAtrasadoDespacho(entrega)) return true;
  if (isAtrasadoEntrega(entrega)) return true;
  return false;
}

/**
 * Calcula os indicadores operacionais a partir da lista de entregas.
 */
function computeEntregasKPIs(entregas) {
  const ativas = entregas.filter(
    (e) => e.status_interno !== STATUS_INTERNO.CANCELADO
  );

  return {
    aSeparar: ativas.filter(
      (e) =>
        e.status_interno === STATUS_INTERNO.A_SEPARAR ||
        e.status_interno === STATUS_INTERNO.EM_SEPARACAO
    ).length,
    prontoDespacho: ativas.filter(
      (e) => e.status_interno === STATUS_INTERNO.PRONTO_DESPACHO
    ).length,
    emTransito: ativas.filter((e) =>
      [
        STATUS_LOGISTICO.ENVIADO,
        STATUS_LOGISTICO.EM_TRANSITO,
        STATUS_LOGISTICO.SAIU_ENTREGA,
      ].includes(e.status_logistico)
    ).length,
    entregues: ativas.filter(
      (e) => e.status_logistico === STATUS_LOGISTICO.ENTREGUE
    ).length,
    comProblemas: entregas.filter((e) => temProblema(e)).length,
  };
}

// ─── Exportação global ────────────────────────────────────────────────────────
window.RezFireEntregas = {
  loadEntregas,
  saveEntregas,
  getLotesPorProduto,
  isAtrasadoDespacho,
  isAtrasadoEntrega,
  temProblema,
  computeEntregasKPIs,
  STATUS_INTERNO,
  STATUS_LOGISTICO,
  ENTREGAS_REF_DATE,
  LOTES_SIMULADOS,
};
