const STORAGE_KEY = "rezfire.produtos";

const DEFAULT_PRODUCTS = [
  {
    id_produto: 1,
    sku: "DET-FUM-01",
    nome: "Detector de Fumaça Óptico",
    descricao: "Detector óptico para ambientes internos.",
    custo: 42.5,
    preco: 89.9,
    ativo: true,
    quantidade_atual: 140,
    estoque_minimo: 50,
  },
  {
    id_produto: 2,
    sku: "EXT-H2O-10L",
    nome: "Extintor Água Pressurizada 10L",
    descricao: "Extintor de água pressurizada classe A.",
    custo: 84.0,
    preco: 159.9,
    ativo: true,
    quantidade_atual: 95,
    estoque_minimo: 25,
  },
  {
    id_produto: 3,
    sku: "EXT-K-6L",
    nome: "Extintor Classe K 6L (Cozinhas)",
    descricao: "Indicado para cozinhas profissionais.",
    custo: 410.0,
    preco: 749.0,
    ativo: true,
    quantidade_atual: 7,
    estoque_minimo: 8,
  },
  {
    id_produto: 4,
    sku: "EXT-CO2-4KG",
    nome: "Extintor CO2 4kg",
    descricao: "Extintor de dióxido de carbono 4 kg.",
    custo: 235.0,
    preco: 429.0,
    ativo: true,
    quantidade_atual: 0,
    estoque_minimo: 20,
  },
  {
    id_produto: 5,
    sku: "EXT-CO2-6KG",
    nome: "Extintor CO2 6kg",
    descricao: "Extintor de dióxido de carbono 6 kg.",
    custo: 298.5,
    preco: 549.0,
    ativo: true,
    quantidade_atual: 48,
    estoque_minimo: 20,
  },
  {
    id_produto: 6,
    sku: "EXT-ESP-9L",
    nome: "Extintor Espuma Mecânica 9L",
    descricao: "Extintor de espuma mecânica 9 litros.",
    custo: 149.0,
    preco: 289.0,
    ativo: true,
    quantidade_atual: 31,
    estoque_minimo: 10,
  },
  {
    id_produto: 7,
    sku: "EXT-PQS-4KG",
    nome: "Extintor Pó Químico ABC 4kg",
    descricao: "Pó químico ABC 4 kg.",
    custo: 89.9,
    preco: 169.9,
    ativo: true,
    quantidade_atual: 180,
    estoque_minimo: 40,
  },
  {
    id_produto: 8,
    sku: "EXT-PQS-6KG",
    nome: "Extintor Pó Químico ABC 6kg",
    descricao: "Pó químico ABC 6 kg.",
    custo: 115.0,
    preco: 219.9,
    ativo: true,
    quantidade_atual: 22,
    estoque_minimo: 30,
  },
  {
    id_produto: 9,
    sku: "EXT-PQS-12KG",
    nome: "Extintor Pó Químico BC 12kg",
    descricao: "Pó químico BC 12 kg.",
    custo: 178.0,
    preco: 329.0,
    ativo: true,
    quantidade_atual: 64,
    estoque_minimo: 15,
  },
  {
    id_produto: 10,
    sku: "MAN-MANG-15",
    nome: "Mangueira de Incêndio 1½\" 15m",
    descricao: "Mangueira de combate a incêndio 15 metros.",
    custo: 195.0,
    preco: 389.0,
    ativo: true,
    quantidade_atual: 38,
    estoque_minimo: 20,
  },
  {
    id_produto: 11,
    sku: "PLA-FOTO-01",
    nome: "Placa Sinalização Fotoluminescente",
    descricao: "Placa de rota de fuga fotoluminescente.",
    custo: 14.5,
    preco: 34.9,
    ativo: true,
    quantidade_atual: 210,
    estoque_minimo: 80,
  },
  {
    id_produto: 12,
    sku: "SUP-EXT-01",
    nome: "Suporte de Parede p/ Extintor",
    descricao: "Suporte metálico para extintor.",
    custo: 18.2,
    preco: 42.0,
    ativo: false,
    quantidade_atual: 16,
    estoque_minimo: 10,
  },
];

const MOVIMENTACOES_MENSAIS = [
  { mes: "mai.", entradas: 620, saidas: 1780 },
  { mes: "jun.", entradas: 510, saidas: 1810 },
  { mes: "jul.", entradas: 740, saidas: 1690 },
  { mes: "ago.", entradas: 480, saidas: 2140 },
  { mes: "set.", entradas: 690, saidas: 1760 },
  { mes: "out.", entradas: 120, saidas: 210 },
];

const PEDIDOS_MOCK = [
  { id_pedido: 1, valor_total: 4280.5 },
  { id_pedido: 2, valor_total: 1890.0 },
  { id_pedido: 3, valor_total: 6120.9 },
  { id_pedido: 4, valor_total: 980.0 },
  { id_pedido: 5, valor_total: 3340.4 },
  { id_pedido: 6, valor_total: 2750.2 },
];

const TOTAL_MOVIMENTACOES = 86;

function cloneDefaults() {
  return DEFAULT_PRODUCTS.map((item) => ({ ...item }));
}

function loadProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let items;
    if (!raw) {
      items = cloneDefaults();
    } else {
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : cloneDefaults();
    }

    let updated = false;
    items = items.map((item) => {
      let itemUpdated = false;
      if (item.custo === undefined || item.custo === null || item.custo === 0) {
        const defaultItem = DEFAULT_PRODUCTS.find((d) => d.id_produto === item.id_produto);
        item.custo = defaultItem && defaultItem.custo
          ? defaultItem.custo
          : Math.round((Number(item.preco || 50) * (0.45 + Math.random() * 0.2)) * 100) / 100;
        itemUpdated = true;
      }
      if (!item.categoria) {
        item.categoria = item.sku.startsWith("EXT") ? "Extintores" : (item.sku.startsWith("PLA") ? "Sinalização" : "Acessórios");
        itemUpdated = true;
      }
      if (!item.tipo) {
        item.tipo = "Simples";
        itemUpdated = true;
      }
      if (itemUpdated) updated = true;
      return item;
    });

    if (updated || !raw) {
      saveProducts(items);
    }
    return items;
  } catch {
    return cloneDefaults();
  }
}

function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function nextProductId(products) {
  return products.reduce((max, item) => Math.max(max, item.id_produto), 0) + 1;
}

function formatMoney(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

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

  const entradas = MOVIMENTACOES_MENSAIS.reduce((sum, m) => sum + m.entradas, 0);
  const saidas = MOVIMENTACOES_MENSAIS.reduce((sum, m) => sum + m.saidas, 0);
  const diasPeriodo = 183;
  const saidaDiaria = saidas / diasPeriodo;
  const coberturaDias = saidaDiaria > 0 ? Math.round(quantidadeTotal / saidaDiaria) : 0;
  const giroAno = quantidadeTotal > 0 ? ((saidas * 2) / quantidadeTotal).toFixed(1).replace(".", ",") : "0,0";
  const frequenciaMedia = (TOTAL_MOVIMENTACOES / 6).toFixed(1).replace(".", ",");
  const ticketMedio =
    PEDIDOS_MOCK.reduce((sum, p) => sum + p.valor_total, 0) / PEDIDOS_MOCK.length;

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
    movimentacoesMensais: MOVIMENTACOES_MENSAIS,
  };
}

window.RezFireData = {
  loadProducts,
  saveProducts,
  nextProductId,
  formatMoney,
  computeDashboard,
  cloneDefaults,
  TOTAL_MOVIMENTACOES,
};
