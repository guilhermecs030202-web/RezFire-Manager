const API_BASE_URL = 'http://localhost:3333/api';

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
    detalhes_extintor: {
      registro_inmetro: "002450/2021",
      tipo_extintor: "Água Pressurizada (AP)",
      capacidade_peso: "10 Litros (2-A)",
      classe_incendio: "A",
      fabricante: "Resil",
      data_fabricacao: "2023-04-10",
      data_validade: "2028-04-10",
      numero_lacre: "L-849201",
      selo_conformidade: "INM-994120",
    },
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
    detalhes_extintor: {
      registro_inmetro: "005110/2022",
      tipo_extintor: "Classe K (Cozinhas)",
      capacidade_peso: "6 Litros (K)",
      classe_incendio: "K",
      fabricante: "Kidde",
      data_fabricacao: "2023-06-15",
      data_validade: "2028-06-15",
      numero_lacre: "L-220194",
      selo_conformidade: "INM-882031",
    },
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
    detalhes_extintor: {
      registro_inmetro: "001890/2020",
      tipo_extintor: "Dióxido de Carbono (CO2)",
      capacidade_peso: "4 kg (5-B:C)",
      classe_incendio: "BC",
      fabricante: "Extang",
      data_fabricacao: "2022-11-20",
      data_validade: "2027-11-20",
      numero_lacre: "L-993021",
      selo_conformidade: "INM-771920",
    },
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
    detalhes_extintor: {
      registro_inmetro: "001891/2020",
      tipo_extintor: "Dióxido de Carbono (CO2)",
      capacidade_peso: "6 kg (10-B:C)",
      classe_incendio: "BC",
      fabricante: "Extang",
      data_fabricacao: "2022-12-05",
      data_validade: "2027-12-05",
      numero_lacre: "L-993044",
      selo_conformidade: "INM-771945",
    },
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
    detalhes_extintor: {
      registro_inmetro: "004010/2021",
      tipo_extintor: "Espuma Mecânica",
      capacidade_peso: "9 Litros (2-A:10-B)",
      classe_incendio: "ABC",
      fabricante: "Resil",
      data_fabricacao: "2023-01-18",
      data_validade: "2028-01-18",
      numero_lacre: "L-552109",
      selo_conformidade: "INM-440192",
    },
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
    detalhes_extintor: {
      registro_inmetro: "003180/2022",
      tipo_extintor: "Pó Químico ABC",
      capacidade_peso: "4 kg (2-A:20-B:C)",
      classe_incendio: "ABC",
      fabricante: "Kidde",
      data_fabricacao: "2023-08-10",
      data_validade: "2024-08-10",
      numero_lacre: "L-332910",
      selo_conformidade: "INM-551029",
    },
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
    detalhes_extintor: {
      registro_inmetro: "003181/2022",
      tipo_extintor: "Pó Químico ABC",
      capacidade_peso: "6 kg (3-A:40-B:C)",
      classe_incendio: "ABC",
      fabricante: "Kidde",
      data_fabricacao: "2023-09-01",
      data_validade: "2024-09-01",
      numero_lacre: "L-332945",
      selo_conformidade: "INM-551066",
    },
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
    detalhes_extintor: {
      registro_inmetro: "002880/2021",
      tipo_extintor: "Pó Químico BC",
      capacidade_peso: "12 kg (40-B:C)",
      classe_incendio: "BC",
      fabricante: "Mocelin",
      data_fabricacao: "2023-03-25",
      data_validade: "2024-03-25",
      numero_lacre: "L-771029",
      selo_conformidade: "INM-332014",
    },
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

// Base simulada realista e determinística de pedidos dos últimos 6 meses
function generateMockOrders() {
  const clients = [
    { nome: "Condomínio Solar das Palmeiras", uf: "SP" },
    { nome: "Transportadora Rodoviária Rápida", uf: "SP" },
    { nome: "Restaurante Família & Sabor", uf: "RJ" },
    { nome: "Auto Mecânica Precision Car", uf: "MG" },
    { nome: "Indústria Metalúrgica Alvorada", uf: "SP" },
    { nome: "Supermercado Bom Preço Ltda", uf: "PR" },
    { nome: "Distribuidora de Alimentos União", uf: "SC" },
    { nome: "Colégio Futuro Brilhante", uf: "SP" },
    { nome: "Hotel Fazenda Recanto Verde", uf: "MG" },
    { nome: "Padaria e Confeitaria Central", uf: "RJ" },
    { nome: "Centro Logístico Bandeirantes", uf: "SP" },
    { nome: "Academia Fisio & Saúde", uf: "RS" },
    { nome: "Gráfica & Editora Moderna", uf: "BA" },
    { nome: "Galpão Armazéns Gerais", uf: "GO" },
    { nome: "Laboratório Santa Clara", uf: "PR" },
  ];

  // Matriz de compras típicas para simular mix real de extintores e acessórios
  const orderPresets = [
    // Kits para empresas (PQS ABC 4kg / 6kg + Placas + Suporte)
    [{ id: 7, qty: 3 }, { id: 11, qty: 3 }, { id: 12, qty: 3 }],
    [{ id: 8, qty: 2 }, { id: 5, qty: 1 }, { id: 11, qty: 2 }],
    [{ id: 7, qty: 4 }, { id: 12, qty: 4 }],
    // Cozinha profissional (Extintor K + CO2)
    [{ id: 3, qty: 1 }, { id: 5, qty: 1 }, { id: 11, qty: 2 }],
    // Sala de servidores / elétrica (CO2 4kg ou 6kg)
    [{ id: 4, qty: 2 }, { id: 1, qty: 2 }],
    [{ id: 5, qty: 2 }, { id: 11, qty: 2 }],
    // Área industrial / galpão (Água 10L + PQS 12kg + Mangueira)
    [{ id: 2, qty: 2 }, { id: 9, qty: 1 }, { id: 10, qty: 1 }],
    // Extintor carro / comércio simples (PQS ABC 4kg avulso)
    [{ id: 7, qty: 2 }],
    [{ id: 7, qty: 1 }, { id: 12, qty: 1 }],
    // Espuma mecânica para inflamáveis
    [{ id: 6, qty: 2 }, { id: 11, qty: 2 }],
    // Reposição condomínio
    [{ id: 2, qty: 3 }, { id: 7, qty: 3 }, { id: 11, qty: 6 }],
    // Sinalização e detectores em lote
    [{ id: 1, qty: 4 }, { id: 11, qty: 10 }],
    // PQS 6kg avulso
    [{ id: 8, qty: 3 }],
  ];

  const orders = [];
  const now = new Date("2024-10-15T18:00:00Z").getTime();
  const dayMs = 86400000;
  
  // Gerar ~90 pedidos ao longo dos últimos 180 dias
  let orderId = 1;
  const daysInterval = [1, 2, 3, 5, 7, 9, 12, 14, 16, 18, 20, 22, 25, 27, 29, 32, 35, 38, 41, 44, 48, 52, 55, 58, 62, 65, 68, 72, 75, 79, 83, 87, 91, 95, 99, 103, 107, 111, 115, 119, 123, 127, 131, 135, 139, 143, 147, 151, 155, 159, 163, 167, 171, 175, 178];

  // Duplicando alguns dias para gerar maior densidade recente (últimos 30-60 dias)
  const allDaysOffsets = [
    0.5, 1, 1.8, 2.5, 3.2, 4.1, 5, 6.2, 7.5, 8.8, 10, 11.5, 13, 14.5, 16, 17.5, 19, 21, 22.5, 24, 26, 28, 29.5,
    ...daysInterval,
    15, 23, 31, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170
  ].sort((a, b) => a - b);

  allDaysOffsets.forEach((daysAgo, idx) => {
    const client = clients[idx % clients.length];
    const isML = (idx % 5 !== 0); // 80% Mercado Livre, 20% Venda Direta
    const canal = isML ? "Mercado Livre" : "Venda Direta";
    const codigo_pedido = isML 
      ? `MLB-28${(940120 + idx * 37).toString().padStart(6, '0')}`
      : `DIR-2024-${(100 + idx).toString()}`;
    
    const preset = orderPresets[idx % orderPresets.length];
    const dateObj = new Date(now - daysAgo * dayMs);
    
    // Status comercial do pedido
    // "Pendente de confirmação" | "Confirmado" | "Em preparação" | "Concluído" | "Cancelado"
    let status = "Concluído";
    if (daysAgo < 1.5) {
      status = (idx % 2 === 0) ? "Pendente de confirmação" : "Confirmado";
    } else if (daysAgo < 4) {
      status = (idx % 2 === 0) ? "Em preparação" : "Confirmado";
    }
    // Poucos cancelamentos simulados (aprox 4%)
    if (idx === 14 || idx === 43 || idx === 68) {
      status = "Cancelado";
    }

    const tipo_envio = isML 
      ? (idx % 2 === 0 ? "Mercado Envios Full" : "Mercado Envios Coleta")
      : (client.uf === "SP" ? "Transportadora Própria" : "Transportadora Parceira");

    const itens = preset.map((itemPreset) => {
      const prod = DEFAULT_PRODUCTS.find((p) => p.id_produto === itemPreset.id) || DEFAULT_PRODUCTS[0];
      const subtotal = itemPreset.qty * prod.preco;
      const custoTotalItem = itemPreset.qty * (prod.custo || (prod.preco * 0.5));
      return {
        id_produto: prod.id_produto,
        sku: prod.sku,
        nome: prod.nome,
        categoria: prod.sku.startsWith("EXT") ? "Extintores" : (prod.sku.startsWith("PLA") ? "Sinalização" : "Acessórios"),
        quantidade: itemPreset.qty,
        preco_unitario: prod.preco,
        custo_unitario: prod.custo,
        desconto: 0,
        subtotal: subtotal,
        custo_total: custoTotalItem,
      };
    });

    // Simula frete e desconto em alguns pedidos comerciais
    const frete = (idx % 4 === 0) ? 25.00 : 0;
    const desconto = (idx % 7 === 0) ? 15.00 : 0;

    const subtotal_itens = itens.reduce((sum, item) => sum + item.subtotal, 0);
    const valor_total = Math.max(0, subtotal_itens - desconto + frete);
    const custo_total = itens.reduce((sum, item) => sum + item.custo_total, 0);
    const lucro_bruto = valor_total - custo_total;

    orders.push({
      id_pedido: orderId++,
      codigo_pedido,
      codigo_externo_ml: isML ? codigo_pedido : null,
      canal,
      tipo_envio,
      data_pedido: dateObj.toISOString(),
      cliente: client.nome,
      uf: client.uf,
      status,
      itens,
      subtotal_itens: Math.round(subtotal_itens * 100) / 100,
      desconto: Math.round(desconto * 100) / 100,
      frete: Math.round(frete * 100) / 100,
      valor_total: Math.round(valor_total * 100) / 100,
      custo_total: Math.round(custo_total * 100) / 100,
      lucro_bruto: Math.round(lucro_bruto * 100) / 100,
      observacoes: (idx % 6 === 0) ? "Cliente solicitou entrega no período matutino com NF física anexada." : "",
      motivo_cancelamento: status === "Cancelado" ? "Cancelamento a pedido do comprador antes da expedição." : null,
      historico: [
        { data: dateObj.toISOString(), evento: "Pedido registrado", descricao: `Registrado via ${canal}.`, usuario: "Sistema" },
        ...(status !== "Pendente de confirmação" ? [{ data: dateObj.toISOString(), evento: "Status: " + status, descricao: "Atualização comercial.", usuario: "Gestor RezFire" }] : [])
      ]
    });
  });

  return orders;
}

function generateMockMovements(orders) {
  let movId = 1;
  const movements = [];

  // 1. Gera movimentações de saída para cada item de cada pedido de venda (Mercado Livre e Venda Direta)
  orders.forEach((order) => {
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
        motivo: order.canal === "Mercado Livre" ? "Venda Mercado Livre" : "Venda Direta",
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        valor_total: item.subtotal,
        data: order.data_pedido,
        responsavel: order.canal === "Mercado Livre" ? "Mercado Livre API" : "Gestor RezFire",
        detalhes_remessa: null,
      });
    });
  });

  // 2. Adiciona movimentações de Entrada (Abastecimento de Fábrica / Notas Fiscais)
  const entradasIniciais = [
    {
      diasAtras: 175,
      id_produto: 2,
      sku: "EXT-H2O-10L",
      qtd: 120,
      motivo: "Nota Fiscal (Abastecimento)",
      nf: "NF 10420 - Resil",
      detalhes_remessa: { lote: "LT-2024/01", validade: "2028-04-10", lacre: "L-849201", inmetro: "002450/2021" },
    },
    {
      diasAtras: 165,
      id_produto: 7,
      sku: "EXT-PQS-4KG",
      qtd: 200,
      motivo: "Nota Fiscal (Abastecimento)",
      nf: "NF 10488 - Kidde",
      detalhes_remessa: { lote: "LT-2024/02", validade: "2024-08-10", lacre: "L-332910", inmetro: "003180/2022" },
    },
    {
      diasAtras: 140,
      id_produto: 8,
      sku: "EXT-PQS-6KG",
      qtd: 60,
      motivo: "Nota Fiscal (Abastecimento)",
      nf: "NF 10488 - Kidde",
      detalhes_remessa: { lote: "LT-2024/03", validade: "2024-09-01", lacre: "L-332945", inmetro: "003181/2022" },
    },
    {
      diasAtras: 110,
      id_produto: 5,
      sku: "EXT-CO2-6KG",
      qtd: 70,
      motivo: "Nota Fiscal (Abastecimento)",
      nf: "NF 10512 - Extang",
      detalhes_remessa: { lote: "LT-2024/05", validade: "2027-12-05", lacre: "L-993044", inmetro: "001891/2020" },
    },
    {
      diasAtras: 85,
      id_produto: 3,
      sku: "EXT-K-6L",
      qtd: 15,
      motivo: "Nota Fiscal (Abastecimento)",
      nf: "NF 10540 - Kidde",
      detalhes_remessa: { lote: "LT-2024/06", validade: "2028-06-15", lacre: "L-220194", inmetro: "005110/2022" },
    },
    {
      diasAtras: 60,
      id_produto: 9,
      sku: "EXT-PQS-12KG",
      qtd: 80,
      motivo: "Nota Fiscal (Abastecimento)",
      nf: "NF 10560 - Mocelin",
      detalhes_remessa: { lote: "LT-2024/08", validade: "2024-03-25", lacre: "L-771029", inmetro: "002880/2021" },
    },
    {
      diasAtras: 35,
      id_produto: 7,
      sku: "EXT-PQS-4KG",
      qtd: 150,
      motivo: "Nota Fiscal (Abastecimento)",
      nf: "NF 10680 - Kidde",
      detalhes_remessa: { lote: "LT-2024/10", validade: "2024-08-10", lacre: "L-332910", inmetro: "003180/2022" },
    },
    {
      diasAtras: 20,
      id_produto: 11,
      sku: "PLA-FOTO-01",
      qtd: 250,
      motivo: "Nota Fiscal (Abastecimento)",
      nf: "NF 10702 - Sinaliza Indústria",
      detalhes_remessa: null,
    },
    {
      diasAtras: 12,
      id_produto: 10,
      sku: "MAN-MANG-15",
      qtd: 50,
      motivo: "Nota Fiscal (Abastecimento)",
      nf: "NF 10740 - Metalúrgica Combate",
      detalhes_remessa: null,
    },
    {
      diasAtras: 4,
      id_produto: 8,
      sku: "EXT-PQS-6KG",
      qtd: 40,
      motivo: "Nota Fiscal (Abastecimento)",
      nf: "NF 10788 - Kidde",
      detalhes_remessa: { lote: "LT-2024/12", validade: "2024-09-01", lacre: "L-332945", inmetro: "003181/2022" },
    },
  ];

  const now = new Date("2024-10-15T18:00:00Z").getTime();
  const dayMs = 86400000;

  entradasIniciais.forEach((ent) => {
    const prod = DEFAULT_PRODUCTS.find((p) => p.id_produto === ent.id_produto) || DEFAULT_PRODUCTS[0];
    const dataIso = new Date(now - ent.diasAtras * dayMs).toISOString();

    movements.push({
      id_movimentacao: movId++,
      id_pedido: null,
      codigo_pedido: ent.nf,
      canal: "Fornecedor",
      tipo_envio: "Nota Fiscal / Carga",
      cliente: "RezFire Estoque Central",
      uf: "SP",
      status_pedido: "Entregue",
      id_produto: prod.id_produto,
      sku: prod.sku,
      nome_produto: prod.nome,
      tipo: "Entrada",
      motivo: ent.motivo,
      quantidade: ent.qtd,
      preco_unitario: prod.custo || prod.preco * 0.5,
      valor_total: ent.qtd * (prod.custo || prod.preco * 0.5),
      data: dataIso,
      responsavel: "Gestor RezFire",
      detalhes_remessa: ent.detalhes_remessa,
    });
  });

  // Ordena por data decrescente
  movements.sort((a, b) => new Date(b.data) - new Date(a.data));
  return movements;
}

const PEDIDOS_MOCK = generateMockOrders();
const MOVIMENTACOES_MOCK = generateMockMovements(PEDIDOS_MOCK);

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
      if (!item.detalhes_extintor && item.sku && item.sku.startsWith("EXT")) {
        const defaultItem = DEFAULT_PRODUCTS.find((d) => d.id_produto === item.id_produto);
        if (defaultItem && defaultItem.detalhes_extintor) {
          item.detalhes_extintor = { ...defaultItem.detalhes_extintor };
          itemUpdated = true;
        }
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

const ORDERS_KEY = "rezfire.pedidos";

function loadOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(PEDIDOS_MOCK));
      return PEDIDOS_MOCK;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Se tiver versão antiga (sem subtotal_itens ou com status antigo "Aprovado"), migra para a base rica
      if (parsed[0].subtotal_itens !== undefined) {
        return parsed;
      }
    }
    localStorage.setItem(ORDERS_KEY, JSON.stringify(PEDIDOS_MOCK));
    return PEDIDOS_MOCK;
  } catch {
    return PEDIDOS_MOCK;
  }
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function nextOrderId(orders) {
  if (!orders || orders.length === 0) return 1;
  return Math.max(...orders.map((o) => Number(o.id_pedido || 0))) + 1;
}

function computeSalesMetrics(orders, filterDays = 30, filterChannel = "") {
  const refTime = new Date("2024-10-15T18:00:00Z").getTime();
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

  // Status dos Pedidos no período
  const statusCount = {
    Entregue: periodOrders.filter((o) => o.status === "Entregue").length,
    "Em trânsito": periodOrders.filter((o) => o.status === "Em trânsito").length,
    Aprovado: periodOrders.filter((o) => o.status === "Aprovado").length,
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

const MOVIMENTACOES_KEY = "rezfire.movimentacoes";

function loadMovements() {
  try {
    const raw = localStorage.getItem(MOVIMENTACOES_KEY);
    if (!raw) {
      localStorage.setItem(MOVIMENTACOES_KEY, JSON.stringify(MOVIMENTACOES_MOCK));
      return MOVIMENTACOES_MOCK;
    }
    const parsed = JSON.parse(raw);
    // Se for o array antigo simplificado (ex: < 10 registros ou sem codigo_pedido), migra para os dados sincronizados com vendas
    if (Array.isArray(parsed) && parsed.length >= 10 && parsed[0].codigo_pedido) {
      return parsed;
    }
    localStorage.setItem(MOVIMENTACOES_KEY, JSON.stringify(MOVIMENTACOES_MOCK));
    return MOVIMENTACOES_MOCK;
  } catch {
    return MOVIMENTACOES_MOCK;
  }
}

function saveMovements(movements) {
  localStorage.setItem(MOVIMENTACOES_KEY, JSON.stringify(movements));
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
  const refTime = new Date("2024-10-15T18:00:00Z").getTime();
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

const FINANCIAL_SETTINGS_KEY = "rezfire.config_financeiro";
const DEFAULT_FINANCIAL_SETTINGS = {
  taxa_ml_percent: 16.0,
  taxa_direto_percent: 0.0,
};

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

window.RezFireData = {
  loadProducts,
  saveProducts,
  nextProductId,
  formatMoney,
  computeDashboard,
  cloneDefaults,
  TOTAL_MOVIMENTACOES,
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
};


