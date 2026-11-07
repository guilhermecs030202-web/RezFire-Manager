import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddTabelaRespostasPadrao1700000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('respostas_padrao');
    if (!tableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'respostas_padrao',
          columns: [
            {
              name: 'id_resposta',
              type: 'int',
              unsigned: true,
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'titulo',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'categoria',
              type: 'varchar',
              length: '50',
              default: "'Geral'",
            },
            {
              name: 'pergunta_exemplo',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'resposta',
              type: 'text',
              isNullable: false,
            },
            {
              name: 'tags',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'ativo',
              type: 'boolean',
              default: true,
            },
            {
              name: 'vezes_utilizada',
              type: 'int',
              unsigned: true,
              default: 0,
            },
            {
              name: 'created_at',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updated_at',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            },
          ],
        }),
        true
      );

      await queryRunner.createIndex(
        'respostas_padrao',
        new TableIndex({
          name: 'IDX_RESPOSTA_CATEGORIA_ATIVO',
          columnNames: ['categoria', 'ativo'],
        })
      );

      // Seed com Respostas Padrão Técnicas Pré-Configuradas (RezFire Extintores)
      const seeds = [
        {
          titulo: 'Validade para Vistoria do Corpo de Bombeiros (AVCB / CLCB)',
          categoria: 'Validade',
          pergunta_exemplo: 'Qual a validade do extintor? É aceito na vistoria do Corpo de Bombeiros para AVCB?',
          resposta: 'Olá! Sim, 100% aceito e homologado pelo Corpo de Bombeiros. Nossos extintores são fornecidos novos de fábrica, com carga fresca e selo do INMETRO. Para extintores prediais/comerciais (Pó ABC, CO2 e Água), a validade da carga é de 1 ano a contar da data de fabricação recente, com teste hidrostático do cilindro válido por 5 anos. Enviamos com Nota Fiscal e certificado para anexar ao seu processo de AVCB/CLCB.',
          tags: 'validade, bombeiros, avcb, clcb, vistoria, recarga, predial, comercial',
        },
        {
          titulo: 'Capacidade Extintora e Classes de Incêndio (2A-20BC vs 4A-40BC)',
          categoria: 'Capacidade Extintora',
          pergunta_exemplo: 'Qual é a capacidade extintora? Serve para madeira, papel, líquidos e elétrica?',
          resposta: 'Olá! Este extintor utiliza agente de Pó Químico ABC de alta performance, eficaz contra as 3 classes de fogo:\n- Classe A: Sólidos combustíveis (madeira, papel, tecidos);\n- Classe B: Líquidos e gases inflamáveis (gasolina, álcool, tintas);\n- Classe C: Equipamentos elétricos energizados (computadores, quadros de força).\nAtende e supera as exigências técnicas da ABNT NBR 15808 para proteção de áreas comerciais e residenciais.',
          tags: 'capacidade extintora, classe abc, classe a, classe b, classe c, fogo, potencia',
        },
        {
          titulo: 'Selo INMETRO e Lacre de Segurança Original',
          categoria: 'INMETRO & Normas',
          pergunta_exemplo: 'O extintor tem selo do INMETRO e nota fiscal?',
          resposta: 'Olá! Sim, produto 100% original, homologado com selo holográfico do INMETRO e número de registro rastreável. Acompanha lacre de inviolabilidade de fábrica, trava do gatilho e manômetro aferido (indicador na faixa verde). Emitimos Nota Fiscal Eletrônica (NFe) com os dados da sua compra (CPF ou CNPJ).',
          tags: 'inmetro, selo, lacre, nota fiscal, nfe, original, garantia, seguranca',
        },
        {
          titulo: 'Acompanha Suporte de Fixação (Parede ou Veicular)',
          categoria: 'Instalação & Suporte',
          pergunta_exemplo: 'Já vem com suporte para pendurar na parede ou colocar no carro?',
          resposta: 'Olá! Sim, acompanha o suporte metálico original próprio para o modelo. Para extintores prediais, acompanha suporte tipo gancho de parede (recomendamos fixação entre 0,10m e 1,60m do piso conforme NBR 12693). Para modelos automotivos, acompanha suporte de fixação veicular reforçado com presilha de abertura rápida.',
          tags: 'suporte, fixacao, parede, carro, instalacao, gancho, veicular, presilha',
        },
        {
          titulo: 'Extintor Automotivo: Validade de 5 Anos sem Manutenção',
          categoria: 'Validade',
          pergunta_exemplo: 'O extintor veicular dura quanto tempo? Precisa recarregar todo ano?',
          resposta: 'Olá! Os extintores automotivos de Pó ABC descartáveis possuem validade de 5 anos a contar da data de fabricação, sem necessidade de recarga anual durante este período, desde que o manômetro permaneça na faixa verde e o lacre intacto. É o modelo ideal para automóveis, utilitários, vans e caminhões.',
          tags: 'automotivo, veicular, 5 anos, carro, caminhao, descartavel, recarga',
        },
      ];

      for (const s of seeds) {
        await queryRunner.query(
          `INSERT INTO respostas_padrao (titulo, categoria, pergunta_exemplo, resposta, tags, ativo, vezes_utilizada)
           VALUES (?, ?, ?, ?, ?, 1, 0)`,
          [s.titulo, s.categoria, s.pergunta_exemplo, s.resposta, s.tags]
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('respostas_padrao');
    if (tableExists) {
      await queryRunner.dropTable('respostas_padrao', true);
    }
  }
}
