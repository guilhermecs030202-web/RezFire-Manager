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
  {
    "id_lote": "LT-2024/01",
    "id_produto": 1,
    "sku": "EXT-PQS-4KG",
    "validade": "2029-01-15",
    "lacre": "INM-948201",
    "quantidade_disponivel": 45
  },
  {
    "id_lote": "LT-2023/15",
    "id_produto": 1,
    "sku": "EXT-PQS-4KG",
    "validade": "2027-04-15",
    "lacre": "INM-332910",
    "quantidade_disponivel": 20
  },
  {
    "id_lote": "LT-2024/04",
    "id_produto": 2,
    "sku": "EXT-H2O-10L",
    "validade": "2028-04-10",
    "lacre": "INM-849202",
    "quantidade_disponivel": 45
  },
  {
    "id_lote": "LT-2024/07",
    "id_produto": 3,
    "sku": "EXT-CO2-6KG",
    "validade": "2028-02-20",
    "lacre": "INM-773041",
    "quantidade_disponivel": 22
  },
  {
    "id_lote": "LT-2023/08",
    "id_produto": 4,
    "sku": "EXT-CO2-4KG",
    "validade": "2027-11-20",
    "lacre": "INM-771920",
    "quantidade_disponivel": 8
  },
  {
    "id_lote": "LT-2024/11",
    "id_produto": 5,
    "sku": "EXT-K-6L",
    "validade": "2028-06-15",
    "lacre": "INM-882031",
    "quantidade_disponivel": 6
  },
  {
    "id_lote": "LT-2022/02",
    "id_produto": 6,
    "sku": "EXT-PQS-12KG",
    "validade": "2024-03-25",
    "lacre": "INM-662910",
    "quantidade_disponivel": 0
  }
];

// ─── Referência de data para dados simulados ─────────────────────────────────
// Alinhado com a data de referência usada no mock-data.js
const ENTREGAS_REF_DATE = new Date();

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
  {
    "id_entrega": "ENT-001",
    "id_pedido_interno": 57,
    "codigo_pedido_ml": null,
    "codigo_pedido_direto": "PED-0057",
    "canal": "Venda Direta",
    "cliente": "Centro Empresarial Millennium",
    "uf": "SP",
    "data_venda": horasAtras(2),
    "prazo_despacho": diasAFrente(1),
    "modalidade_envio": "Transportadora Parceira (Rodonaves)",
    "id_envio_ml": null,
    "codigo_rastreio": null,
    "data_despacho": null,
    "previsao_entrega": diasAFrente(4),
    "data_entrega": null,
    "status_interno": STATUS_INTERNO.A_SEPARAR,
    "status_logistico": STATUS_LOGISTICO.AGUARDANDO_ENVIO,
    "ocorrencias": [],
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 2,
        "preco_unitario": 169.9,
        "subtotal": 339.8
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 2,
        "preco_unitario": 18.9,
        "subtotal": 37.8
      }
    ],
    "valor_total": 377.6,
    "separacao": null,
    "historico": [
      {
        "data": horasAtras(2),
        "evento": "Pedido Recebido",
        "descricao": "Aguardando separação física dos extintores no galpão.",
        "tipo": "info"
      }
    ]
  },
  {
    "id_entrega": "ENT-002",
    "id_pedido_interno": 56,
    "codigo_pedido_ml": null,
    "codigo_pedido_direto": "PED-0056",
    "canal": "Venda Direta",
    "cliente": "Escola Técnica Integrada",
    "uf": "PR",
    "data_venda": horasAtras(5),
    "prazo_despacho": diasAFrente(1),
    "modalidade_envio": "Transportadora Parceira (Rodonaves)",
    "id_envio_ml": null,
    "codigo_rastreio": null,
    "data_despacho": null,
    "previsao_entrega": diasAFrente(5),
    "data_entrega": null,
    "status_interno": STATUS_INTERNO.EM_SEPARACAO,
    "status_logistico": STATUS_LOGISTICO.AGUARDANDO_ENVIO,
    "ocorrencias": [],
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 2,
        "preco_unitario": 169.9,
        "subtotal": 339.8
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 2,
        "preco_unitario": 18.9,
        "subtotal": 37.8
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 2,
        "preco_unitario": 34.9,
        "subtotal": 69.8
      }
    ],
    "valor_total": 447.4,
    "separacao": {
      "responsavel": "Operador Galpão",
      "iniciada_em": horasAtras(1),
      "lotes_vinculados": [
        {
          "id_produto": 1,
          "id_lote": "LT-2024/01",
          "quantidade": 2,
          "validade": "2029-01-15",
          "lacre": "INM-948201"
        }
      ]
    },
    "historico": [
      {
        "data": horasAtras(5),
        "evento": "Pedido Recebido",
        "descricao": "Aprovado no financeiro.",
        "tipo": "info"
      },
      {
        "data": horasAtras(1),
        "evento": "Separação Iniciada",
        "descricao": "Extintores sendo conferidos no galpão.",
        "tipo": "info"
      }
    ]
  },
  {
    "id_entrega": "ENT-003",
    "id_pedido_interno": 55,
    "codigo_pedido_ml": "MLB-2894012055",
    "codigo_pedido_direto": null,
    "canal": "Mercado Livre",
    "cliente": "Laboratório Clínico Biolab",
    "uf": "SP",
    "data_venda": diasAtras(1),
    "prazo_despacho": horasAtras(2),
    "modalidade_envio": "Mercado Envios Coleta",
    "id_envio_ml": "ENV-48920194",
    "codigo_rastreio": "BR-ML-7729104",
    "data_despacho": null,
    "previsao_entrega": diasAFrente(2),
    "data_entrega": null,
    "status_interno": STATUS_INTERNO.PRONTO_DESPACHO,
    "status_logistico": STATUS_LOGISTICO.AGUARDANDO_ENVIO,
    "ocorrencias": [
      {
        "data": horasAtras(1),
        "tipo": "Atraso na Coleta",
        "descricao": "Transportadora do Mercado Livre atrasou a janela da tarde. Coleta remarcada para manhã seguinte."
      }
    ],
    "itens": [
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 3,
        "preco_unitario": 159.9,
        "subtotal": 479.7
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 3,
        "preco_unitario": 18.9,
        "subtotal": 56.7
      }
    ],
    "valor_total": 536.4,
    "separacao": {
      "responsavel": "Operador Galpão",
      "iniciada_em": diasAtras(1),
      "concluida_em": horasAtras(3),
      "lotes_vinculados": [
        {
          "id_produto": 2,
          "id_lote": "LT-2024/04",
          "quantidade": 3,
          "validade": "2028-04-10",
          "lacre": "INM-849202"
        }
      ]
    },
    "historico": [
      {
        "data": diasAtras(1),
        "evento": "Venda Mercado Livre",
        "descricao": "Pedido aprovado via Mercado Envios.",
        "tipo": "info"
      },
      {
        "data": horasAtras(3),
        "evento": "Pronto para Despacho",
        "descricao": "Volumes embalados com etiquetas ML afixadas.",
        "tipo": "info"
      }
    ]
  },
  {
    "id_entrega": "ENT-004",
    "id_pedido_interno": 54,
    "codigo_pedido_ml": "MLB-2894012054",
    "codigo_pedido_direto": null,
    "canal": "Mercado Livre",
    "cliente": "Teatro Municipal Carlos Gomes",
    "uf": "RJ",
    "data_venda": diasAtras(1),
    "prazo_despacho": diasAtras(1),
    "modalidade_envio": "Mercado Envios Coleta",
    "id_envio_ml": "ENV-48920150",
    "codigo_rastreio": "QB-948201490BR",
    "data_despacho": horasAtras(8),
    "previsao_entrega": diasAFrente(3),
    "data_entrega": null,
    "status_interno": STATUS_INTERNO.DESPACHO_REGISTRADO,
    "status_logistico": STATUS_LOGISTICO.EM_TRANSITO,
    "ocorrencias": [],
    "itens": [
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 4,
        "preco_unitario": 459,
        "subtotal": 1836
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 4,
        "preco_unitario": 34.9,
        "subtotal": 139.6
      }
    ],
    "valor_total": 1975.6,
    "separacao": {
      "responsavel": "Operador Galpão",
      "iniciada_em": diasAtras(1),
      "concluida_em": diasAtras(1),
      "lotes_vinculados": [
        {
          "id_produto": 3,
          "id_lote": "LT-2024/07",
          "quantidade": 4,
          "validade": "2028-02-20",
          "lacre": "INM-773041"
        }
      ]
    },
    "historico": [
      {
        "data": diasAtras(1),
        "evento": "Venda ML",
        "descricao": "Aprovado.",
        "tipo": "info"
      },
      {
        "data": horasAtras(8),
        "evento": "Coletado",
        "descricao": "Mercado Envios realizou a coleta.",
        "tipo": "info"
      }
    ]
  },
  {
    "id_entrega": "ENT-005",
    "id_pedido_interno": 53,
    "codigo_pedido_ml": "MLB-2894012053",
    "codigo_pedido_direto": null,
    "canal": "Mercado Livre",
    "cliente": "Farmácia Droga Express",
    "uf": "SP",
    "data_venda": diasAtras(2),
    "prazo_despacho": diasAtras(1),
    "modalidade_envio": "Mercado Envios Coleta",
    "id_envio_ml": "ENV-48920112",
    "codigo_rastreio": "QB-948201230BR",
    "data_despacho": diasAtras(1),
    "previsao_entrega": diasAFrente(1),
    "data_entrega": null,
    "status_interno": STATUS_INTERNO.DESPACHO_REGISTRADO,
    "status_logistico": STATUS_LOGISTICO.EM_TRANSITO,
    "ocorrencias": [],
    "itens": [
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 4,
        "preco_unitario": 389,
        "subtotal": 1556
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 4,
        "preco_unitario": 18.9,
        "subtotal": 75.6
      }
    ],
    "valor_total": 1631.6,
    "separacao": {
      "responsavel": "Operador Galpão",
      "lotes_vinculados": [
        {
          "id_produto": 4,
          "id_lote": "LT-2023/08",
          "quantidade": 4,
          "validade": "2027-11-20",
          "lacre": "INM-771920"
        }
      ]
    },
    "historico": [
      {
        "data": diasAtras(2),
        "evento": "Pedido Recebido",
        "descricao": "Aprovado.",
        "tipo": "info"
      },
      {
        "data": diasAtras(1),
        "evento": "Despachado",
        "descricao": "Coleta realizada.",
        "tipo": "info"
      }
    ]
  },
  {
    "id_entrega": "ENT-006",
    "id_pedido_interno": 52,
    "codigo_pedido_ml": null,
    "codigo_pedido_direto": "PED-0052",
    "canal": "Venda Direta",
    "cliente": "Gráfica e Editora Moderna",
    "uf": "RS",
    "data_venda": diasAtras(3),
    "prazo_despacho": diasAtras(2),
    "modalidade_envio": "Transportadora Parceira (Rodonaves)",
    "id_envio_ml": null,
    "codigo_rastreio": "ROD-8820491",
    "data_despacho": diasAtras(2),
    "previsao_entrega": diasAtras(0),
    "data_entrega": horasAtras(4),
    "status_interno": STATUS_INTERNO.DESPACHO_REGISTRADO,
    "status_logistico": STATUS_LOGISTICO.ENTREGUE,
    "ocorrencias": [],
    "itens": [
      {
        "id_produto": 11,
        "sku": "DET-FUM-01",
        "nome": "Detector de Fumaça Óptico",
        "quantidade": 8,
        "preco_unitario": 89.9,
        "subtotal": 719.2
      }
    ],
    "valor_total": 719.2,
    "separacao": {
      "responsavel": "Operador Galpão",
      "lotes_vinculados": []
    },
    "historico": [
      {
        "data": diasAtras(3),
        "evento": "Venda Direta",
        "descricao": "Aprovado.",
        "tipo": "info"
      },
      {
        "data": diasAtras(2),
        "evento": "Despachado",
        "descricao": "Rodonaves coletou.",
        "tipo": "info"
      },
      {
        "data": horasAtras(4),
        "evento": "Entregue",
        "descricao": "Recebido pelo cliente no RS.",
        "tipo": "info"
      }
    ]
  }
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
      if (localStorage.getItem("rezfire.mock_version") !== "rezfire_v2_2026") {
        localStorage.setItem("rezfire.mock_version", "rezfire_v2_2026");
        saveEntregas(ENTREGAS_MOCK);
        return ENTREGAS_MOCK;
      }
    } catch {}
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
  let lotes = [];
  if (window.RezFireData && typeof window.RezFireData.loadLotes === "function") {
    lotes = window.RezFireData.loadLotes().filter((l) => l.id_produto === id_produto);
  } else {
    lotes = [...LOTES_SIMULADOS.filter((l) => l.id_produto === id_produto)];
  }

  // Ordena por validade mais próxima (FEFO)
  lotes.sort((a, b) => new Date(a.validade || "9999-12-31").getTime() - new Date(b.validade || "9999-12-31").getTime());

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
