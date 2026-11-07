/**
 * mock-anuncios.js
 * Dados simulados e camada de serviços para a tela de Anúncios do Mercado Livre — RezFire Manager.
 *
 * Módulo independente que integra com os produtos e estoque já existentes no RezFireData.
 * Preparado para fácil substituição por chamadas reais à API REST do Mercado Livre via Backend (OAuth 2.0).
 *
 * SUPORTE COMPLETO A ANÚNCIOS COM MÚLTIPLOS ITENS (KITS / COMBOS / BUNDLES)
 * Conforme especificação do banco (tabela associativa produto_anuncio com quantidade_anunciada):
 * Um anúncio pode conter 1 produto simples, múltiplos produtos (Kit) ou um Combo do catálogo.
 * O estoque disponível do anúncio é governado pelo componente com menor saldo proporcional (gargalo).
 */
(function () {
  const STORAGE_KEY = "rezfire.anuncios";
  const SYNC_META_KEY = "rezfire.anuncios.sync";

  // Data base de simulação sincronizada com os outros mocks
  const REF_DATE = new Date();

  function subDays(days, hours = 0) {
    const d = new Date(REF_DATE.getTime() - (days * 24 + hours) * 3600 * 1000);
    return d.toISOString();
  }

  /**
   * Helper para normalizar itens_anuncio de um anúncio:
   * Retorna array de { id_produto, quantidade_anunciada }
   * Suporta retrocompatibilidade com anúncio que tenha apenas id_produto (quantidade = 1).
   */
  function extrairItensAnuncio(anuncio) {
    if (Array.isArray(anuncio.itens_anuncio) && anuncio.itens_anuncio.length > 0) {
      return anuncio.itens_anuncio.map((item) => ({
        id_produto: Number(item.id_produto),
        quantidade_anunciada: Number(item.quantidade_anunciada || 1)
      }));
    }
    if (anuncio.id_produto) {
      return [{
        id_produto: Number(anuncio.id_produto),
        quantidade_anunciada: 1
      }];
    }
    return [];
  }

  // Anúncios iniciais simulados cobrindo itens unitários e ANÚNCIOS MULTI-ITEM (Kits e Combos)
  const DEFAULT_ANUNCIOS = [
  {
    "id_anuncio": 1,
    "ml_item_id": "MLB-2894012110",
    "titulo": "Extintor De Incêndio Pó ABC 4kg Automotivo E Comercial Com Suporte",
    "tipo_composicao": "kit",
    "itens_anuncio": [
      {
        "id_produto": 1,
        "quantidade_anunciada": 1
      },
      {
        "id_produto": 8,
        "quantidade_anunciada": 1
      }
    ],
    "preco": 188.8,
    "quantidade_disponivel": 65,
    "quantidade_vendida": 142,
    "visualizacoes": 3840,
    "status": "Ativo",
    "listing_type_id": "gold_special",
    "tipo_anuncio": "Clássico",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Extintores",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_854921-MLB48921829101_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012110",
    "data_criacao": "2023-08-10T14:20:00Z",
    "ultima_sincronizacao": subDays(0, 2),
    "ml_item_id_origem": "MLB-190412891",
    "tempo_reposicionamento_dias": 6,
    "historico": [
      {
        "data": subDays(0, 2),
        "evento": "Sincronização",
        "titulo": "Sincronização Automática",
        "detalhe": "Estoque sincronizado: 65 unidades disponíveis no armazém."
      },
      {
        "data": subDays(5),
        "evento": "Alteração de Preço",
        "titulo": "Reajuste Promocional",
        "detalhe": "Preço ajustado de R$ 199,90 para R$ 188,80 para ganho de Buy Box."
      },
      {
        "data": subDays(14),
        "evento": "Reativação",
        "titulo": "Anúncio Reativado",
        "detalhe": "Estoque de suportes reabastecido. Status retornado para Ativo."
      },
      {
        "data": subDays(16),
        "evento": "Pausa por Estoque",
        "titulo": "Pausa Automática por Ruptura",
        "detalhe": "Anúncio pausado automaticamente: estoque do componente Suporte zerado."
      },
      {
        "data": subDays(30),
        "evento": "Sucessor de Anúncio Excluído",
        "titulo": "Herdeiro de Anúncio Excluído [MLB-190412891]",
        "detalhe": "Anúncio recriado do zero em substituição ao MLB-190412891 excluído pelo robô do ML. Tempo de reposicionamento: 6 dias."
      }
    ]
  },
  {
    "id_anuncio": 2,
    "ml_item_id": "MLB-2894012148",
    "titulo": "Extintor Água Pressurizada AP 10 Litros Inmetro RezFire",
    "tipo_composicao": "unitario",
    "itens_anuncio": [
      {
        "id_produto": 2,
        "quantidade_anunciada": 1
      }
    ],
    "preco": 159.9,
    "quantidade_disponivel": 45,
    "quantidade_vendida": 89,
    "visualizacoes": 2150,
    "status": "Ativo",
    "listing_type_id": "gold_pro",
    "tipo_anuncio": "Premium (sem juros)",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Extintores",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_728419-MLB48921829102_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012148",
    "data_criacao": "2023-09-01T10:15:00Z",
    "ultima_sincronizacao": subDays(0, 1),
    "historico": [
      {
        "data": subDays(0, 1),
        "evento": "Sincronização",
        "detalhe": "Sincronização de estoque concluída."
      }
    ]
  },
  {
    "id_anuncio": 3,
    "ml_item_id": "MLB-2894012185",
    "titulo": "Kit Proteção Predial: Extintor CO2 6kg + Placa Fotoluminescente",
    "tipo_composicao": "kit",
    "itens_anuncio": [
      {
        "id_produto": 3,
        "quantidade_anunciada": 1
      },
      {
        "id_produto": 9,
        "quantidade_anunciada": 1
      }
    ],
    "preco": 519,
    "quantidade_disponivel": 22,
    "quantidade_vendida": 37,
    "visualizacoes": 1420,
    "status": "Ativo",
    "listing_type_id": "gold_pro",
    "tipo_anuncio": "Premium (sem juros)",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Extintores",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_912834-MLB48921829103_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012185",
    "data_criacao": "2023-11-20T16:00:00Z",
    "ultima_sincronizacao": subDays(0, 3),
    "historico": [
      {
        "data": subDays(0, 3),
        "evento": "Sincronização",
        "detalhe": "Dados checados no Mercado Livre."
      }
    ]
  },
  {
    "id_anuncio": 4,
    "ml_item_id": "MLB-2894012201",
    "titulo": "Extintor Pó Químico BC 12kg Para Indústria E Posto De Combustível",
    "tipo_composicao": "unitario",
    "itens_anuncio": [
      {
        "id_produto": 6,
        "quantidade_anunciada": 1
      }
    ],
    "preco": 329,
    "quantidade_disponivel": 10,
    "quantidade_vendida": 50,
    "visualizacoes": 1890,
    "status": "Pausado",
    "listing_type_id": "gold_special",
    "tipo_anuncio": "Clássico",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Extintores",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_638291-MLB48921829104_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012201",
    "data_criacao": "2023-10-05T09:40:00Z",
    "ultima_sincronizacao": subDays(0, 4),
    "historico": [
      {
        "data": subDays(0, 4),
        "evento": "Sincronização",
        "detalhe": "Aviso de estoque divergente."
      }
    ]
  },
  {
    "id_anuncio": 5,
    "ml_item_id": "MLB-2894012234",
    "titulo": "Kit Cozinha Industrial: 1x Extintor Classe K 6L + 1x Suporte Reforçado",
    "tipo_composicao": "kit",
    "itens_anuncio": [
      {
        "id_produto": 5,
        "quantidade_anunciada": 1
      },
      {
        "id_produto": 8,
        "quantidade_anunciada": 1
      }
    ],
    "preco": 767.9,
    "quantidade_disponivel": 12,
    "quantidade_vendida": 12,
    "visualizacoes": 980,
    "status": "Ativo",
    "listing_type_id": "gold_pro",
    "tipo_anuncio": "Premium (sem juros)",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Extintores",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_781290-MLB48921829105_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012234",
    "data_criacao": "2024-01-15T11:20:00Z",
    "ultima_sincronizacao": subDays(0, 2),
    "historico": [
      {
        "data": subDays(0, 2),
        "evento": "Sincronização",
        "detalhe": "Estoque sincronizado."
      }
    ]
  },
  {
    "id_anuncio": 6,
    "ml_item_id": "MLB-2894012270",
    "titulo": "Kit 5 Placas Sinalização Extintor Fotoluminescente 20x20cm Norma ABNT",
    "tipo_composicao": "kit",
    "itens_anuncio": [
      {
        "id_produto": 9,
        "quantidade_anunciada": 5
      }
    ],
    "preco": 169.9,
    "quantidade_disponivel": 43,
    "quantidade_vendida": 285,
    "visualizacoes": 4950,
    "status": "Ativo",
    "listing_type_id": "gold_special",
    "tipo_anuncio": "Clássico",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Sinalização",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_891201-MLB48921829106_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012270",
    "data_criacao": "2023-07-22T08:30:00Z",
    "ultima_sincronizacao": subDays(0, 1),
    "historico": [
      {
        "data": subDays(0, 1),
        "evento": "Sincronização",
        "detalhe": "Cálculo proporcional de estoque verificado."
      }
    ]
  },
  {
    "id_anuncio": 7,
    "ml_item_id": "MLB-2894012315",
    "titulo": "Combo Comercial Completo: 1x Extintor ABC 4kg + 1x Placa + 1x Suporte",
    "tipo_composicao": "kit",
    "itens_anuncio": [
      {
        "id_produto": 1,
        "quantidade_anunciada": 1
      },
      {
        "id_produto": 9,
        "quantidade_anunciada": 1
      },
      {
        "id_produto": 8,
        "quantidade_anunciada": 1
      }
    ],
    "preco": 199.9,
    "quantidade_disponivel": 65,
    "quantidade_vendida": 68,
    "visualizacoes": 2450,
    "status": "Ativo",
    "listing_type_id": "gold_pro",
    "tipo_anuncio": "Premium (sem juros)",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Extintores",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_710294-MLB48921829107_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012315",
    "data_criacao": "2024-02-10T15:40:00Z",
    "ultima_sincronizacao": subDays(0, 1),
    "historico": [
      {
        "data": subDays(0, 1),
        "evento": "Sincronização",
        "detalhe": "Combo de extintor completo ativo."
      }
    ]
  },
  {
    "id_anuncio": 8,
    "ml_item_id": "MLB-2894012350",
    "titulo": "Extintor CO2 4kg Comercial Dióxido De Carbono Inmetro RezFire",
    "tipo_composicao": "unitario",
    "itens_anuncio": [
      {
        "id_produto": 4,
        "quantidade_anunciada": 1
      }
    ],
    "preco": 389,
    "quantidade_disponivel": 8,
    "quantidade_vendida": 32,
    "visualizacoes": 1680,
    "status": "Ativo",
    "listing_type_id": "gold_special",
    "tipo_anuncio": "Clássico",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Extintores",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_901824-MLB48921829108_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012350",
    "data_criacao": "2023-09-18T12:00:00Z",
    "ultima_sincronizacao": subDays(0, 2),
    "historico": [
      {
        "data": subDays(0, 2),
        "evento": "Alerta Estoque",
        "detalhe": "Estoque crítico abaixo do mínimo."
      }
    ]
  },
  {
    "id_anuncio": 9,
    "ml_item_id": "MLB-2894012389",
    "titulo": "Mangueira De Incêndio Predial Tipo 1 1.1/2 Polegadas 15 Metros",
    "tipo_composicao": "unitario",
    "itens_anuncio": [
      {
        "id_produto": 10,
        "quantidade_anunciada": 1
      }
    ],
    "preco": 249,
    "quantidade_disponivel": 16,
    "quantidade_vendida": 24,
    "visualizacoes": 850,
    "status": "Ativo",
    "listing_type_id": "gold_pro",
    "tipo_anuncio": "Premium (sem juros)",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Mangueiras",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_612849-MLB48921829109_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012389",
    "data_criacao": "2023-11-05T17:10:00Z",
    "ultima_sincronizacao": subDays(0, 1),
    "historico": [
      {
        "data": subDays(0, 1),
        "evento": "Sincronização",
        "detalhe": "Status ativo regular."
      }
    ]
  },
  {
    "id_anuncio": 10,
    "ml_item_id": "MLB-2894012410",
    "titulo": "Kit 10 Suportes Universais De Parede Para Extintor",
    "tipo_composicao": "kit",
    "itens_anuncio": [
      {
        "id_produto": 8,
        "quantidade_anunciada": 10
      }
    ],
    "preco": 175,
    "quantidade_disponivel": 18,
    "quantidade_vendida": 22,
    "visualizacoes": 1400,
    "status": "Ativo",
    "listing_type_id": "gold_special",
    "tipo_anuncio": "Clássico",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Acessórios",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_783491-MLB48921829110_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012410",
    "data_criacao": "2023-06-12T10:00:00Z",
    "ultima_sincronizacao": subDays(0, 1),
    "historico": [
      {
        "data": subDays(0, 1),
        "evento": "Sincronização",
        "detalhe": "Kit atacado para instaladores."
      }
    ]
  },
  {
    "id_anuncio": 11,
    "ml_item_id": "MLB-2894012455",
    "titulo": "Detector De Fumaça Óptico Sem Fio Bateria 9V Certificado",
    "tipo_composicao": "unitario",
    "itens_anuncio": [
      {
        "id_produto": 11,
        "quantidade_anunciada": 1
      }
    ],
    "preco": 89.9,
    "quantidade_disponivel": 32,
    "quantidade_vendida": 48,
    "visualizacoes": 2100,
    "status": "Ativo",
    "listing_type_id": "gold_special",
    "tipo_anuncio": "Clássico",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Detectores",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_902341-MLB48921829111_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012455",
    "data_criacao": "2023-08-25T14:50:00Z",
    "ultima_sincronizacao": subDays(0, 2),
    "historico": [
      {
        "data": subDays(0, 2),
        "evento": "Sincronização",
        "detalhe": "Dados atualizados."
      }
    ]
  },
  {
    "id_anuncio": 12,
    "ml_item_id": "MLB-2894012499",
    "titulo": "Extintor Espuma Mecânica 9L Linha Antiga (Encerrado)",
    "tipo_composicao": "unitario",
    "itens_anuncio": [
      {
        "id_produto": 7,
        "quantidade_anunciada": 1
      }
    ],
    "preco": 289,
    "quantidade_disponivel": 0,
    "quantidade_vendida": 12,
    "visualizacoes": 410,
    "status": "Encerrado",
    "listing_type_id": "gold_special",
    "tipo_anuncio": "Clássico",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Extintores",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_819234-MLB48921829112_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012499",
    "data_criacao": "2022-10-10T09:00:00Z",
    "ultima_sincronizacao": subDays(40),
    "historico": [
      {
        "data": subDays(40),
        "evento": "Encerrado",
        "detalhe": "Anúncio finalizado por encerramento de linha."
      }
    ]
  },
  {
    "id_anuncio": 13,
    "ml_item_id": "MLB-2894012580",
    "titulo": "Luz de Emergência 30 LEDs Bivolt Autônoma Segurimax",
    "tipo_composicao": "unitario",
    "itens_anuncio": [],
    "preco": 49.9,
    "quantidade_disponivel": 25,
    "quantidade_vendida": 15,
    "visualizacoes": 520,
    "status": "Pausado",
    "listing_type_id": "gold_special",
    "tipo_anuncio": "Clássico",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Iluminação",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_619024-MLB48921829113_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-2894012580",
    "data_criacao": "2024-03-01T10:00:00Z",
    "ultima_sincronizacao": subDays(5),
    "historico": [
      {
        "data": subDays(5),
        "evento": "Aviso",
        "detalhe": "Anúncio ativo no ML sem correspondência no catálogo RezFire."
      }
    ]
  },
  {
    "id_anuncio": 14,
    "ml_item_id": "MLB-190412891",
    "titulo": "Extintor Pó ABC 4kg com Suporte Parede RezFire (Antigo)",
    "tipo_composicao": "kit",
    "itens_anuncio": [
      { "id_produto": 1, "quantidade_anunciada": 1 },
      { "id_produto": 8, "quantidade_anunciada": 1 }
    ],
    "preco": 199.9,
    "quantidade_disponivel": 0,
    "quantidade_vendida": 480,
    "visualizacoes": 12500,
    "status": "Excluído",
    "foi_recriado": true,
    "motivo_exclusao": "Exclusão indevida por robô de catálogo do Mercado Livre (alegação de categoria duplicada)",
    "data_exclusao": subDays(36),
    "data_recriacao": subDays(30),
    "tempo_reposicionamento_dias": 6,
    "ml_item_id_substituto": "MLB-2894012110",
    "listing_type_id": "gold_special",
    "tipo_anuncio": "Clássico",
    "condicao": "Novo",
    "categoria_ml": "Segurança Contra Incêndio > Extintores",
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_854921-MLB48921829101_012022-V.jpg",
    "permalink": "https://produto.mercadolivre.com.br/MLB-190412891",
    "data_criacao": "2022-03-15T10:00:00Z",
    "ultima_sincronizacao": subDays(30),
    "historico": [
      {
        "data": subDays(30),
        "evento": "Exclusão e Recriação",
        "titulo": "Anúncio Excluído e Substituído",
        "detalhe": "Anúncio excluído pelo ML e substituído por [MLB-2894012110]. Tempo de reposicionamento: 6 dias."
      },
      {
        "data": subDays(36),
        "evento": "Advertência ML",
        "titulo": "Infração de Catálogo Detectada",
        "detalhe": "Robô do ML bloqueou a edição e excluiu a publicação por divergência cadastral."
      }
    ]
  }
];

  // Metadados da conexão OAuth 2.0 com o Mercado Livre
  const DEFAULT_SYNC_META = {
    status_conexao: "Conectado",
    app_id: "782910482910482",
    seller_id: "MLB-REZFIRE-OFICIAL",
    seller_nickname: "REZFIRE_EXTINTORES",
    token_expira_em: "2024-10-21T18:00:00Z",
    ultima_sincronizacao: subDays(0, 1),
    total_anuncios_ml: 13,
    taxa_sucesso: 100
  };

  /**
   * Carrega os anúncios salvos no localStorage ou inicializa os dados padrão.
   */
  function loadAnuncios() {
    try {
      if (localStorage.getItem("rezfire.mock_version") !== "rezfire_v2_2026") {
        localStorage.setItem("rezfire.mock_version", "rezfire_v2_2026");
        saveAnuncios(DEFAULT_ANUNCIOS);
        return DEFAULT_ANUNCIOS.map((a) => ({ ...a }));
      }
    } catch {}
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        saveAnuncios(DEFAULT_ANUNCIOS);
        return DEFAULT_ANUNCIOS.map((a) => ({ ...a }));
      }
      const parsed = JSON.parse(raw);
      // Assegura migração suave caso existam dados antigos com apenas id_produto
      return (Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ANUNCIOS).map((a) => {
        if (!a.itens_anuncio) {
          a.itens_anuncio = extrairItensAnuncio(a);
        }
        return a;
      });
    } catch {
      return DEFAULT_ANUNCIOS.map((a) => ({ ...a }));
    }
  }

  /**
   * Salva os anúncios no localStorage.
   */
  function saveAnuncios(anuncios) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(anuncios));
  }

  function loadSyncMeta() {
    try {
      const raw = localStorage.getItem(SYNC_META_KEY);
      if (!raw) {
        saveSyncMeta(DEFAULT_SYNC_META);
        return { ...DEFAULT_SYNC_META };
      }
      return JSON.parse(raw);
    } catch {
      return { ...DEFAULT_SYNC_META };
    }
  }

  function saveSyncMeta(meta) {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  }

  /**
   * CÁLCULO DE DISPONIBILIDADE DINÂMICA DO ANÚNCIO (ESTOQUE VIRTUAL / GARGALO)
   * Para anúncios multi-item (kits ou combos), o estoque físico disponível para venda
   * é calculado pelo componente de menor disponibilidade proporcional no armazém.
   *
   * Retorna: {
   *   estoqueDisponivel: number,
   *   componentes: Array<{ id_produto, sku, nome, quantidade_anunciada, saldoFisico, maxKitsPossiveis, ehGargalo, ativo, precoUnitario }>,
   *   precoTotalReferencia: number,
   *   gargalo: { sku, nome, saldoFisico, quantidade_anunciada } | null
   * }
   */
  function calcularEstoqueDinamicoAnuncio(anuncio, produtos) {
    const prods = produtos || (window.RezFireData ? window.RezFireData.loadProducts() : []);
    const itens = extrairItensAnuncio(anuncio);

    if (itens.length === 0) {
      return {
        estoqueDisponivel: 0,
        componentes: [],
        precoTotalReferencia: 0,
        gargalo: null,
        temItemInexistente: false
      };
    }

    let minKits = Infinity;
    let gargaloItem = null;
    let precoRefTotal = 0;
    let temItemInexistente = false;

    const componentes = itens.map((item) => {
      const prod = prods.find((p) => p.id_produto === item.id_produto);
      if (!prod) {
        temItemInexistente = true;
        return {
          id_produto: item.id_produto,
          sku: `ID #${item.id_produto}`,
          nome: "Produto Não Cadastrado",
          quantidade_anunciada: item.quantidade_anunciada,
          saldoFisico: 0,
          maxKitsPossiveis: 0,
          ehGargalo: true,
          ativo: false,
          precoUnitario: 0
        };
      }

      const saldo = Number(prod.quantidade_atual ?? 0);
      const qtdPorKit = Math.max(1, Number(item.quantidade_anunciada || 1));
      const kitsPossiveis = Math.floor(saldo / qtdPorKit);

      precoRefTotal += (Number(prod.preco || 0) * qtdPorKit);

      if (kitsPossiveis < minKits) {
        minKits = kitsPossiveis;
        gargaloItem = {
          id_produto: prod.id_produto,
          sku: prod.sku,
          nome: prod.nome,
          saldoFisico: saldo,
          quantidade_anunciada: qtdPorKit
        };
      }

      return {
        id_produto: prod.id_produto,
        sku: prod.sku,
        nome: prod.nome,
        quantidade_anunciada: qtdPorKit,
        saldoFisico: saldo,
        maxKitsPossiveis: kitsPossiveis,
        ehGargalo: false,
        ativo: prod.ativo !== false,
        precoUnitario: Number(prod.preco || 0)
      };
    });

    const estoqueFinal = minKits === Infinity ? 0 : Math.max(0, minKits);

    // Marca quem é o gargalo da composição
    componentes.forEach((c) => {
      if (gargaloItem && c.id_produto === gargaloItem.id_produto) {
        c.ehGargalo = true;
      }
    });

    return {
      estoqueDisponivel: estoqueFinal,
      componentes,
      precoTotalReferencia: Math.round(precoRefTotal * 100) / 100,
      gargalo: gargaloItem,
      temItemInexistente
    };
  }

  /**
   * ANALISADOR DE DIVERGÊNCIAS MULTI-ITEM
   * Compara os dados do anúncio (seja unitário ou kit com múltiplos itens) com o estoque e catálogo real.
   */
  function analisarDivergencias(anuncio, produtos) {
    const divergencias = [];
    const prods = produtos || (window.RezFireData ? window.RezFireData.loadProducts() : []);
    const itens = extrairItensAnuncio(anuncio);
    const refDate = REF_DATE.getTime();

    // 1. Verificação de vínculo com produtos
    if (itens.length === 0) {
      divergencias.push({
        tipo: "sem_vinculo",
        titulo: "Anúncio sem produtos vinculados",
        gravidade: "alta",
        descricao: "Este anúncio está ativo no Mercado Livre mas não possui nenhum produto cadastrado na sua composição interna.",
        detalhe: `Código MLB: ${anuncio.ml_item_id}`,
        acaoRecomendada: "Adicione os itens componentes (extintores, suportes, placas) para permitir o rastreio dinâmico de estoque."
      });
      return divergencias;
    }

    const calculo = calcularEstoqueDinamicoAnuncio(anuncio, prods);

    // 2. Componente inexistente
    if (calculo.temItemInexistente) {
      divergencias.push({
        tipo: "produto_inexistente",
        titulo: "Item da composição não encontrado no cadastro",
        gravidade: "alta",
        descricao: "Um ou mais produtos que compõem este anúncio/kit foram excluídos ou não existem no catálogo do RezFire.",
        detalhe: "Composição incompatível com a base de dados interna",
        acaoRecomendada: "Revise a composição do anúncio e reponha o produto correto do catálogo."
      });
    }

    // 3. Componente inativo com anúncio Ativo
    const itensInativos = calculo.componentes.filter((c) => !c.ativo);
    if (anuncio.status === "Ativo" && itensInativos.length > 0) {
      const nomes = itensInativos.map((i) => `[${i.sku}] ${i.nome}`).join(", ");
      divergencias.push({
        tipo: "produto_inativo",
        titulo: "Item inativo presente em anúncio Ativo",
        gravidade: "alta",
        descricao: `O anúncio está vendendo no Mercado Livre, mas possui componente(s) marcado(s) como INATIVO internamente: ${nomes}.`,
        detalhe: `Itens inativos na composição: ${itensInativos.length}`,
        acaoRecomendada: "Reative o produto no catálogo ou pause o anúncio no Mercado Livre."
      });
    }

    // 4. Anúncio ativo com ruptura de estoque (pelo componente gargalo)
    if (anuncio.status === "Ativo" && calculo.estoqueDisponivel <= 0) {
      const gargalo = calculo.gargalo;
      divergencias.push({
        tipo: "estoque_zerado",
        titulo: "Ruptura de estoque (Gargalo Zerado)",
        gravidade: "critica",
        descricao: gargalo
          ? `O item gargalo [${gargalo.sku}] ${gargalo.nome} está com saldo ZERO no galpão, impossibilitando a montagem/envio deste anúncio.`
          : "Nenhum saldo físico disponível para atender a este anúncio.",
        detalhe: `Disponível no ML: ${anuncio.quantidade_disponivel} un. | Estoque real montável: 0 un.`,
        acaoRecomendada: "Pause o anúncio no Mercado Livre imediatamente até o reabastecimento do componente esgotado."
      });
    }

    // 5. Quantidade anunciada incompatível com o estoque real montável
    if (anuncio.status === "Ativo" && calculo.estoqueDisponivel > 0 && Math.abs(anuncio.quantidade_disponivel - calculo.estoqueDisponivel) > 0) {
      const excessoML = anuncio.quantidade_disponivel > calculo.estoqueDisponivel;
      divergencias.push({
        tipo: "quantidade_divergente",
        titulo: excessoML ? "Anúncio oferta mais do que o estoque permite" : "Estoque no ML abaixo do potencial montável",
        gravidade: excessoML ? "alta" : "media",
        descricao: excessoML
          ? `O anúncio oferta ${anuncio.quantidade_disponivel} unidades no ML, mas você só consegue montar ${calculo.estoqueDisponivel} unidades devido à limitação de estoque do componente [${calculo.gargalo?.sku}].`
          : `O anúncio está com apenas ${anuncio.quantidade_disponivel} un. no ML, embora seus componentes permitam ofertar ${calculo.estoqueDisponivel} unidades.`,
        detalhe: `Estoque no ML: ${anuncio.quantidade_disponivel} un. | Estoque Real Montável: ${calculo.estoqueDisponivel} un. (Gargalo: ${calculo.gargalo?.sku})`,
        acaoRecomendada: "Ajuste o estoque do anúncio no ML para refletir o teto determinado pelo componente mais escasso."
      });
    }

    // 6. Preço anunciado vs soma dos preços de tabela
    const precoML = Number(anuncio.preco ?? 0);
    const precoRef = calculo.precoTotalReferencia;
    if (precoRef > 0 && Math.abs(precoML - precoRef) > 0.01) {
      const diff = precoML - precoRef;
      const percent = Math.round((diff / precoRef) * 100);
      divergencias.push({
        tipo: "preco_divergente",
        titulo: "Preço no ML diverge da soma dos itens cadastrados",
        gravidade: diff < 0 ? "alta" : "media",
        descricao: diff < 0
          ? `O anúncio vende por R$ ${precoML.toFixed(2)}, valor inferior à soma dos preços individuais dos itens no catálogo (R$ ${precoRef.toFixed(2)} / ${percent}%). Verifique a margem do kit!`
          : `O anúncio está por R$ ${precoML.toFixed(2)}, enquanto a soma de catálogo dos itens é R$ ${precoRef.toFixed(2)} (+${percent}%).`,
        detalhe: `Preço no ML: R$ ${precoML.toFixed(2)} | Soma de Referência: R$ ${precoRef.toFixed(2)}`,
        acaoRecomendada: "Avalie se o desconto de kit ou acréscimo de frete/comissão está de acordo com a estratégia comercial."
      });
    }

    // 7. Sincronização antiga (> 7 dias)
    if (anuncio.ultima_sincronizacao) {
      const diffDias = Math.floor((refDate - new Date(anuncio.ultima_sincronizacao).getTime()) / (24 * 3600 * 1000));
      if (diffDias >= 7) {
        divergencias.push({
          tipo: "sincronizacao_antiga",
          titulo: `Sem sincronização recente (${diffDias} dias)`,
          gravidade: "baixa",
          descricao: `A última verificação deste anúncio ocorreu há mais de ${diffDias} dias. As métricas e o status podem estar desatualizados.`,
          detalhe: `Última sincronização: ${new Date(anuncio.ultima_sincronizacao).toLocaleDateString("pt-BR")}`,
          acaoRecomendada: "Execute a sincronização manual deste anúncio para atualizar visitas, vendas e status."
        });
      }
    }

    return divergencias;
  }

  /**
   * Calcula todos os KPIs da tela de Anúncios dinamicamente
   */
  function computeAnunciosKPIs(anuncios, produtos) {
    const prods = produtos || (window.RezFireData ? window.RezFireData.loadProducts() : []);
    const total = anuncios.length;
    let ativos = 0;
    let pausados = 0;
    let encerrados = 0;
    let comDivergencias = 0;
    let totalVendas = 0;
    let totalVisualizacoes = 0;
    let semVendas = 0;
    let totalKits = 0;

    anuncios.forEach((a) => {
      if (a.status === "Ativo") ativos++;
      else if (a.status === "Pausado") pausados++;
      else if (a.status === "Encerrado") encerrados++;

      const itens = extrairItensAnuncio(a);
      if (itens.length > 1 || (itens.length === 1 && itens[0].quantidade_anunciada > 1)) {
        totalKits++;
      }

      const divs = analisarDivergencias(a, prods);
      if (divs.length > 0) comDivergencias++;

      const vendas = Number(a.quantidade_vendida || 0);
      totalVendas += vendas;
      if (vendas === 0) semVendas++;

      totalVisualizacoes += Number(a.visualizacoes || 0);
    });

    return {
      total,
      ativos,
      pausados,
      encerrados,
      comDivergencias,
      totalVendas,
      totalVisualizacoes,
      semVendas,
      totalKits
    };
  }

  /**
   * Atualiza a composição completa de itens de um anúncio (Tabela produto_anuncio)
   * itens: Array<{ id_produto: number, quantidade_anunciada: number }>
   */
  function atualizarComposicaoAnuncio(id_anuncio, itens) {
    const anuncios = loadAnuncios();
    const idx = anuncios.findIndex((a) => a.id_anuncio === Number(id_anuncio));
    if (idx !== -1) {
      const itensLimpos = (itens || [])
        .map((it) => ({ id_produto: Number(it.id_produto), quantidade_anunciada: Math.max(1, Number(it.quantidade_anunciada || 1)) }))
        .filter((it) => !isNaN(it.id_produto) && it.id_produto > 0);

      anuncios[idx].itens_anuncio = itensLimpos;
      anuncios[idx].tipo_composicao = itensLimpos.length > 1 || (itensLimpos.length === 1 && itensLimpos[0].quantidade_anunciada > 1) ? "kit" : "unitario";

      // Mantém id_produto como referência primária se for unitário
      anuncios[idx].id_produto = itensLimpos.length === 1 && itensLimpos[0].quantidade_anunciada === 1 ? itensLimpos[0].id_produto : null;

      if (!anuncios[idx].historico) anuncios[idx].historico = [];
      anuncios[idx].historico.unshift({
        data: new Date().toISOString(),
        evento: "Composição Atualizada",
        detalhe: `${itensLimpos.length} produto(s) configurado(s) na composição deste anúncio.`
      });

      saveAnuncios(anuncios);
      return anuncios[idx];
    }
    return null;
  }

  function syncAnuncios(id_anuncio = null) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const anuncios = loadAnuncios();
        const agora = new Date().toISOString();
        if (id_anuncio) {
          const item = anuncios.find((a) => a.id_anuncio === Number(id_anuncio));
          if (item) {
            item.ultima_sincronizacao = agora;
            if (!item.historico) item.historico = [];
            item.historico.unshift({
              data: agora,
              evento: "Sincronização Manual",
              detalhe: "Dados checados na API do Mercado Livre com sucesso."
            });
          }
        } else {
          anuncios.forEach((a) => {
            a.ultima_sincronizacao = agora;
          });
          const meta = loadSyncMeta();
          meta.ultima_sincronizacao = agora;
          saveSyncMeta(meta);
        }
        saveAnuncios(anuncios);
        resolve({ success: true, timestamp: agora });
      }, 700);
    });
  }

  /**
   * Adiciona uma ocorrência cronológica ao histórico do anúncio (SCRUM-19 / #14)
   */
  function adicionarOcorrencia(id_anuncio, dados) {
    const anuncios = loadAnuncios();
    const idx = anuncios.findIndex((a) => a.id_anuncio === Number(id_anuncio));
    if (idx < 0) return null;

    const anuncio = anuncios[idx];
    anuncio.historico = anuncio.historico || [];

    const novaOcorrencia = {
      id_ocorrencia: Date.now(),
      data: dados.data_ocorrencia || new Date().toISOString(),
      evento: dados.tipo_evento || 'Ocorrência Operacional',
      titulo: dados.titulo || dados.tipo_evento || 'Registro',
      detalhe: dados.detalhe || '',
      autor: dados.autor || 'Gestor RezFire',
      dados_anteriores: dados.dados_anteriores || null,
    };

    anuncio.historico.unshift(novaOcorrencia);
    saveAnuncios(anuncios);
    return novaOcorrencia;
  }

  /**
   * Marca anúncio como excluído/recriado com cálculo de reposicionamento (SCRUM-20 / #15)
   */
  function marcarRecriado(id_anuncio_antigo, dados) {
    const anuncios = loadAnuncios();
    const idxAntigo = anuncios.findIndex((a) => a.id_anuncio === Number(id_anuncio_antigo));
    if (idxAntigo < 0) throw new Error("Anúncio antigo não encontrado.");

    const antigo = anuncios[idxAntigo];
    const dExclusao = new Date(dados.data_exclusao || new Date());
    const dRecriacao = new Date(dados.data_recriacao || new Date());
    const diffMs = Math.max(0, dRecriacao.getTime() - dExclusao.getTime());
    const tempoDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const mlNovo = (dados.ml_item_id_novo || '').trim();

    antigo.foi_recriado = true;
    antigo.status = 'Excluído';
    antigo.motivo_exclusao = dados.motivo_exclusao || 'Excluído pelo Mercado Livre';
    antigo.data_exclusao = dExclusao.toISOString();
    antigo.data_recriacao = dRecriacao.toISOString();
    antigo.tempo_reposicionamento_dias = tempoDias;
    antigo.ml_item_id_substituto = mlNovo;

    antigo.historico = antigo.historico || [];
    antigo.historico.unshift({
      id_ocorrencia: Date.now(),
      data: new Date().toISOString(),
      evento: 'Exclusão e Recriação',
      titulo: 'Anúncio Excluído no ML e Substituído',
      detalhe: `Anúncio excluído pelo ML e substituído por [${mlNovo}]. Motivo: ${dados.motivo_exclusao}. Tempo de reposicionamento: ${tempoDias} dia(s).`,
      autor: 'Gestor RezFire',
      dados_anteriores: {
        ml_item_id_antigo: antigo.ml_item_id,
        ml_item_id_novo: mlNovo,
        tempo_reposicionamento_dias: tempoDias,
      },
    });

    // Se o novo anúncio já existir na base
    const idxNovo = anuncios.findIndex((a) => a.ml_item_id === mlNovo || a.id_anuncio === Number(dados.id_anuncio_novo));
    let novo = null;
    if (idxNovo >= 0) {
      novo = anuncios[idxNovo];
      novo.id_anuncio_origem = antigo.id_anuncio;
      novo.ml_item_id_origem = antigo.ml_item_id;
      novo.tempo_reposicionamento_dias = tempoDias;
      novo.historico = novo.historico || [];
      novo.historico.unshift({
        id_ocorrencia: Date.now() + 1,
        data: new Date().toISOString(),
        evento: 'Sucessor de Anúncio Excluído',
        titulo: `Herdeiro do Anúncio Excluído [${antigo.ml_item_id}]`,
        detalhe: `Criado em substituição ao anúncio histórico [${antigo.ml_item_id}], excluído em ${dExclusao.toLocaleDateString('pt-BR')}. Motivo: ${dados.motivo_exclusao}.`,
        autor: 'Gestor RezFire',
        dados_anteriores: {
          ml_item_id_antigo: antigo.ml_item_id,
          tempo_reposicionamento_dias: tempoDias,
        },
      });
    }

    saveAnuncios(anuncios);
    return {
      sucesso: true,
      anuncio_antigo: antigo,
      anuncio_novo: novo,
      tempo_reposicionamento_dias: tempoDias,
    };
  }

  /**
   * Lista anúncios excluídos e recriados para acompanhamento de reposicionamento
   */
  function listarRecriados() {
    const anuncios = loadAnuncios();
    const recriados = anuncios.filter((a) => a.foi_recriado);
    const mediaDias = recriados.length > 0
      ? Number((recriados.reduce((sum, a) => sum + (a.tempo_reposicionamento_dias || 0), 0) / recriados.length).toFixed(1))
      : 0;

    return {
      total_recriados: recriados.length,
      media_tempo_reposicionamento_dias: mediaDias,
      anuncios: recriados,
    };
  }

  // Exportação Global
  window.RezFireAnuncios = {
    loadAnuncios,
    saveAnuncios,
    loadSyncMeta,
    saveSyncMeta,
    extrairItensAnuncio,
    calcularEstoqueDinamicoAnuncio,
    analisarDivergencias,
    computeAnunciosKPIs,
    atualizarComposicaoAnuncio,
    syncAnuncios,
    adicionarOcorrencia,
    marcarRecriado,
    listarRecriados,
    REF_DATE
  };
})();
