/**
 * mock-data.js
 * Base de dados centralizada e mock de serviços — RezFire Manager (v2 unificada)
 *
 * Catálogo unificado de 12 produtos com consistência matemática estrita:
 * Saldo Atual = Entradas (NFs) - Saídas (Vendas + Perdas Operacionais).
 * Pedidos e Movimentações com datas relativas dinâmicas e integração total.
 */

const STORAGE_KEY = "rezfire.produtos";
const ORDERS_KEY = "rezfire.pedidos";
const MOVEMENTS_KEY = "rezfire.movimentacoes";
const LOTES_KEY = "rezfire.lotes";
const INSPECOES_KEY = "rezfire.inspecoes";
const FINANCIAL_SETTINGS_KEY = "rezfire.config.financeiro";
const MOCK_VERSION_KEY = "rezfire.mock_version";
const CURRENT_MOCK_VERSION = "rezfire_v2_2026";

function offsetDaysDate(days, hours = 0, minutes = 0) {
  const d = new Date(Date.now() + (days * 86400000 + hours * 3600000 + minutes * 60000));
  return d.toISOString();
}

function subDaysDate(days, hours = 0, minutes = 0) {
  const d = new Date(Date.now() - (days * 86400000 + hours * 3600000 + minutes * 60000));
  return d.toISOString();
}

// ─── Catálogo Mestre de Produtos (12 itens) ──────────────────────────────────
const DEFAULT_PRODUCTS = [
  {
    "id_produto": 1,
    "sku": "EXT-PQS-4KG",
    "nome": "Extintor Pó Químico ABC 4kg",
    "descricao": "Extintor de pó químico seco pressurizado ABC de 4kg. Indicado para veículos leves, comércio e residências.",
    "custo": 82,
    "preco": 169.9,
    "categoria": "Extintores",
    "ativo": true,
    "quantidade_atual": 65,
    "estoque_minimo": 40,
    "tipo": "Unitário",
    "detalhes_extintor": {
      "registro_inmetro": "003180/2021",
      "tipo_extintor": "Pó Químico Seco (PQS ABC)",
      "capacidade_peso": "4 kg (2-A:20-B:C)",
      "classe_incendio": "ABC",
      "fabricante": "Resil Comercial",
      "data_fabricacao": "2024-01-15",
      "data_validade": "2029-01-15",
      "numero_lacre": "L-332910",
      "selo_conformidade": "INM-552190"
    }
  },
  {
    "id_produto": 2,
    "sku": "EXT-H2O-10L",
    "nome": "Extintor Água Pressurizada 10L",
    "descricao": "Extintor de água pressurizada classe A para materiais sólidos combustíveis como madeira, papel e tecidos.",
    "custo": 74,
    "preco": 159.9,
    "categoria": "Extintores",
    "ativo": true,
    "quantidade_atual": 45,
    "estoque_minimo": 30,
    "tipo": "Unitário",
    "detalhes_extintor": {
      "registro_inmetro": "002450/2021",
      "tipo_extintor": "Água Pressurizada (AP)",
      "capacidade_peso": "10 Litros (2-A)",
      "classe_incendio": "A",
      "fabricante": "Resil",
      "data_fabricacao": "2023-04-10",
      "data_validade": "2028-04-10",
      "numero_lacre": "L-849201",
      "selo_conformidade": "INM-994120"
    }
  },
  {
    "id_produto": 3,
    "sku": "EXT-CO2-6KG",
    "nome": "Extintor CO2 6kg",
    "descricao": "Extintor de dióxido de carbono 6kg classe BC, ideal para equipamentos elétricos energizados e líquidos inflamáveis sem deixar resíduos.",
    "custo": 245,
    "preco": 459,
    "categoria": "Extintores",
    "ativo": true,
    "quantidade_atual": 22,
    "estoque_minimo": 20,
    "tipo": "Unitário",
    "detalhes_extintor": {
      "registro_inmetro": "001891/2020",
      "tipo_extintor": "Dióxido de Carbono (CO2)",
      "capacidade_peso": "6 kg (10-B:C)",
      "classe_incendio": "BC",
      "fabricante": "Extang Incêndio",
      "data_fabricacao": "2023-02-20",
      "data_validade": "2028-02-20",
      "numero_lacre": "L-993044",
      "selo_conformidade": "INM-771945"
    }
  },
  {
    "id_produto": 4,
    "sku": "EXT-CO2-4KG",
    "nome": "Extintor CO2 4kg",
    "descricao": "Extintor de dióxido de carbono 4kg classe BC. Estoque abaixo do mínimo operacional com remessa bloqueada para venda preventiva.",
    "custo": 210,
    "preco": 389,
    "categoria": "Extintores",
    "ativo": true,
    "quantidade_atual": 8,
    "estoque_minimo": 25,
    "tipo": "Unitário",
    "detalhes_extintor": {
      "registro_inmetro": "001890/2020",
      "tipo_extintor": "Dióxido de Carbono (CO2)",
      "capacidade_peso": "4 kg (5-B:C)",
      "classe_incendio": "BC",
      "fabricante": "Extang Incêndio",
      "data_fabricacao": "2022-11-20",
      "data_validade": "2027-11-20",
      "numero_lacre": "L-993021",
      "selo_conformidade": "INM-771920"
    }
  },
  {
    "id_produto": 5,
    "sku": "EXT-K-6L",
    "nome": "Extintor Classe K 6L (Cozinhas)",
    "descricao": "Extintor à base de acetato de potássio desenvolvido para combate a incêndios em óleos e gorduras vegetais em cozinhas profissionais.",
    "custo": 410,
    "preco": 749,
    "categoria": "Extintores",
    "ativo": true,
    "quantidade_atual": 6,
    "estoque_minimo": 5,
    "tipo": "Unitário",
    "detalhes_extintor": {
      "registro_inmetro": "005110/2022",
      "tipo_extintor": "Classe K (Cozinhas)",
      "capacidade_peso": "6 Litros (K)",
      "classe_incendio": "K",
      "fabricante": "Kidde Brasil",
      "data_fabricacao": "2023-06-15",
      "data_validade": "2028-06-15",
      "numero_lacre": "L-220194",
      "selo_conformidade": "INM-882031"
    }
  },
  {
    "id_produto": 6,
    "sku": "EXT-PQS-12KG",
    "nome": "Extintor Pó Químico BC 12kg",
    "descricao": "Extintor industrial pressurizado de grande capacidade para indústrias e postos de combustível. Atualmente com estoque esgotado (ruptura).",
    "custo": 175,
    "preco": 329,
    "categoria": "Extintores",
    "ativo": true,
    "quantidade_atual": 0,
    "estoque_minimo": 15,
    "tipo": "Unitário",
    "detalhes_extintor": {
      "registro_inmetro": "004080/2020",
      "tipo_extintor": "Pó Químico Seco (BC)",
      "capacidade_peso": "12 kg (40-B:C)",
      "classe_incendio": "BC",
      "fabricante": "Mocelin",
      "data_fabricacao": "2022-05-10",
      "data_validade": "2027-05-10",
      "numero_lacre": "L-771029",
      "selo_conformidade": "INM-662910"
    }
  },
  {
    "id_produto": 7,
    "sku": "EXT-ESP-9L",
    "nome": "Extintor Espuma Mecânica 9L",
    "descricao": "Extintor de espuma mecânica 9 litros. Linha descontinuada pelo fornecedor.",
    "custo": 145,
    "preco": 289,
    "categoria": "Extintores",
    "ativo": false,
    "quantidade_atual": 0,
    "estoque_minimo": 15,
    "tipo": "Unitário",
    "detalhes_extintor": {
      "registro_inmetro": "004010/2021",
      "tipo_extintor": "Espuma Mecânica",
      "capacidade_peso": "9 Litros (2-A:10-B)",
      "classe_incendio": "ABC",
      "fabricante": "Resil",
      "data_fabricacao": "2022-01-18",
      "data_validade": "2027-01-18",
      "numero_lacre": "L-449102",
      "selo_conformidade": "INM-332190"
    }
  },
  {
    "id_produto": 8,
    "sku": "SUP-EXT-01",
    "nome": "Suporte de Parede p/ Extintor",
    "descricao": "Suporte de fixação universal em chapa de aço zincado resistente a corrosão, compatível com extintores de 4kg a 12kg.",
    "custo": 6.5,
    "preco": 18.9,
    "categoria": "Acessórios & Suportes",
    "ativo": true,
    "quantidade_atual": 180,
    "estoque_minimo": 50,
    "tipo": "Unitário"
  },
  {
    "id_produto": 9,
    "sku": "PLA-FOTO-01",
    "nome": "Placa Sinalização Fotoluminescente",
    "descricao": "Placa de rota de fuga e indicação de extintor fotoluminescente em PVC autoextinguível 20x20cm, em conformidade com NBR 13434.",
    "custo": 9.8,
    "preco": 34.9,
    "categoria": "Sinalização",
    "ativo": true,
    "quantidade_atual": 215,
    "estoque_minimo": 60,
    "tipo": "Unitário"
  },
  {
    "id_produto": 10,
    "sku": "MAN-MANG-15",
    "nome": "Mangueira de Incêndio 15m",
    "descricao": "Mangueira de incêndio tipo 1 (1.1/2'') de 15 metros com uniões de engate rápido Storz em latão, para edifícios residenciais.",
    "custo": 125,
    "preco": 249,
    "categoria": "Hidrantes & Mangueiras",
    "ativo": true,
    "quantidade_atual": 16,
    "estoque_minimo": 15,
    "tipo": "Unitário"
  },
  {
    "id_produto": 11,
    "sku": "DET-FUM-01",
    "nome": "Detector de Fumaça Óptico",
    "descricao": "Detector de fumaça óptico autônomo com sinalizador sonoro de 85dB e bateria de 9V inclusa para residências e escritórios.",
    "custo": 38,
    "preco": 89.9,
    "categoria": "Acessórios & Suportes",
    "ativo": true,
    "quantidade_atual": 32,
    "estoque_minimo": 20,
    "tipo": "Unitário"
  },
  {
    "id_produto": 12,
    "sku": "KIT-ABC-COMPLETO",
    "nome": "Kit Segurança Comercial ABC + Suporte + Placa",
    "descricao": "Combo promocional completo composto por 1x Extintor ABC 4kg, 1x Suporte de Parede e 1x Placa Fotoluminescente. Estoque dinâmico com baixa proporcional.",
    "custo": 98.3,
    "preco": 199.9,
    "categoria": "Kits & Combos",
    "ativo": true,
    "quantidade_atual": 65,
    "estoque_minimo": 20,
    "tipo": "Combo",
    "combo_items": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "quantidade": 1,
        "nome": "Extintor Pó Químico ABC 4kg"
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "quantidade": 1,
        "nome": "Suporte de Parede p/ Extintor"
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "quantidade": 1,
        "nome": "Placa Sinalização Fotoluminescente"
      }
    ]
  }
];

// ─── Lotes de Extintores (FEFO) ──────────────────────────────────────────────
// Saldos somam exatamente a quantidade física de extintores no armazém
const DEFAULT_LOTES = [
  // EXT-PQS-4KG (Saldo: 65 un)
  {
    id_lote: "LT-2024/01",
    id_produto: 1,
    sku: "EXT-PQS-4KG",
    nome: "Extintor Pó Químico ABC 4kg",
    lacre: "INM-948201",
    numero_lote: "LT-2024/01",
    data_fabricacao: subDaysDate(120),
    validade: offsetDaysDate(1100), // ~3 anos (Regular)
    quantidade_disponivel: 45,
    quantidade_inicial: 50,
  },
  {
    id_lote: "LT-2023/15",
    id_produto: 1,
    sku: "EXT-PQS-4KG",
    nome: "Extintor Pó Químico ABC 4kg",
    lacre: "INM-332910",
    numero_lote: "LT-2023/15",
    data_fabricacao: subDaysDate(300),
    validade: offsetDaysDate(240), // 240 dias (Alerta FEFO <= 365 dias)
    quantidade_disponivel: 20,
    quantidade_inicial: 20,
  },

  // EXT-H2O-10L (Saldo: 45 un)
  {
    id_lote: "LT-2024/04",
    id_produto: 2,
    sku: "EXT-H2O-10L",
    nome: "Extintor Água Pressurizada 10L",
    lacre: "INM-849202",
    numero_lote: "LT-2024/04",
    data_fabricacao: subDaysDate(90),
    validade: offsetDaysDate(1180), // ~3.2 anos (Regular)
    quantidade_disponivel: 45,
    quantidade_inicial: 45,
  },

  // EXT-CO2-6KG (Saldo: 22 un)
  {
    id_lote: "LT-2024/07",
    id_produto: 3,
    sku: "EXT-CO2-6KG",
    nome: "Extintor CO2 6kg",
    lacre: "INM-773041",
    numero_lote: "LT-2024/07",
    data_fabricacao: subDaysDate(60),
    validade: offsetDaysDate(950), // ~2.6 anos (Regular)
    quantidade_disponivel: 22,
    quantidade_inicial: 25,
  },

  // EXT-CO2-4KG (Saldo: 8 un) - Bloqueado Preventivo (< 180 dias)
  {
    id_lote: "LT-2023/08",
    id_produto: 4,
    sku: "EXT-CO2-4KG",
    nome: "Extintor CO2 4kg",
    lacre: "INM-771920",
    numero_lote: "LT-2023/08",
    data_fabricacao: subDaysDate(400),
    validade: offsetDaysDate(110), // 110 dias (Bloqueado expedição <= 180 dias)
    quantidade_disponivel: 8,
    quantidade_inicial: 10,
  },

  // EXT-K-6L (Saldo: 6 un)
  {
    id_lote: "LT-2024/11",
    id_produto: 5,
    sku: "EXT-K-6L",
    nome: "Extintor Classe K 6L (Cozinhas)",
    lacre: "INM-882031",
    numero_lote: "LT-2024/11",
    data_fabricacao: subDaysDate(50),
    validade: offsetDaysDate(1250), // ~3.4 anos (Regular)
    quantidade_disponivel: 6,
    quantidade_inicial: 6,
  },

  // EXT-PQS-12KG (Saldo: 0 un) - Vencido / Esgotado
  {
    id_lote: "LT-2022/02",
    id_produto: 6,
    sku: "EXT-PQS-12KG",
    nome: "Extintor Pó Químico BC 12kg",
    lacre: "INM-662910",
    numero_lote: "LT-2022/02",
    data_fabricacao: subDaysDate(800),
    validade: offsetDaysDate(-45), // Vencido há 45 dias
    quantidade_disponivel: 0,
    quantidade_inicial: 15,
  },
];

// ─── Pedidos Simulados ───────────────────────────────────────────────────────
const RAW_ORDERS = [
  {
    "id_pedido": 1,
    "codigo_pedido": "PED-0001",
    "canal": "Venda Direta",
    "cliente": "Condomínio Edifício Mirante do Vale",
    "uf": "SP",
    "diasAtras": 160,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 2,
    "codigo_pedido": "PED-0002",
    "canal": "Venda Direta",
    "cliente": "Auto Posto Alvorada Ltda",
    "uf": "SP",
    "diasAtras": 157,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 3,
    "codigo_pedido": "PED-0003",
    "canal": "Venda Direta",
    "cliente": "Transportadora Rápido Sudeste",
    "uf": "RJ",
    "diasAtras": 154,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 4,
    "codigo_pedido": "PED-0004",
    "canal": "Venda Direta",
    "cliente": "Restaurante e Churrascaria Fogo Nobre",
    "uf": "MG",
    "diasAtras": 151,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 5,
    "codigo_pedido": "PED-0005",
    "canal": "Venda Direta",
    "cliente": "Indústria Metalúrgica Progresso",
    "uf": "SP",
    "diasAtras": 148,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 6,
    "codigo_pedido": "PED-0006",
    "canal": "Venda Direta",
    "cliente": "Supermercado Compre Bem",
    "uf": "PR",
    "diasAtras": 144,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 7,
    "codigo_pedido": "PED-0007",
    "canal": "Venda Direta",
    "cliente": "Hospital e Maternidade São Lucas",
    "uf": "SP",
    "diasAtras": 141,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 8,
    "codigo_pedido": "PED-0008",
    "canal": "Venda Direta",
    "cliente": "Centro Educacional Futuro",
    "uf": "SC",
    "diasAtras": 138,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 9,
    "codigo_pedido": "PED-0009",
    "canal": "Venda Direta",
    "cliente": "Distribuidora de Alimentos União",
    "uf": "GO",
    "diasAtras": 135,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 10,
    "codigo_pedido": "PED-0010",
    "canal": "Venda Direta",
    "cliente": "Oficina Mecânica Precision Car",
    "uf": "SP",
    "diasAtras": 132,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 11,
    "codigo_pedido": "PED-0011",
    "canal": "Venda Direta",
    "cliente": "Hotel Pousada das Palmeiras",
    "uf": "RJ",
    "diasAtras": 129,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 12,
    "codigo_pedido": "PED-0012",
    "canal": "Venda Direta",
    "cliente": "Padaria e Confeitaria Bella Vista",
    "uf": "SP",
    "diasAtras": 126,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 10,
        "preco_unitario": 169.9,
        "subtotal": 1699
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 8,
        "preco_unitario": 159.9,
        "subtotal": 1279.2
      },
      {
        "id_produto": 8,
        "sku": "SUP-EXT-01",
        "nome": "Suporte de Parede p/ Extintor",
        "quantidade": 18,
        "preco_unitario": 18.9,
        "subtotal": 340.2
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 18,
        "preco_unitario": 34.9,
        "subtotal": 628.2
      }
    ],
    "subtotal": 3946.6,
    "desconto": 197.33,
    "frete": 0,
    "valor_total": 3749.27,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 13,
    "codigo_pedido": "PED-0013",
    "canal": "Venda Direta",
    "cliente": "Galpão Logístico Bandeirantes",
    "uf": "SP",
    "diasAtras": 123,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 5,
        "sku": "EXT-K-6L",
        "nome": "Extintor Classe K 6L (Cozinhas)",
        "quantidade": 3,
        "preco_unitario": 749,
        "subtotal": 2247
      },
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 2,
        "preco_unitario": 169.9,
        "subtotal": 339.8
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 5,
        "preco_unitario": 34.9,
        "subtotal": 174.5
      }
    ],
    "subtotal": 2761.3,
    "desconto": 138.07,
    "frete": 0,
    "valor_total": 2623.23,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 14,
    "codigo_pedido": "PED-0014",
    "canal": "Venda Direta",
    "cliente": "Academia Iron Fitness Center",
    "uf": "MG",
    "diasAtras": 119,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 5,
        "sku": "EXT-K-6L",
        "nome": "Extintor Classe K 6L (Cozinhas)",
        "quantidade": 3,
        "preco_unitario": 749,
        "subtotal": 2247
      },
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 2,
        "preco_unitario": 169.9,
        "subtotal": 339.8
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 5,
        "preco_unitario": 34.9,
        "subtotal": 174.5
      }
    ],
    "subtotal": 2761.3,
    "desconto": 138.07,
    "frete": 0,
    "valor_total": 2623.23,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 15,
    "codigo_pedido": "PED-0015",
    "canal": "Venda Direta",
    "cliente": "Gráfica e Editora Moderna",
    "uf": "RS",
    "diasAtras": 116,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 5,
        "sku": "EXT-K-6L",
        "nome": "Extintor Classe K 6L (Cozinhas)",
        "quantidade": 3,
        "preco_unitario": 749,
        "subtotal": 2247
      },
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 2,
        "preco_unitario": 169.9,
        "subtotal": 339.8
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 5,
        "preco_unitario": 34.9,
        "subtotal": 174.5
      }
    ],
    "subtotal": 2761.3,
    "desconto": 138.07,
    "frete": 0,
    "valor_total": 2623.23,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 16,
    "codigo_pedido": "PED-0016",
    "canal": "Venda Direta",
    "cliente": "Farmácia Droga Express",
    "uf": "SP",
    "diasAtras": 113,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 5,
        "sku": "EXT-K-6L",
        "nome": "Extintor Classe K 6L (Cozinhas)",
        "quantidade": 3,
        "preco_unitario": 749,
        "subtotal": 2247
      },
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 2,
        "preco_unitario": 169.9,
        "subtotal": 339.8
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 5,
        "preco_unitario": 34.9,
        "subtotal": 174.5
      }
    ],
    "subtotal": 2761.3,
    "desconto": 138.07,
    "frete": 0,
    "valor_total": 2623.23,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 17,
    "codigo_pedido": "PED-0017",
    "canal": "Venda Direta",
    "cliente": "Teatro Municipal Carlos Gomes",
    "uf": "RJ",
    "diasAtras": 110,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 10,
        "sku": "MAN-MANG-15",
        "nome": "Mangueira de Incêndio 15m",
        "quantidade": 4,
        "preco_unitario": 249,
        "subtotal": 996
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 6,
        "preco_unitario": 34.9,
        "subtotal": 209.4
      }
    ],
    "subtotal": 1205.4,
    "desconto": 60.27,
    "frete": 0,
    "valor_total": 1145.13,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 18,
    "codigo_pedido": "PED-0018",
    "canal": "Venda Direta",
    "cliente": "Laboratório Clínico Biolab",
    "uf": "SP",
    "diasAtras": 107,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 10,
        "sku": "MAN-MANG-15",
        "nome": "Mangueira de Incêndio 15m",
        "quantidade": 4,
        "preco_unitario": 249,
        "subtotal": 996
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 6,
        "preco_unitario": 34.9,
        "subtotal": 209.4
      }
    ],
    "subtotal": 1205.4,
    "desconto": 60.27,
    "frete": 0,
    "valor_total": 1145.13,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 19,
    "codigo_pedido": "PED-0019",
    "canal": "Venda Direta",
    "cliente": "Escola Técnica Integrada",
    "uf": "PR",
    "diasAtras": 104,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 10,
        "sku": "MAN-MANG-15",
        "nome": "Mangueira de Incêndio 15m",
        "quantidade": 4,
        "preco_unitario": 249,
        "subtotal": 996
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 6,
        "preco_unitario": 34.9,
        "subtotal": 209.4
      }
    ],
    "subtotal": 1205.4,
    "desconto": 60.27,
    "frete": 0,
    "valor_total": 1145.13,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 20,
    "codigo_pedido": "PED-0020",
    "canal": "Venda Direta",
    "cliente": "Centro Empresarial Millennium",
    "uf": "SP",
    "diasAtras": 101,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 10,
        "sku": "MAN-MANG-15",
        "nome": "Mangueira de Incêndio 15m",
        "quantidade": 4,
        "preco_unitario": 249,
        "subtotal": 996
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 6,
        "preco_unitario": 34.9,
        "subtotal": 209.4
      }
    ],
    "subtotal": 1205.4,
    "desconto": 60.27,
    "frete": 0,
    "valor_total": 1145.13,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 21,
    "codigo_pedido": "PED-0021",
    "canal": "Venda Direta",
    "cliente": "Condomínio Edifício Mirante do Vale",
    "uf": "SP",
    "diasAtras": 98,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 10,
        "sku": "MAN-MANG-15",
        "nome": "Mangueira de Incêndio 15m",
        "quantidade": 4,
        "preco_unitario": 249,
        "subtotal": 996
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 6,
        "preco_unitario": 34.9,
        "subtotal": 209.4
      }
    ],
    "subtotal": 1205.4,
    "desconto": 60.27,
    "frete": 0,
    "valor_total": 1145.13,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 22,
    "codigo_pedido": "PED-0022",
    "canal": "Venda Direta",
    "cliente": "Auto Posto Alvorada Ltda",
    "uf": "SP",
    "diasAtras": 94,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 10,
        "sku": "MAN-MANG-15",
        "nome": "Mangueira de Incêndio 15m",
        "quantidade": 4,
        "preco_unitario": 249,
        "subtotal": 996
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 6,
        "preco_unitario": 34.9,
        "subtotal": 209.4
      }
    ],
    "subtotal": 1205.4,
    "desconto": 60.27,
    "frete": 0,
    "valor_total": 1145.13,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 23,
    "codigo_pedido": "MLB-2894012023",
    "canal": "Mercado Livre",
    "cliente": "Transportadora Rápido Sudeste",
    "uf": "RJ",
    "diasAtras": 91,
    "status": "Concluido",
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
    "subtotal": 1975.6,
    "desconto": 0,
    "frete": 0,
    "valor_total": 1975.6,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Mercado Envios Coleta"
  },
  {
    "id_pedido": 24,
    "codigo_pedido": "MLB-2894012024",
    "canal": "Mercado Livre",
    "cliente": "Restaurante e Churrascaria Fogo Nobre",
    "uf": "MG",
    "diasAtras": 88,
    "status": "Concluido",
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
    "subtotal": 1975.6,
    "desconto": 0,
    "frete": 0,
    "valor_total": 1975.6,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Mercado Envios Coleta"
  },
  {
    "id_pedido": 58,
    "codigo_pedido": "MLB-2894012058",
    "canal": "Mercado Livre",
    "cliente": "Logística Express Barueri",
    "uf": "SP",
    "diasAtras": 88,
    "status": "Cancelado",
    "motivo_cancelamento": "Desistência do comprador após aprovação comercial (estoque estornado).",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 4,
        "preco_unitario": 169.9,
        "subtotal": 679.6
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
    "subtotal": 755.2,
    "desconto": 0,
    "frete": 0,
    "valor_total": 755.2,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Mercado Envios"
  },
  {
    "id_pedido": 25,
    "codigo_pedido": "MLB-2894012025",
    "canal": "Mercado Livre",
    "cliente": "Indústria Metalúrgica Progresso",
    "uf": "SP",
    "diasAtras": 85,
    "status": "Concluido",
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
    "subtotal": 1975.6,
    "desconto": 0,
    "frete": 0,
    "valor_total": 1975.6,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Mercado Envios Coleta"
  },
  {
    "id_pedido": 26,
    "codigo_pedido": "MLB-2894012026",
    "canal": "Mercado Livre",
    "cliente": "Supermercado Compre Bem",
    "uf": "PR",
    "diasAtras": 82,
    "status": "Concluido",
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
    "subtotal": 1631.6,
    "desconto": 0,
    "frete": 0,
    "valor_total": 1631.6,
    "forma_pagamento": "PIX",
    "tipo_envio": "Mercado Envios Coleta"
  },
  {
    "id_pedido": 27,
    "codigo_pedido": "MLB-2894012027",
    "canal": "Mercado Livre",
    "cliente": "Hospital e Maternidade São Lucas",
    "uf": "SP",
    "diasAtras": 79,
    "status": "Concluido",
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
    "subtotal": 719.2,
    "desconto": 0,
    "frete": 0,
    "valor_total": 719.2,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Mercado Envios Coleta"
  },
  {
    "id_pedido": 28,
    "codigo_pedido": "MLB-2894012028",
    "canal": "Mercado Livre",
    "cliente": "Centro Educacional Futuro",
    "uf": "SC",
    "diasAtras": 76,
    "status": "Concluido",
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
    "subtotal": 719.2,
    "desconto": 0,
    "frete": 0,
    "valor_total": 719.2,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Mercado Envios Coleta"
  },
  {
    "id_pedido": 29,
    "codigo_pedido": "MLB-2894012029",
    "canal": "Mercado Livre",
    "cliente": "Distribuidora de Alimentos União",
    "uf": "GO",
    "diasAtras": 73,
    "status": "Concluido",
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
    "subtotal": 719.2,
    "desconto": 0,
    "frete": 0,
    "valor_total": 719.2,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Mercado Envios Coleta"
  },
  {
    "id_pedido": 30,
    "codigo_pedido": "MLB-2894012030",
    "canal": "Mercado Livre",
    "cliente": "Oficina Mecânica Precision Car",
    "uf": "SP",
    "diasAtras": 70,
    "status": "Concluido",
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
    "subtotal": 719.2,
    "desconto": 0,
    "frete": 0,
    "valor_total": 719.2,
    "forma_pagamento": "PIX",
    "tipo_envio": "Mercado Envios Coleta"
  },
  {
    "id_pedido": 31,
    "codigo_pedido": "MLB-2894012031",
    "canal": "Mercado Livre",
    "cliente": "Hotel Pousada das Palmeiras",
    "uf": "RJ",
    "diasAtras": 66,
    "status": "Concluido",
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
    "subtotal": 719.2,
    "desconto": 0,
    "frete": 0,
    "valor_total": 719.2,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Mercado Envios Coleta"
  },
  {
    "id_pedido": 32,
    "codigo_pedido": "MLB-2894012032",
    "canal": "Mercado Livre",
    "cliente": "Padaria e Confeitaria Bella Vista",
    "uf": "SP",
    "diasAtras": 63,
    "status": "Concluido",
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
    "subtotal": 719.2,
    "desconto": 0,
    "frete": 0,
    "valor_total": 719.2,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Mercado Envios Coleta"
  },
  {
    "id_pedido": 33,
    "codigo_pedido": "PED-0033",
    "canal": "Venda Direta",
    "cliente": "Galpão Logístico Bandeirantes",
    "uf": "SP",
    "diasAtras": 60,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 4,
        "preco_unitario": 169.9,
        "subtotal": 679.6
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 4,
        "preco_unitario": 159.9,
        "subtotal": 639.6
      },
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 1,
        "preco_unitario": 34.9,
        "subtotal": 34.9
      }
    ],
    "subtotal": 3708.1,
    "desconto": 185.41,
    "frete": 0,
    "valor_total": 3522.69,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 34,
    "codigo_pedido": "PED-0034",
    "canal": "Venda Direta",
    "cliente": "Academia Iron Fitness Center",
    "uf": "MG",
    "diasAtras": 57,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 4,
        "preco_unitario": 169.9,
        "subtotal": 679.6
      },
      {
        "id_produto": 2,
        "sku": "EXT-H2O-10L",
        "nome": "Extintor Água Pressurizada 10L",
        "quantidade": 2,
        "preco_unitario": 159.9,
        "subtotal": 319.8
      },
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 3353.4,
    "desconto": 167.67,
    "frete": 0,
    "valor_total": 3185.73,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 35,
    "codigo_pedido": "PED-0035",
    "canal": "Venda Direta",
    "cliente": "Gráfica e Editora Moderna",
    "uf": "RS",
    "diasAtras": 54,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 4,
        "preco_unitario": 169.9,
        "subtotal": 679.6
      },
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 3033.6,
    "desconto": 151.68,
    "frete": 0,
    "valor_total": 2881.92,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 36,
    "codigo_pedido": "PED-0036",
    "canal": "Venda Direta",
    "cliente": "Farmácia Droga Express",
    "uf": "SP",
    "diasAtras": 51,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 4,
        "preco_unitario": 169.9,
        "subtotal": 679.6
      },
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 3033.6,
    "desconto": 151.68,
    "frete": 0,
    "valor_total": 2881.92,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 37,
    "codigo_pedido": "PED-0037",
    "canal": "Venda Direta",
    "cliente": "Teatro Municipal Carlos Gomes",
    "uf": "RJ",
    "diasAtras": 48,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 4,
        "preco_unitario": 169.9,
        "subtotal": 679.6
      },
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 3033.6,
    "desconto": 151.68,
    "frete": 0,
    "valor_total": 2881.92,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 38,
    "codigo_pedido": "PED-0038",
    "canal": "Venda Direta",
    "cliente": "Laboratório Clínico Biolab",
    "uf": "SP",
    "diasAtras": 45,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 4,
        "preco_unitario": 169.9,
        "subtotal": 679.6
      },
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 3033.6,
    "desconto": 151.68,
    "frete": 0,
    "valor_total": 2881.92,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 59,
    "codigo_pedido": "PED-0059",
    "canal": "Venda Direta",
    "cliente": "Restaurante Sabor Mineiro",
    "uf": "MG",
    "diasAtras": 42,
    "status": "Cancelado",
    "motivo_cancelamento": "Desistência do comprador após aprovação comercial (estoque estornado).",
    "itens": [
      {
        "id_produto": 5,
        "sku": "EXT-K-6L",
        "nome": "Extintor Classe K 6L (Cozinhas)",
        "quantidade": 2,
        "preco_unitario": 749,
        "subtotal": 1498
      }
    ],
    "subtotal": 1498,
    "desconto": 0,
    "frete": 0,
    "valor_total": 1498,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Mercado Envios"
  },
  {
    "id_pedido": 39,
    "codigo_pedido": "PED-0039",
    "canal": "Venda Direta",
    "cliente": "Escola Técnica Integrada",
    "uf": "PR",
    "diasAtras": 41,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 1,
        "sku": "EXT-PQS-4KG",
        "nome": "Extintor Pó Químico ABC 4kg",
        "quantidade": 3,
        "preco_unitario": 169.9,
        "subtotal": 509.7
      },
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 2863.7,
    "desconto": 143.19,
    "frete": 0,
    "valor_total": 2720.51,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 40,
    "codigo_pedido": "PED-0040",
    "canal": "Venda Direta",
    "cliente": "Centro Empresarial Millennium",
    "uf": "SP",
    "diasAtras": 38,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 2354,
    "desconto": 117.7,
    "frete": 0,
    "valor_total": 2236.3,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 41,
    "codigo_pedido": "PED-0041",
    "canal": "Venda Direta",
    "cliente": "Condomínio Edifício Mirante do Vale",
    "uf": "SP",
    "diasAtras": 35,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 2354,
    "desconto": 117.7,
    "frete": 0,
    "valor_total": 2236.3,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 42,
    "codigo_pedido": "PED-0042",
    "canal": "Venda Direta",
    "cliente": "Auto Posto Alvorada Ltda",
    "uf": "SP",
    "diasAtras": 32,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 2354,
    "desconto": 117.7,
    "frete": 0,
    "valor_total": 2236.3,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 43,
    "codigo_pedido": "PED-0043",
    "canal": "Venda Direta",
    "cliente": "Transportadora Rápido Sudeste",
    "uf": "RJ",
    "diasAtras": 29,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 2354,
    "desconto": 117.7,
    "frete": 0,
    "valor_total": 2236.3,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 44,
    "codigo_pedido": "PED-0044",
    "canal": "Venda Direta",
    "cliente": "Restaurante e Churrascaria Fogo Nobre",
    "uf": "MG",
    "diasAtras": 26,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 2354,
    "desconto": 117.7,
    "frete": 0,
    "valor_total": 2236.3,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 45,
    "codigo_pedido": "PED-0045",
    "canal": "Venda Direta",
    "cliente": "Indústria Metalúrgica Progresso",
    "uf": "SP",
    "diasAtras": 23,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 2354,
    "desconto": 117.7,
    "frete": 0,
    "valor_total": 2236.3,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 46,
    "codigo_pedido": "PED-0046",
    "canal": "Venda Direta",
    "cliente": "Supermercado Compre Bem",
    "uf": "PR",
    "diasAtras": 20,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 4,
        "sku": "EXT-CO2-4KG",
        "nome": "Extintor CO2 4kg",
        "quantidade": 2,
        "preco_unitario": 389,
        "subtotal": 778
      },
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 1436,
    "desconto": 71.8,
    "frete": 0,
    "valor_total": 1364.2,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 47,
    "codigo_pedido": "PED-0047",
    "canal": "Venda Direta",
    "cliente": "Hospital e Maternidade São Lucas",
    "uf": "SP",
    "diasAtras": 16,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 658,
    "desconto": 0,
    "frete": 0,
    "valor_total": 658,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 48,
    "codigo_pedido": "PED-0048",
    "canal": "Venda Direta",
    "cliente": "Centro Educacional Futuro",
    "uf": "SC",
    "diasAtras": 13,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 658,
    "desconto": 0,
    "frete": 0,
    "valor_total": 658,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 60,
    "codigo_pedido": "MLB-2894012060",
    "canal": "Mercado Livre",
    "cliente": "Condomínio Bosque Real",
    "uf": "RJ",
    "diasAtras": 12,
    "status": "Cancelado",
    "motivo_cancelamento": "Desistência do comprador após aprovação comercial (estoque estornado).",
    "itens": [
      {
        "id_produto": 3,
        "sku": "EXT-CO2-6KG",
        "nome": "Extintor CO2 6kg",
        "quantidade": 2,
        "preco_unitario": 459,
        "subtotal": 918
      },
      {
        "id_produto": 9,
        "sku": "PLA-FOTO-01",
        "nome": "Placa Sinalização Fotoluminescente",
        "quantidade": 5,
        "preco_unitario": 34.9,
        "subtotal": 174.5
      }
    ],
    "subtotal": 1092.5,
    "desconto": 0,
    "frete": 0,
    "valor_total": 1092.5,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Mercado Envios"
  },
  {
    "id_pedido": 49,
    "codigo_pedido": "PED-0049",
    "canal": "Venda Direta",
    "cliente": "Distribuidora de Alimentos União",
    "uf": "GO",
    "diasAtras": 10,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 658,
    "desconto": 0,
    "frete": 0,
    "valor_total": 658,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 50,
    "codigo_pedido": "PED-0050",
    "canal": "Venda Direta",
    "cliente": "Oficina Mecânica Precision Car",
    "uf": "SP",
    "diasAtras": 7,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 658,
    "desconto": 0,
    "frete": 0,
    "valor_total": 658,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 51,
    "codigo_pedido": "PED-0051",
    "canal": "Venda Direta",
    "cliente": "Hotel Pousada das Palmeiras",
    "uf": "RJ",
    "diasAtras": 4,
    "status": "Concluido",
    "itens": [
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 658,
    "desconto": 0,
    "frete": 0,
    "valor_total": 658,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 52,
    "codigo_pedido": "PED-0052",
    "canal": "Venda Direta",
    "cliente": "Padaria e Confeitaria Bella Vista",
    "uf": "SP",
    "diasAtras": 3,
    "status": "Confirmado",
    "itens": [
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 658,
    "desconto": 0,
    "frete": 0,
    "valor_total": 658,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 53,
    "codigo_pedido": "PED-0053",
    "canal": "Venda Direta",
    "cliente": "Galpão Logístico Bandeirantes",
    "uf": "SP",
    "diasAtras": 2,
    "status": "Confirmado",
    "itens": [
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 658,
    "desconto": 0,
    "frete": 0,
    "valor_total": 658,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 54,
    "codigo_pedido": "PED-0054",
    "canal": "Venda Direta",
    "cliente": "Academia Iron Fitness Center",
    "uf": "MG",
    "diasAtras": 1,
    "status": "Confirmado",
    "itens": [
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 658,
    "desconto": 0,
    "frete": 0,
    "valor_total": 658,
    "forma_pagamento": "PIX",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 55,
    "codigo_pedido": "PED-0055",
    "canal": "Venda Direta",
    "cliente": "Gráfica e Editora Moderna",
    "uf": "RS",
    "diasAtras": 1,
    "status": "Confirmado",
    "itens": [
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 658,
    "desconto": 0,
    "frete": 0,
    "valor_total": 658,
    "forma_pagamento": "Mercado Pago",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 56,
    "codigo_pedido": "PED-0056",
    "canal": "Venda Direta",
    "cliente": "Farmácia Droga Express",
    "uf": "SP",
    "diasAtras": 0,
    "status": "Confirmado",
    "itens": [
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 658,
    "desconto": 0,
    "frete": 0,
    "valor_total": 658,
    "forma_pagamento": "Cartão de Crédito",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  },
  {
    "id_pedido": 57,
    "codigo_pedido": "PED-0057",
    "canal": "Venda Direta",
    "cliente": "Teatro Municipal Carlos Gomes",
    "uf": "RJ",
    "diasAtras": 0,
    "status": "Confirmado",
    "itens": [
      {
        "id_produto": 6,
        "sku": "EXT-PQS-12KG",
        "nome": "Extintor Pó Químico BC 12kg",
        "quantidade": 2,
        "preco_unitario": 329,
        "subtotal": 658
      }
    ],
    "subtotal": 658,
    "desconto": 0,
    "frete": 0,
    "valor_total": 658,
    "forma_pagamento": "Boleto Bancário",
    "tipo_envio": "Transportadora Parceira (Rodonaves)"
  }
];

function generateMockOrders() {
  return RAW_ORDERS.map((o) => {
    const dataIso = subDaysDate(o.diasAtras, (o.id_pedido % 12) + 8, (o.id_pedido * 7) % 60);
    return {
      ...o,
      data_pedido: dataIso,
      subtotal_itens: o.subtotal,
      codigo_externo_ml: o.canal === "Mercado Livre" ? o.codigo_pedido : null,
      historico: [
        {
          data: dataIso,
          evento: "Pedido Registrado",
          descricao: `Registrado via ${o.canal}.`,
          usuario: o.canal === "Mercado Livre" ? "Mercado Livre API" : "Gestor RezFire",
        },
        ...(o.status !== "Confirmado"
          ? [
              {
                data: dataIso,
                evento: "Status: " + o.status,
                descricao: o.motivo_cancelamento || "Atualização de status comercial.",
                usuario: "Gestor RezFire",
              },
            ]
          : []),
      ],
    };
  });
}

// ─── Movimentações de Estoque ────────────────────────────────────────────────
function generateMockMovements(ordersList) {
  let movId = 1;
  const movements = [];

  // 1. Entradas por Nota Fiscal de Fornecedor
  const entradasIniciais = [
    { diasAtras: 175, id_produto: 8, sku: "SUP-EXT-01", qtd: 400, unit: 6.5, nf: "NF-e 10600 - Metalúrgica Combate", fornecedor: "Metalúrgica Combate" },
    { diasAtras: 170, id_produto: 1, sku: "EXT-PQS-4KG", qtd: 120, unit: 82.0, nf: "NF-e 10420 - Resil Comercial", fornecedor: "Resil Comercial Ltda" },
    { diasAtras: 165, id_produto: 9, sku: "PLA-FOTO-01", qtd: 500, unit: 9.8, nf: "NF-e 10702 - Sinaliza Indústria", fornecedor: "Sinaliza Indústria Visual" },
    { diasAtras: 160, id_produto: 2, sku: "EXT-H2O-10L", qtd: 150, unit: 74.0, nf: "NF-e 10420 - Resil Comercial", fornecedor: "Resil Comercial Ltda" },
    { diasAtras: 140, id_produto: 11, sku: "DET-FUM-01", qtd: 80, unit: 38.0, nf: "NF-e 10800 - Segurimax", fornecedor: "Segurimax Distribuição" },
    { diasAtras: 130, id_produto: 3, sku: "EXT-CO2-6KG", qtd: 60, unit: 245.0, nf: "NF-e 10512 - Extang Incêndio", fornecedor: "Extang Incêndio Indústria" },
    { diasAtras: 125, id_produto: 4, sku: "EXT-CO2-4KG", qtd: 40, unit: 210.0, nf: "NF-e 10512 - Extang Incêndio", fornecedor: "Extang Incêndio Indústria" },
    { diasAtras: 100, id_produto: 10, sku: "MAN-MANG-15", qtd: 40, unit: 125.0, nf: "NF-e 10740 - Metalúrgica Combate", fornecedor: "Metalúrgica Combate" },
    { diasAtras: 90, id_produto: 5, sku: "EXT-K-6L", qtd: 18, unit: 410.0, nf: "NF-e 10540 - Kidde Brasil", fornecedor: "Kidde Brasil Ltda" },
    { diasAtras: 80, id_produto: 6, sku: "EXT-PQS-12KG", qtd: 50, unit: 175.0, nf: "NF-e 10560 - Mocelin", fornecedor: "Mocelin Equipamentos" },
    { diasAtras: 45, id_produto: 1, sku: "EXT-PQS-4KG", qtd: 100, unit: 82.0, nf: "NF-e 10680 - Kidde Brasil", fornecedor: "Kidde Brasil Ltda" },
  ];

  entradasIniciais.forEach((ent) => {
    const prod = DEFAULT_PRODUCTS.find((p) => p.id_produto === ent.id_produto);
    movements.push({
      id_movimentacao: movId++,
      id_produto: ent.id_produto,
      sku: ent.sku,
      nome_produto: prod ? prod.nome : ent.sku,
      tipo: "Entrada",
      motivo: `Abastecimento Fornecedor (${ent.nf})`,
      quantidade: ent.qtd,
      preco_unitario: ent.unit,
      valor_total: Number((ent.qtd * ent.unit).toFixed(2)),
      data: subDaysDate(ent.diasAtras, 9, 30),
      responsavel: "Gestor RezFire",
      detalhes_remessa: {
        fornecedor: ent.fornecedor,
        nota_fiscal: ent.nf,
      },
    });
  });

  // 2. Saídas Operacionais Avulsas (Avarias/Perdas no Galpão)
  const prodH2O = DEFAULT_PRODUCTS.find((p) => p.id_produto === 2);
  movements.push({
    id_movimentacao: movId++,
    id_produto: 2,
    sku: "EXT-H2O-10L",
    nome_produto: prodH2O.nome,
    tipo: "Saída",
    motivo: "Perda operacional (despressurização / avaria no galpão)",
    quantidade: 3,
    preco_unitario: prodH2O.preco,
    valor_total: Number((3 * prodH2O.preco).toFixed(2)),
    data: subDaysDate(55, 14, 15),
    responsavel: "Gestor RezFire",
    detalhes_remessa: null,
  });

  // 3. Saídas por Vendas de Pedidos
  ordersList.forEach((order) => {
    (order.itens || []).forEach((item) => {
      movements.push({
        id_movimentacao: movId++,
        id_pedido: order.id_pedido,
        codigo_pedido: order.codigo_pedido,
        canal: order.canal,
        tipo_envio: order.tipo_envio,
        cliente: order.cliente,
        uf: order.uf,
        status_pedido: order.status,
        id_produto: item.id_produto,
        sku: item.sku,
        nome_produto: item.nome,
        tipo: "Saída",
        motivo: order.canal === "Mercado Livre" ? `Venda Mercado Livre (${order.codigo_pedido})` : `Venda Direta (${order.codigo_pedido})`,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        valor_total: item.subtotal,
        data: order.data_pedido,
        responsavel: order.canal === "Mercado Livre" ? "Mercado Livre API" : "Gestor RezFire",
        detalhes_remessa: null,
      });

      // Se o pedido foi cancelado pós-aprovação, gera imediatamente a Entrada correspondente de estorno
      if (order.status === "Cancelado") {
        const dataEstorno = new Date(new Date(order.data_pedido).getTime() + 3600000).toISOString();
        movements.push({
          id_movimentacao: movId++,
          id_pedido: order.id_pedido,
          codigo_pedido: order.codigo_pedido,
          canal: order.canal,
          tipo_envio: order.tipo_envio,
          cliente: order.cliente,
          uf: order.uf,
          status_pedido: "Cancelado",
          id_produto: item.id_produto,
          sku: item.sku,
          nome_produto: item.nome,
          tipo: "Entrada",
          motivo: `Estorno de Cancelamento - Pedido ${order.codigo_pedido}`,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          valor_total: item.subtotal,
          data: dataEstorno,
          responsavel: "Gestor RezFire",
          detalhes_remessa: null,
        });
      }
    });
  });

  // Ordena por data decrescente (mais recente primeiro)
  movements.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  return movements;
}

const DEFAULT_ORDERS = generateMockOrders();
const DEFAULT_MOVEMENTS = generateMockMovements(DEFAULT_ORDERS);

const DEFAULT_FINANCIAL_SETTINGS = {
  taxa_ml_percent: 13.0,
  taxa_direto_percent: 2.5,
};

// ─── Migração Automática e Versionamento ────────────────────────────────────
function verificarVersaoMocks() {
  try {
    const versao = localStorage.getItem(MOCK_VERSION_KEY);
    if (versao !== CURRENT_MOCK_VERSION) {
      resetarDadosPadrao();
    }
  } catch (err) {
    console.warn("Não foi possível verificar versão do mock:", err);
  }
}

function resetarDadosPadrao() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ORDERS_KEY);
    localStorage.removeItem(MOVEMENTS_KEY);
    localStorage.removeItem(LOTES_KEY);
    localStorage.removeItem(INSPECOES_KEY);
    localStorage.removeItem(FINANCIAL_SETTINGS_KEY);
    localStorage.removeItem("rezfire.anuncios");
    localStorage.removeItem("rezfire.anuncios.sync");
    localStorage.removeItem("rezfire.entregas");
    localStorage.removeItem("rezfire.certificados");
    localStorage.setItem(MOCK_VERSION_KEY, CURRENT_MOCK_VERSION);
  } catch (err) {
    console.error("Erro ao resetar mocks:", err);
  }
}

// Executa verificação inicial
verificarVersaoMocks();

// ─── Métodos de Acesso a Dados ──────────────────────────────────────────────
function cloneDefaults() {
  return DEFAULT_PRODUCTS.map((item) => ({ ...item }));
}

function loadProducts() {
  verificarVersaoMocks();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const def = cloneDefaults();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(def));
      return def;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : cloneDefaults();
  } catch {
    return cloneDefaults();
  }
}

function saveProducts(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error("Erro ao salvar produtos:", err);
  }
}

function nextProductId(items) {
  const ids = items.map((i) => Number(i.id_produto) || 0);
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function loadOrders() {
  verificarVersaoMocks();
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(DEFAULT_ORDERS));
      return DEFAULT_ORDERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ORDERS;
  } catch {
    return DEFAULT_ORDERS;
  }
}

function saveOrders(ordersList) {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(ordersList));
  } catch (err) {
    console.error("Erro ao salvar pedidos:", err);
  }
}

function nextOrderId(ordersList) {
  const ids = ordersList.map((o) => Number(o.id_pedido) || 0);
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

function loadMovements() {
  verificarVersaoMocks();
  try {
    const raw = localStorage.getItem(MOVEMENTS_KEY);
    if (!raw) {
      localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(DEFAULT_MOVEMENTS));
      return DEFAULT_MOVEMENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MOVEMENTS;
  } catch {
    return DEFAULT_MOVEMENTS;
  }
}

function saveMovements(movementsList) {
  try {
    localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movementsList));
  } catch (err) {
    console.error("Erro ao salvar movimentações:", err);
  }
}

function computeMovementsMetrics(movements) {
  const saidasML = movements.filter((m) => m.tipo === "Saída" && m.canal === "Mercado Livre");
  const saidasDiretas = movements.filter((m) => m.tipo === "Saída" && m.canal === "Venda Direta");
  const entradas = movements.filter((m) => m.tipo === "Entrada");

  const qtdSaidasML = saidasML.reduce((sum, m) => sum + Number(m.quantidade || 0), 0);
  const valorSaidasML = saidasML.reduce((sum, m) => sum + Number(m.valor_total || 0), 0);

  const qtdSaidasDiretas = saidasDiretas.reduce((sum, m) => sum + Number(m.quantidade || 0), 0);
  const valorSaidasDiretas = saidasDiretas.reduce((sum, m) => sum + Number(m.valor_total || 0), 0);

  const qtdEntradas = entradas.reduce((sum, m) => sum + Number(m.quantidade || 0), 0);

  return {
    totalMovimentacoes: movements.length,
    qtdSaidasML,
    valorSaidasML,
    qtdSaidasDiretas,
    valorSaidasDiretas,
    qtdEntradas,
    ultimaMovimentacao: movements[0] || null,
  };
}

// ─── Dashboard Geral (Calculado Dinamicamente do Storage) ───────────────────
function computeDashboard(products) {
  const ativos = products.filter((p) => p.ativo);
  const quantidadeTotal = ativos.reduce((sum, p) => sum + Number(p.quantidade_atual || 0), 0);
  const valorTotal = ativos.reduce(
    (sum, p) => sum + Number(p.quantidade_atual || 0) * Number(p.preco || 0),
    0
  );
  const abaixoMinimo = ativos.filter(
    (p) => Number(p.quantidade_atual) <= Number(p.estoque_minimo)
  ).length;

  const movements = loadMovements();
  const orders = loadOrders();

  const seisMesesAtras = Date.now() - 180 * 86400000;
  const movsPeriodo = movements.filter((m) => new Date(m.data).getTime() >= seisMesesAtras);

  const entradas = movsPeriodo.filter((m) => m.tipo === "Entrada").reduce((sum, m) => sum + Number(m.quantidade || 0), 0);
  const saidas = movsPeriodo.filter((m) => m.tipo === "Saída").reduce((sum, m) => sum + Number(m.quantidade || 0), 0);

  const diasPeriodo = 180;
  const saidaDiaria = saidas / diasPeriodo;
  const coberturaDias = saidaDiaria > 0 ? Math.round(quantidadeTotal / saidaDiaria) : 0;
  const giroAno = quantidadeTotal > 0 ? ((saidas * 2) / quantidadeTotal).toFixed(1).replace(".", ",") : "0,0";
  const frequenciaMedia = (movsPeriodo.length / 6).toFixed(1).replace(".", ",");

  const validOrders = orders.filter((o) => o.status !== "Cancelado");
  const ticketMedio = validOrders.length > 0
    ? validOrders.reduce((sum, p) => sum + Number(p.valor_total || 0), 0) / validOrders.length
    : 0;

  // Movimentações Mensais para o gráfico ApexCharts (últimos 6 meses)
  const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const now = new Date();
  const ultimos6Meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    ultimos6Meses.push({
      ano: d.getFullYear(),
      mes: d.getMonth(),
      label: `${mesesNomes[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
      entradas: 0,
      saidas: 0,
    });
  }

  movements.forEach((m) => {
    const mDate = new Date(m.data);
    const bucket = ultimos6Meses.find((b) => b.ano === mDate.getFullYear() && b.mes === mDate.getMonth());
    if (bucket) {
      if (m.tipo === "Entrada") bucket.entradas += Number(m.quantidade || 0);
      else if (m.tipo === "Saída") bucket.saidas += Number(m.quantidade || 0);
    }
  });

  const movimentacoesMensais = ultimos6Meses.map((b) => ({
    mes: b.label,
    entradas: b.entradas,
    saidas: b.saidas,
  }));

  return {
    quantidadeTotal,
    valorTotal,
    abaixoMinimo,
    coberturaDias,
    giroAno,
    entradas,
    saidas,
    frequenciaMedia,
    ticketMedio,
    movimentacoesMensais,
  };
}

// ─── Dashboard de Vendas (Dinâmico com Date.now) ─────────────────────────────
function computeSalesMetrics(orders, filterDays = 30, filterChannel = "") {
  const refTime = Date.now() + 60000;
  const dayMs = 86400000;
  const currentWindowStart = refTime - (filterDays * dayMs);
  const previousWindowStart = currentWindowStart - (filterDays * dayMs);

  // Filtra por canal se informado
  let baseOrders = orders;
  if (filterChannel && filterChannel !== "todos") {
    baseOrders = baseOrders.filter((o) => o.canal.toLowerCase().includes(filterChannel.toLowerCase()));
  }

  // Pedidos do período atual
  const periodOrders = baseOrders.filter((o) => {
    const t = new Date(o.data_pedido).getTime();
    return t >= currentWindowStart && t <= refTime;
  });

  // Pedidos do período anterior para comparação
  const prevPeriodOrders = baseOrders.filter((o) => {
    const t = new Date(o.data_pedido).getTime();
    return t >= previousWindowStart && t < currentWindowStart;
  });

  // Pedidos válidos (não cancelados)
  const validOrders = periodOrders.filter((o) => o.status !== "Cancelado");
  const cancelOrders = periodOrders.filter((o) => o.status === "Cancelado");
  const prevValidOrders = prevPeriodOrders.filter((o) => o.status !== "Cancelado");

  const totalPedidos = periodOrders.length;
  const pedidosConcluidos = validOrders.length;
  const taxaConclusao = totalPedidos > 0 ? ((pedidosConcluidos / totalPedidos) * 100).toFixed(1) : "100.0";
  const taxaCancelamento = totalPedidos > 0 ? ((cancelOrders.length / totalPedidos) * 100).toFixed(1) : "0.0";

  // Faturamento e Lucro
  const faturamentoTotal = validOrders.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
  const faturamentoAnterior = prevValidOrders.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
  
  let deltaFaturamento = 0;
  if (faturamentoAnterior > 0) {
    deltaFaturamento = Math.round(((faturamentoTotal - faturamentoAnterior) / faturamentoAnterior) * 1000) / 10;
  } else if (faturamentoTotal > 0) {
    deltaFaturamento = 100;
  }

  const custoTotal = validOrders.reduce((sum, o) => sum + Number(o.custo_total || 0), 0);
  const lucroBruto = faturamentoTotal - custoTotal;
  const margemBrutaPercentual = faturamentoTotal > 0 ? ((lucroBruto / faturamentoTotal) * 100).toFixed(1) : "0.0";

  const ticketMedio = pedidosConcluidos > 0 ? faturamentoTotal / pedidosConcluidos : 0;
  
  // Unidades vendidas por tipo e por produto
  let totalUnidades = 0;
  const productAggMap = {};
  const categoryAggMap = {};

  validOrders.forEach((o) => {
    (o.itens || []).forEach((item) => {
      totalUnidades += item.quantidade;

      // Por produto
      if (!productAggMap[item.id_produto]) {
        productAggMap[item.id_produto] = {
          id_produto: item.id_produto,
          sku: item.sku,
          nome: item.nome,
          categoria: item.categoria,
          quantidade: 0,
          faturamento: 0,
          lucro: 0,
        };
      }
      productAggMap[item.id_produto].quantidade += item.quantidade;
      productAggMap[item.id_produto].faturamento += item.subtotal;
      productAggMap[item.id_produto].lucro += (item.subtotal - item.custo_total);

      // Por categoria
      const cat = item.categoria || "Geral";
      if (!categoryAggMap[cat]) {
        categoryAggMap[cat] = { categoria: cat, faturamento: 0, quantidade: 0 };
      }
      categoryAggMap[cat].faturamento += item.subtotal;
      categoryAggMap[cat].quantidade += item.quantidade;
    });
  });

  const topProdutos = Object.values(productAggMap).sort((a, b) => b.faturamento - a.faturamento);
  const categorias = Object.values(categoryAggMap).sort((a, b) => b.faturamento - a.faturamento);

  // Faturamento Mercado Livre vs Venda Direta
  const mlOrders = validOrders.filter((o) => o.canal === "Mercado Livre");
  const faturamentoML = mlOrders.reduce((sum, o) => sum + o.valor_total, 0);
  const diretoOrders = validOrders.filter((o) => o.canal !== "Mercado Livre");
  const faturamentoDireto = diretoOrders.reduce((sum, o) => sum + o.valor_total, 0);
  const shareML = faturamentoTotal > 0 ? ((faturamentoML / faturamentoTotal) * 100).toFixed(1) : "0.0";

  // Vendas por Estado / UF
  const ufMap = {};
  validOrders.forEach((o) => {
    const uf = o.uf || "SP";
    if (!ufMap[uf]) ufMap[uf] = { uf, faturamento: 0, pedidos: 0 };
    ufMap[uf].faturamento += o.valor_total;
    ufMap[uf].pedidos += 1;
  });
  const ufs = Object.values(ufMap).sort((a, b) => b.faturamento - a.faturamento);

  // Status dos Pedidos no período (Unificado: Confirmado, Concluído, Cancelado)
  const statusCount = {
    Concluido: periodOrders.filter((o) => o.status === "Concluído" || o.status === "Entregue").length,
    Confirmado: periodOrders.filter((o) => o.status === "Confirmado" || o.status === "Aprovado" || o.status === "Em preparação" || o.status === "Pendente de confirmação").length,
    Cancelado: cancelOrders.length,
  };

  // Evolução temporal para gráfico
  // Agrupamento: Se período <= 30 dias, quebra em 5 blocos de dias; se maior, quebra por meses
  let timelineCategories = [];
  let timelineFaturamento = [];
  let timelinePedidos = [];

  if (filterDays <= 30) {
    // 6 períodos de 5 dias
    const slots = 6;
    const slotDuration = (filterDays * dayMs) / slots;
    for (let i = 0; i < slots; i++) {
      const slotStart = currentWindowStart + i * slotDuration;
      const slotEnd = slotStart + slotDuration;
      const dStart = new Date(slotStart);
      const label = `${dStart.getDate()}/${dStart.getMonth() + 1}`;
      
      const inSlot = validOrders.filter((o) => {
        const t = new Date(o.data_pedido).getTime();
        return t >= slotStart && t < slotEnd;
      });

      timelineCategories.push(label);
      timelineFaturamento.push(Math.round(inSlot.reduce((sum, o) => sum + o.valor_total, 0)));
      timelinePedidos.push(inSlot.length);
    }
  } else {
    // Meses (Mai, Jun, Jul, Ago, Set, Out)
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthBuckets = {};

    validOrders.forEach((o) => {
      const d = new Date(o.data_pedido);
      const mLabel = monthNames[d.getMonth()];
      if (!monthBuckets[mLabel]) {
        monthBuckets[mLabel] = { faturamento: 0, pedidos: 0, order: d.getMonth() };
      }
      monthBuckets[mLabel].faturamento += o.valor_total;
      monthBuckets[mLabel].pedidos += 1;
    });

    const sortedMonths = Object.keys(monthBuckets).sort((a, b) => monthBuckets[a].order - monthBuckets[b].order);
    timelineCategories = sortedMonths;
    timelineFaturamento = sortedMonths.map((m) => Math.round(monthBuckets[m].faturamento));
    timelinePedidos = sortedMonths.map((m) => monthBuckets[m].pedidos);
  }

  // Lista dos pedidos ordenados do mais recente para o mais antigo
  const recentOrders = [...periodOrders].sort((a, b) => new Date(b.data_pedido) - new Date(a.data_pedido));

  return {
    faturamentoTotal,
    faturamentoAnterior,
    deltaFaturamento,
    totalPedidos,
    pedidosConcluidos,
    taxaConclusao,
    taxaCancelamento,
    ticketMedio,
    totalUnidades,
    custoTotal,
    lucroBruto,
    margemBrutaPercentual,
    faturamentoML,
    faturamentoDireto,
    shareML,
    topProdutos,
    categorias,
    ufs,
    statusCount,
    timeline: {
      categories: timelineCategories,
      faturamento: timelineFaturamento,
      pedidos: timelinePedidos,
    },
    recentOrders,
  };
}

function computeStockDashboardMetrics(products, filterCategory = "todos", filterRisk = "todos") {
  // Deriva dados enriquecidos para cada produto
  const enriched = products.map((p) => {
    const qty = Number(p.quantidade_atual || 0);
    const min = Number(p.estoque_minimo || 0);
    const custo = Number(p.custo || (p.preco ? p.preco * 0.55 : 0));
    const preco = Number(p.preco || 0);
    const valorCusto = qty * custo;
    const valorVenda = qty * preco;

    // Macro-categoria e Categoria detalhada
    let macroCategoria = "Extintores";
    let categoriaDetalhada = "Extintor Geral";
    if (p.sku.startsWith("EXT-CO2")) {
      macroCategoria = "Extintores";
      categoriaDetalhada = "Extintor CO2";
    } else if (p.sku.startsWith("EXT-H2O")) {
      macroCategoria = "Extintores";
      categoriaDetalhada = "Extintor Água";
    } else if (p.sku.startsWith("EXT-PQS")) {
      macroCategoria = "Extintores";
      categoriaDetalhada = "Extintor Pó Químico";
    } else if (p.sku.startsWith("EXT-K")) {
      macroCategoria = "Extintores";
      categoriaDetalhada = "Extintor Classe K";
    } else if (p.sku.startsWith("EXT-ESP")) {
      macroCategoria = "Extintores";
      categoriaDetalhada = "Espuma Mecânica";
    } else if (p.sku.startsWith("MAN")) {
      macroCategoria = "Hidrantes & Mangueiras";
      categoriaDetalhada = "Mangueiras de Incêndio";
    } else if (p.sku.startsWith("PLA")) {
      macroCategoria = "Sinalização";
      categoriaDetalhada = "Placas Fotoluminescentes";
    } else if (p.sku.startsWith("DET") || p.sku.startsWith("SUP")) {
      macroCategoria = "Acessórios & Suportes";
      categoriaDetalhada = p.sku.startsWith("DET") ? "Detectores" : "Suportes Metálicos";
    }

    // Classificação de Risco Operacional
    let risco = "normal";
    let riscoLabel = "Estoque Seguro";
    let riscoCor = "#1f9d5c";
    let chipClass = "ok";

    if (qty <= 0) {
      risco = "ruptura";
      riscoLabel = "Ruptura Imediata";
      riscoCor = "#e24b4b";
      chipClass = "zero";
    } else if (qty <= min) {
      risco = "critico";
      riscoLabel = "Abaixo do Mínimo";
      riscoCor = "#e85c2a";
      chipClass = "low";
    } else if (qty <= Math.ceil(min * 1.35)) {
      risco = "atencao";
      riscoLabel = "Ponto de Atenção";
      riscoCor = "#f59e0b";
      chipClass = "warning";
    } else if (qty > min * 3.5 && min > 0) {
      risco = "excesso";
      riscoLabel = "Excesso / Sem Giro";
      riscoCor = "#3b82f6";
      chipClass = "excess";
    }

    // Média de consumo mensal estimada baseada no giro histórico
    let mediaMensal = Math.max(1, Math.round(min * 1.25));
    if (p.id_produto === 7) mediaMensal = 55; // PQS 4kg (alto giro)
    else if (p.id_produto === 8) mediaMensal = 32; // PQS 6kg
    else if (p.id_produto === 4) mediaMensal = 25; // CO2 4kg (zerado mas com alta demanda)
    else if (p.id_produto === 1) mediaMensal = 40; // Detector de Fumaça
    else if (p.id_produto === 11) mediaMensal = 65; // Placa Fotoluminescente
    else if (p.id_produto === 2) mediaMensal = 28; // H2O 10L
    else if (p.id_produto === 3) mediaMensal = 6; // Classe K
    else if (p.id_produto === 5) mediaMensal = 22; // CO2 6kg
    else if (p.id_produto === 6) mediaMensal = 12; // Espuma Mecânica
    else if (p.id_produto === 9) mediaMensal = 18; // PQS 12kg
    else if (p.id_produto === 10) mediaMensal = 14; // Mangueira
    else if (p.id_produto === 12) mediaMensal = 0; // Inativo

    const mediaDiaria = mediaMensal > 0 ? mediaMensal / 30 : 0;
    const diasCobertura = qty <= 0 ? 0 : (mediaDiaria > 0 ? Math.round(qty / mediaDiaria) : 999);

    // Sugestão de reposição (Ponto de Pedido para atingir 160% do estoque mínimo de segurança)
    let sugestaoQtd = 0;
    if (qty <= min) {
      const target = Math.ceil(min * 1.6);
      sugestaoQtd = Math.max(0, target - qty);
      if (sugestaoQtd > 10) sugestaoQtd = Math.ceil(sugestaoQtd / 5) * 5;
    }
    const custoReposicao = sugestaoQtd * custo;

    return {
      ...p,
      macro_categoria: macroCategoria,
      categoria_detalhada: categoriaDetalhada,
      custo_unitario: custo,
      valor_custo_total: valorCusto,
      valor_venda_total: valorVenda,
      risco,
      risco_label: riscoLabel,
      risco_cor: riscoCor,
      chip_class: chipClass,
      media_mensal: mediaMensal,
      media_diaria: mediaDiaria,
      dias_cobertura: diasCobertura,
      sugestao_qtd: sugestaoQtd,
      custo_reposicao: custoReposicao,
    };
  });

  // Filtros
  let filtered = [...enriched];
  if (filterCategory && filterCategory !== "todos") {
    filtered = filtered.filter((p) => {
      if (filterCategory === "extintores") return p.sku.startsWith("EXT");
      if (filterCategory === "acessorios") return p.sku.startsWith("DET") || p.sku.startsWith("SUP");
      if (filterCategory === "sinalizacao") return p.sku.startsWith("PLA");
      if (filterCategory === "hidrantes") return p.sku.startsWith("MAN");
      return (
        p.macro_categoria.toLowerCase().includes(filterCategory.toLowerCase()) ||
        p.categoria_detalhada.toLowerCase().includes(filterCategory.toLowerCase())
      );
    });
  }

  if (filterRisk && filterRisk !== "todos") {
    filtered = filtered.filter((p) => p.risco === filterRisk);
  }

  // Agregações Globais
  const baseAtivos = enriched.filter((p) => p.ativo);
  const quantidadeTotal = baseAtivos.reduce((sum, p) => sum + Number(p.quantidade_atual || 0), 0);
  const valorTotalCusto = baseAtivos.reduce((sum, p) => sum + p.valor_custo_total, 0);
  const valorTotalVenda = baseAtivos.reduce((sum, p) => sum + p.valor_venda_total, 0);
  const margemProjetada =
    valorTotalVenda > 0 ? (((valorTotalVenda - valorTotalCusto) / valorTotalVenda) * 100).toFixed(1) : "0.0";

  const skusRuptura = baseAtivos.filter((p) => p.risco === "ruptura");
  const skusCriticos = baseAtivos.filter((p) => p.risco === "critico");
  const skusAtencao = baseAtivos.filter((p) => p.risco === "atencao");
  const skusNormais = baseAtivos.filter((p) => p.risco === "normal");
  const skusExcesso = baseAtivos.filter((p) => p.risco === "excesso");

  const taxaRuptura = baseAtivos.length > 0 ? ((skusRuptura.length / baseAtivos.length) * 100).toFixed(1) : "0.0";
  const totalAbaixoMinimo = skusRuptura.length + skusCriticos.length;

  const somaMediaDiaria = baseAtivos.reduce((sum, p) => sum + p.media_diaria, 0);
  const coberturaMedia = somaMediaDiaria > 0 ? Math.round(quantidadeTotal / somaMediaDiaria) : 0;

  const totalSugestaoQtd = baseAtivos.reduce((sum, p) => sum + p.sugestao_qtd, 0);
  const totalSugestaoCusto = baseAtivos.reduce((sum, p) => sum + p.custo_reposicao, 0);

  // Capital por categoria
  const catAgg = {};
  enriched.forEach((p) => {
    const macro = p.macro_categoria;
    if (!catAgg[macro]) catAgg[macro] = { nome: macro, valorCusto: 0, valorVenda: 0, unidades: 0 };
    catAgg[macro].valorCusto += p.valor_custo_total;
    catAgg[macro].valorVenda += p.valor_venda_total;
    catAgg[macro].unidades += p.quantidade_atual;
  });

  return {
    items: filtered,
    allItems: enriched,
    quantidadeTotal,
    valorTotalCusto,
    valorTotalVenda,
    margemProjetada,
    taxaRuptura,
    totalAbaixoMinimo,
    coberturaMedia,
    totalSugestaoQtd,
    totalSugestaoCusto,
    acuraciaInventario: "98,2%",
    giroEstoque: "28,4x",
    distribuicaoSaude: {
      ruptura: skusRuptura.length,
      critico: skusCriticos.length,
      atencao: skusAtencao.length,
      normal: skusNormais.length,
      excesso: skusExcesso.length,
    },
    skusRuptura,
    skusCriticos,
    skusAtencao,
    skusExcesso,
    capitalPorCategoria: Object.values(catAgg),
  };
}

function computeFinancialDashboardMetrics(products, orders, filterPeriodDays = 30, filterChannel = "todos", filterMarginRisk = "todos") {
  const refTime = Date.now() + 60000;
  const dayMs = 86400000;
  const currentWindowStart = refTime - (filterPeriodDays * dayMs);
  const previousWindowStart = currentWindowStart - (filterPeriodDays * dayMs);

  // 1. Filtra Pedidos por Canal
  let baseOrders = orders;
  if (filterChannel && filterChannel !== "todos") {
    baseOrders = baseOrders.filter((o) => o.canal.toLowerCase().includes(filterChannel.toLowerCase()));
  }

  const periodOrders = baseOrders.filter((o) => {
    const t = new Date(o.data_pedido).getTime();
    return t >= currentWindowStart && t <= refTime;
  });

  const prevPeriodOrders = baseOrders.filter((o) => {
    const t = new Date(o.data_pedido).getTime();
    return t >= previousWindowStart && t < currentWindowStart;
  });

  const validOrders = periodOrders.filter((o) => o.status !== "Cancelado");
  const cancelOrders = periodOrders.filter((o) => o.status === "Cancelado");
  const prevValidOrders = prevPeriodOrders.filter((o) => o.status !== "Cancelado");

  // Alíquotas configuradas pelo gestor
  const settings = loadFinancialSettings();
  const taxaMlPercent = Number(settings.taxa_ml_percent ?? 16);
  const taxaDiretoPercent = Number(settings.taxa_direto_percent ?? 0);

  // Receitas e Lucros
  const faturamentoTotal = validOrders.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
  const faturamentoAnterior = prevValidOrders.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
  
  let deltaFaturamento = 0;
  if (faturamentoAnterior > 0) {
    deltaFaturamento = Math.round(((faturamentoTotal - faturamentoAnterior) / faturamentoAnterior) * 1000) / 10;
  } else if (faturamentoTotal > 0) {
    deltaFaturamento = 100;
  }

  const cmvTotal = validOrders.reduce((sum, o) => sum + Number(o.custo_total || 0), 0);
  const lucroBruto = faturamentoTotal - cmvTotal;
  const margemBrutaPercentual = faturamentoTotal > 0 ? ((lucroBruto / faturamentoTotal) * 100).toFixed(1) : "0.0";

  // Comissões e Taxas estimadas dos canais
  const ordersML = validOrders.filter((o) => o.canal === "Mercado Livre");
  const faturamentoML = ordersML.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
  const cmvML = ordersML.reduce((sum, o) => sum + Number(o.custo_total || 0), 0);
  const taxasML = Math.round(faturamentoML * (taxaMlPercent / 100));
  const lucroLiquidoML = (faturamentoML - cmvML) - taxasML;

  const ordersDireto = validOrders.filter((o) => o.canal === "Venda Direta");
  const faturamentoDireto = ordersDireto.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
  const cmvDireto = ordersDireto.reduce((sum, o) => sum + Number(o.custo_total || 0), 0);
  const taxasDireto = Math.round(faturamentoDireto * (taxaDiretoPercent / 100));
  const lucroLiquidoDireto = (faturamentoDireto - cmvDireto) - taxasDireto;

  const taxasCanaisTotal = taxasML + taxasDireto;
  const lucroLiquidoContribuicao = lucroBruto - taxasCanaisTotal;
  const margemLiquidaContribuicao = faturamentoTotal > 0 ? ((lucroLiquidoContribuicao / faturamentoTotal) * 100).toFixed(1) : "0.0";

  // Capital Imobilizado em Estoque e Custo de Carregamento (Holding Cost)
  const ativos = products.filter((p) => p.ativo);
  const valorEstoqueAtivo = ativos.reduce((sum, p) => sum + (Number(p.quantidade_atual || 0) * Number(p.custo || (p.preco * 0.55))), 0);
  
  // Holding cost padrão de armazém de segurança: 25% a.a. sobre o estoque ativo
  const custoCarregamentoAno = valorEstoqueAtivo * 0.25;
  const custoCarregamentoMes = custoCarregamentoAno / 12;

  // GMROI (Gross Margin Return on Investment): (Lucro Bruto Anualizado / Estoque Médio a Custo) * 100
  const diasPeriodo = Math.max(1, filterPeriodDays);
  const lucroBrutoAnualizado = (lucroBruto / diasPeriodo) * 365;
  const gmroi = valorEstoqueAtivo > 0 ? ((lucroBrutoAnualizado / valorEstoqueAtivo) * 100).toFixed(1) : "0.0";

  const ticketMedio = validOrders.length > 0 ? faturamentoTotal / validOrders.length : 0;
  const perdaCancelamentos = cancelOrders.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);

  // Agregações por Produto no Período
  const productFinancials = {};
  products.forEach((p) => {
    const custo = Number(p.custo || (p.preco ? p.preco * 0.55 : 0));
    const preco = Number(p.preco || 0);
    const margemUnitRs = preco - custo;
    const margemUnitPct = preco > 0 ? ((margemUnitRs / preco) * 100).toFixed(1) : "0.0";
    
    let riscoMargem = "medium";
    let riscoMargemLabel = "Margem Segura (40-50%)";
    let riscoBadgeClass = "medium";
    let diagnostico = "Margem dentro do padrão de mercado";

    if (Number(margemUnitPct) >= 50) {
      riscoMargem = "high";
      riscoMargemLabel = "Alta Rentabilidade (> 50%)";
      riscoBadgeClass = "high";
      diagnostico = "Excelente retorno unitário";
    } else if (Number(margemUnitPct) < 40) {
      riscoMargem = "low";
      riscoMargemLabel = "Margem em Risco (< 40%)";
      riscoBadgeClass = "low";
      diagnostico = "Atenção: Margem comprimida por taxas do ML";
    }

    productFinancials[p.id_produto] = {
      ...p,
      custo_unitario: custo,
      preco_unitario: preco,
      margem_unit_rs: margemUnitRs,
      margem_unit_pct: Number(margemUnitPct),
      risco_margem: riscoMargem,
      risco_margem_label: riscoMargemLabel,
      risco_badge_class: riscoBadgeClass,
      diagnostico,
      unidades_vendidas: 0,
      faturamento_periodo: 0,
      cmv_periodo: 0,
      lucro_periodo: 0,
    };
  });

  // Soma vendas dos pedidos válidos
  validOrders.forEach((o) => {
    (o.itens || []).forEach((item) => {
      if (productFinancials[item.id_produto]) {
        const pf = productFinancials[item.id_produto];
        pf.unidades_vendidas += item.quantidade;
        pf.faturamento_periodo += item.subtotal;
        pf.cmv_periodo += item.quantidade * (item.custo_unitario || pf.custo_unitario);
        pf.lucro_periodo = pf.faturamento_periodo - pf.cmv_periodo;
      }
    });
  });

  let productList = Object.values(productFinancials);

  // Calcula % de participação na receita
  productList.forEach((p) => {
    p.share_receita = faturamentoTotal > 0 ? ((p.faturamento_periodo / faturamentoTotal) * 100).toFixed(1) : "0.0";
  });

  // Filtro de risco de margem se aplicado
  let filteredProducts = [...productList];
  if (filterMarginRisk && filterMarginRisk !== "todos") {
    filteredProducts = filteredProducts.filter((p) => p.risco_margem === filterMarginRisk);
  }

  // Ordena por Lucro Total gerado
  filteredProducts.sort((a, b) => b.lucro_periodo - a.lucro_periodo);

  // Identifica SKUs em Risco Financeiro para o Banner
  const skusRiscoMargem = productList.filter((p) => p.risco_margem === "low");
  const shareML = faturamentoTotal > 0 ? ((faturamentoML / faturamentoTotal) * 100).toFixed(1) : "0.0";

  // Curva ABC Financeira (Classe A: 70%, Classe B: 20%, Classe C: 10%)
  const sortedByFat = [...productList].sort((a, b) => b.faturamento_periodo - a.faturamento_periodo);
  let acumulado = 0;
  let countA = 0;
  let countB = 0;
  let countC = 0;
  let fatA = 0;
  let fatB = 0;
  let fatC = 0;

  sortedByFat.forEach((p) => {
    acumulado += p.faturamento_periodo;
    const pctAcum = faturamentoTotal > 0 ? acumulado / faturamentoTotal : 0;
    if (pctAcum <= 0.70 || countA === 0) {
      countA += 1;
      fatA += p.faturamento_periodo;
    } else if (pctAcum <= 0.90) {
      countB += 1;
      fatB += p.faturamento_periodo;
    } else {
      countC += 1;
      fatC += p.faturamento_periodo;
    }
  });

  // Timeline Mensal Financeira consolidada (mai a out)
  const monthlyTimeline = [
    { mes: "mai.", receita: 368000, cmv: 198000, lucro: 170000 },
    { mes: "jun.", receita: 395000, cmv: 212000, lucro: 183000 },
    { mes: "jul.", receita: 310000, cmv: 168000, lucro: 142000 },
    { mes: "ago.", receita: 405000, cmv: 219000, lucro: 186000 },
    { mes: "set.", receita: 355000, cmv: 191000, lucro: 164000 },
    { mes: "out.", receita: 42000, cmv: 22000, lucro: 20000 },
  ];

  return {
    items: filteredProducts,
    allItems: productList,
    faturamentoTotal,
    faturamentoAnterior,
    deltaFaturamento,
    cmvTotal,
    lucroBruto,
    margemBrutaPercentual,
    taxasCanaisTotal,
    lucroLiquidoContribuicao,
    margemLiquidaContribuicao,
    valorEstoqueAtivo,
    custoCarregamentoAno,
    custoCarregamentoMes,
    gmroi,
    ticketMedio,
    perdaCancelamentos,
    faturamentoML,
    lucroLiquidoML,
    faturamentoDireto,
    lucroLiquidoDireto,
    taxaMlPercent,
    taxaDiretoPercent,
    taxasML,
    taxasDireto,
    shareML,
    skusRiscoMargem,
    curvaABC: {
      countA,
      countB,
      countC,
      fatA,
      fatB,
      fatC,
    },
    timeline: monthlyTimeline,
  };
}

function loadFinancialSettings() {
  try {
    const raw = localStorage.getItem(FINANCIAL_SETTINGS_KEY);
    if (!raw) {
      localStorage.setItem(FINANCIAL_SETTINGS_KEY, JSON.stringify(DEFAULT_FINANCIAL_SETTINGS));
      return { ...DEFAULT_FINANCIAL_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return {
      taxa_ml_percent: typeof parsed.taxa_ml_percent === "number" ? parsed.taxa_ml_percent : DEFAULT_FINANCIAL_SETTINGS.taxa_ml_percent,
      taxa_direto_percent: typeof parsed.taxa_direto_percent === "number" ? parsed.taxa_direto_percent : DEFAULT_FINANCIAL_SETTINGS.taxa_direto_percent,
    };
  } catch {
    return { ...DEFAULT_FINANCIAL_SETTINGS };
  }
}

function saveFinancialSettings(settings) {
  try {
    localStorage.setItem(FINANCIAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Erro ao salvar taxas financeiras:", err);
  }
}

// ─── Validação de Lotes FEFO ────────────────────────────────────────────────
function computeLoteStatus(validadeStr) {
  const agora = new Date();
  const validade = new Date(validadeStr);
  const diffMs = validade.getTime() - agora.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const mesesRestantes = (diasRestantes / 30.4).toFixed(1);
  const textoTempo = diasRestantes <= 0
    ? `Vencido há ${Math.abs(diasRestantes)} dias`
    : `${diasRestantes} dias (~ ${mesesRestantes} meses)`;

  if (diasRestantes <= 0) {
    return {
      diasRestantes,
      statusKey: "vencido",
      label: "Vencido (Bloqueio Total)",
      cls: "badge-vencido",
      podeDespachar: false,
      textoTempo,
    };
  }

  if (diasRestantes <= 180) {
    return {
      diasRestantes,
      statusKey: "bloqueado",
      label: "Bloqueado (< 6 meses)",
      cls: "badge-bloqueado",
      podeDespachar: false,
      textoTempo,
    };
  }

  if (diasRestantes <= 365) {
    return {
      diasRestantes,
      statusKey: "alerta",
      label: "Alerta (≤ 1 ano)",
      cls: "badge-alerta",
      podeDespachar: true,
      textoTempo,
    };
  }

  return {
    diasRestantes,
    statusKey: "regular",
    label: "Regular (> 1 ano)",
    cls: "badge-regular",
    podeDespachar: true,
    textoTempo,
  };
}

function loadLotes() {
  verificarVersaoMocks();
  try {
    const raw = localStorage.getItem(LOTES_KEY);
    if (!raw) {
      localStorage.setItem(LOTES_KEY, JSON.stringify(DEFAULT_LOTES));
      return DEFAULT_LOTES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_LOTES;
  } catch {
    return DEFAULT_LOTES;
  }
}

function saveLotes(lotes) {
  try {
    localStorage.setItem(LOTES_KEY, JSON.stringify(lotes));
  } catch (err) {
    console.error("Erro ao salvar lotes:", err);
  }
}

// ─── Inspeções de Qualidade na Entrada (SCRUM-11 / #6) ───────────────────────
const DEFAULT_INSPECOES = [
  {
    id_inspecao: 1,
    id_produto: 1,
    sku: "EXT-PQS-4KG",
    nome_produto: "Extintor Pó Químico ABC 4kg",
    id_lote: "LT-2024/01",
    numero_lote: "LT-2024/01",
    tipo_inspecao: "Entrada",
    checklist: {
      avarias_casco: true,
      sem_corrosao: true,
      rotulo_legivel: true,
      manometro_pressao: true,
      lacre_acessorios: true,
    },
    resultado: "Aprovado",
    quantidade_total: 45,
    quantidade_aprovada: 45,
    quantidade_reprovada: 0,
    motivo_reprovacao: null,
    destino_reprovados: null,
    observacoes: "Lote 100% conforme na chegada. Todos manômetros na faixa verde.",
    responsavel: "Gestor RezFire",
    data_inspecao: subDaysDate(120),
  },
  {
    id_inspecao: 2,
    id_produto: 2,
    sku: "EXT-H2O-10L",
    nome_produto: "Extintor Água Pressurizada 10L",
    id_lote: "LT-2023/12",
    numero_lote: "LT-2023/12",
    tipo_inspecao: "Entrada",
    checklist: {
      avarias_casco: true,
      sem_corrosao: true,
      rotulo_legivel: true,
      manometro_pressao: true,
      lacre_acessorios: true,
    },
    resultado: "Aprovado",
    quantidade_total: 30,
    quantidade_aprovada: 30,
    quantidade_reprovada: 0,
    motivo_reprovacao: null,
    destino_reprovados: null,
    observacoes: "Conferência física sem irregularidades.",
    responsavel: "Gestor RezFire",
    data_inspecao: subDaysDate(140),
  },
  {
    id_inspecao: 3,
    id_produto: 3,
    sku: "EXT-CO2-6KG",
    nome_produto: "Extintor Dióxido de Carbono CO2 6kg",
    id_lote: "LT-2024/03",
    numero_lote: "LT-2024/03",
    tipo_inspecao: "Entrada",
    checklist: {
      avarias_casco: true,
      sem_corrosao: true,
      rotulo_legivel: true,
      manometro_pressao: true,
      lacre_acessorios: true,
    },
    resultado: "Aprovado",
    quantidade_total: 22,
    quantidade_aprovada: 22,
    quantidade_reprovada: 0,
    motivo_reprovacao: null,
    destino_reprovados: null,
    observacoes: "Lacre Inmetro inviolado e bocal difusor íntegro.",
    responsavel: "Gestor RezFire",
    data_inspecao: subDaysDate(80),
  },
  {
    id_inspecao: 4,
    id_produto: 1,
    sku: "EXT-PQS-4KG",
    nome_produto: "Extintor Pó Químico ABC 4kg",
    id_lote: "LT-2024/02-BLOQ",
    numero_lote: "LT-2024/02",
    tipo_inspecao: "Entrada",
    checklist: {
      avarias_casco: true,
      sem_corrosao: true,
      rotulo_legivel: true,
      manometro_pressao: false,
      lacre_acessorios: true,
    },
    resultado: "Aprovado Parcial",
    quantidade_total: 22,
    quantidade_aprovada: 20,
    quantidade_reprovada: 2,
    motivo_reprovacao: "Manômetro com perda de pressão / ponteiro fora da faixa verde operacional.",
    destino_reprovados: "Devolucao Fornecedor",
    observacoes: "2 cilindros com despressurização retidos para devolução. 20 unidades conformes liberadas para o estoque.",
    responsavel: "Gestor RezFire",
    data_inspecao: subDaysDate(30),
  },
];

function loadInspecoes() {
  verificarVersaoMocks();
  try {
    const raw = localStorage.getItem(INSPECOES_KEY);
    if (!raw) {
      localStorage.setItem(INSPECOES_KEY, JSON.stringify(DEFAULT_INSPECOES));
      return DEFAULT_INSPECOES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_INSPECOES;
  } catch {
    return DEFAULT_INSPECOES;
  }
}

function saveInspecoes(inspecoes) {
  try {
    localStorage.setItem(INSPECOES_KEY, JSON.stringify(inspecoes));
  } catch (err) {
    console.error("Erro ao salvar inspeções:", err);
  }
}

// ─── Exportação Global ───────────────────────────────────────────────────────
window.RezFireData = {
  loadProducts,
  saveProducts,
  nextProductId,
  formatMoney,
  computeDashboard,
  cloneDefaults,
  TOTAL_MOVIMENTACOES: DEFAULT_MOVEMENTS.length,
  loadOrders,
  saveOrders,
  nextOrderId,
  computeSalesMetrics,
  generateMockOrders,
  loadMovements,
  saveMovements,
  computeMovementsMetrics,
  generateMockMovements,
  computeStockDashboardMetrics,
  computeFinancialDashboardMetrics,
  loadFinancialSettings,
  saveFinancialSettings,
  loadLotes,
  saveLotes,
  loadInspecoes,
  saveInspecoes,
  computeLoteStatus,
  resetarDadosPadrao,
};
