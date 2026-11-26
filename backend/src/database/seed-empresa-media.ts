import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { AppDataSource } from '../config/database';

/**
 * Seed Corporativo Realista — RezFire Equipamentos Contra Incêndio Ltda (Empresa Média)
 *
 * Popula integralmente o banco MySQL com dados matematicamente coerentes entre todos os módulos:
 * - Usuários (Gestor + Operadores RBAC)
 * - Catálogo de 16 produtos (15 ativos + 1 inativo, 2 combos, dados fiscais NCM/CFOP/CSOSN)
 * - Estoque (normal, ponto de atenção, baixo, ruptura total e excesso) + 18 Lotes FEFO
 * - 6 Fornecedores + Vínculos Produto-Fornecedor + 26 Pedidos de Compra (prazo, atraso, variação custo)
 * - 38 Clientes (B2B Presencial + Mercado Livre, novos, recorrentes, inativos e VIP em risco)
 * - 115 Pedidos + Itens com custos, impostos, comissões ML, frete, ads e lucro líquido exatos
 * - Movimentações de estoque coerentes (Entradas NF, Saídas Vendas, Perdas, Estornos)
 * - 13 Devoluções + Itens (SLA no prazo, SLA estourado, motivos Pareto, troca vs reembolso)
 * - 94+ Notas Fiscais Eletrônicas (Autorizadas, Rejeitadas SEFAZ, Canceladas, Em Processamento,
 *   Cartas de Correção, Inutilizações e Transmissões) + 3 pedidos faturáveis pendentes de NF-e
 * - 12 Anúncios ML + Ocorrências de queda/reativação + Mídias + Eventos Webhook
 * - 38 Lançamentos Financeiros segregados (Empresa PJ x Pessoal PF)
 * - 12 Inspeções de Qualidade + 8 Certificados INMETRO + Notificações + Respostas Padrão
 */

// PRNG determinístico (Mulberry32) para reprodutibilidade exata
function createRng(seed: number) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(20261124);
const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function formatSqlDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatSqlDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgo(days: number, hourOffset = 10, minOffset = 0): Date {
  const d = new Date(Date.now() - days * 86400000);
  d.setHours(hourOffset, minOffset, randInt(0, 59), 0);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date(Date.now() + days * 86400000);
  d.setHours(12, 0, 0, 0);
  return d;
}

// Geradores de CPF e CNPJ matematicamente válidos (passam no fiscalValidator)
function gerarCnpjValido(base8: number): string {
  const digits = String(base8).padStart(8, '0') + '0001';
  const arr = digits.split('').map(Number);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const s1 = arr.reduce((acc, d, i) => acc + d * w1[i], 0);
  const d1 = s1 % 11 < 2 ? 0 : 11 - (s1 % 11);
  arr.push(d1);
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const s2 = arr.reduce((acc, d, i) => acc + d * w2[i], 0);
  const d2 = s2 % 11 < 2 ? 0 : 11 - (s2 % 11);
  arr.push(d2);
  return arr.join('');
}

function gerarCpfValido(base9: number): string {
  const arr = String(base9).padStart(9, '0').split('').map(Number);
  const s1 = arr.reduce((acc, d, i) => acc + d * (10 - i), 0);
  const d1 = (s1 * 10) % 11 === 10 ? 0 : (s1 * 10) % 11;
  arr.push(d1);
  const s2 = arr.reduce((acc, d, i) => acc + d * (11 - i), 0);
  const d2 = (s2 * 10) % 11 === 10 ? 0 : (s2 * 10) % 11;
  arr.push(d2);
  return arr.join('');
}

function formatDocMask(doc: string): string {
  if (doc.length === 14) {
    return doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function gerarChaveNfe(ufCod: string, data: Date, cnpjEmit: string, serie: number, numero: number): string {
  const aamm = String(data.getFullYear()).slice(-2) + String(data.getMonth() + 1).padStart(2, '0');
  const mod = '55';
  const ser = String(serie).padStart(3, '0');
  const nNF = String(numero).padStart(9, '0');
  const tpEmis = '1';
  const cNF = String(10000000 + ((numero * 7919) % 89999999)).padStart(8, '0');
  const base43 = `${ufCod}${aamm}${cnpjEmit}${mod}${ser}${nNF}${tpEmis}${cNF}`;
  // Módulo 11 dígito verificador oficial SEFAZ
  let peso = 2;
  let soma = 0;
  for (let i = base43.length - 1; i >= 0; i--) {
    soma += Number(base43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  return `${base43}${dv}`;
}

export async function runSeedEmpresaMedia() {
  console.log('🏢 Iniciando população completa do banco RezFireDB (Cenário Empresa Média)...');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    // ───────────────────────────────────────────────────────────────────────────
    // 0. Limpeza segura das tabelas operacionais (preserva migrations e gestor)
    // ───────────────────────────────────────────────────────────────────────────
    await qr.query('SET FOREIGN_KEY_CHECKS = 0');
    const tabelasParaLimpar = [
      'notas_fiscais_eventos',
      'notas_fiscais_transmissoes',
      'notas_fiscais_itens',
      'notas_fiscais_inutilizacoes',
      'notas_fiscais',
      'itens_devolucao',
      'devolucoes',
      'inspecoes_qualidade',
      'itens_pedido_compra',
      'pedidos_compra',
      'produto_fornecedor',
      'fornecedores',
      'itens_pedido',
      'pedidos',
      'clientes',
      'movimentacoes_estoque',
      'lotes_estoque',
      'estoque',
      'produto_anuncio',
      'midias_anuncio',
      'ocorrencias_anuncio',
      'anuncios_ml',
      'eventos_mercado_livre',
      'documentos_certificacao',
      'produtos',
      'lancamentos_financeiros',
      'notificacoes',
      'respostas_padrao',
      'frete_configuracoes',
    ];
    for (const tbl of tabelasParaLimpar) {
      await qr.query(`DELETE FROM \`${tbl}\``);
      await qr.query(`ALTER TABLE \`${tbl}\` AUTO_INCREMENT = 1`);
    }
    await qr.query('SET FOREIGN_KEY_CHECKS = 1');

    // ───────────────────────────────────────────────────────────────────────────
    // 1. Usuários (Gestor + 2 Operadores RBAC)
    // ───────────────────────────────────────────────────────────────────────────
    let [gestor] = await qr.query(`SELECT id_usuario, nome, email FROM usuarios WHERE email = 'gestor@rezfire.com.br' LIMIT 1`);
    if (!gestor) {
      const hashGestor = await bcrypt.hash('rezfire2026', 10);
      const res = await qr.query(
        `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, created_at) VALUES (?, ?, ?, 'GESTOR', 1, ?)`,
        ['Gestor RezFire', 'gestor@rezfire.com.br', hashGestor, formatSqlDateTime(daysAgo(180))]
      );
      gestor = { id_usuario: res.insertId, nome: 'Gestor RezFire', email: 'gestor@rezfire.com.br' };
    }
    const idGestor = Number(gestor.id_usuario);

    // Operadores (remove outros exceto gestor e recria limpo)
    await qr.query(`DELETE FROM usuarios WHERE id_usuario != ?`, [idGestor]);
    const hashOperador = await bcrypt.hash('operador2026', 10);
    const resOp1 = await qr.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, created_at) VALUES (?, ?, ?, 'OPERADOR', 1, ?)`,
      ['Carlos Henrique (Expedição)', 'carlos.expedicao@rezfire.com.br', hashOperador, formatSqlDateTime(daysAgo(140))]
    );
    const resOp2 = await qr.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, created_at) VALUES (?, ?, ?, 'OPERADOR', 1, ?)`,
      ['Marina Costa (Almoxarifado)', 'marina.estoque@rezfire.com.br', hashOperador, formatSqlDateTime(daysAgo(95))]
    );
    const idOp1 = Number(resOp1.insertId);
    const idOp2 = Number(resOp2.insertId);

    // ───────────────────────────────────────────────────────────────────────────
    // 2. Conexão Mercado Livre + Configuração de Frete + Emitente Fiscal
    // ───────────────────────────────────────────────────────────────────────────
    let [conexaoMl] = await qr.query(`SELECT id_conexao FROM conexoes_mercado_livre LIMIT 1`);
    if (!conexaoMl) {
      const resCon = await qr.query(
        `INSERT INTO conexoes_mercado_livre (id_usuario, ml_user_id, access_token, refresh_token, expires_at, status)
         VALUES (?, '128491029', 'APP_USR-782190-VALID-TOKEN', 'TG-650123-REFRESH', ?, 'Conectado')`,
        [idGestor, formatSqlDateTime(daysFromNow(30))]
      );
      conexaoMl = { id_conexao: resCon.insertId };
    } else {
      await qr.query(
        `UPDATE conexoes_mercado_livre SET id_usuario = ?, status = 'Conectado', expires_at = ? WHERE id_conexao = ?`,
        [idGestor, formatSqlDateTime(daysFromNow(30)), conexaoMl.id_conexao]
      );
    }
    const idConexaoMl = Number(conexaoMl.id_conexao);

    await qr.query(
      `INSERT INTO frete_configuracoes (frete_taxa_percentual_padrao, frete_transportadora_padrao, frete_atualizado_por_usuario_id)
       VALUES (4.5000, 'JadLog', ?)`,
      [idGestor]
    );

    const emitenteCnpj = '11222333000181';
    const [emitExist] = await qr.query(`SELECT id_emitente FROM emitente_fiscal LIMIT 1`);
    const certValidoDe = formatSqlDateTime(daysAgo(343));
    const certValidoAte = formatSqlDateTime(daysFromNow(22)); // Vence em 22 dias -> Alerta ATENÇÃO (< 30d)
    if (emitExist) {
      await qr.query(
        `UPDATE emitente_fiscal SET
          razao_social = 'RezFire Equipamentos Contra Incendio Ltda',
          nome_fantasia = 'RezFire',
          cnpj = ?,
          inscricao_estadual = '110042490114',
          regime_tributario = '1',
          cep = '03165000',
          logradouro = 'Rua da Mooca',
          numero = '2480',
          bairro = 'Mooca',
          municipio = 'Sao Paulo',
          codigo_municipio_ibge = '3550308',
          uf = 'SP',
          serie_nfe = 1,
          proximo_numero_nfe = 1125,
          ambiente = 'homologacao',
          certificado_titular = 'RezFire Equipamentos Contra Incendio Ltda:11222333000181',
          certificado_emissor = 'AC Certisign RFB G5',
          certificado_cnpj = ?,
          certificado_serial = '7A41F902B33C8E10',
          certificado_valido_de = ?,
          certificado_valido_ate = ?,
          certificado_atualizado_em = ?
         WHERE id_emitente = ?`,
        [emitenteCnpj, emitenteCnpj, certValidoDe, certValidoAte, formatSqlDateTime(daysAgo(10)), emitExist.id_emitente]
      );
    } else {
      await qr.query(
        `INSERT INTO emitente_fiscal (
          razao_social, nome_fantasia, cnpj, inscricao_estadual, regime_tributario,
          cep, logradouro, numero, bairro, municipio, codigo_municipio_ibge, uf,
          serie_nfe, proximo_numero_nfe, ambiente, modo_integracao,
          certificado_titular, certificado_emissor, certificado_cnpj, certificado_serial,
          certificado_valido_de, certificado_valido_ate, certificado_atualizado_em
        ) VALUES (
          'RezFire Equipamentos Contra Incendio Ltda', 'RezFire', ?, '110042490114', '1',
          '03165000', 'Rua da Mooca', '2480', 'Mooca', 'Sao Paulo', '3550308', 'SP',
          1, 1125, 'homologacao', 'sefaz_direto',
          'RezFire Equipamentos Contra Incendio Ltda:11222333000181', 'AC Certisign RFB G5', ?, '7A41F902B33C8E10',
          ?, ?, ?
        )`,
        [emitenteCnpj, emitenteCnpj, certValidoDe, certValidoAte, formatSqlDateTime(daysAgo(10))]
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 3. Fornecedores (6 parceiros industriais homologados)
    // ───────────────────────────────────────────────────────────────────────────
    const fornecedoresSeed = [
      {
        razao: 'Resil Comercial e Industrial LTDA',
        fantasia: 'Resil Extintores',
        cnpj: formatDocMask(gerarCnpjValido(61123456)),
        ie: '112.334.556.789',
        contato: 'Renato Alencar (Gerente Comercial)',
        email: 'vendas@resil.com.br',
        tel: '(11) 4589-2200',
        cep: '04571-010',
        logr: 'Av. das Nações Unidas',
        num: '12901',
        bairro: 'Brooklin Paulista',
        cidade: 'São Paulo',
        uf: 'SP',
        prazo: 5,
        pgto: '28/42/56 dias DDL',
        obs: 'Principal fabricante homologado de extintores PQS ABC e AP com selo INMETRO.',
      },
      {
        razao: 'Metalúrgica Bucka Spiero S/A',
        fantasia: 'Bucka Fire Systems',
        cnpj: formatDocMask(gerarCnpjValido(52987654)),
        ie: '289.441.902.113',
        contato: 'Mariana Spiero (Suprimentos)',
        email: 'pedidos@bucka.com.br',
        tel: '(11) 2468-1000',
        cep: '07220-000',
        logr: 'Rod. Presidente Dutra',
        num: 'km 218',
        bairro: 'Cumbica',
        cidade: 'Guarulhos',
        uf: 'SP',
        prazo: 7,
        pgto: '30/60 dias',
        obs: 'Especialista em cilindros de alta pressão CO2, válvulas e mangueiras Tipo 2.',
      },
      {
        razao: 'Extinpel Indústria e Comércio de Extintores Ltda',
        fantasia: 'Extinpel Brasil',
        cnpj: formatDocMask(gerarCnpjValido(14555777)),
        ie: '901.882.331.450',
        contato: 'Gilberto Prado (Expedição)',
        email: 'comercial@extinpel.com.br',
        tel: '(41) 3345-8810',
        cep: '81170-200',
        logr: 'Rua João Bettega',
        num: '4120',
        bairro: 'CIC',
        cidade: 'Curitiba',
        uf: 'PR',
        prazo: 8,
        pgto: '30 dias direto',
        obs: 'Fornecedor de linha industrial 6kg, 12kg e Espuma Mecânica. Monitorar SLA de transporte.',
      },
      {
        razao: 'Kidde Sistemas de Segurança Contra Incêndio Ltda',
        fantasia: 'Kidde Brasil',
        cnpj: formatDocMask(gerarCnpjValido(43210987)),
        ie: '115.667.889.012',
        contato: 'Patrícia Nogueira (Key Account)',
        email: 'b2b@kidde.com.br',
        tel: '(11) 3528-4400',
        cep: '06455-000',
        logr: 'Alameda Araguaia',
        num: '2190',
        bairro: 'Alphaville',
        cidade: 'Barueri',
        uf: 'SP',
        prazo: 10,
        pgto: '28 dias boleto',
        obs: 'Linha premium Classe K para cozinhas industriais e sensores de detecção óptica.',
      },
      {
        razao: 'SinalFlex Indústria Gráfica e Sinalização ABNT Ltda',
        fantasia: 'SinalFlex ABNT',
        cnpj: formatDocMask(gerarCnpjValido(28445910)),
        ie: '244.712.008.334',
        contato: 'Fábio Tavares',
        email: 'vendas@sinalflex.com.br',
        tel: '(19) 3276-4100',
        cep: '13060-804',
        logr: 'Av. John Boyd Dunlop',
        num: '3900',
        bairro: 'Jardim Londres',
        cidade: 'Campinas',
        uf: 'SP',
        prazo: 4,
        pgto: '21 dias direto',
        obs: 'Placas fotoluminescentes NBR 13434 com laudo de luminância.',
      },
      {
        razao: 'Metalúrgica Lacerda Suportes e Acessórios Ltda',
        fantasia: 'Metalúrgica Lacerda',
        cnpj: formatDocMask(gerarCnpjValido(33778120)),
        ie: '669.104.229.118',
        contato: 'André Lacerda',
        email: 'faturamento@lacerdametal.com.br',
        tel: '(15) 3228-9100',
        cep: '18087-101',
        logr: 'Av. Independência',
        num: '5180',
        bairro: 'Éden',
        cidade: 'Sorocaba',
        uf: 'SP',
        prazo: 6,
        pgto: '28/42 dias',
        obs: 'Suportes de parede eletrostáticos e tripés de solo em aço inox.',
      },
    ];

    const fornecedorIds: Record<string, number> = {};
    for (const f of fornecedoresSeed) {
      const res = await qr.query(
        `INSERT INTO fornecedores (
          razao_social, nome_fantasia, cnpj, inscricao_estadual, contato_nome, email, telefone,
          cep, logradouro, numero, bairro, cidade, estado, prazo_padrao_dias, condicoes_pagamento, observacoes, ativo, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          f.razao, f.fantasia, f.cnpj, f.ie, f.contato, f.email, f.tel,
          f.cep, f.logr, f.num, f.bairro, f.cidade, f.uf, f.prazo, f.pgto, f.obs,
          formatSqlDateTime(daysAgo(160)),
        ]
      );
      fornecedorIds[f.fantasia] = Number(res.insertId);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 4. Produtos (16 SKUs: 13 Simples Ativos + 2 Combos Ativos + 1 Inativo)
    // ───────────────────────────────────────────────────────────────────────────
    const produtosSeed = [
      {
        sku: 'EXT-PQS-4KG',
        nome: 'Extintor Pó Químico Seco ABC 4kg',
        descricao: 'Extintor multiuso Pó Químico ABC 4kg (2-A:20-B:C). Selo INMETRO, ideal para comércios, condomínios e frotas.',
        custo: 72.0,
        preco: 149.9,
        categoria: 'Extintores',
        tipo: 'Simples',
        qtd: 118,
        min: 40,
        ativo: 1,
        ncm: '84241000',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Resil Extintores', principal: 1, custo: 72.0 },
          { nome: 'Extinpel Brasil', principal: 0, custo: 74.5 },
        ],
        detalhes: {
          registro_inmetro: '003180/2023',
          tipo_extintor: 'Pó Químico ABC',
          capacidade_peso: '4 kg (2-A:20-B:C)',
          classe_incendio: 'ABC',
          fabricante: 'Resil',
          data_fabricacao: formatSqlDate(daysAgo(210)),
          data_validade: formatSqlDate(daysFromNow(1615)),
          numero_lacre: 'L-492018',
          selo_conformidade: 'INM-552011',
        },
        lotes: [
          { num: 'LT-PQS4-25A', lacre: 'L-492010', fabDias: 1580, valDias: 245, qtd: 18, status: 'Ativo' }, // Alerta FEFO (<=365d)
          { num: 'LT-PQS4-26A', lacre: 'L-492018', fabDias: 210, valDias: 1615, qtd: 100, status: 'Ativo' },
        ],
      },
      {
        sku: 'EXT-PQS-6KG',
        nome: 'Extintor Pó Químico Seco ABC 6kg',
        descricao: 'Extintor Pó ABC 6kg (3-A:30-B:C) alta capacidade extintora para galpões logísticos e indústrias.',
        custo: 94.0,
        preco: 189.9,
        categoria: 'Extintores',
        tipo: 'Simples',
        qtd: 84,
        min: 30,
        ativo: 1,
        ncm: '84241000',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Resil Extintores', principal: 1, custo: 94.0 },
          { nome: 'Extinpel Brasil', principal: 0, custo: 97.0 },
        ],
        detalhes: {
          registro_inmetro: '003181/2023',
          tipo_extintor: 'Pó Químico ABC',
          capacidade_peso: '6 kg (3-A:30-B:C)',
          classe_incendio: 'ABC',
          fabricante: 'Resil',
          data_fabricacao: formatSqlDate(daysAgo(160)),
          data_validade: formatSqlDate(daysFromNow(1665)),
          numero_lacre: 'L-581920',
          selo_conformidade: 'INM-552044',
        },
        lotes: [
          { num: 'LT-PQS6-26A', lacre: 'L-581920', fabDias: 160, valDias: 1665, qtd: 52, status: 'Ativo' },
          { num: 'LT-PQS6-26B', lacre: 'L-581988', fabDias: 45, valDias: 1780, qtd: 32, status: 'Ativo' },
        ],
      },
      {
        sku: 'EXT-AP-10L',
        nome: 'Extintor Água Pressurizada 10L - Portátil',
        descricao: 'Extintor de Água Pressurizada (AP) 10 Litros (2-A) para incêndios Classe A (madeira, papel, tecidos).',
        custo: 82.0,
        preco: 159.9,
        categoria: 'Extintores',
        tipo: 'Simples',
        qtd: 62,
        min: 25,
        ativo: 1,
        ncm: '84241000',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Resil Extintores', principal: 1, custo: 82.0 },
          { nome: 'Extinpel Brasil', principal: 0, custo: 84.0 },
        ],
        detalhes: {
          registro_inmetro: '002450/2022',
          tipo_extintor: 'Água Pressurizada (AP)',
          capacidade_peso: '10 Litros (2-A)',
          classe_incendio: 'A',
          fabricante: 'Resil',
          data_fabricacao: formatSqlDate(daysAgo(190)),
          data_validade: formatSqlDate(daysFromNow(1635)),
          numero_lacre: 'L-849201',
          selo_conformidade: 'INM-994120',
        },
        lotes: [
          { num: 'LT-AP10-25B', lacre: 'L-849150', fabDias: 1530, valDias: 295, qtd: 12, status: 'Ativo' }, // Alerta FEFO
          { num: 'LT-AP10-26A', lacre: 'L-849201', fabDias: 190, valDias: 1635, qtd: 50, status: 'Ativo' },
        ],
      },
      {
        sku: 'EXT-CO2-4KG',
        nome: 'Extintor Dióxido de Carbono CO2 4kg',
        descricao: 'Extintor CO2 4kg (5-B:C) para painéis elétricos, data centers e equipamentos eletrônicos sensíveis.',
        custo: 228.0,
        preco: 429.0,
        categoria: 'Extintores',
        tipo: 'Simples',
        qtd: 11, // ABAIXO DO MÍNIMO (20) -> Alerta estoque baixo!
        min: 20,
        ativo: 1,
        ncm: '84241000',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Bucka Fire Systems', principal: 1, custo: 228.0 },
          { nome: 'Resil Extintores', principal: 0, custo: 235.0 },
        ],
        detalhes: {
          registro_inmetro: '001890/2022',
          tipo_extintor: 'Dióxido de Carbono (CO2)',
          capacidade_peso: '4 kg (5-B:C)',
          classe_incendio: 'BC',
          fabricante: 'Bucka',
          data_fabricacao: formatSqlDate(daysAgo(240)),
          data_validade: formatSqlDate(daysFromNow(1585)),
          numero_lacre: 'L-993021',
          selo_conformidade: 'INM-771920',
        },
        lotes: [
          { num: 'LT-CO24-24B', lacre: 'L-992801', fabDias: 1705, valDias: 120, qtd: 3, status: 'Bloqueado' }, // <= 180d BLOQUEADO!
          { num: 'LT-CO24-26A', lacre: 'L-993021', fabDias: 240, valDias: 1585, qtd: 8, status: 'Ativo' },
        ],
      },
      {
        sku: 'EXT-CO2-6KG',
        nome: 'Extintor Dióxido de Carbono CO2 6kg',
        descricao: 'Extintor CO2 6kg (10-B:C) para subestações elétricas, CPDs e salas de máquinas.',
        custo: 292.0,
        preco: 549.0,
        categoria: 'Extintores',
        tipo: 'Simples',
        qtd: 24, // Ponto de atenção (min 18)
        min: 18,
        ativo: 1,
        ncm: '84241000',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Bucka Fire Systems', principal: 1, custo: 292.0 },
        ], // Fornecedor único!
        detalhes: {
          registro_inmetro: '001891/2022',
          tipo_extintor: 'Dióxido de Carbono (CO2)',
          capacidade_peso: '6 kg (10-B:C)',
          classe_incendio: 'BC',
          fabricante: 'Bucka',
          data_fabricacao: formatSqlDate(daysAgo(180)),
          data_validade: formatSqlDate(daysFromNow(1645)),
          numero_lacre: 'L-993044',
          selo_conformidade: 'INM-771945',
        },
        lotes: [
          { num: 'LT-CO26-25A', lacre: 'L-993011', fabDias: 1610, valDias: 215, qtd: 6, status: 'Ativo' }, // Alerta FEFO
          { num: 'LT-CO26-26A', lacre: 'L-993044', fabDias: 180, valDias: 1645, qtd: 18, status: 'Ativo' },
        ],
      },
      {
        sku: 'EXT-K-6L',
        nome: 'Extintor Classe K 6L - Cozinhas Profissionais',
        descricao: 'Extintor especial com acetato de potássio para combate a incêndios em óleos e gorduras quentes.',
        custo: 415.0,
        preco: 769.0,
        categoria: 'Extintores',
        tipo: 'Simples',
        qtd: 9,
        min: 8,
        ativo: 1,
        ncm: '84241000',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Kidde Brasil', principal: 1, custo: 415.0 },
        ], // Fornecedor único!
        detalhes: {
          registro_inmetro: '005110/2023',
          tipo_extintor: 'Classe K (Cozinhas)',
          capacidade_peso: '6 Litros (K)',
          classe_incendio: 'K',
          fabricante: 'Kidde',
          data_fabricacao: formatSqlDate(daysAgo(280)),
          data_validade: formatSqlDate(daysFromNow(1545)),
          numero_lacre: 'L-220194',
          selo_conformidade: 'INM-882031',
        },
        lotes: [
          { num: 'LT-K6L-21V', lacre: 'L-219002', fabDias: 1843, valDias: -18, qtd: 1, status: 'Vencido' }, // VENCIDO!
          { num: 'LT-K6L-26A', lacre: 'L-220194', fabDias: 280, valDias: 1545, qtd: 8, status: 'Ativo' },
        ],
      },
      {
        sku: 'EXT-PQS-12KG',
        nome: 'Extintor Pó Químico Seco ABC 12kg Industrial',
        descricao: 'Extintor pressurizado industrial de alta capacidade (4-A:40-B:C) para postos de combustíveis e depósitos.',
        custo: 188.0,
        preco: 349.0,
        categoria: 'Extintores',
        tipo: 'Simples',
        qtd: 0, // RUPTURA TOTAL (0 un.)!
        min: 15,
        ativo: 1,
        ncm: '84241000',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Extinpel Brasil', principal: 1, custo: 188.0 },
          { nome: 'Resil Extintores', principal: 0, custo: 194.0 },
        ],
        detalhes: {
          registro_inmetro: '004210/2023',
          tipo_extintor: 'Pó Químico ABC',
          capacidade_peso: '12 kg (4-A:40-B:C)',
          classe_incendio: 'ABC',
          fabricante: 'Extinpel',
          data_fabricacao: formatSqlDate(daysAgo(150)),
          data_validade: formatSqlDate(daysFromNow(1675)),
          numero_lacre: 'L-712040',
          selo_conformidade: 'INM-610291',
        },
        lotes: [
          { num: 'LT-PQS12-26A', lacre: 'L-712040', fabDias: 150, valDias: 1675, qtd: 0, status: 'Esgotado' },
        ],
      },
      {
        sku: 'EXT-ESP-10L',
        nome: 'Extintor Espuma Mecânica 10L AFFF',
        descricao: 'Extintor de Espuma Mecânica AFFF 10L (2-A:10-B) indicado para líquidos inflamáveis e oficinas.',
        custo: 168.0,
        preco: 265.0, // Margem bruta 36,6% (< 40% -> aciona alerta de risco de margem!)
        categoria: 'Extintores',
        tipo: 'Simples',
        qtd: 14,
        min: 12,
        ativo: 1,
        ncm: '84241000',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Extinpel Brasil', principal: 1, custo: 168.0 },
        ],
        detalhes: {
          registro_inmetro: '004890/2023',
          tipo_extintor: 'Espuma Mecânica (AFFF)',
          capacidade_peso: '10 Litros (2-A:10-B)',
          classe_incendio: 'AB',
          fabricante: 'Extinpel',
          data_fabricacao: formatSqlDate(daysAgo(140)),
          data_validade: formatSqlDate(daysFromNow(1685)),
          numero_lacre: 'L-605112',
          selo_conformidade: 'INM-620411',
        },
        lotes: [
          { num: 'LT-ESP10-24C', lacre: 'L-604900', fabDias: 1730, valDias: 95, qtd: 4, status: 'Bloqueado' }, // <=180d BLOQUEADO!
          { num: 'LT-ESP10-26A', lacre: 'L-605112', fabDias: 140, valDias: 1685, qtd: 10, status: 'Ativo' },
        ],
      },
      {
        sku: 'SUP-EXT-01',
        nome: 'Suporte Universal de Parede para Extintores',
        descricao: 'Suporte universal em aço carbono reforçado com pintura eletrostática anticorrosiva.',
        custo: 6.8,
        preco: 19.9,
        categoria: 'Acessórios',
        tipo: 'Simples',
        qtd: 340, // Excesso saudável
        min: 60,
        ativo: 1,
        ncm: '73269090',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Metalúrgica Lacerda', principal: 1, custo: 6.8 },
          { nome: 'Resil Extintores', principal: 0, custo: 7.4 },
        ],
        detalhes: null,
        lotes: [],
      },
      {
        sku: 'SUP-SOLO-INOX',
        nome: 'Suporte de Solo Tripé Inox para Extintor',
        descricao: 'Suporte de chão em aço inox escovado com sapatas antiderrapantes para recepções e escritórios.',
        custo: 42.0,
        preco: 94.9,
        categoria: 'Acessórios',
        tipo: 'Simples',
        qtd: 38,
        min: 20,
        ativo: 1,
        ncm: '73269090',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Metalúrgica Lacerda', principal: 1, custo: 42.0 },
        ],
        detalhes: null,
        lotes: [],
      },
      {
        sku: 'PLA-FOTO-01',
        nome: 'Placa Sinalização Extintor Fotoluminescente 20x20cm',
        descricao: 'Placa de sinalização de equipamento de combate a incêndio padrão ABNT NBR 13434.',
        custo: 4.9,
        preco: 15.9,
        categoria: 'Sinalização',
        tipo: 'Simples',
        qtd: 290,
        min: 50,
        ativo: 1,
        ncm: '39269090',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'SinalFlex ABNT', principal: 1, custo: 4.9 },
        ],
        detalhes: null,
        lotes: [],
      },
      {
        sku: 'DET-FUM-01',
        nome: 'Detector Óptico de Fumaça com Sirene Autônoma',
        descricao: 'Sensor fotoelétrico de fumaça com bateria 9V inclusa e alarme sonoro de 85dB.',
        custo: 44.0,
        preco: 94.9,
        categoria: 'Detecção',
        tipo: 'Simples',
        qtd: 16, // ABAIXO DO MÍNIMO (25) -> Alerta estoque baixo!
        min: 25,
        ativo: 1,
        ncm: '85311090',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Kidde Brasil', principal: 1, custo: 44.0 },
        ],
        detalhes: null,
        lotes: [],
      },
      {
        sku: 'MAN-INC-15M',
        nome: 'Mangueira de Incêndio Tipo 2 Predial 1.1/2" 15m',
        descricao: 'Mangueira de incêndio NBR 11861 Tipo 2 com engates storz em latão certificada ABNT.',
        custo: 195.0,
        preco: 319.0, // Margem bruta 38,9% (< 40% -> alerta financeiro!)
        categoria: 'Hidrantes',
        tipo: 'Simples',
        qtd: 21,
        min: 10,
        ativo: 1,
        ncm: '59090000',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Bucka Fire Systems', principal: 1, custo: 195.0 },
        ],
        detalhes: null,
        lotes: [],
      },
      {
        sku: 'EXT-PQS-1KG-VEIC',
        nome: 'Extintor Veicular Pó BC 1kg (Linha Descontinuada)',
        descricao: 'Modelo automotivo antigo descontinuado do catálogo ativo.',
        custo: 34.0,
        preco: 64.9,
        categoria: 'Extintores',
        tipo: 'Simples',
        qtd: 0,
        min: 0,
        ativo: 0,
        ncm: '84241000',
        cfop: '5102',
        csosn: '102',
        fornecedores: [
          { nome: 'Resil Extintores', principal: 1, custo: 34.0 },
        ],
        detalhes: null,
        lotes: [],
      },
    ];

    const produtoMap: Record<string, { id: number; sku: string; nome: string; custo: number; preco: number; categoria: string; ncm: string; cfop: string; csosn: string }> = {};
    const lotePorProduto: Record<number, number> = {};

    for (const p of produtosSeed) {
      const res = await qr.query(
        `INSERT INTO produtos (
          sku, nome, descricao, custo, preco, categoria, tipo, combo_items, detalhes_extintor,
          ativo, ncm, cfop, origem_mercadoria, cst_csosn, unidade_comercial, cest, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, '0', ?, 'UN', NULL, ?)`,
        [
          p.sku, p.nome, p.descricao, p.custo, p.preco, p.categoria, p.tipo,
          p.detalhes ? JSON.stringify(p.detalhes) : null,
          p.ativo, p.ncm, p.cfop, p.csosn, formatSqlDateTime(daysAgo(150)),
        ]
      );
      const idProd = Number(res.insertId);
      produtoMap[p.sku] = { id: idProd, sku: p.sku, nome: p.nome, custo: p.custo, preco: p.preco, categoria: p.categoria, ncm: p.ncm, cfop: p.cfop, csosn: p.csosn };

      await qr.query(
        `INSERT INTO estoque (id_produto, quantidade_atual, estoque_minimo, updated_at) VALUES (?, ?, ?, ?)`,
        [idProd, p.qtd, p.min, formatSqlDateTime(daysAgo(0, 9))]
      );

      for (const fLink of p.fornecedores) {
        await qr.query(
          `INSERT INTO produto_fornecedor (id_produto, id_fornecedor, principal, custo_compra, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [idProd, fornecedorIds[fLink.nome], fLink.principal, fLink.custo, formatSqlDateTime(daysAgo(140))]
        );
      }

      for (const l of p.lotes) {
        const resLote = await qr.query(
          `INSERT INTO lotes_estoque (
            id_produto, numero_lote, numero_lacre_inmetro, data_fabricacao, data_validade,
            quantidade_disponivel, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            idProd, l.num, l.lacre, formatSqlDate(daysAgo(l.fabDias)),
            l.valDias >= 0 ? formatSqlDate(daysFromNow(l.valDias)) : formatSqlDate(daysAgo(Math.abs(l.valDias))),
            l.qtd, l.status, formatSqlDateTime(daysAgo(Math.min(l.fabDias, 120))),
          ]
        );
        if (!lotePorProduto[idProd]) {
          lotePorProduto[idProd] = Number(resLote.insertId);
        }
      }
    }

    // 2 Combos Dinâmicos
    const combosSeed = [
      {
        sku: 'KIT-PQS-COMPLETO',
        nome: 'Kit Proteção Completa: Extintor PQS 4kg + Suporte + Placa',
        descricao: 'Kit comercial pronto para instalação AVCB: 1x Extintor ABC 4kg + 1x Suporte Parede + 1x Placa Fotoluminescente.',
        custo: round2(produtoMap['EXT-PQS-4KG'].custo + produtoMap['SUP-EXT-01'].custo + produtoMap['PLA-FOTO-01'].custo),
        preco: 169.9,
        categoria: 'Kits',
        qtd: 118,
        min: 20,
        items: [
          { id_produto: produtoMap['EXT-PQS-4KG'].id, quantidade: 1 },
          { id_produto: produtoMap['SUP-EXT-01'].id, quantidade: 1 },
          { id_produto: produtoMap['PLA-FOTO-01'].id, quantidade: 1 },
        ],
      },
      {
        sku: 'KIT-CO2-CPD',
        nome: 'Kit CPD & Servidor: 2x Extintor CO2 6kg + 2x Placas Sinalização',
        descricao: 'Combo corporativo de alta proteção elétrica para salas de servidores e racks.',
        custo: round2(produtoMap['EXT-CO2-6KG'].custo * 2 + produtoMap['PLA-FOTO-01'].custo * 2),
        preco: 1089.0,
        categoria: 'Kits',
        qtd: 12,
        min: 5,
        items: [
          { id_produto: produtoMap['EXT-CO2-6KG'].id, quantidade: 2 },
          { id_produto: produtoMap['PLA-FOTO-01'].id, quantidade: 2 },
        ],
      },
    ];

    for (const c of combosSeed) {
      const res = await qr.query(
        `INSERT INTO produtos (
          sku, nome, descricao, custo, preco, categoria, tipo, combo_items, detalhes_extintor,
          ativo, ncm, cfop, origem_mercadoria, cst_csosn, unidade_comercial, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'Combo', ?, NULL, 1, '84241000', '5102', '0', '102', 'UN', ?)`,
        [c.sku, c.nome, c.descricao, c.custo, c.preco, c.categoria, JSON.stringify(c.items), formatSqlDateTime(daysAgo(140))]
      );
      const idProd = Number(res.insertId);
      produtoMap[c.sku] = { id: idProd, sku: c.sku, nome: c.nome, custo: c.custo, preco: c.preco, categoria: c.categoria, ncm: '84241000', cfop: '5102', csosn: '102' };

      await qr.query(
        `INSERT INTO estoque (id_produto, quantidade_atual, estoque_minimo) VALUES (?, ?, ?)`,
        [idProd, c.qtd, c.min]
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 5. Clientes (38 clientes: 18 B2B Presencial + 20 Mercado Livre, 9 UFs)
    // ───────────────────────────────────────────────────────────────────────────
    interface ClienteMeta {
      id: number;
      nome: string;
      doc: string;
      email: string;
      tel: string;
      cidade: string;
      uf: string;
      cep: string;
      ibge: string;
      logr: string;
      bairro: string;
      origem: 'PRESENCIAL' | 'MERCADO_LIVRE';
      criadoDiasAtras: number;
      grupo: 'vip_inativo' | 'inativo' | 'recorrente' | 'regular' | 'novo';
    }

    const cidadesGeo = [
      { cidade: 'São Paulo', uf: 'SP', cep: '01310100', ibge: '3550308', logr: 'Av. Paulista', bairro: 'Bela Vista' },
      { cidade: 'Campinas', uf: 'SP', cep: '13010111', ibge: '3509502', logr: 'Av. Francisco Glicério', bairro: 'Centro' },
      { cidade: 'Guarulhos', uf: 'SP', cep: '07090000', ibge: '3518800', logr: 'Av. Paulo Faccini', bairro: 'Maia' },
      { cidade: 'Santo André', uf: 'SP', cep: '09015000', ibge: '3547809', logr: 'Av. Portugal', bairro: 'Centro' },
      { cidade: 'Rio de Janeiro', uf: 'RJ', cep: '20040020', ibge: '3304557', logr: 'Av. Rio Branco', bairro: 'Centro' },
      { cidade: 'Belo Horizonte', uf: 'MG', cep: '30130010', ibge: '3106200', logr: 'Av. Afonso Pena', bairro: 'Centro' },
      { cidade: 'Curitiba', uf: 'PR', cep: '80020310', ibge: '4106902', logr: 'Rua XV de Novembro', bairro: 'Centro' },
      { cidade: 'Joinville', uf: 'SC', cep: '89201400', ibge: '4209102', logr: 'Rua do Príncipe', bairro: 'Centro' },
      { cidade: 'Porto Alegre', uf: 'RS', cep: '90010150', ibge: '4314902', logr: 'Av. Borges de Medeiros', bairro: 'Centro Histórico' },
      { cidade: 'Salvador', uf: 'BA', cep: '40020000', ibge: '2927408', logr: 'Av. Tancredo Neves', bairro: 'Caminho das Árvores' },
      { cidade: 'Brasília', uf: 'DF', cep: '70040010', ibge: '5300108', logr: 'SCN Quadra 02', bairro: 'Asa Norte' },
      { cidade: 'Goiânia', uf: 'GO', cep: '74003010', ibge: '5208707', logr: 'Av. Goiás', bairro: 'Setor Central' },
    ];

    const clientesRaw: Array<{ nome: string; origem: 'PRESENCIAL' | 'MERCADO_LIVRE'; geoIdx: number; criadoDiasAtras: number; grupo: ClienteMeta['grupo']; isPj: boolean }> = [
      // B2B Presencial (18)
      { nome: 'Condomínio Residencial Jardins Paulista', origem: 'PRESENCIAL', geoIdx: 0, criadoDiasAtras: 120, grupo: 'recorrente', isPj: true },
      { nome: 'Auto Posto Rota do Sol Ltda', origem: 'PRESENCIAL', geoIdx: 1, criadoDiasAtras: 115, grupo: 'recorrente', isPj: true },
      { nome: 'Construtora Monte Alto Engenharia S/A', origem: 'PRESENCIAL', geoIdx: 0, criadoDiasAtras: 110, grupo: 'vip_inativo', isPj: true },
      { nome: 'Indústria Metalúrgica Bandeirantes Ltda', origem: 'PRESENCIAL', geoIdx: 2, criadoDiasAtras: 105, grupo: 'recorrente', isPj: true },
      { nome: 'Hospital Santa Clara de Campinas', origem: 'PRESENCIAL', geoIdx: 1, criadoDiasAtras: 102, grupo: 'vip_inativo', isPj: true },
      { nome: 'Supermercados Nova Estrela Ltda', origem: 'PRESENCIAL', geoIdx: 3, criadoDiasAtras: 98, grupo: 'recorrente', isPj: true },
      { nome: 'Colégio Horizonte Ensino Integrado', origem: 'PRESENCIAL', geoIdx: 0, criadoDiasAtras: 88, grupo: 'recorrente', isPj: true },
      { nome: 'Restaurante & Grill Brasas do Sul', origem: 'PRESENCIAL', geoIdx: 6, criadoDiasAtras: 55, grupo: 'recorrente', isPj: true },
      { nome: 'Transportadora Via Express Logística', origem: 'PRESENCIAL', geoIdx: 2, criadoDiasAtras: 50, grupo: 'recorrente', isPj: true },
      { nome: 'Clínica Médica Vida Plena Ltda', origem: 'PRESENCIAL', geoIdx: 4, criadoDiasAtras: 46, grupo: 'regular', isPj: true },
      { nome: 'Hotel Executivo Paulista Flat', origem: 'PRESENCIAL', geoIdx: 0, criadoDiasAtras: 42, grupo: 'recorrente', isPj: true },
      { nome: 'Condomínio Comercial Prime Tower', origem: 'PRESENCIAL', geoIdx: 5, criadoDiasAtras: 36, grupo: 'regular', isPj: true },
      { nome: 'Oficina Mecânica Torque Diesel Ltda', origem: 'PRESENCIAL', geoIdx: 3, criadoDiasAtras: 26, grupo: 'novo', isPj: true },
      { nome: 'Centro Logístico Anhanguera Galpões', origem: 'PRESENCIAL', geoIdx: 1, criadoDiasAtras: 22, grupo: 'novo', isPj: true },
      { nome: 'Padaria & Confeitaria Bella Mooca', origem: 'PRESENCIAL', geoIdx: 0, criadoDiasAtras: 18, grupo: 'novo', isPj: true },
      { nome: 'Academia Forma & Saúde Unidades SP', origem: 'PRESENCIAL', geoIdx: 0, criadoDiasAtras: 14, grupo: 'novo', isPj: true },
      { nome: 'Frigorífico Serra Azul Indústria', origem: 'PRESENCIAL', geoIdx: 7, criadoDiasAtras: 9, grupo: 'novo', isPj: true },
      { nome: 'Shopping Parque das Araucárias', origem: 'PRESENCIAL', geoIdx: 6, criadoDiasAtras: 4, grupo: 'novo', isPj: true },

      // Mercado Livre (20)
      { nome: 'Marcos Vinícius Oliveira', origem: 'MERCADO_LIVRE', geoIdx: 0, criadoDiasAtras: 125, grupo: 'inativo', isPj: false },
      { nome: 'Fernanda Rodrigues Silva', origem: 'MERCADO_LIVRE', geoIdx: 4, criadoDiasAtras: 118, grupo: 'inativo', isPj: false },
      { nome: 'Eduardo Martins Pereira', origem: 'MERCADO_LIVRE', geoIdx: 5, criadoDiasAtras: 112, grupo: 'inativo', isPj: false },
      { nome: 'Rafael Augusto Costa', origem: 'MERCADO_LIVRE', geoIdx: 6, criadoDiasAtras: 92, grupo: 'recorrente', isPj: false },
      { nome: 'Juliana Mendes Ferreira', origem: 'MERCADO_LIVRE', geoIdx: 0, criadoDiasAtras: 85, grupo: 'recorrente', isPj: false },
      { nome: 'Ricardo Almeida Santos', origem: 'MERCADO_LIVRE', geoIdx: 8, criadoDiasAtras: 76, grupo: 'recorrente', isPj: false },
      { nome: 'Camila Souza Nogueira', origem: 'MERCADO_LIVRE', geoIdx: 1, criadoDiasAtras: 56, grupo: 'recorrente', isPj: false },
      { nome: 'Bruno Henrique Carvalho', origem: 'MERCADO_LIVRE', geoIdx: 4, criadoDiasAtras: 52, grupo: 'regular', isPj: false },
      { nome: 'Patrícia Lima Azevedo', origem: 'MERCADO_LIVRE', geoIdx: 5, criadoDiasAtras: 48, grupo: 'recorrente', isPj: false },
      { nome: 'Thiago Ribeiro Barbosa', origem: 'MERCADO_LIVRE', geoIdx: 7, criadoDiasAtras: 44, grupo: 'regular', isPj: false },
      { nome: 'Amanda Cristina Duarte', origem: 'MERCADO_LIVRE', geoIdx: 9, criadoDiasAtras: 39, grupo: 'regular', isPj: false },
      { nome: 'Lucas Gabriel Teixeira', origem: 'MERCADO_LIVRE', geoIdx: 10, criadoDiasAtras: 34, grupo: 'regular', isPj: false },
      { nome: 'Vanessa Aparecida Gomes', origem: 'MERCADO_LIVRE', geoIdx: 11, criadoDiasAtras: 27, grupo: 'novo', isPj: false },
      { nome: 'Gustavo Henrique Moreira', origem: 'MERCADO_LIVRE', geoIdx: 0, criadoDiasAtras: 24, grupo: 'novo', isPj: false },
      { nome: 'Tatiane Moraes Cardoso', origem: 'MERCADO_LIVRE', geoIdx: 4, criadoDiasAtras: 20, grupo: 'novo', isPj: false },
      { nome: 'Felipe Augusto Batista', origem: 'MERCADO_LIVRE', geoIdx: 6, criadoDiasAtras: 16, grupo: 'novo', isPj: false },
      { nome: 'Larissa Fernandes Rocha', origem: 'MERCADO_LIVRE', geoIdx: 8, criadoDiasAtras: 12, grupo: 'novo', isPj: false },
      { nome: 'Diego Santana Cavalcanti', origem: 'MERCADO_LIVRE', geoIdx: 9, criadoDiasAtras: 8, grupo: 'novo', isPj: false },
      { nome: 'Priscila Barros Monteiro', origem: 'MERCADO_LIVRE', geoIdx: 5, criadoDiasAtras: 5, grupo: 'novo', isPj: false },
      { nome: 'André Luiz Nascimento', origem: 'MERCADO_LIVRE', geoIdx: 0, criadoDiasAtras: 2, grupo: 'novo', isPj: false },
    ];

    const clientes: ClienteMeta[] = [];
    for (let i = 0; i < clientesRaw.length; i++) {
      const c = clientesRaw[i];
      const geo = cidadesGeo[c.geoIdx];
      const doc = c.isPj ? gerarCnpjValido(21000000 + i * 137) : gerarCpfValido(310000000 + i * 7919);
      const emailSlug = c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '.').slice(0, 24);
      const email = `${emailSlug}@${c.isPj ? 'empresa.com.br' : 'email.com.br'}`;
      const tel = `(${geo.uf === 'SP' ? '11' : geo.uf === 'RJ' ? '21' : geo.uf === 'MG' ? '31' : geo.uf === 'PR' ? '41' : '47'}) 9${randInt(8100, 9988)}-${randInt(1000, 9999)}`;
      const extId = c.origem === 'MERCADO_LIVRE' ? `ML-BUYER-${890100 + i}` : null;

      const res = await qr.query(
        `INSERT INTO clientes (
          nome, documento, email, telefone, cidade, estado, cep, observacoes, origem, external_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.nome, formatDocMask(doc), email, tel, geo.cidade, geo.uf,
          `${geo.cep.slice(0, 5)}-${geo.cep.slice(5)}`,
          c.isPj ? 'Cliente corporativo com renovação anual AVCB / recarga.' : 'Comprador verificado Mercado Livre.',
          c.origem, extId, formatSqlDateTime(daysAgo(c.criadoDiasAtras, 11)),
        ]
      );
      clientes.push({
        id: Number(res.insertId),
        nome: c.nome,
        doc,
        email,
        tel,
        cidade: geo.cidade,
        uf: geo.uf,
        cep: geo.cep,
        ibge: geo.ibge,
        logr: geo.logr,
        bairro: geo.bairro,
        origem: c.origem,
        criadoDiasAtras: c.criadoDiasAtras,
        grupo: c.grupo,
      });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 6. Pedidos + Itens de Pedido (115 pedidos ao longo de 105 dias)
    // ───────────────────────────────────────────────────────────────────────────
    const skusVendaML = ['KIT-PQS-COMPLETO', 'EXT-PQS-4KG', 'EXT-PQS-6KG', 'EXT-AP-10L', 'EXT-CO2-4KG', 'EXT-CO2-6KG', 'SUP-EXT-01', 'PLA-FOTO-01', 'DET-FUM-01', 'SUP-SOLO-INOX'];
    const skusVendaB2B = ['EXT-PQS-4KG', 'EXT-PQS-6KG', 'EXT-AP-10L', 'EXT-CO2-4KG', 'EXT-CO2-6KG', 'EXT-K-6L', 'EXT-ESP-10L', 'KIT-CO2-CPD', 'MAN-INC-15M', 'DET-FUM-01', 'SUP-EXT-01', 'PLA-FOTO-01'];

    interface PedidoCriado {
      id: number;
      codigo: string;
      status: 'Confirmado' | 'Concluido' | 'Cancelado';
      statusEntrega: 'A separar' | 'Pronto p/ despacho' | 'Despachado' | 'Entregue';
      origem: string;
      cliente: ClienteMeta;
      dataPedido: Date;
      valorTotal: number;
      itens: Array<{ idProduto: number; sku: string; nome: string; qtd: number; preco: number; custo: number; subtotal: number; ncm: string; cfop: string; csosn: string }>;
      diasAtras: number;
    }

    const pedidosCriados: PedidoCriado[] = [];
    let seqPedidoDireto = 20260001;
    let seqPedidoMl = 200000845100;

    async function criarPedido(opts: {
      cliente: ClienteMeta;
      diasAtras: number;
      status: 'Confirmado' | 'Concluido' | 'Cancelado';
      statusEntrega: 'A separar' | 'Pronto p/ despacho' | 'Despachado' | 'Entregue';
      prazoDespachoDiasOffset?: number; // negativo = atrasado, 0 = hoje, positivo = futuro
      forcarItens?: Array<{ sku: string; qtd: number }>;
      motivoCancel?: string;
    }): Promise<PedidoCriado> {
      const isMl = opts.cliente.origem === 'MERCADO_LIVRE';
      const origem = isMl ? 'Mercado Livre' : 'Venda Direta';
      const origemDado = isMl ? 'mercado_livre' : 'manual';
      const codigo = isMl ? `MLB-${seqPedidoMl++}` : `PED-${seqPedidoDireto++}`;
      const codigoExterno = isMl ? codigo.replace('MLB-', '') : null;

      const dataPedido = daysAgo(opts.diasAtras, randInt(8, 18), randInt(0, 55));

      // Define itens do pedido (equilibrado entre ML ~58% e B2B Direto ~42% do faturamento)
      let itensSpec = opts.forcarItens;
      if (!itensSpec) {
        const qtdLinhas = isMl ? (rng() < 0.55 ? 1 : 2) : (rng() < 0.6 ? 2 : 3);
        const pool = isMl ? skusVendaML : skusVendaB2B;
        const usados = new Set<string>();
        itensSpec = [];
        for (let k = 0; k < qtdLinhas; k++) {
          let sku = pick(pool);
          let guard = 0;
          while (usados.has(sku) && guard++ < 10) sku = pick(pool);
          usados.add(sku);
          const isAcessorio = sku.startsWith('SUP') || sku.startsWith('PLA');
          const qtd = isMl
            ? (isAcessorio ? randInt(5, 14) : randInt(2, 6))
            : (isAcessorio ? randInt(6, 16) : randInt(2, 5));
          itensSpec.push({ sku, qtd });
        }
      }

      let valorBruto = 0;
      let custoProdutos = 0;
      let totalUnidades = 0;
      const itensDetalhados = itensSpec.map((it) => {
        const prod = produtoMap[it.sku];
        const subtotal = round2(prod.preco * it.qtd);
        valorBruto = round2(valorBruto + subtotal);
        custoProdutos = round2(custoProdutos + prod.custo * it.qtd);
        totalUnidades += it.qtd;
        return {
          idProduto: prod.id,
          sku: prod.sku,
          nome: prod.nome,
          qtd: it.qtd,
          preco: prod.preco,
          custo: prod.custo,
          subtotal,
          ncm: prod.ncm,
          cfop: prod.cfop,
          csosn: prod.csosn,
        };
      });

      const valorDesconto = !isMl && valorBruto >= 2000 ? round2(valorBruto * 0.03) : 0;
      const valorTotal = round2(valorBruto - valorDesconto);

      // Financeiro do pedido
      const tipoAnuncio = isMl ? (rng() < 0.65 ? 'Classico' : 'Premium') : 'Direta';
      const aliqImposto = 6.5;
      const custoImpostos = round2(valorTotal * (aliqImposto / 100));
      const custoEmbalagem = round2(Math.min(45, 5.5 + totalUnidades * 1.8));
      const tarifaMlPct = !isMl ? 0 : (tipoAnuncio === 'Premium' ? 16.5 : 11.5);
      const tarifaMlComissao = round2(valorTotal * (tarifaMlPct / 100));
      const tarifaMlFixa = isMl && valorTotal < 79 ? 6.0 : 0;
      const custoFrete = isMl
        ? round2(24.9 + Math.min(45, totalUnidades * 4.5))
        : (valorTotal >= 2500 ? 0 : round2(35 + totalUnidades * 2.5));
      const custoAds = isMl && rng() < 0.55 ? round2(valorTotal * 0.028) : 0;

      const totalCustosFixos = round2(custoProdutos + custoImpostos + custoEmbalagem);
      const totalTarifas = round2(tarifaMlComissao + tarifaMlFixa + custoFrete + custoAds);
      const lucroLiquido = round2(valorTotal - totalCustosFixos - totalTarifas);
      const margemLiquidaPct = valorTotal > 0 ? round2((lucroLiquido / valorTotal) * 100) : 0;

      // Logística
      const modalidade = isMl
        ? pick(['Coleta', 'Coleta', 'Full', 'Tradicional'])
        : pick(['Logística Própria', 'Transportadora Parceira']);
      const prazoEstimado = modalidade === 'Full' ? 2 : modalidade === 'Coleta' ? 3 : 4;

      let prazoDespacho: Date;
      if (opts.prazoDespachoDiasOffset !== undefined) {
        prazoDespacho = new Date(Date.now() + opts.prazoDespachoDiasOffset * 86400000);
        if (opts.prazoDespachoDiasOffset === 0) prazoDespacho.setHours(23, 30, 0, 0);
      } else {
        prazoDespacho = new Date(dataPedido.getTime() + 24 * 3600 * 1000);
      }

      let dataDespacho: Date | null = null;
      let dataEntregaEfetiva: Date | null = null;
      if (opts.statusEntrega === 'Despachado' || opts.statusEntrega === 'Entregue') {
        dataDespacho = new Date(dataPedido.getTime() + randInt(6, 22) * 3600 * 1000);
      }
      if (opts.statusEntrega === 'Entregue') {
        dataEntregaEfetiva = new Date((dataDespacho || dataPedido).getTime() + randInt(1, prazoEstimado) * 86400000);
      }

      const resPed = await qr.query(
        `INSERT INTO pedidos (
          codigo_pedido, status, cliente_nome, id_cliente, origem, origem_dado, codigo_externo_ml,
          baixa_estoque_realizada, data_pedido, valor_total, exibir_na_entrega, status_entrega,
          prazo_despacho, data_despacho, created_at, updated_at,
          motivo_devolucao, tipo_ocorrencia, detalhe_devolucao, data_devolucao,
          tipo_anuncio, custo_produtos, aliquota_imposto_percentual, custo_impostos, custo_embalagem,
          tarifa_ml_percentual, tarifa_ml_comissao, tarifa_ml_fixa, custo_frete, custo_ads,
          total_custos_fixos, total_tarifas_plataforma, lucro_liquido, margem_liquida_percentual,
          modalidade_envio, prazo_dias_estimado, data_entrega_efetiva,
          destinatario_documento, destinatario_ie, destinatario_cep, destinatario_logradouro,
          destinatario_numero, destinatario_bairro, destinatario_municipio,
          destinatario_codigo_municipio_ibge, destinatario_uf, destinatario_email, valor_desconto
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          1, ?, ?, 1, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?
        )`,
        [
          codigo, opts.status, opts.cliente.nome, opts.cliente.id, origem, origemDado, codigoExterno,
          formatSqlDateTime(dataPedido), valorTotal, opts.statusEntrega,
          formatSqlDateTime(prazoDespacho), dataDespacho ? formatSqlDateTime(dataDespacho) : null,
          formatSqlDateTime(dataPedido), formatSqlDateTime(dataEntregaEfetiva || dataDespacho || dataPedido),
          opts.motivoCancel || null,
          opts.status === 'Cancelado' ? 'Cancelamento' : null,
          opts.motivoCancel ? `Cancelado antes da entrega: ${opts.motivoCancel}` : null,
          opts.status === 'Cancelado' ? formatSqlDateTime(new Date(dataPedido.getTime() + 8 * 3600 * 1000)) : null,
          tipoAnuncio, custoProdutos, aliqImposto, custoImpostos, custoEmbalagem,
          tarifaMlPct, tarifaMlComissao, tarifaMlFixa, custoFrete, custoAds,
          totalCustosFixos, totalTarifas, lucroLiquido, margemLiquidaPct,
          modalidade, prazoEstimado, dataEntregaEfetiva ? formatSqlDateTime(dataEntregaEfetiva) : null,
          opts.cliente.doc, opts.cliente.doc.length === 14 ? 'ISENTO' : null, opts.cliente.cep, opts.cliente.logr,
          String(randInt(80, 2400)), opts.cliente.bairro, opts.cliente.cidade,
          opts.cliente.ibge, opts.cliente.uf, opts.cliente.email, valorDesconto,
        ]
      );
      const idPedido = Number(resPed.insertId);

      for (const it of itensDetalhados) {
        await qr.query(
          `INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_unitario, subtotal)
           VALUES (?, ?, ?, ?, ?)`,
          [idPedido, it.idProduto, it.qtd, it.preco, it.subtotal]
        );
      }

      const pedObj: PedidoCriado = {
        id: idPedido,
        codigo,
        status: opts.status,
        statusEntrega: opts.statusEntrega,
        origem,
        cliente: opts.cliente,
        dataPedido,
        valorTotal,
        itens: itensDetalhados,
        diasAtras: opts.diasAtras,
      };
      pedidosCriados.push(pedObj);
      return pedObj;
    }

    const clientesAtivos = clientes.filter((c) => c.grupo !== 'inativo' && c.grupo !== 'vip_inativo');
    const clientesRecorrentes = clientes.filter((c) => c.grupo === 'recorrente');
    const clientesVipsInativos = clientes.filter((c) => c.grupo === 'vip_inativo');
    const clientesInativos = clientes.filter((c) => c.grupo === 'inativo');
    const clientesNovos = clientes.filter((c) => c.grupo === 'novo');

    // A) Pedidos antigos (70 a 108 dias atrás) — VIPs em risco de churn + Inativos + histórico de recorrentes
    for (const vip of clientesVipsInativos) {
      await criarPedido({
        cliente: vip,
        diasAtras: 96,
        status: 'Concluido',
        statusEntrega: 'Entregue',
        forcarItens: [{ sku: 'EXT-PQS-6KG', qtd: 12 }, { sku: 'EXT-CO2-6KG', qtd: 4 }],
      });
      await criarPedido({
        cliente: vip,
        diasAtras: 72, // > 60 dias sem comprar -> Alerta crítico VIP churn!
        status: 'Concluido',
        statusEntrega: 'Entregue',
        forcarItens: [{ sku: 'KIT-CO2-CPD', qtd: 2 }, { sku: 'MAN-INC-15M', qtd: 4 }],
      });
    }
    for (const inat of clientesInativos) {
      await criarPedido({
        cliente: inat,
        diasAtras: randInt(95, 108),
        status: 'Concluido',
        statusEntrega: 'Entregue',
      });
    }
    for (let i = 0; i < 6; i++) {
      await criarPedido({
        cliente: clientesRecorrentes[i % clientesRecorrentes.length],
        diasAtras: randInt(64, 86),
        status: 'Concluido',
        statusEntrega: 'Entregue',
      });
    }

    // B) Período Anterior (31 a 59 dias atrás): 44 pedidos (~R$ 105k–118k, 62% ML / 38% B2B)
    const clientesMlAnt = clientesAtivos.filter((c) => c.origem === 'MERCADO_LIVRE' && c.criadoDiasAtras >= 32);
    const clientesB2bAnt = clientesAtivos.filter((c) => c.origem === 'PRESENCIAL' && c.criadoDiasAtras >= 32);
    for (let i = 0; i < 44; i++) {
      const usarMl = i % 10 < 6; // 60% ML
      const poolCli = usarMl ? clientesMlAnt : clientesB2bAnt;
      const cli = poolCli[i % poolCli.length];
      const dias = Math.min(cli.criadoDiasAtras - 1, randInt(31, 59));
      const isCancel = i === 12 || i === 33;
      await criarPedido({
        cliente: cli,
        diasAtras: Math.max(31, dias),
        status: isCancel ? 'Cancelado' : 'Concluido',
        statusEntrega: isCancel ? 'A separar' : 'Entregue',
        motivoCancel: isCancel ? 'Desistência do comprador antes da coleta' : undefined,
      });
    }

    // C) Período Atual (0 a 29 dias atrás): 64 pedidos (~R$ 132k–148k -> crescimento real ~+18%!)
    const clientesMlAtivos = clientesAtivos.filter((c) => c.origem === 'MERCADO_LIVRE');
    const clientesB2bAtivos = clientesAtivos.filter((c) => c.origem === 'PRESENCIAL');
    // C.1) 49 Concluídos (dias 4 a 29)
    for (let i = 0; i < 49; i++) {
      let cli: ClienteMeta;
      if (i < clientesNovos.length) {
        cli = clientesNovos[i];
      } else {
        const usarMl = i % 10 < 7; // 70% ML para equilibrar receita ML (~58%) x B2B (~42%)
        const pool = usarMl ? clientesMlAtivos : clientesB2bAtivos;
        cli = pool[i % pool.length];
      }
      const maxDias = Math.max(4, Math.min(29, cli.criadoDiasAtras));
      const dias = randInt(4, maxDias);
      await criarPedido({
        cliente: cli,
        diasAtras: dias,
        status: 'Concluido',
        statusEntrega: 'Entregue',
      });
    }

    // C.2) 3 Cancelados no período atual
    for (let i = 0; i < 3; i++) {
      const cli = clientesAtivos[(i * 5 + 2) % clientesAtivos.length];
      await criarPedido({
        cliente: cli,
        diasAtras: randInt(5, 22),
        status: 'Cancelado',
        statusEntrega: 'A separar',
        motivoCancel: i === 0 ? 'Erro nos dados cadastrais de entrega' : 'Desistência do cliente antes do despacho',
      });
    }

    // C.3) 12 Confirmados em operação logística (dias 0 a 3)
    // 2 atrasados na expedição (prazo -2d e -1d) -> Alertas críticos de postagem!
    await criarPedido({
      cliente: clientes.find((c) => c.origem === 'MERCADO_LIVRE' && c.grupo === 'novo')!,
      diasAtras: 3,
      status: 'Confirmado',
      statusEntrega: 'A separar',
      prazoDespachoDiasOffset: -2,
      forcarItens: [{ sku: 'KIT-PQS-COMPLETO', qtd: 3 }],
    });
    await criarPedido({
      cliente: clientes.find((c) => c.origem === 'PRESENCIAL' && c.grupo === 'recorrente')!,
      diasAtras: 2,
      status: 'Confirmado',
      statusEntrega: 'Pronto p/ despacho',
      prazoDespachoDiasOffset: -1,
      forcarItens: [{ sku: 'EXT-PQS-6KG', qtd: 6 }, { sku: 'PLA-FOTO-01', qtd: 6 }],
    });
    // 2 para postar HOJE -> Alertas de atenção de postagem!
    await criarPedido({
      cliente: clientesNovos[2],
      diasAtras: 1,
      status: 'Confirmado',
      statusEntrega: 'A separar',
      prazoDespachoDiasOffset: 0,
      forcarItens: [{ sku: 'EXT-CO2-4KG', qtd: 2 }, { sku: 'SUP-SOLO-INOX', qtd: 2 }],
    });
    await criarPedido({
      cliente: clientesNovos[5],
      diasAtras: 1,
      status: 'Confirmado',
      statusEntrega: 'Pronto p/ despacho',
      prazoDespachoDiasOffset: 0,
      forcarItens: [{ sku: 'EXT-AP-10L', qtd: 4 }],
    });
    // 2 em preparação no prazo (prazo +1d)
    for (let i = 0; i < 2; i++) {
      await criarPedido({
        cliente: clientesAtivos[(i * 7 + 1) % clientesAtivos.length],
        diasAtras: 0,
        status: 'Confirmado',
        statusEntrega: i === 0 ? 'A separar' : 'Pronto p/ despacho',
        prazoDespachoDiasOffset: 1,
      });
    }
    // 6 Despachados (Em trânsito)
    for (let i = 0; i < 6; i++) {
      await criarPedido({
        cliente: clientesAtivos[(i * 4 + 3) % clientesAtivos.length],
        diasAtras: randInt(1, 3),
        status: 'Confirmado',
        statusEntrega: 'Despachado',
      });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 7. Pedidos de Compra + Itens (26 POs nos últimos 90 dias)
    // ───────────────────────────────────────────────────────────────────────────
    const posConfig = [
      // Histórico 62-88d (3 recebidos)
      { num: 'PC-2026-0071', forn: 'Resil Extintores', emi: 86, prev: 81, rec: 82, status: 'RECEBIDO', itens: [{ sku: 'EXT-PQS-4KG', qtd: 80, preco: 69.5 }, { sku: 'EXT-AP-10L', qtd: 40, preco: 79.0 }] },
      { num: 'PC-2026-0072', forn: 'Bucka Fire Systems', emi: 78, prev: 71, rec: 71, status: 'RECEBIDO', itens: [{ sku: 'EXT-CO2-4KG', qtd: 20, preco: 204.0 }, { sku: 'EXT-CO2-6KG', qtd: 16, preco: 278.0 }] },
      { num: 'PC-2026-0073', forn: 'Extinpel Brasil', emi: 68, prev: 60, rec: 58, status: 'RECEBIDO', itens: [{ sku: 'EXT-PQS-12KG', qtd: 20, preco: 178.0 }, { sku: 'EXT-ESP-10L', qtd: 18, preco: 160.0 }] },

      // Período Anterior 31-59d (10 POs — preços base para variação de custo!)
      { num: 'PC-2026-0074', forn: 'Resil Extintores', emi: 57, prev: 52, rec: 52, status: 'RECEBIDO', itens: [{ sku: 'EXT-PQS-4KG', qtd: 90, preco: 70.0 }, { sku: 'EXT-PQS-6KG', qtd: 50, preco: 91.0 }] },
      { num: 'PC-2026-0075', forn: 'SinalFlex ABNT', emi: 54, prev: 50, rec: 50, status: 'RECEBIDO', itens: [{ sku: 'PLA-FOTO-01', qtd: 300, preco: 4.8 }] },
      { num: 'PC-2026-0076', forn: 'Metalúrgica Lacerda', emi: 51, prev: 45, rec: 45, status: 'RECEBIDO', itens: [{ sku: 'SUP-EXT-01', qtd: 250, preco: 6.5 }, { sku: 'SUP-SOLO-INOX', qtd: 30, preco: 40.5 }] },
      { num: 'PC-2026-0077', forn: 'Bucka Fire Systems', emi: 48, prev: 41, rec: 41, status: 'RECEBIDO', itens: [{ sku: 'EXT-CO2-4KG', qtd: 18, preco: 205.0 }, { sku: 'MAN-INC-15M', qtd: 16, preco: 189.0 }] },
      { num: 'PC-2026-0078', forn: 'Kidde Brasil', emi: 45, prev: 35, rec: 36, status: 'RECEBIDO', itens: [{ sku: 'EXT-K-6L', qtd: 10, preco: 405.0 }, { sku: 'DET-FUM-01', qtd: 45, preco: 42.5 }] },
      { num: 'PC-2026-0079', forn: 'Extinpel Brasil', emi: 43, prev: 35, rec: 32, status: 'RECEBIDO', itens: [{ sku: 'EXT-PQS-6KG', qtd: 40, preco: 94.0 }, { sku: 'EXT-ESP-10L', qtd: 15, preco: 162.0 }] }, // Atraso 3d
      { num: 'PC-2026-0080', forn: 'Resil Extintores', emi: 40, prev: 35, rec: 35, status: 'RECEBIDO', itens: [{ sku: 'EXT-AP-10L', qtd: 50, preco: 80.5 }, { sku: 'EXT-PQS-4KG', qtd: 60, preco: 71.0 }] },
      { num: 'PC-2026-0081', forn: 'Bucka Fire Systems', emi: 37, prev: 30, rec: 30, status: 'RECEBIDO', itens: [{ sku: 'EXT-CO2-6KG', qtd: 15, preco: 285.0 }] },
      { num: 'PC-2026-0082', forn: 'Metalúrgica Lacerda', emi: 34, prev: 28, rec: 28, status: 'RECEBIDO', itens: [{ sku: 'SUP-EXT-01', qtd: 180, preco: 6.7 }] },
      { num: 'PC-2026-0083', forn: 'Extinpel Brasil', emi: 32, prev: 24, rec: 21, status: 'RECEBIDO', itens: [{ sku: 'EXT-PQS-12KG', qtd: 18, preco: 182.0 }] }, // Atraso 3d

      // Período Atual 0-29d (13 POs)
      { num: 'PC-2026-0084', forn: 'Resil Extintores', emi: 27, prev: 22, rec: 22, status: 'RECEBIDO', itens: [{ sku: 'EXT-PQS-4KG', qtd: 100, preco: 72.0 }, { sku: 'EXT-PQS-6KG', qtd: 60, preco: 94.0 }] },
      { num: 'PC-2026-0085', forn: 'Bucka Fire Systems', emi: 25, prev: 18, rec: 18, status: 'RECEBIDO', itens: [{ sku: 'EXT-CO2-4KG', qtd: 16, preco: 230.0 }, { sku: 'EXT-CO2-6KG', qtd: 14, preco: 292.0 }] }, // CO2-4KG +12.2% aumento custo -> Alerta!
      { num: 'PC-2026-0086', forn: 'SinalFlex ABNT', emi: 22, prev: 18, rec: 18, status: 'RECEBIDO', itens: [{ sku: 'PLA-FOTO-01', qtd: 250, preco: 4.9 }] },
      { num: 'PC-2026-0087', forn: 'Extinpel Brasil', emi: 21, prev: 13, rec: 10, status: 'RECEBIDO', itens: [{ sku: 'EXT-ESP-10L', qtd: 16, preco: 168.0 }, { sku: 'EXT-PQS-6KG', qtd: 30, preco: 97.0 }] }, // Atrasado 3d!
      { num: 'PC-2026-0088', forn: 'Kidde Brasil', emi: 18, prev: 8, rec: 9, status: 'RECEBIDO', itens: [{ sku: 'EXT-K-6L', qtd: 10, preco: 415.0 }, { sku: 'DET-FUM-01', qtd: 35, preco: 44.0 }] },
      { num: 'PC-2026-0089', forn: 'Resil Extintores', emi: 15, prev: 10, rec: 10, status: 'RECEBIDO', itens: [{ sku: 'EXT-AP-10L', qtd: 60, preco: 82.0 }, { sku: 'EXT-PQS-4KG', qtd: 70, preco: 72.0 }] },
      { num: 'PC-2026-0090', forn: 'Metalúrgica Lacerda', emi: 12, prev: 6, rec: 6, status: 'RECEBIDO', itens: [{ sku: 'SUP-EXT-01', qtd: 200, preco: 6.8 }, { sku: 'SUP-SOLO-INOX', qtd: 28, preco: 42.0 }] },
      { num: 'PC-2026-0091', forn: 'Extinpel Brasil', emi: 14, prev: 6, rec: 3, status: 'RECEBIDO', itens: [{ sku: 'EXT-ESP-10L', qtd: 12, preco: 169.0 }] }, // Atrasado 3d! (100% atrasos Extinpel no período -> Alerta crítico!)
      { num: 'PC-2026-0092', forn: 'Extinpel Brasil', emi: 13, prev: 5, rec: null, status: 'ATRASADO', itens: [{ sku: 'EXT-PQS-12KG', qtd: 25, preco: 188.0 }] }, // Atrasado em aberto há 5 dias!
      { num: 'PC-2026-0093', forn: 'Bucka Fire Systems', emi: 8, prev: 1, rec: null, status: 'PARCIAL', itens: [{ sku: 'MAN-INC-15M', qtd: 20, preco: 195.0 }, { sku: 'EXT-CO2-6KG', qtd: 12, preco: 294.0 }] },
      { num: 'PC-2026-0094', forn: 'Resil Extintores', emi: 4, prev: -3, rec: null, status: 'ABERTO', itens: [{ sku: 'EXT-PQS-4KG', qtd: 80, preco: 72.0 }, { sku: 'EXT-AP-10L', qtd: 30, preco: 82.0 }] },
      { num: 'PC-2026-0095', forn: 'SinalFlex ABNT', emi: 2, prev: -4, rec: null, status: 'ABERTO', itens: [{ sku: 'PLA-FOTO-01', qtd: 200, preco: 4.9 }] },
      { num: 'PC-2026-0096', forn: 'Metalúrgica Lacerda', emi: 16, prev: 10, rec: null, status: 'CANCELADO', itens: [{ sku: 'SUP-SOLO-INOX', qtd: 15, preco: 45.0 }] },
    ];

    // OBS: DET-FUM-01 e EXT-CO2-4KG estão abaixo do mínimo e SEM PO aberto -> aciona alerta "ruptura_sem_pedido"!
    const poIds: Record<string, number> = {};
    for (const po of posConfig) {
      const subtotalItens = po.itens.reduce((acc, it) => acc + it.qtd * it.preco, 0);
      const frete = subtotalItens >= 6000 ? 0 : 185.0;
      const desconto = subtotalItens >= 10000 ? round2(subtotalItens * 0.02) : 0;
      const total = round2(subtotalItens + frete - desconto);

      const dataEmissao = daysAgo(po.emi, 10);
      const dataPrev = po.prev >= 0 ? daysAgo(po.prev, 12) : daysFromNow(Math.abs(po.prev));
      const dataRec = po.rec !== null ? daysAgo(po.rec, 14) : null;

      const resPo = await qr.query(
        `INSERT INTO pedidos_compra (
          numero_pedido, id_fornecedor, data_emissao, data_previsao_entrega, data_recebimento,
          condicoes_pagamento, status, valor_total, valor_frete, valor_desconto, observacoes, motivo_cancelamento, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          po.num, fornecedorIds[po.forn], formatSqlDateTime(dataEmissao), formatSqlDate(dataPrev),
          dataRec ? formatSqlDateTime(dataRec) : null,
          '28/42 dias DDL', po.status, total, frete, desconto,
          po.status === 'ATRASADO' ? 'Fornecedor notificou atraso na transportadora — cobrança ativa.' : 'Ordem de reposição programada de estoque.',
          po.status === 'CANCELADO' ? 'Substituído por pedido consolidado com melhor condição comercial.' : null,
          formatSqlDateTime(dataEmissao),
        ]
      );
      const idPo = Number(resPo.insertId);
      poIds[po.num] = idPo;

      for (const it of po.itens) {
        const prod = produtoMap[it.sku];
        const qtdEntregue = po.status === 'RECEBIDO' ? it.qtd : (po.status === 'PARCIAL' ? Math.floor(it.qtd / 2) : 0);
        await qr.query(
          `INSERT INTO itens_pedido_compra (
            id_pedido_compra, id_produto, quantidade_pedida, quantidade_entregue, preco_unitario, subtotal, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [idPo, prod.id, it.qtd, qtdEntregue, it.preco, round2(it.qtd * it.preco), formatSqlDateTime(dataEmissao)]
        );
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 8. Movimentações de Estoque (Entradas NF + Saídas Vendas + Ajustes/Perdas)
    // ───────────────────────────────────────────────────────────────────────────
    // Entradas dos pedidos de compra recebidos
    for (const po of posConfig) {
      if (po.status === 'RECEBIDO' && po.rec !== null) {
        const dt = daysAgo(po.rec, 14, 30);
        for (const it of po.itens) {
          const prod = produtoMap[it.sku];
          await qr.query(
            `INSERT INTO movimentacoes_estoque (id_produto, id_usuario, tipo, quantidade, motivo, data_movimentacao)
             VALUES (?, ?, 'Entrada', ?, ?, ?)`,
            [prod.id, idOp2, it.qtd, `Entrada NF Compra ${po.num} (${po.forn})`, formatSqlDateTime(dt)]
          );
        }
      }
    }
    // Saídas dos pedidos válidos (e estorno dos cancelados)
    for (const ped of pedidosCriados) {
      if (ped.diasAtras > 65) continue;
      for (const it of ped.itens) {
        await qr.query(
          `INSERT INTO movimentacoes_estoque (id_produto, id_usuario, tipo, quantidade, motivo, data_movimentacao)
           VALUES (?, ?, 'Saída', ?, ?, ?)`,
          [it.idProduto, idOp1, it.qtd, `Baixa por venda — Pedido ${ped.codigo} (${ped.origem})`, formatSqlDateTime(ped.dataPedido)]
        );
        if (ped.status === 'Cancelado') {
          const dtEstorno = new Date(ped.dataPedido.getTime() + 9 * 3600 * 1000);
          await qr.query(
            `INSERT INTO movimentacoes_estoque (id_produto, id_usuario, tipo, quantidade, motivo, data_movimentacao)
             VALUES (?, ?, 'Entrada', ?, ?, ?)`,
            [it.idProduto, idGestor, it.qtd, `Estorno por cancelamento — Pedido ${ped.codigo}`, formatSqlDateTime(dtEstorno)]
          );
        }
      }
    }
    // Saídas operacionais não-comerciais e balanço físico (Regra de Ouro)
    const movAvulsas = [
      { sku: 'EXT-PQS-4KG', tipo: 'Saída', qtd: 2, motivo: 'Avaria no galpão — casco amassado na movimentação de palete', dias: 19, usr: idOp2 },
      { sku: 'EXT-CO2-4KG', tipo: 'Saída', qtd: 1, motivo: 'Despressurização identificada na inspeção — enviado para recarga', dias: 14, usr: idOp2 },
      { sku: 'SUP-EXT-01', tipo: 'Entrada', qtd: 5, motivo: 'Ajuste de Balanço / Inventário Físico Mensal', dias: 11, usr: idGestor },
      { sku: 'PLA-FOTO-01', tipo: 'Saída', qtd: 4, motivo: 'Ajuste de Balanço / Inventário Físico (unidades riscadas)', dias: 7, usr: idGestor },
    ];
    for (const mv of movAvulsas) {
      await qr.query(
        `INSERT INTO movimentacoes_estoque (id_produto, id_usuario, tipo, quantidade, motivo, data_movimentacao)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [produtoMap[mv.sku].id, mv.usr, mv.tipo, mv.qtd, mv.motivo, formatSqlDateTime(daysAgo(mv.dias, 16))]
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 9. Devoluções e Qualidade (13 devoluções: 7 período atual + 6 anterior)
    // ───────────────────────────────────────────────────────────────────────────
    const pedidosConcluidosAtual = pedidosCriados.filter((p) => p.status === 'Concluido' && p.diasAtras <= 28);
    const pedidosConcluidosAnt = pedidosCriados.filter((p) => p.status === 'Concluido' && p.diasAtras >= 32 && p.diasAtras <= 58);

    const devolucoesSpec = [
      // Período Atual (7 casos)
      { ped: pedidosConcluidosAtual[1], diasAb: 25, diasConc: 22, status: 'CONCLUIDA', res: 'TROCA', frete: 34.9, motivo: 'AVARIA_TRANSPORTE', detalhe: 'Cilindro chegou com amassado na base durante transporte.', dest: 'DESCARTADO' },
      { ped: pedidosConcluidosAtual[5], diasAb: 21, diasConc: 17, status: 'CONCLUIDA', res: 'REEMBOLSO', frete: 29.5, motivo: 'ARREPENDIMENTO', detalhe: 'Cliente comprou capacidade errada para exigência do condomínio.', dest: 'RECUPERADO' },
      { ped: pedidosConcluidosAtual[9], diasAb: 18, diasConc: 14, status: 'CONCLUIDA', res: 'TROCA', frete: 38.0, motivo: 'DEFEITO', detalhe: 'Manômetro apresentou ponteiro abaixo da faixa verde no recebimento.', dest: 'DESCARTADO' },
      { ped: pedidosConcluidosAtual[14], diasAb: 14, diasConc: 10, status: 'CONCLUIDA', res: 'TROCA', frete: 32.0, motivo: 'AVARIA_TRANSPORTE', detalhe: 'Difusor trincado por queda da caixa na transportadora.', dest: 'RECUPERADO' },
      { ped: pedidosConcluidosAtual[18], diasAb: 11, diasConc: null, status: 'ABERTA', res: 'REEMBOLSO', frete: 41.0, motivo: 'AVARIA_TRANSPORTE', detalhe: 'Reclamação aberta no ML aguardando conferência reversa — SLA estourado!', dest: 'EM_AVALIACAO' }, // > 7 dias -> Alerta SLA!
      { ped: pedidosConcluidosAtual[22], diasAb: 5, diasConc: null, status: 'EM_ANALISE', res: 'TROCA', frete: 28.9, motivo: 'PRODUTO_ERRADO', detalhe: 'Enviado suporte de parede no lugar do tripé inox.', dest: 'RECUPERADO' },
      { ped: pedidosConcluidosAtual[25], diasAb: 8, diasConc: 6, status: 'RECUSADA', res: 'REEMBOLSO', frete: 0.0, motivo: 'DEFEITO', detalhe: 'Lacre INMETRO violado e cilindro acionado pelo comprador (mau uso comprovado).', dest: 'RECUPERADO' },

      // Período Anterior (6 casos)
      { ped: pedidosConcluidosAnt[1], diasAb: 54, diasConc: 49, status: 'CONCLUIDA', res: 'REEMBOLSO', frete: 31.0, motivo: 'AVARIA_TRANSPORTE', detalhe: 'Embalagem rasgada e pintura arranhada no transporte.', dest: 'RECUPERADO' },
      { ped: pedidosConcluidosAnt[6], diasAb: 50, diasConc: 45, status: 'CONCLUIDA', res: 'TROCA', frete: 35.0, motivo: 'DEFEITO', detalhe: 'Válvula com vazamento lento identificado na entrega.', dest: 'DESCARTADO' },
      { ped: pedidosConcluidosAnt[12], diasAb: 45, diasConc: 41, status: 'CONCLUIDA', res: 'REEMBOLSO', frete: 27.5, motivo: 'ARREPENDIMENTO', detalhe: 'Cancelamento dentro dos 7 dias do CDC.', dest: 'RECUPERADO' },
      { ped: pedidosConcluidosAnt[19], diasAb: 41, diasConc: 37, status: 'CONCLUIDA', res: 'TROCA', frete: 33.9, motivo: 'AVARIA_TRANSPORTE', detalhe: 'Caixa molhada em centro de distribuição.', dest: 'RECUPERADO' },
      { ped: pedidosConcluidosAnt[24], diasAb: 37, diasConc: 33, status: 'CONCLUIDA', res: 'REEMBOLSO', frete: 29.0, motivo: 'DIVERGENCIA_DESCRICAO', detalhe: 'Cliente esperava suporte incluso no anúncio unitário.', dest: 'RECUPERADO' },
      { ped: pedidosConcluidosAnt[30], diasAb: 34, diasConc: 31, status: 'CONCLUIDA', res: 'TROCA', frete: 36.0, motivo: 'DEFEITO', detalhe: 'Mangueira do extintor com rosca espanada.', dest: 'DESCARTADO' },
    ];

    let seqDev = 1;
    for (const dv of devolucoesSpec) {
      if (!dv.ped || !dv.ped.itens.length) continue;
      const item = dv.ped.itens[0];
      const qtdDev = 1;
      const subtotalItem = round2(item.preco * qtdDev);
      const valorReembolso = dv.res === 'REEMBOLSO' && dv.status !== 'RECUSADA' ? subtotalItem : 0;
      const custoPerda = dv.dest === 'DESCARTADO' ? round2(item.custo * qtdDev) : 0;
      const dtAb = daysAgo(dv.diasAb, 11);
      const dtConc = dv.diasConc !== null ? daysAgo(dv.diasConc, 16) : null;

      const resDev = await qr.query(
        `INSERT INTO devolucoes (
          codigo_devolucao, id_pedido, id_cliente, status, tipo_resolucao,
          custo_frete_reverso, valor_total_reembolso, data_abertura, data_conclusao,
          prazo_limite_dias, observacoes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 7, ?, ?)`,
        [
          `DEV-2026-${String(seqDev++).padStart(4, '0')}`, dv.ped.id, dv.ped.cliente.id,
          dv.status, dv.res, dv.frete, valorReembolso,
          formatSqlDateTime(dtAb), dtConc ? formatSqlDateTime(dtConc) : null,
          dv.detalhe, formatSqlDateTime(dtAb),
        ]
      );
      const idDev = Number(resDev.insertId);
      await qr.query(
        `INSERT INTO itens_devolucao (
          id_devolucao, id_produto, quantidade, valor_unitario, subtotal,
          motivo, detalhe_motivo, destino_item, custo_perda_item, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idDev, item.idProduto, qtdDev, item.preco, subtotalItem,
          dv.motivo, dv.detalhe, dv.dest, custoPerda, formatSqlDateTime(dtAb),
        ]
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 10. Notas Fiscais Eletrônicas (NF-e reais para Período Atual e Anterior)
    // ───────────────────────────────────────────────────────────────────────────
    const emitenteSnap = {
      xNome: 'RezFire Equipamentos Contra Incendio Ltda',
      xFant: 'RezFire',
      CNPJ: emitenteCnpj,
      IE: '110042490114',
      CRT: '1',
      UF: 'SP',
      xMun: 'Sao Paulo',
    };

    // Seleciona TODOS os pedidos faturáveis (incluindo histórico > 60d para que apenas 3 pedidos fiquem sem NF-e!)
    const pedidosParaFaturar = [...pedidosCriados]
      .sort((a, b) => a.dataPedido.getTime() - b.dataPedido.getTime());

    // Marca exatamente 3 pedidos recentes (dias 2 a 5, status Confirmado/Concluido) como SEM NF-e
    const semNfeIds = new Set<number>();
    for (const p of [...pedidosParaFaturar].reverse()) {
      if ((p.status === 'Confirmado' || p.status === 'Concluido') && p.diasAtras >= 2 && p.diasAtras <= 5 && semNfeIds.size < 3) {
        semNfeIds.add(p.id);
      }
    }

    let numNfe = 1010;
    let rejeitadasAtualCount = 0;
    let canceladasAtualCount = 0;
    let cceCount = 0;

    for (const p of pedidosParaFaturar) {
      if (semNfeIds.has(p.id)) continue;

      const isAtual = p.diasAtras <= 29;
      let statusNf: 'autorizada' | 'cancelada' | 'rejeitada' | 'em_processamento' = 'autorizada';
      let codSefaz = '100';
      let motSefaz = 'Autorizado o uso da NF-e';
      let msgAmigavel = 'NF-e autorizada pela SEFAZ-SP.';
      let justCancel: string | null = null;

      if (p.status === 'Cancelado') {
        statusNf = 'cancelada';
        codSefaz = '135';
        motSefaz = 'Evento registrado e vinculado a NF-e (Cancelamento)';
        justCancel = p.diasAtras % 2 === 0
          ? 'Cancelamento homologado: Desistência da compra pelo cliente antes do despacho'
          : 'Cancelamento homologado: Erro nos dados cadastrais de entrega do destinatário';
        if (isAtual) canceladasAtualCount++;
      } else if (isAtual && rejeitadasAtualCount < 2 && p.diasAtras >= 3 && p.diasAtras <= 14) {
        statusNf = 'rejeitada';
        rejeitadasAtualCount++;
        if (rejeitadasAtualCount === 1) {
          codSefaz = '204';
          motSefaz = `Rejeição 204: Duplicidade de NF-e [nNF: ${numNfe}, nRec: 35100048921]`;
          msgAmigavel = 'Número de NF-e já utilizado anteriormente na SEFAZ. Ajuste a numeração e retransmita.';
        } else {
          codSefaz = '539';
          motSefaz = 'Rejeição 539: Duplicidade de NF-e com diferença na Chave de Acesso';
          msgAmigavel = 'Já existe NF-e autorizada com este número e chave diferente.';
        }
      } else if (!isAtual && numNfe === 1044) {
        statusNf = 'rejeitada';
        codSefaz = '778';
        motSefaz = 'Rejeição 778: Informado NCM inexistente na tabela da SEFAZ';
        msgAmigavel = 'Verifique o NCM do produto antes de reenviar.';
      } else if (isAtual && p.diasAtras === 0 && p.statusEntrega === 'A separar') {
        statusNf = 'em_processamento';
        codSefaz = '105';
        motSefaz = 'Lote em processamento na SEFAZ';
        msgAmigavel = 'Aguardando retorno assíncrono do lote na SEFAZ.';
      }

      // Pula números 1040 e 1085 para criar 2 inutilizações reais!
      if (numNfe === 1040 || numNfe === 1085) {
        numNfe++;
      }

      const numeroAtual = numNfe++;
      const dtEmissao = new Date(p.dataPedido.getTime() + randInt(25, 195) * 60000);
      const dtAutorizacao = statusNf === 'autorizada' || statusNf === 'cancelada'
        ? new Date(dtEmissao.getTime() + randInt(1, 4) * 60000)
        : null;
      const chave = gerarChaveNfe('35', dtEmissao, emitenteCnpj, 1, numeroAtual);
      const protocolo = dtAutorizacao ? `13526${String(numeroAtual).padStart(10, '0')}` : null;
      const recibo = `351000${String(numeroAtual).padStart(9, '0')}`;

      const vTotTrib = round2(p.valorTotal * 0.065);
      const vICMS = round2(vTotTrib * 0.45);
      const vPIS = round2(vTotTrib * 0.12);
      const vCOFINS = round2(vTotTrib * 0.28);
      const vSimples = round2(vTotTrib - vICMS - vPIS - vCOFINS);

      const destSnap = {
        xNome: p.cliente.nome,
        [p.cliente.doc.length === 14 ? 'CNPJ' : 'CPF']: p.cliente.doc,
        UF: p.cliente.uf,
        xMun: p.cliente.cidade,
        CEP: p.cliente.cep,
        email: p.cliente.email,
      };
      const totaisSnap = {
        vProd: p.valorTotal,
        vNF: p.valorTotal,
        vTotTrib,
        vICMS,
        vPIS,
        vCOFINS,
        vSimples,
      };
      const impostosSnap = {
        regime: 'Simples Nacional',
        aliquota_efetiva_pct: 6.5,
        valor_aproximado_tributos: vTotTrib,
      };

      const temCce = statusNf === 'autorizada' && isAtual && cceCount < 2 && p.diasAtras >= 7;
      if (temCce) cceCount++;

      const resNf = await qr.query(
        `INSERT INTO notas_fiscais (
          id_pedido, ambiente, serie, numero, chave_acesso, status, protocolo_autorizacao,
          emitente_snapshot, destinatario_snapshot, totais_snapshot, impostos_snapshot,
          assinatura_valida, assinada_em, assinada_por_certificado_serial, versao_layout,
          valor_total, emitida_em, ultimo_codigo_sefaz, ultimo_motivo_sefaz, ultima_mensagem_amigavel,
          numero_recibo, autorizada_em, tentativas_envio, ultima_tentativa_em,
          codigo_pedido_snapshot, guarda_legal_ate, danfe_gerado_em,
          cancelada_em, protocolo_cancelamento, justificativa_cancelamento,
          total_cartas_correcao, ultima_carta_correcao_em, created_at, updated_at
        ) VALUES (
          ?, 'homologacao', 1, ?, ?, ?, ?,
          ?, ?, ?, ?,
          1, ?, '7A41F902B33C8E10', '4.00',
          ?, ?, ?, ?, ?,
          ?, ?, 1, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?
        )`,
        [
          p.id, numeroAtual, chave, statusNf, protocolo,
          JSON.stringify(emitenteSnap), JSON.stringify(destSnap), JSON.stringify(totaisSnap), JSON.stringify(impostosSnap),
          formatSqlDateTime(dtEmissao),
          p.valorTotal, formatSqlDateTime(dtEmissao), codSefaz, motSefaz, msgAmigavel,
          recibo, dtAutorizacao ? formatSqlDateTime(dtAutorizacao) : null, formatSqlDateTime(dtEmissao),
          p.codigo, formatSqlDate(daysFromNow(1825)), dtAutorizacao ? formatSqlDateTime(dtAutorizacao) : null,
          statusNf === 'cancelada' ? formatSqlDateTime(new Date(dtEmissao.getTime() + 4 * 3600000)) : null,
          statusNf === 'cancelada' ? `13526C${String(numeroAtual).padStart(9, '0')}` : null,
          justCancel,
          temCce ? 1 : 0, temCce ? formatSqlDateTime(new Date(dtEmissao.getTime() + 24 * 3600000)) : null,
          formatSqlDateTime(dtEmissao), formatSqlDateTime(dtAutorizacao || dtEmissao),
        ]
      );
      const idNf = Number(resNf.insertId);

      // Itens da NF-e
      for (const it of p.itens) {
        await qr.query(
          `INSERT INTO notas_fiscais_itens (
            id_nota_fiscal, id_produto, sku_snapshot, nome_snapshot,
            ncm_snapshot, cfop_snapshot, origem_snapshot, cst_csosn_snapshot, unidade_snapshot,
            quantidade, valor_unitario, valor_total
          ) VALUES (?, ?, ?, ?, ?, ?, '0', ?, 'UN', ?, ?, ?)`,
          [idNf, it.idProduto, it.sku, it.nome, it.ncm, it.cfop, it.csosn, it.qtd, it.preco, it.subtotal]
        );
      }

      // Log de transmissão SEFAZ
      await qr.query(
        `INSERT INTO notas_fiscais_transmissoes (
          id_nota_fiscal, id_usuario, tipo_operacao, modo_transporte, ambiente, tentativa_numero,
          sucesso_comunicacao, resultado, http_status, codigo_sefaz, motivo_sefaz, mensagem_amigavel,
          numero_recibo, protocolo, chave_acesso, duracao_ms, created_at
        ) VALUES (?, ?, 'autorizacao', 'simulado', 'homologacao', 1, 1, ?, 200, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idNf, idGestor, statusNf === 'cancelada' ? 'autorizada' : statusNf,
          codSefaz, motSefaz, msgAmigavel, recibo, protocolo, chave, randInt(310, 980), formatSqlDateTime(dtEmissao),
        ]
      );

      // Eventos de Cancelamento ou Carta de Correção
      if (statusNf === 'cancelada') {
        const dtEv = new Date(dtEmissao.getTime() + 4 * 3600000);
        await qr.query(
          `INSERT INTO notas_fiscais_eventos (
            id_nota_fiscal, id_usuario, tipo_evento, codigo_tipo_evento, sequencia,
            ambiente, modo_transporte, status, descricao_evento, codigo_sefaz, motivo_sefaz,
            mensagem_amigavel, protocolo_evento, data_evento, created_at
          ) VALUES (?, ?, 'cancelamento', '110111', 1, 'homologacao', 'simulado', 'registrado', ?, '135', 'Evento registrado e vinculado a NF-e', 'Cancelamento homologado.', ?, ?, ?)`,
          [idNf, idGestor, justCancel, `13526C${String(numeroAtual).padStart(9, '0')}`, formatSqlDateTime(dtEv), formatSqlDateTime(dtEv)]
        );
      }
      if (temCce) {
        const dtEv = new Date(dtEmissao.getTime() + 24 * 3600000);
        await qr.query(
          `INSERT INTO notas_fiscais_eventos (
            id_nota_fiscal, id_usuario, tipo_evento, codigo_tipo_evento, sequencia,
            ambiente, modo_transporte, status, descricao_evento, codigo_sefaz, motivo_sefaz,
            mensagem_amigavel, protocolo_evento, data_evento, created_at
          ) VALUES (?, ?, 'carta_correcao', '110110', 1, 'homologacao', 'simulado', 'registrado', 'Correção de dados complementares de transportadora e volume de despacho.', '135', 'Evento registrado e vinculado a NF-e', 'CC-e registrada na SEFAZ.', ?, ?, ?)`,
          [idNf, idGestor, `13526E${String(numeroAtual).padStart(9, '0')}`, formatSqlDateTime(dtEv), formatSqlDateTime(dtEv)]
        );
      }
    }

    // 2 Inutilizações reais (1 no período anterior, 1 no período atual)
    await qr.query(
      `INSERT INTO notas_fiscais_inutilizacoes (
        id_usuario, ambiente, modo_transporte, uf, ano, cnpj, serie, numero_inicial, numero_final,
        justificativa, status, codigo_sefaz, motivo_sefaz, mensagem_amigavel, protocolo, created_at
      ) VALUES
        (?, 'homologacao', 'simulado', 'SP', '26', ?, 1, 1040, 1040, 'Quebra de sequência numérica por falha temporária de conexão ERP', 'autorizada', '102', 'Inutilização de número homologado', 'Faixa 1040 inutilizada com sucesso.', '135260000001040', ?),
        (?, 'homologacao', 'simulado', 'SP', '26', ?, 1, 1085, 1085, 'Salto de numeração por reinício de fila de emissão fiscal', 'autorizada', '102', 'Inutilização de número homologado', 'Faixa 1085 inutilizada com sucesso.', '135260000001085', ?)`,
      [idGestor, emitenteCnpj, formatSqlDateTime(daysAgo(41, 15)), idGestor, emitenteCnpj, formatSqlDateTime(daysAgo(12, 16))]
    );

    // Atualiza proximo_numero_nfe no emitente
    await qr.query(`UPDATE emitente_fiscal SET proximo_numero_nfe = ?`, [numNfe]);

    // ───────────────────────────────────────────────────────────────────────────
    // 11. Anúncios Mercado Livre + Vínculos + Ocorrências de Queda + Mídias
    // ───────────────────────────────────────────────────────────────────────────
    const anunciosSeed = [
      { mlId: 'MLB-3928174010', sku: 'EXT-PQS-4KG', titulo: 'Extintor De Incêndio Pó Químico ABC 4kg Selo Inmetro Novo', preco: 149.9, status: 'Ativo', disp: 110, vend: 312, visitas: 4820 },
      { mlId: 'MLB-4019283741', sku: 'KIT-PQS-COMPLETO', titulo: 'Kit Completo Extintor ABC 4kg + Suporte Parede + Placa ABNT', preco: 169.9, status: 'Ativo', disp: 105, vend: 428, visitas: 6150 },
      { mlId: 'MLB-3849201920', sku: 'EXT-PQS-6KG', titulo: 'Extintor Pó Químico Seco ABC 6kg Industrial Alta Capacidade', preco: 189.9, status: 'Ativo', disp: 80, vend: 194, visitas: 2940 },
      { mlId: 'MLB-3740192831', sku: 'EXT-AP-10L', titulo: 'Extintor Água Pressurizada 10 Litros AP 2A Inmetro Condomínio', preco: 159.9, status: 'Ativo', disp: 60, vend: 158, visitas: 2310 },
      { mlId: 'MLB-2894012201', sku: 'EXT-CO2-4KG', titulo: 'Extintor CO2 4kg Dióxido De Carbono Painel Elétrico E TI', preco: 429.0, status: 'Rebaixado', disp: 8, vend: 89, visitas: 1620 }, // Rebaixado -> Queda!
      { mlId: 'MLB-4102938475', sku: 'KIT-CO2-CPD', titulo: 'Kit CPD & Servidor: 2x Extintores CO2 6kg + 2x Placas CO2', preco: 1089.0, status: 'Ativo', disp: 10, vend: 47, visitas: 1120 },
      { mlId: 'MLB-3519084412', sku: 'EXT-PQS-12KG', titulo: 'Extintor Industrial Pó Químico ABC 12kg Postos E Galpões', preco: 349.0, status: 'Pausado', disp: 0, vend: 74, visitas: 1380 }, // Pausado por ruptura!
      { mlId: 'MLB-4210983301', sku: 'EXT-K-6L', titulo: 'Extintor Classe K 6L Cozinha Industrial Restaurantes Inmetro', preco: 769.0, status: 'Ativo', disp: 8, vend: 36, visitas: 890 },
      { mlId: 'MLB-4311892204', sku: 'DET-FUM-01', titulo: 'Detector Óptico De Fumaça Autônomo Sirene 85dB Bateria 9V', preco: 94.9, status: 'Ativo', disp: 24, vend: 265, visitas: 3490 }, // Divergência: ML 24 > Estoque 16!
      { mlId: 'MLB-4410229876', sku: 'SUP-EXT-01', titulo: 'Suporte De Parede Universal Reforçado Para Extintor De Incêndio', preco: 19.9, status: 'Ativo', disp: 250, vend: 510, visitas: 5120 },
      { mlId: 'MLB-4510338765', sku: 'SUP-SOLO-INOX', titulo: 'Suporte De Solo Tripé Inox Escovado Para Extintor 4kg A 10L', preco: 94.9, status: 'Ativo', disp: 35, vend: 124, visitas: 1950 },
      { mlId: 'MLB-4610447654', sku: 'PLA-FOTO-01', titulo: 'Placa Sinalização Extintor Fotoluminescente ABNT NBR 13434', preco: 15.9, status: 'Ativo', disp: 240, vend: 640, visitas: 4780 },
    ];

    const anuncioIds: Record<string, number> = {};
    for (const an of anunciosSeed) {
      const resAn = await qr.query(
        `INSERT INTO anuncios_ml (
          id_conexao, ml_item_id, origem_dado, codigo_externo_ml, titulo, preco, status,
          quantidade_disponivel, quantidade_vendida, visitas, url, ultima_sincronizacao, created_at
        ) VALUES (?, ?, 'mercado_livre', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idConexaoMl, an.mlId, an.mlId, an.titulo, an.preco, an.status,
          an.disp, an.vend, an.visitas, `https://produto.mercadolivre.com.br/${an.mlId}`,
          formatSqlDateTime(daysAgo(0, 18)), formatSqlDateTime(daysAgo(120)),
        ]
      );
      const idAn = Number(resAn.insertId);
      anuncioIds[an.mlId] = idAn;

      await qr.query(
        `INSERT INTO produto_anuncio (id_produto, id_anuncio, quantidade_anunciada) VALUES (?, ?, 1)`,
        [produtoMap[an.sku].id, idAn]
      );
    }

    // Ocorrências profissionais para gráfico Faturamento x Quedas de Anúncio
    const ocorrenciasSeed = [
      { mlId: 'MLB-3928174010', tipo: 'Pausa por Estoque', titulo: 'Anúncio pausado automaticamente (reposição em trânsito)', detalhe: 'Saldo ML zerou durante pico de vendas; reativado após chegada da NF PC-2026-0084.', dias: 22, autor: 'Sincronizador ML (Automático)' },
      { mlId: 'MLB-3928174010', tipo: 'Reativação', titulo: 'Anúncio reativado com novo lote FEFO', detalhe: 'Estoque reabastecido com 100 unidades do lote LT-PQS4-26A.', dias: 19, autor: 'Gestor RezFire' },
      { mlId: 'MLB-3849201920', tipo: 'Pausa por Reclamação / Moderação', titulo: 'Anúncio moderado para conferência de ficha técnica INMETRO', detalhe: 'Mercado Livre solicitou atualização do número de registro INMETRO na ficha técnica.', dias: 14, autor: 'Moderação Mercado Livre' },
      { mlId: 'MLB-3849201920', tipo: 'Reativação', titulo: 'Moderação aprovada — anúncio reativado', detalhe: 'Certificado INMETRO 003181/2023 validado e anúncio restaurado.', dias: 11, autor: 'Gestor RezFire' },
      { mlId: 'MLB-3519084412', tipo: 'Pausa por Estoque', titulo: 'Anúncio pausado por ruptura total (EXT-PQS-12KG)', detalhe: 'Última unidade vendida; aguardando entrega do pedido atrasado PC-2026-0092 (Extinpel).', dias: 5, autor: 'Sincronizador ML (Automático)' },
      { mlId: 'MLB-2894012201', tipo: 'Rebaixado', titulo: 'Exposição reduzida por revisão de categoria técnica', detalhe: 'Anúncio de CO2 4kg rebaixado por pendência de foto do selo INMETRO atualizado.', dias: 3, autor: 'Moderação Mercado Livre' },
    ];
    for (const oc of ocorrenciasSeed) {
      await qr.query(
        `INSERT INTO ocorrencias_anuncio (id_anuncio, tipo_evento, titulo, detalhe, autor, data_ocorrencia, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [anuncioIds[oc.mlId], oc.tipo, oc.titulo, oc.detalhe, oc.autor, formatSqlDateTime(daysAgo(oc.dias, 13)), formatSqlDateTime(daysAgo(oc.dias, 13))]
      );
    }

    // Mídias e Eventos ML
    await qr.query(
      `INSERT INTO midias_anuncio (id_anuncio, tipo, rotulo, url, ordem) VALUES
        (?, 'FOTO', 'Foto Principal — Extintor ABC 4kg + Selo INMETRO', 'https://cdn.rezfire.com.br/img/ext-pqs-4kg-front.jpg', 1),
        (?, 'FOTO', 'Detalhe Manômetro Faixa Verde e Lacre', 'https://cdn.rezfire.com.br/img/ext-pqs-4kg-manometro.jpg', 2),
        (?, 'FOTO', 'Kit Completo Montado com Suporte e Placa', 'https://cdn.rezfire.com.br/img/kit-pqs-completo.jpg', 1),
        (?, 'VIDEO', 'Demonstração de Instalação ABNT NBR 12693', 'https://cdn.rezfire.com.br/vid/instalacao-extintor.mp4', 2)`,
      [anuncioIds['MLB-3928174010'], anuncioIds['MLB-3928174010'], anuncioIds['MLB-4019283741'], anuncioIds['MLB-4019283741']]
    );

    await qr.query(
      `INSERT INTO eventos_mercado_livre (id_evento_ml, topic, resource, payload, status, tentativas, created_at) VALUES
        ('EVT-ML-901821', 'orders_v2', '/orders/200000845140', '{"status":"paid"}', 'PROCESSADO', 1, ?),
        ('EVT-ML-901822', 'shipments', '/shipments/4391028371', '{"substatus":"ready_to_print"}', 'PROCESSADO', 1, ?),
        ('EVT-ML-901823', 'items', '/items/MLB-3519084412', '{"status":"paused"}', 'PROCESSADO', 1, ?),
        ('EVT-ML-901824', 'questions', '/questions/130948271', '{"text":"Tem validade de 5 anos?"}', 'PROCESSADO', 1, ?)`,
      [formatSqlDateTime(daysAgo(2, 11)), formatSqlDateTime(daysAgo(1, 15)), formatSqlDateTime(daysAgo(1, 9)), formatSqlDateTime(daysAgo(0, 14))]
    );

    // ───────────────────────────────────────────────────────────────────────────
    // 12. Lançamentos Financeiros (38 lançamentos PJ x PF nos últimos 60 dias)
    // ───────────────────────────────────────────────────────────────────────────
    const lancamentosSeed = [
      // Período Atual (0-29d) — Empresa (PJ) Receitas
      { desc: 'Repasse Mercado Pago — Liquidação Semanal #44', val: 21450.0, tipo: 'Receita', clas: 'Empresa', cat: 'Vendas Mercado Livre', dias: 26 },
      { desc: 'Recebimento Boletos/PIX — Carteira B2B Condomínios', val: 14820.0, tipo: 'Receita', clas: 'Empresa', cat: 'Vendas Diretas B2B', dias: 23 },
      { desc: 'Repasse Mercado Pago — Liquidação Semanal #45', val: 23180.0, tipo: 'Receita', clas: 'Empresa', cat: 'Vendas Mercado Livre', dias: 19 },
      { desc: 'Recebimento NF-e Faturadas — Indústrias & Postos', val: 18640.0, tipo: 'Receita', clas: 'Empresa', cat: 'Vendas Diretas B2B', dias: 15 },
      { desc: 'Repasse Mercado Pago — Liquidação Semanal #46', val: 20890.0, tipo: 'Receita', clas: 'Empresa', cat: 'Vendas Mercado Livre', dias: 12 },
      { desc: 'Recebimento PIX Venda Corporativa — Contratos AVCB', val: 16250.0, tipo: 'Receita', clas: 'Empresa', cat: 'Vendas Diretas B2B', dias: 7 },
      { desc: 'Repasse Mercado Pago — Liquidação Semanal #47', val: 19740.0, tipo: 'Receita', clas: 'Empresa', cat: 'Vendas Mercado Livre', dias: 3 },

      // Período Atual (0-29d) — Empresa (PJ) Despesas
      { desc: 'Aluguel e Condomínio Galpão Logístico Mooca (380m²)', val: 4800.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Infraestrutura / Aluguel', dias: 25 },
      { desc: 'Folha de Pagamento e Encargos — Equipe Armazém/Expedição', val: 8450.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Folha de Pagamento', dias: 24 },
      { desc: 'Guia DAS Simples Nacional — Competência Mensal', val: 7980.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Impostos / Simples Nacional', dias: 19 },
      { desc: 'Pagamento Fornecedor Resil Extintores — Parcela 1/3', val: 18600.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Fornecedores / Mercadorias', dias: 18 },
      { desc: 'Pagamento Fornecedor Bucka Fire Systems — CO2/Mangueiras', val: 9420.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Fornecedores / Mercadorias', dias: 16 },
      { desc: 'Fatura JadLog / Transportadoras Parceiras (Coletas B2B)', val: 4120.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Logística / Frete', dias: 14 },
      { desc: 'Caixas Reforçadas, Plástico Bolha e Fitas Gomadas', val: 1890.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Insumos / Embalagem', dias: 13 },
      { desc: 'Campanhas Mercado Ads — Impulsionamento Linha ABC/CO2', val: 2350.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Marketing / Ads', dias: 11 },
      { desc: 'Lacres, Anéis INMETRO e Taxa de Auditoria Técnica', val: 1150.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Certificação / Inmetro', dias: 9 },
      { desc: 'Energia Elétrica, Fibra Óptica e Licenças de Software', val: 1120.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Utilidades / Sistemas', dias: 8 },
      { desc: 'Honorários Contabilidade Mensal e Assessoria Fiscal', val: 1350.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Serviços Contábeis', dias: 6 },
      { desc: 'Pró-labore Mensal do Sócio Gestor (Retirada PJ -> PF)', val: 8500.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Pró-labore / Retiradas', dias: 5 },
      { desc: 'Pagamento Fornecedor Kidde Brasil — Linha Classe K', val: 5690.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Fornecedores / Mercadorias', dias: 4 },

      // Período Atual (0-29d) — Pessoal (PF) Segregado
      { desc: 'Recebimento de Pró-labore Mensal (Crédito PF)', val: 8500.0, tipo: 'Receita', clas: 'Pessoal', cat: 'Pró-labore / Renda', dias: 5 },
      { desc: 'Aluguel Residencial do Sócio Gestor', val: 2600.0, tipo: 'Despesa', clas: 'Pessoal', cat: 'Moradia Pessoal', dias: 21 },
      { desc: 'Plano de Saúde Familiar', val: 1450.0, tipo: 'Despesa', clas: 'Pessoal', cat: 'Saúde Pessoal', dias: 17 },
      { desc: 'Supermercado e Despesas Domésticas', val: 1840.0, tipo: 'Despesa', clas: 'Pessoal', cat: 'Alimentação Pessoal', dias: 10 },
      { desc: 'Mensalidade Escolar / Educação', val: 1120.0, tipo: 'Despesa', clas: 'Pessoal', cat: 'Educação Pessoal', dias: 7 },

      // Período Anterior (31-58d) — Histórico para filtros 60d/90d
      { desc: 'Repasse Mercado Pago — Liquidação Quinzena 1', val: 36800.0, tipo: 'Receita', clas: 'Empresa', cat: 'Vendas Mercado Livre', dias: 52 },
      { desc: 'Recebimento Carteira B2B — Mês Anterior', val: 39400.0, tipo: 'Receita', clas: 'Empresa', cat: 'Vendas Diretas B2B', dias: 45 },
      { desc: 'Repasse Mercado Pago — Liquidação Quinzena 2', val: 38200.0, tipo: 'Receita', clas: 'Empresa', cat: 'Vendas Mercado Livre', dias: 35 },
      { desc: 'Aluguel Galpão Mooca — Mês Anterior', val: 4800.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Infraestrutura / Aluguel', dias: 55 },
      { desc: 'Folha de Pagamento Equipe — Mês Anterior', val: 8450.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Folha de Pagamento', dias: 54 },
      { desc: 'Guia DAS Simples Nacional — Mês Anterior', val: 7120.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Impostos / Simples Nacional', dias: 49 },
      { desc: 'Compras de Reposição Fornecedores — Mês Anterior', val: 31400.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Fornecedores / Mercadorias', dias: 42 },
      { desc: 'Pró-labore Sócio Gestor — Mês Anterior', val: 8500.0, tipo: 'Despesa', clas: 'Empresa', cat: 'Pró-labore / Retiradas', dias: 35 },
      { desc: 'Despesas Pessoais Consolidadas — Mês Anterior', val: 6750.0, tipo: 'Despesa', clas: 'Pessoal', cat: 'Despesa Pessoal', dias: 38 },
    ];

    for (const lf of lancamentosSeed) {
      await qr.query(
        `INSERT INTO lancamentos_financeiros (
          descricao, valor, tipo, classificacao, categoria, data_competencia, observacoes, id_usuario, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          lf.desc, lf.val, lf.tipo, lf.clas, lf.cat,
          formatSqlDate(daysAgo(lf.dias)),
          lf.clas === 'Empresa' ? 'Lançamento contábil corporativo PJ.' : 'Lançamento estritamente pessoal PF (segregado).',
          idGestor, formatSqlDateTime(daysAgo(lf.dias, 10)),
        ]
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 13. Inspeções de Qualidade (12 registros reais)
    // ───────────────────────────────────────────────────────────────────────────
    const inspecoesSeed = [
      { sku: 'EXT-PQS-4KG', tipo: 'Entrada', res: 'Aprovado', tot: 100, apr: 100, rep: 0, mot: null, dest: null, obs: 'Remessa PC-2026-0084 100% conforme. Manômetros na faixa verde e lacres íntegros.', dias: 22 },
      { sku: 'EXT-PQS-6KG', tipo: 'Entrada', res: 'Aprovado', tot: 60, apr: 60, rep: 0, mot: null, dest: null, obs: 'Conferência de lote Resil sem avarias de pintura ou válvulas.', dias: 22 },
      { sku: 'EXT-CO2-4KG', tipo: 'Entrada', res: 'Aprovado Parcial', tot: 16, apr: 15, rep: 1, mot: '1 cilindro com leve avaria na rosca do difusor.', dest: 'Devolucao Fornecedor', obs: '15 unidades liberadas ao estoque; 1 unidade devolvida à Bucka.', dias: 18 },
      { sku: 'EXT-ESP-10L', tipo: 'Entrada', res: 'Aprovado Parcial', tot: 16, apr: 14, rep: 2, mot: 'Manômetro fora da faixa verde (despressurização parcial).', dest: 'Devolucao Fornecedor', obs: 'Retidos 2 cilindros da Extinpel para troca em garantia.', dias: 10 },
      { sku: 'EXT-AP-10L', tipo: 'Entrada', res: 'Aprovado', tot: 60, apr: 60, rep: 0, mot: null, dest: null, obs: 'Selo INMETRO conferido por amostragem; 100% aprovado.', dias: 10 },
      { sku: 'EXT-K-6L', tipo: 'Entrada', res: 'Aprovado', tot: 10, apr: 10, rep: 0, mot: null, dest: null, obs: 'Lote Kidde Classe K aprovado integralmente com certificados.', dias: 9 },
      { sku: 'EXT-ESP-10L', tipo: 'Entrada', res: 'Reprovado', tot: 4, apr: 0, rep: 4, mot: 'Lote entregue com validade residual inferior a 6 meses.', dest: 'Quarentena', obs: 'Segregado imediatamente conforme política FEFO RezFire.', dias: 4 },
      { sku: 'KIT-PQS-COMPLETO', tipo: 'Separacao', res: 'Aprovado', tot: 15, apr: 15, rep: 0, mot: null, dest: null, obs: 'Checklist de expedição ML validado antes da coleta.', dias: 3 },
      { sku: 'EXT-CO2-6KG', tipo: 'Separacao', res: 'Aprovado', tot: 8, apr: 8, rep: 0, mot: null, dest: null, obs: 'Pesagem de conferência CO2 e proteção com plástico bolha duplo.', dias: 2 },
    ];
    for (const ins of inspecoesSeed) {
      const prod = produtoMap[ins.sku];
      const checklist = ins.tipo === 'Entrada'
        ? { avarias_casco: ins.rep === 0, sem_corrosao: true, rotulo_legivel: true, manometro_pressao: ins.rep === 0, lacre_acessorios: true }
        : { lacre_inmetro_intacto: true, manometro_faixa_verde: true, sem_avarias_transporte: true, suporte_acessorios: true, rotulo_instrucoes: true };
      await qr.query(
        `INSERT INTO inspecoes_qualidade (
          id_produto, id_lote, id_usuario, tipo_inspecao, checklist, resultado,
          quantidade_total, quantidade_aprovada, quantidade_reprovada,
          motivo_reprovacao, destino_reprovados, observacoes, responsavel, data_inspecao, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prod.id, lotePorProduto[prod.id] || null, idOp2, ins.tipo, JSON.stringify(checklist), ins.res,
          ins.tot, ins.apr, ins.rep, ins.mot, ins.dest, ins.obs,
          ins.tipo === 'Entrada' ? 'Marina Costa (Almoxarifado)' : 'Carlos Henrique (Expedição)',
          formatSqlDateTime(daysAgo(ins.dias, 15)), formatSqlDateTime(daysAgo(ins.dias, 15)),
        ]
      );
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 14. Documentos de Certificação INMETRO + Notificações + Respostas Padrão
    // ───────────────────────────────────────────────────────────────────────────
    const certsSeed = [
      { tipo: 'PRODUTO', id: produtoMap['EXT-PQS-4KG'].id, nome: 'Certificado_INMETRO_003180_2023_Resil_ABC_4kg.pdf', tam: 428120 },
      { tipo: 'PRODUTO', id: produtoMap['EXT-PQS-6KG'].id, nome: 'Certificado_INMETRO_003181_2023_Resil_ABC_6kg.pdf', tam: 412900 },
      { tipo: 'PRODUTO', id: produtoMap['EXT-AP-10L'].id, nome: 'Certificado_INMETRO_002450_2022_AP_10L.pdf', tam: 389450 },
      { tipo: 'PRODUTO', id: produtoMap['EXT-CO2-4KG'].id, nome: 'Certificado_INMETRO_001890_2022_Bucka_CO2_4kg.pdf', tam: 510240 },
      { tipo: 'PRODUTO', id: produtoMap['EXT-CO2-6KG'].id, nome: 'Certificado_INMETRO_001891_2022_Bucka_CO2_6kg.pdf', tam: 498110 },
      { tipo: 'PRODUTO', id: produtoMap['EXT-K-6L'].id, nome: 'Certificado_INMETRO_005110_2023_Kidde_Classe_K.pdf', tam: 615300 },
      { tipo: 'ANUNCIO', id: anuncioIds['MLB-3928174010'], nome: 'Laudo_Conformidade_ML_Extintor_ABC_4kg.pdf', tam: 312000 },
      { tipo: 'ANUNCIO', id: anuncioIds['MLB-4019283741'], nome: 'Ficha_Tecnica_ABNT_Kit_Protecao_Completa.pdf', tam: 284500 },
    ];
    for (const c of certsSeed) {
      await qr.query(
        `INSERT INTO documentos_certificacao (tipo_entidade, entidade_id, nome_arquivo_original, caminho_disco, tamanho_bytes, mime_type, created_at)
         VALUES (?, ?, ?, ?, ?, 'application/pdf', ?)`,
        [c.tipo, c.id, c.nome, `uploads/certificados/${c.nome}`, c.tam, formatSqlDateTime(daysAgo(45))]
      );
    }

    const notifsSeed = [
      { tipo: 'FISCAL_CERTIFICADO', titulo: 'Certificado Digital A1 vence em 22 dias', msg: 'Providencie a renovação do certificado ICP-Brasil antes do vencimento para evitar bloqueio na emissão de NF-e.', link: 'fiscal.html', lida: 0, dias: 0 },
      { tipo: 'ESTOQUE_RUPTURA', titulo: 'Ruptura Total: EXT-PQS-12KG (0 unidades)', msg: 'O anúncio MLB-3519084412 foi pausado automaticamente. Pedido de compra PC-2026-0092 está atrasado há 5 dias.', link: 'estoque.html', lida: 0, dias: 1 },
      { tipo: 'VALIDADE_FEFO', titulo: 'Lote Vencido Detectado: LT-K6L-21V (EXT-K-6L)', msg: '1 unidade vencida há 18 dias segregada no almoxarifado. Requer envio para recarga/descarte.', link: 'alertas.html', lida: 0, dias: 1 },
      { tipo: 'POSTAGEM_ATRASADA', titulo: '2 Pedidos com Prazo de Despacho Atrasado', msg: 'Pedidos aguardando separação/expedição com risco de impacto na reputação do Mercado Livre.', link: 'entregas.html', lida: 0, dias: 0 },
      { tipo: 'FISCAL_REJEICAO', titulo: '2 Notas Fiscais Rejeitadas pela SEFAZ', msg: 'Verifique rejeições 204 e 539 no Painel Fiscal para correção e retransmissão.', link: 'dashboard.html?tab=fiscal', lida: 0, dias: 2 },
      { tipo: 'COMPRAS_ATRASO', titulo: 'Pedido de Compra PC-2026-0092 Atrasado (Extinpel)', msg: 'Entrega prevista venceu há 5 dias. Acione o fornecedor para liberar reposição de EXT-PQS-12KG.', link: 'pedidos-compra.html', lida: 1, dias: 3 },
    ];
    for (const nf of notifsSeed) {
      await qr.query(
        `INSERT INTO notificacoes (id_usuario, tipo, canal, titulo, mensagem, link, lida, enviado_email, created_at)
         VALUES (?, ?, 'TODOS', ?, ?, ?, ?, 1, ?)`,
        [idGestor, nf.tipo, nf.titulo, nf.msg, nf.link, nf.lida, formatSqlDateTime(daysAgo(nf.dias, 9))]
      );
    }

    const respostasSeed = [
      { titulo: 'Validade e Garantia INMETRO (5 anos)', cat: 'Produto', perg: 'Qual a validade do extintor ABC 4kg?', resp: 'Olá! Todos os nossos extintores ABC 4kg são novos de fábrica, acompanham selo INMETRO vigente, validade da carga de 5 anos e garantia de fábrica contra defeitos. Enviamos com Nota Fiscal!', tags: 'validade,inmetro,garantia', usos: 84 },
      { titulo: 'Prazo de Despacho e Frete', cat: 'Entrega', perg: 'Comprando hoje envia quando?', resp: 'Olá! Pedidos com pagamento aprovado até as 14h são despachados no mesmo dia útil com embalagem reforçada e código de rastreamento imediato.', tags: 'envio,prazo,coleta', usos: 67 },
      { titulo: 'Emissão de NF-e para Condomínios e CNPJ', cat: 'Fiscal', perg: 'Vocês emitem nota fiscal para CNPJ / condomínio?', resp: 'Sim! Emitimos NF-e eletrônica automaticamente para CPF ou CNPJ (condomínios, empresas e comércios). Basta manter os dados de faturamento atualizados no cadastro da compra.', tags: 'nfe,cnpj,condominio', usos: 53 },
      { titulo: 'Diferença entre Extintor ABC, Água e CO2', cat: 'Tecnico', perg: 'Qual extintor devo usar no meu comércio?', resp: 'O extintor Pó Químico ABC atende classes A (sólidos), B (líquidos inflamáveis) e C (equipamentos elétricos) — é o mais versátil para comércios. Para salas de servidores/TI recomendamos CO2 por não deixar resíduos.', tags: 'abc,co2,classe', usos: 41 },
      { titulo: 'Inclusão de Suporte e Placa ABNT', cat: 'Produto', perg: 'Vem com suporte de parede e placa?', resp: 'Temos tanto o extintor avulso quanto o Kit Proteção Completa que já inclui Suporte de Parede reforçado + Placa Fotoluminescente padrão ABNT NBR 13434. Posso enviar o link do kit!', tags: 'kit,suporte,placa', usos: 39 },
    ];
    for (const r of respostasSeed) {
      await qr.query(
        `INSERT INTO respostas_padrao (titulo, categoria, pergunta_exemplo, resposta, tags, ativo, vezes_utilizada, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [r.titulo, r.cat, r.perg, r.resp, r.tags, r.usos, formatSqlDateTime(daysAgo(90))]
      );
    }

    await qr.commitTransaction();

    // Resumo estatístico no console
    const fatAtual = pedidosCriados
      .filter((p) => p.diasAtras <= 29 && p.status !== 'Cancelado')
      .reduce((s, p) => s + p.valorTotal, 0);
    const fatAnt = pedidosCriados
      .filter((p) => p.diasAtras >= 30 && p.diasAtras <= 59 && p.status !== 'Cancelado')
      .reduce((s, p) => s + p.valorTotal, 0);

    console.log('\n✅ SEED EMPRESA MÉDIA CONCLUÍDO COM SUCESSO!');
    console.log(`   • Produtos: ${Object.keys(produtoMap).length} | Fornecedores: ${fornecedoresSeed.length} | Clientes: ${clientes.length}`);
    console.log(`   • Pedidos totais: ${pedidosCriados.length} | Pedidos sem NF-e (>24h): ${semNfeIds.size}`);
    console.log(`   • Faturamento 30d atual: R$ ${fatAtual.toFixed(2)} vs 30d anterior: R$ ${fatAnt.toFixed(2)}`);
    console.log(`   • NF-es geradas até nº ${numNfe - 1} | Devoluções: ${devolucoesSpec.length} | POs: ${posConfig.length}`);
    console.log(`   • Usuários: gestor@rezfire.com.br (GESTOR) + 2 operadores (OPERADOR / senha: operador2026)`);
  } catch (error) {
    await qr.rollbackTransaction();
    console.error('❌ Erro ao executar seed empresa média:', error);
    throw error;
  } finally {
    await qr.release();
  }
}

if (require.main === module) {
  runSeedEmpresaMedia()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
