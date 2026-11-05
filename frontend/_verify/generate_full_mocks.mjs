// Script completo de geração e teste dos mocks matematicamente unificados
import fs from "node:fs";

// 1. Catálogo Mestre de Produtos (12 itens)
const products = [
  {
    id_produto: 1,
    sku: "EXT-PQS-4KG",
    nome: "Extintor Pó Químico ABC 4kg",
    descricao: "Extintor de pó químico seco pressurizado ABC de 4kg. Indicado para veículos leves, comércio e residências.",
    custo: 82.0,
    preco: 169.9,
    ativo: true,
    quantidade_atual: 65,
    estoque_minimo: 40,
    tipo: "Unitário",
    detalhes_extintor: {
      registro_inmetro: "003180/2021",
      tipo_extintor: "Pó Químico Seco (PQS ABC)",
      capacidade_peso: "4 kg (2-A:20-B:C)",
      classe_incendio: "ABC",
      fabricante: "Resil Comercial",
      data_fabricacao: "2024-01-15",
      data_validade: "2029-01-15",
      numero_lacre: "L-332910",
      selo_conformidade: "INM-552190",
    },
  },
  {
    id_produto: 2,
    sku: "EXT-H2O-10L",
    nome: "Extintor Água Pressurizada 10L",
    descricao: "Extintor de água pressurizada classe A para materiais sólidos combustíveis como madeira, papel e tecidos.",
    custo: 74.0,
    preco: 159.9,
    ativo: true,
    quantidade_atual: 45,
    estoque_minimo: 30,
    tipo: "Unitário",
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
    sku: "EXT-CO2-6KG",
    nome: "Extintor CO2 6kg",
    descricao: "Extintor de dióxido de carbono 6kg classe BC, ideal para equipamentos elétricos energizados e líquidos inflamáveis sem deixar resíduos.",
    custo: 245.0,
    preco: 459.0,
    ativo: true,
    quantidade_atual: 22,
    estoque_minimo: 20,
    tipo: "Unitário",
    detalhes_extintor: {
      registro_inmetro: "001891/2020",
      tipo_extintor: "Dióxido de Carbono (CO2)",
      capacidade_peso: "6 kg (10-B:C)",
      classe_incendio: "BC",
      fabricante: "Extang Incêndio",
      data_fabricacao: "2023-02-20",
      data_validade: "2028-02-20",
      numero_lacre: "L-993044",
      selo_conformidade: "INM-771945",
    },
  },
  {
    id_produto: 4,
    sku: "EXT-CO2-4KG",
    nome: "Extintor CO2 4kg",
    descricao: "Extintor de dióxido de carbono 4kg classe BC. Estoque abaixo do mínimo operacional com remessa bloqueada para venda preventiva.",
    custo: 210.0,
    preco: 389.0,
    ativo: true,
    quantidade_atual: 8,
    estoque_minimo: 25,
    tipo: "Unitário",
    detalhes_extintor: {
      registro_inmetro: "001890/2020",
      tipo_extintor: "Dióxido de Carbono (CO2)",
      capacidade_peso: "4 kg (5-B:C)",
      classe_incendio: "BC",
      fabricante: "Extang Incêndio",
      data_fabricacao: "2022-11-20",
      data_validade: "2027-11-20",
      numero_lacre: "L-993021",
      selo_conformidade: "INM-771920",
    },
  },
  {
    id_produto: 5,
    sku: "EXT-K-6L",
    nome: "Extintor Classe K 6L (Cozinhas)",
    descricao: "Extintor à base de acetato de potássio desenvolvido para combate a incêndios em óleos e gorduras vegetais em cozinhas profissionais.",
    custo: 410.0,
    preco: 749.0,
    ativo: true,
    quantidade_atual: 6,
    estoque_minimo: 5,
    tipo: "Unitário",
    detalhes_extintor: {
      registro_inmetro: "005110/2022",
      tipo_extintor: "Classe K (Cozinhas)",
      capacidade_peso: "6 Litros (K)",
      classe_incendio: "K",
      fabricante: "Kidde Brasil",
      data_fabricacao: "2023-06-15",
      data_validade: "2028-06-15",
      numero_lacre: "L-220194",
      selo_conformidade: "INM-882031",
    },
  },
  {
    id_produto: 6,
    sku: "EXT-PQS-12KG",
    nome: "Extintor Pó Químico BC 12kg",
    descricao: "Extintor industrial pressurizado de grande capacidade para indústrias e postos de combustível. Atualmente com estoque esgotado (ruptura).",
    custo: 175.0,
    preco: 329.0,
    ativo: true,
    quantidade_atual: 0,
    estoque_minimo: 15,
    tipo: "Unitário",
    detalhes_extintor: {
      registro_inmetro: "004080/2020",
      tipo_extintor: "Pó Químico Seco (BC)",
      capacidade_peso: "12 kg (40-B:C)",
      classe_incendio: "BC",
      fabricante: "Mocelin",
      data_fabricacao: "2022-05-10",
      data_validade: "2027-05-10",
      numero_lacre: "L-771029",
      selo_conformidade: "INM-662910",
    },
  },
  {
    id_produto: 7,
    sku: "EXT-ESP-9L",
    nome: "Extintor Espuma Mecânica 9L",
    descricao: "Extintor de espuma mecânica 9 litros. Linha descontinuada pelo fornecedor.",
    custo: 145.0,
    preco: 289.0,
    ativo: false,
    quantidade_atual: 0,
    estoque_minimo: 15,
    tipo: "Unitário",
    detalhes_extintor: {
      registro_inmetro: "004010/2021",
      tipo_extintor: "Espuma Mecânica",
      capacidade_peso: "9 Litros (2-A:10-B)",
      classe_incendio: "ABC",
      fabricante: "Resil",
      data_fabricacao: "2022-01-18",
      data_validade: "2027-01-18",
      numero_lacre: "L-449102",
      selo_conformidade: "INM-332190",
    },
  },
  {
    id_produto: 8,
    sku: "SUP-EXT-01",
    nome: "Suporte de Parede p/ Extintor",
    descricao: "Suporte de fixação universal em chapa de aço zincado resistente a corrosão, compatível com extintores de 4kg a 12kg.",
    custo: 6.5,
    preco: 18.9,
    ativo: true,
    quantidade_atual: 180,
    estoque_minimo: 50,
    tipo: "Unitário",
  },
  {
    id_produto: 9,
    sku: "PLA-FOTO-01",
    nome: "Placa Sinalização Fotoluminescente",
    descricao: "Placa de rota de fuga e indicação de extintor fotoluminescente em PVC autoextinguível 20x20cm, em conformidade com NBR 13434.",
    custo: 9.8,
    preco: 34.9,
    ativo: true,
    quantidade_atual: 215,
    estoque_minimo: 60,
    tipo: "Unitário",
  },
  {
    id_produto: 10,
    sku: "MAN-MANG-15",
    nome: "Mangueira de Incêndio 15m",
    descricao: "Mangueira de incêndio tipo 1 (1.1/2'') de 15 metros com uniões de engate rápido Storz em latão, para edifícios residenciais.",
    custo: 125.0,
    preco: 249.0,
    ativo: true,
    quantidade_atual: 16,
    estoque_minimo: 15,
    tipo: "Unitário",
  },
  {
    id_produto: 11,
    sku: "DET-FUM-01",
    nome: "Detector de Fumaça Óptico",
    descricao: "Detector de fumaça óptico autônomo com sinalizador sonoro de 85dB e bateria de 9V inclusa para residências e escritórios.",
    custo: 38.0,
    preco: 89.9,
    ativo: true,
    quantidade_atual: 32,
    estoque_minimo: 20,
    tipo: "Unitário",
  },
  {
    id_produto: 12,
    sku: "KIT-ABC-COMPLETO",
    nome: "Kit Segurança Comercial ABC + Suporte + Placa",
    descricao: "Combo promocional completo composto por 1x Extintor ABC 4kg, 1x Suporte de Parede e 1x Placa Fotoluminescente. Estoque dinâmico com baixa proporcional.",
    custo: 98.3,
    preco: 199.9,
    ativo: true,
    quantidade_atual: 65, // Dinâmico: min(65, 180, 215)
    estoque_minimo: 20,
    tipo: "Combo",
    combo_items: [
      { id_produto: 1, sku: "EXT-PQS-4KG", quantidade: 1, nome: "Extintor Pó Químico ABC 4kg" },
      { id_produto: 8, sku: "SUP-EXT-01", quantidade: 1, nome: "Suporte de Parede p/ Extintor" },
      { id_produto: 9, sku: "PLA-FOTO-01", quantidade: 1, nome: "Placa Sinalização Fotoluminescente" },
    ],
  },
];

// 2. Entradas por NF
const entradasNFs = [
  { id: 1, id_produto: 1, sku: "EXT-PQS-4KG", nome: "Extintor Pó Químico ABC 4kg", qtd: 120, unit: 82.0, nf: "NF-e 10420 (Resil Comercial)", fornecedor: "Resil Comercial Ltda", diasAtras: 170 },
  { id: 2, id_produto: 1, sku: "EXT-PQS-4KG", nome: "Extintor Pó Químico ABC 4kg", qtd: 100, unit: 82.0, nf: "NF-e 10680 (Kidde Brasil)", fornecedor: "Kidde Brasil Ltda", diasAtras: 45 },
  { id: 3, id_produto: 2, sku: "EXT-H2O-10L", nome: "Extintor Água Pressurizada 10L", qtd: 150, unit: 74.0, nf: "NF-e 10420 (Resil Comercial)", fornecedor: "Resil Comercial Ltda", diasAtras: 160 },
  { id: 4, id_produto: 3, sku: "EXT-CO2-6KG", nome: "Extintor CO2 6kg", qtd: 60, unit: 245.0, nf: "NF-e 10512 (Extang Incêndio)", fornecedor: "Extang Incêndio Indústria", diasAtras: 130 },
  { id: 5, id_produto: 4, sku: "EXT-CO2-4KG", nome: "Extintor CO2 4kg", qtd: 40, unit: 210.0, nf: "NF-e 10512 (Extang Incêndio)", fornecedor: "Extang Incêndio Indústria", diasAtras: 125 },
  { id: 6, id_produto: 5, sku: "EXT-K-6L", nome: "Extintor Classe K 6L (Cozinhas)", qtd: 18, unit: 410.0, nf: "NF-e 10540 (Kidde Brasil)", fornecedor: "Kidde Brasil Ltda", diasAtras: 90 },
  { id: 7, id_produto: 6, sku: "EXT-PQS-12KG", nome: "Extintor Pó Químico BC 12kg", qtd: 50, unit: 175.0, nf: "NF-e 10560 (Mocelin)", fornecedor: "Mocelin Equipamentos", diasAtras: 80 },
  { id: 8, id_produto: 8, sku: "SUP-EXT-01", nome: "Suporte de Parede p/ Extintor", qtd: 400, unit: 6.5, nf: "NF-e 10600 (Metalúrgica Combate)", fornecedor: "Metalúrgica Combate", diasAtras: 175 },
  { id: 9, id_produto: 9, sku: "PLA-FOTO-01", nome: "Placa Sinalização Fotoluminescente", qtd: 500, unit: 9.8, nf: "NF-e 10702 (Sinaliza Indústria)", fornecedor: "Sinaliza Indústria Visual", diasAtras: 165 },
  { id: 10, id_produto: 10, sku: "MAN-MANG-15", nome: "Mangueira de Incêndio 15m", qtd: 40, unit: 125.0, nf: "NF-e 10740 (Metalúrgica Combate)", fornecedor: "Metalúrgica Combate", diasAtras: 100 },
  { id: 11, id_produto: 11, sku: "DET-FUM-01", nome: "Detector de Fumaça Óptico", qtd: 80, unit: 38.0, nf: "NF-e 10800 (Segurimax)", fornecedor: "Segurimax Distribuição", diasAtras: 140 },
];

const saidasAvulsas = [
  { id: 1, id_produto: 2, sku: "EXT-H2O-10L", nome: "Extintor Água Pressurizada 10L", qtd: 3, motivo: "Perda operacional (despressurização no galpão)", preco: 159.9, diasAtras: 55 },
];

const TARGET_SALES = {
  1: 155,
  2: 102,
  3: 38,
  4: 32,
  5: 12,
  6: 50,
  7: 0,
  8: 220,
  9: 285,
  10: 24,
  11: 48,
};

const CLIENTES = [
  { nome: "Condomínio Edifício Mirante do Vale", uf: "SP" },
  { nome: "Auto Posto Alvorada Ltda", uf: "SP" },
  { nome: "Transportadora Rápido Sudeste", uf: "RJ" },
  { nome: "Restaurante e Churrascaria Fogo Nobre", uf: "MG" },
  { nome: "Indústria Metalúrgica Progresso", uf: "SP" },
  { nome: "Supermercado Compre Bem", uf: "PR" },
  { nome: "Hospital e Maternidade São Lucas", uf: "SP" },
  { nome: "Centro Educacional Futuro", uf: "SC" },
  { nome: "Distribuidora de Alimentos União", uf: "GO" },
  { nome: "Oficina Mecânica Precision Car", uf: "SP" },
  { nome: "Hotel Pousada das Palmeiras", uf: "RJ" },
  { nome: "Padaria e Confeitaria Bella Vista", uf: "SP" },
  { nome: "Galpão Logístico Bandeirantes", uf: "SP" },
  { nome: "Academia Iron Fitness Center", uf: "MG" },
  { nome: "Gráfica e Editora Moderna", uf: "RS" },
  { nome: "Farmácia Droga Express", uf: "SP" },
  { nome: "Teatro Municipal Carlos Gomes", uf: "RJ" },
  { nome: "Laboratório Clínico Biolab", uf: "SP" },
  { nome: "Escola Técnica Integrada", uf: "PR" },
  { nome: "Centro Empresarial Millennium", uf: "SP" },
];

const PAGAMENTOS = ["Cartão de Crédito", "Boleto Bancário", "PIX", "Mercado Pago"];
const getProd = (id) => products.find((p) => p.id_produto === id);

const remainingSales = { ...TARGET_SALES };
const rawOrdersList = [];

// Arquétipos para montar os pedidos
const orderArchetypes = [
  { canal: "Venda Direta", itens: [{ id: 1, qtd: 10 }, { id: 2, qtd: 8 }, { id: 8, qtd: 18 }, { id: 9, qtd: 18 }] },
  { canal: "Venda Direta", itens: [{ id: 1, qtd: 6 }, { id: 2, qtd: 4 }, { id: 8, qtd: 10 }, { id: 9, qtd: 10 }] },
  { canal: "Venda Direta", itens: [{ id: 5, qtd: 3 }, { id: 1, qtd: 2 }, { id: 9, qtd: 5 }] },
  { canal: "Venda Direta", itens: [{ id: 6, qtd: 8 }, { id: 8, qtd: 8 }, { id: 9, qtd: 8 }] },
  { canal: "Venda Direta", itens: [{ id: 10, qtd: 4 }, { id: 9, qtd: 6 }] },
  { canal: "Mercado Livre", itens: [{ id: 3, qtd: 4 }, { id: 9, qtd: 4 }] },
  { canal: "Mercado Livre", itens: [{ id: 4, qtd: 4 }, { id: 8, qtd: 4 }] },
  { canal: "Mercado Livre", itens: [{ id: 11, qtd: 8 }] },
  { canal: "Mercado Livre", itens: [{ id: 9, qtd: 20 }] },
  { canal: "Mercado Livre", itens: [{ id: 8, qtd: 20 }] },
  { canal: "Mercado Livre", itens: [{ id: 1, qtd: 2 }, { id: 8, qtd: 2 }, { id: 9, qtd: 2 }] },
  { canal: "Mercado Livre", itens: [{ id: 1, qtd: 2 }, { id: 8, qtd: 2 }] },
  { canal: "Mercado Livre", itens: [{ id: 2, qtd: 3 }, { id: 8, qtd: 3 }] },
];

let cliIndex = 0;
while (Object.values(remainingSales).some((q) => q > 0)) {
  let chosen = null;
  for (const arch of orderArchetypes) {
    if (arch.itens.every((it) => (remainingSales[it.id] || 0) >= it.qtd)) {
      chosen = { canal: arch.canal, itens: arch.itens.map((it) => ({ ...it })) };
      break;
    }
  }

  if (!chosen) {
    const itensSobra = [];
    let canalSobra = "Mercado Livre";
    for (const [idStr, remaining] of Object.entries(remainingSales)) {
      const pId = Number(idStr);
      if (remaining > 0) {
        const take = Math.min(remaining, pId === 8 || pId === 9 ? 15 : pId === 1 || pId === 2 ? 4 : 2);
        itensSobra.push({ id: pId, qtd: take });
        if (pId === 6 || pId === 10) canalSobra = "Venda Direta";
      }
    }
    if (itensSobra.length > 0) {
      chosen = { canal: canalSobra, itens: itensSobra };
    }
  }

  if (!chosen || chosen.itens.length === 0) break;

  chosen.itens.forEach((it) => {
    remainingSales[it.id] -= it.qtd;
  });

  const cli = CLIENTES[cliIndex % CLIENTES.length];
  cliIndex++;

  rawOrdersList.push({
    canal: chosen.canal,
    cliente: cli.nome,
    uf: cli.uf,
    itensConfig: chosen.itens,
  });
}

// 3 cancelados
const cancelledOrdersConfig = [
  { canal: "Mercado Livre", cliente: "Logística Express Barueri", uf: "SP", itens: [{ id: 1, qtd: 4 }, { id: 8, qtd: 4 }] },
  { canal: "Venda Direta", cliente: "Restaurante Sabor Mineiro", uf: "MG", itens: [{ id: 5, qtd: 2 }] },
  { canal: "Mercado Livre", cliente: "Condomínio Bosque Real", uf: "RJ", itens: [{ id: 3, qtd: 2 }, { id: 9, qtd: 5 }] },
];

// Agora distribuímos as datas uniformemente dos pedidos:
// Os últimos 5 pedidos válidos são de 0, 1, 2, 3 dias atrás (Confirmados)
// Os anteriores são de 4 a 160 dias atrás (Concluidos)
const totalValid = rawOrdersList.length;
const finalOrders = [];

rawOrdersList.forEach((raw, idx) => {
  const idPed = idx + 1;
  const isRecent = idx >= totalValid - 6;
  let diasAtras;
  if (idx === totalValid - 1) diasAtras = 0;       // Hoje!
  else if (idx === totalValid - 2) diasAtras = 0;  // Hoje mais cedo
  else if (idx === totalValid - 3) diasAtras = 1;  // Ontem
  else if (idx === totalValid - 4) diasAtras = 1;  // Ontem
  else if (idx === totalValid - 5) diasAtras = 2;  // 2 dias atrás
  else if (idx === totalValid - 6) diasAtras = 3;  // 3 dias atrás
  else {
    diasAtras = Math.round(4 + ((totalValid - 7 - idx) / (totalValid - 7)) * 156);
  }

  const itensPedido = raw.itensConfig.map((ci) => {
    const prod = getProd(ci.id);
    const sub = Number((prod.preco * ci.qtd).toFixed(2));
    return {
      id_produto: prod.id_produto,
      sku: prod.sku,
      nome: prod.nome,
      quantidade: ci.qtd,
      preco_unitario: prod.preco,
      subtotal: sub,
    };
  });

  const subtotal = Number(itensPedido.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
  const frete = raw.canal === "Mercado Livre" ? (subtotal > 200 ? 0 : 24.9) : (subtotal > 500 ? 0 : 45.0);
  const desconto = raw.canal === "Venda Direta" && subtotal > 1000 ? Number((subtotal * 0.05).toFixed(2)) : 0;
  const valorTotal = Number((subtotal - desconto + frete).toFixed(2));

  const status = diasAtras <= 3 ? "Confirmado" : "Concluido";
  const formaPagamento = PAGAMENTOS[idPed % PAGAMENTOS.length];
  const codPed = raw.canal === "Mercado Livre" ? `MLB-${2894012000 + idPed}` : `PED-${String(idPed).padStart(4, "0")}`;

  finalOrders.push({
    id_pedido: idPed,
    codigo_pedido: codPed,
    canal: raw.canal,
    cliente: raw.cliente,
    uf: raw.uf,
    diasAtras: diasAtras,
    status: status,
    itens: itensPedido,
    subtotal: subtotal,
    desconto: desconto,
    frete: frete,
    valor_total: valorTotal,
    forma_pagamento: formaPagamento,
    tipo_envio: raw.canal === "Mercado Livre" ? "Mercado Envios Coleta" : "Transportadora Parceira (Rodonaves)",
  });
});

// Adiciona os 3 cancelados em dias específicos
let cancelId = totalValid + 1;
cancelledOrdersConfig.forEach((cfg, cIdx) => {
  const diasAtras = cIdx === 0 ? 88 : cIdx === 1 ? 42 : 12;
  const idPed = cancelId++;
  const codPed = cfg.canal === "Mercado Livre" ? `MLB-${2894012000 + idPed}` : `PED-${String(idPed).padStart(4, "0")}`;
  const itensPedido = cfg.itens.map((ci) => {
    const prod = getProd(ci.id);
    const sub = Number((prod.preco * ci.qtd).toFixed(2));
    return {
      id_produto: prod.id_produto,
      sku: prod.sku,
      nome: prod.nome,
      quantidade: ci.qtd,
      preco_unitario: prod.preco,
      subtotal: sub,
    };
  });
  const subtotal = Number(itensPedido.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
  finalOrders.push({
    id_pedido: idPed,
    codigo_pedido: codPed,
    canal: cfg.canal,
    cliente: cfg.cliente,
    uf: cfg.uf,
    diasAtras: diasAtras,
    status: "Cancelado",
    motivo_cancelamento: "Desistência do comprador após aprovação comercial (estoque estornado).",
    itens: itensPedido,
    subtotal: subtotal,
    desconto: 0,
    frete: 0,
    valor_total: subtotal,
    forma_pagamento: "Cartão de Crédito",
    tipo_envio: "Mercado Envios",
  });
});

// Ordena por diasAtras decrescente
finalOrders.sort((a, b) => b.diasAtras - a.diasAtras);

// Salva arquivos
fs.writeFileSync("frontend/_verify/unified_products.json", JSON.stringify(products, null, 2));
fs.writeFileSync("frontend/_verify/unified_orders.json", JSON.stringify(finalOrders, null, 2));

console.log("Pedidos gerados:", finalOrders.length);
console.log("Pedidos nos últimos 3 dias:", finalOrders.filter((o) => o.diasAtras <= 3).map((o) => ({ id: o.id_pedido, cod: o.codigo_pedido, d: o.diasAtras, status: o.status })));
