import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import {
  Usuario,
  Produto,
  Estoque,
  LoteEstoque,
  MovimentacaoEstoque,
  ConexaoMercadoLivre,
  AnuncioML,
  ProdutoAnuncio,
} from '../entities';

export async function runSeed() {
  console.log('🌱 Iniciando Seed do Banco de Dados RezFire...');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const usuarioRepo = queryRunner.manager.getRepository(Usuario);
    const produtoRepo = queryRunner.manager.getRepository(Produto);
    const estoqueRepo = queryRunner.manager.getRepository(Estoque);
    const loteRepo = queryRunner.manager.getRepository(LoteEstoque);
    const movRepo = queryRunner.manager.getRepository(MovimentacaoEstoque);
    const conexaoRepo = queryRunner.manager.getRepository(ConexaoMercadoLivre);
    const anuncioRepo = queryRunner.manager.getRepository(AnuncioML);
    const paRepo = queryRunner.manager.getRepository(ProdutoAnuncio);

    // 1. Criar Gestor RezFire se não existir
    let gestor = await usuarioRepo.findOne({ where: { email: 'gestor@rezfire.com.br' } });
    if (!gestor) {
      const senhaHash = await bcrypt.hash('rezfire2026', 10);
      gestor = usuarioRepo.create({
        nome: 'Gestor RezFire',
        email: 'gestor@rezfire.com.br',
        senha_hash: senhaHash,
        ativo: true,
      });
      gestor = await usuarioRepo.save(gestor);
      console.log('✓ Gestor padrão criado: gestor@rezfire.com.br');
    }

    // 2. Criar Conexão Mock inicial com Mercado Livre
    let conexao = await conexaoRepo.findOne({ where: { id_usuario: gestor.id_usuario } });
    if (!conexao) {
      conexao = conexaoRepo.create({
        id_usuario: gestor.id_usuario,
        ml_user_id: '128491029',
        access_token: 'APP_USR-782190-VALID-TOKEN',
        refresh_token: 'TG-650123-REFRESH',
        status: 'Conectado',
        expires_at: new Date(Date.now() + 6 * 3600 * 1000),
      });
      conexao = await conexaoRepo.save(conexao);
      console.log('✓ Conexão Mercado Livre inicial configurada.');
    }

    // 3. Cadastrar os 12 Produtos do Catálogo Mestre
    const PRODUTOS_SEED = [
      {
        sku: 'EXT-AP-10L',
        nome: 'Extintor Água Pressurizada 10L - Portátil',
        descricao: 'Extintor de Água Pressurizada (AP) 10 Litros para incêndios Classe A (madeira, papel, tecido).',
        custo: 85.0,
        preco: 149.9,
        categoria: 'Extintores',
        tipo: 'Simples' as const,
        quantidade_atual: 45,
        estoque_minimo: 15,
        detalhes_extintor: {
          registro_inmetro: '002450/2021',
          tipo_extintor: 'Água Pressurizada (AP)',
          capacidade_peso: '10 Litros (2-A)',
          classe_incendio: 'A',
          fabricante: 'Resil',
          data_fabricacao: '2025-06-10',
          data_validade: '2030-06-10',
          numero_lacre: 'L-849201',
          selo_conformidade: 'INM-994120',
        },
      },
      {
        sku: 'EXT-PQS-4KG',
        nome: 'Extintor Pó Químico Seco ABC 4kg',
        descricao: 'Extintor multiuso Pó ABC 4kg. Ideal para indústrias, veículos pesados e comércios.',
        custo: 68.0,
        preco: 129.9,
        categoria: 'Extintores',
        tipo: 'Simples' as const,
        quantidade_atual: 80,
        estoque_minimo: 20,
        detalhes_extintor: {
          registro_inmetro: '003180/2022',
          tipo_extintor: 'Pó Químico ABC',
          capacidade_peso: '4 kg (2-A:20-B:C)',
          classe_incendio: 'ABC',
          fabricante: 'Mocelin',
          data_fabricacao: '2025-08-15',
          data_validade: '2030-08-15',
          numero_lacre: 'L-392019',
          selo_conformidade: 'INM-552011',
        },
      },
      {
        sku: 'EXT-PQS-6KG',
        nome: 'Extintor Pó Químico Seco ABC 6kg',
        descricao: 'Extintor Pó ABC 6kg alta capacidade extintora comercial e industrial.',
        custo: 88.0,
        preco: 169.9,
        categoria: 'Extintores',
        tipo: 'Simples' as const,
        quantidade_atual: 60,
        estoque_minimo: 15,
        detalhes_extintor: {
          registro_inmetro: '003181/2022',
          tipo_extintor: 'Pó Químico ABC',
          capacidade_peso: '6 kg (3-A:30-B:C)',
          classe_incendio: 'ABC',
          fabricante: 'Mocelin',
          data_fabricacao: '2025-09-01',
          data_validade: '2030-09-01',
          numero_lacre: 'L-481920',
          selo_conformidade: 'INM-552044',
        },
      },
      {
        sku: 'EXT-CO2-4KG',
        nome: 'Extintor Dióxido de Carbono CO2 4kg',
        descricao: 'Extintor CO2 4kg indicado para equipamentos eletrônicos sensíveis e líquidos inflamáveis.',
        custo: 235.0,
        preco: 429.0,
        categoria: 'Extintores',
        tipo: 'Simples' as const,
        quantidade_atual: 22,
        estoque_minimo: 10,
        detalhes_extintor: {
          registro_inmetro: '001890/2020',
          tipo_extintor: 'Dióxido de Carbono (CO2)',
          capacidade_peso: '4 kg (5-B:C)',
          classe_incendio: 'BC',
          fabricante: 'Extang',
          data_fabricacao: '2024-03-20',
          data_validade: '2029-03-20',
          numero_lacre: 'L-993021',
          selo_conformidade: 'INM-771920',
        },
      },
      {
        sku: 'EXT-CO2-6KG',
        nome: 'Extintor Dióxido de Carbono CO2 6kg',
        descricao: 'Extintor CO2 6kg para proteção elétrica e salas de máquinas.',
        custo: 298.5,
        preco: 549.0,
        categoria: 'Extintores',
        tipo: 'Simples' as const,
        quantidade_atual: 18,
        estoque_minimo: 8,
        detalhes_extintor: {
          registro_inmetro: '001891/2020',
          tipo_extintor: 'Dióxido de Carbono (CO2)',
          capacidade_peso: '6 kg (10-B:C)',
          classe_incendio: 'BC',
          fabricante: 'Extang',
          data_fabricacao: '2024-05-10',
          data_validade: '2029-05-10',
          numero_lacre: 'L-993044',
          selo_conformidade: 'INM-771945',
        },
      },
      {
        sku: 'EXT-K-6L',
        nome: 'Extintor Classe K 6L - Cozinhas Profissionais',
        descricao: 'Extintor especial com acetato de potássio para combate a óleos e gorduras quentes.',
        custo: 410.0,
        preco: 749.0,
        categoria: 'Extintores',
        tipo: 'Simples' as const,
        quantidade_atual: 12,
        estoque_minimo: 5,
        detalhes_extintor: {
          registro_inmetro: '005110/2022',
          tipo_extintor: 'Classe K (Cozinhas)',
          capacidade_peso: '6 Litros (K)',
          classe_incendio: 'K',
          fabricante: 'Kidde',
          data_fabricacao: '2024-11-12',
          data_validade: '2029-11-12',
          numero_lacre: 'L-220194',
          selo_conformidade: 'INM-882031',
        },
      },
      {
        sku: 'SUP-EXT-01',
        nome: 'Suporte Universal de Parede para Extintores',
        descricao: 'Suporte em aço carbono reforçado com pintura eletrostática.',
        custo: 6.5,
        preco: 18.9,
        categoria: 'Acessórios',
        tipo: 'Simples' as const,
        quantidade_atual: 220,
        estoque_minimo: 40,
        detalhes_extintor: null,
      },
      {
        sku: 'SUP-SOLO-INOX',
        nome: 'Suporte de Solo Tripé Inox para Extintor',
        descricao: 'Suporte de chão elegante em aço inoxidável para escritórios e halls.',
        custo: 38.0,
        preco: 89.9,
        categoria: 'Acessórios',
        tipo: 'Simples' as const,
        quantidade_atual: 45,
        estoque_minimo: 15,
        detalhes_extintor: null,
      },
      {
        sku: 'PLA-FOTO-01',
        nome: 'Placa Sinalização Extintor Fotoluminescente 20x20cm',
        descricao: 'Placa de rota de fuga e indicação de extintor padrão ABNT NBR 13434.',
        custo: 5.2,
        preco: 14.9,
        categoria: 'Sinalização',
        tipo: 'Simples' as const,
        quantidade_atual: 180,
        estoque_minimo: 30,
        detalhes_extintor: null,
      },
      {
        sku: 'DET-FUM-01',
        nome: 'Detector Óptico de Fumaça com Sirene Autônoma',
        descricao: 'Sensor fotoelétrico com bateria 9V e alarme de 85dB.',
        custo: 42.5,
        preco: 89.9,
        categoria: 'Detecção',
        tipo: 'Simples' as const,
        quantidade_atual: 75,
        estoque_minimo: 20,
        detalhes_extintor: null,
      },
    ];

    const mapaProdutosCriados = new Map<string, Produto>();

    for (const p of PRODUTOS_SEED) {
      let prod = await produtoRepo.findOne({ where: { sku: p.sku } });
      if (!prod) {
        prod = produtoRepo.create({
          sku: p.sku,
          nome: p.nome,
          descricao: p.descricao,
          custo: p.custo,
          preco: p.preco,
          categoria: p.categoria,
          tipo: p.tipo,
          detalhes_extintor: p.detalhes_extintor,
          ativo: true,
        });
        prod = await produtoRepo.save(prod);

        // Cria estoque 1:1
        const est = estoqueRepo.create({
          id_produto: prod.id_produto,
          quantidade_atual: p.quantidade_atual,
          estoque_minimo: p.estoque_minimo,
        });
        await estoqueRepo.save(est);

        // Regra de Ouro: Registra movimentação de entrada inicial
        if (p.quantidade_atual > 0) {
          const mov = movRepo.create({
            id_produto: prod.id_produto,
            id_usuario: gestor.id_usuario,
            tipo: 'Entrada',
            quantidade: p.quantidade_atual,
            motivo: 'Carga Inicial de Estoque (NF Remessa Inicial)',
            data_movimentacao: new Date(),
          });
          await movRepo.save(mov);
        }

        // Se for extintor com data de validade, cria lote FEFO
        if (p.detalhes_extintor?.data_validade) {
          const lote = loteRepo.create({
            id_produto: prod.id_produto,
            numero_lote: `LT-${p.sku.split('-')[1] || '2025'}-01`,
            numero_lacre_inmetro: p.detalhes_extintor.numero_lacre || 'L-001',
            data_fabricacao: p.detalhes_extintor.data_fabricacao,
            data_validade: p.detalhes_extintor.data_validade,
            quantidade_disponivel: p.quantidade_atual,
            status: 'Ativo',
          });
          await loteRepo.save(lote);
        }

        console.log(`✓ Produto criado: ${prod.sku} (${prod.nome}) - Estoque: ${p.quantidade_atual}`);
      }
      mapaProdutosCriados.set(p.sku, prod);
    }

    // 4. Cadastrar 2 Combos Inteligentes
    const extPqs4 = mapaProdutosCriados.get('EXT-PQS-4KG');
    const sup01 = mapaProdutosCriados.get('SUP-EXT-01');
    const pla01 = mapaProdutosCriados.get('PLA-FOTO-01');

    if (extPqs4 && sup01 && pla01) {
      let comboKit1 = await produtoRepo.findOne({ where: { sku: 'KIT-PQS-COMPLETO' } });
      if (!comboKit1) {
        comboKit1 = produtoRepo.create({
          sku: 'KIT-PQS-COMPLETO',
          nome: 'Kit Proteção Completa: Extintor PQS 4kg + Suporte + Placa',
          descricao: 'Combo comercial pronto para instalação: 1 Extintor PQS 4kg + 1 Suporte Parede + 1 Placa Fotoluminescente.',
          custo: Number(extPqs4.custo) + Number(sup01.custo) + Number(pla01.custo),
          preco: 154.9,
          categoria: 'Kits',
          tipo: 'Combo',
          combo_items: [
            { id_produto: extPqs4.id_produto, quantidade: 1 },
            { id_produto: sup01.id_produto, quantidade: 1 },
            { id_produto: pla01.id_produto, quantidade: 1 },
          ],
          ativo: true,
        });
        comboKit1 = await produtoRepo.save(comboKit1);

        // Estoque dinâmico de combo (saldo baseado no item gargalo)
        const estCombo = estoqueRepo.create({
          id_produto: comboKit1.id_produto,
          quantidade_atual: Math.min(80, 220, 180), // Menor disponibilidade física
          estoque_minimo: 10,
        });
        await estoqueRepo.save(estCombo);
        console.log('✓ Combo cadastrado: KIT-PQS-COMPLETO');
      }
    }

    await queryRunner.commitTransaction();
    console.log('🎉 Seed concluído com sucesso e integridade transacional garantida!');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Erro durante o Seed:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}

// Executa diretamente se invocado via linha de comando
if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

