import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColunasCompletasFornecedoresEProdutos1700000000020 implements MigrationInterface {
  name = 'AddColunasCompletasFornecedoresEProdutos1700000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Adicionar colunas cadastrais complementares na tabela fornecedores
    const colunasFornecedores = [
      { nome: 'inscricao_estadual', sql: 'ADD COLUMN inscricao_estadual VARCHAR(30) NULL AFTER cnpj' },
      { nome: 'contato_nome', sql: 'ADD COLUMN contato_nome VARCHAR(100) NULL AFTER inscricao_estadual' },
      { nome: 'cep', sql: 'ADD COLUMN cep VARCHAR(15) NULL AFTER telefone' },
      { nome: 'logradouro', sql: 'ADD COLUMN logradouro VARCHAR(150) NULL AFTER cep' },
      { nome: 'numero', sql: 'ADD COLUMN numero VARCHAR(30) NULL AFTER logradouro' },
      { nome: 'bairro', sql: 'ADD COLUMN bairro VARCHAR(100) NULL AFTER numero' },
      { nome: 'condicoes_pagamento', sql: 'ADD COLUMN condicoes_pagamento VARCHAR(150) NULL AFTER prazo_padrao_dias' },
      { nome: 'observacoes', sql: 'ADD COLUMN observacoes TEXT NULL AFTER condicoes_pagamento' },
    ];

    for (const col of colunasFornecedores) {
      const existe = await queryRunner.query(`
        SELECT COUNT(*) as total 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'fornecedores' 
          AND COLUMN_NAME = '${col.nome}';
      `);
      if (Number(existe[0]?.total || 0) === 0) {
        await queryRunner.query(`ALTER TABLE fornecedores ${col.sql};`);
      }
    }

    // 2. Adicionar coluna custo_compra na tabela produto_fornecedor
    const existeCustoCompra = await queryRunner.query(`
      SELECT COUNT(*) as total 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'produto_fornecedor' 
        AND COLUMN_NAME = 'custo_compra';
    `);
    if (Number(existeCustoCompra[0]?.total || 0) === 0) {
      await queryRunner.query(`
        ALTER TABLE produto_fornecedor 
        ADD COLUMN custo_compra DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER principal;
      `);
    }

    // 3. Atualizar dados cadastrais dos fornecedores seed existentes
    await queryRunner.query(`
      UPDATE fornecedores 
      SET 
        inscricao_estadual = '112.334.556.789',
        contato_nome = 'Renato Alencar (Gerente de Contas)',
        cep = '04571-010',
        logradouro = 'Avenida das Nações Unidas',
        numero = '12901',
        bairro = 'Brooklin Paulista',
        condicoes_pagamento = '28/42/56 dias DDL',
        observacoes = 'Principal fornecedor de extintores portáteis ABC/BC e cilindros homologados pelo Inmetro.'
      WHERE id_fornecedor = 1;
    `);

    await queryRunner.query(`
      UPDATE fornecedores 
      SET 
        inscricao_estadual = '289.441.902.113',
        contato_nome = 'Mariana Spiero (Suprimentos)',
        cep = '07220-000',
        logradouro = 'Rodovia Presidente Dutra',
        numero = 'km 218',
        bairro = 'Cumbica',
        condicoes_pagamento = '30 dias direto',
        observacoes = 'Especialista em válvulas de alta pressão para CO2, mangueiras e carretas de grande porte.'
      WHERE id_fornecedor = 2;
    `);

    await queryRunner.query(`
      UPDATE fornecedores 
      SET 
        inscricao_estadual = '901.882.331.450',
        contato_nome = 'Gilberto Prado (Comercial)',
        cep = '81200-100',
        logradouro = 'Rua Eduardo Sprada',
        numero = '4450',
        bairro = 'Campo Comprido',
        condicoes_pagamento = 'À vista ou 21 DDL',
        observacoes = 'Fornecedor paranaense de pó químico BC/ABC granel e cargas de reposição rápida.'
      WHERE id_fornecedor = 3;
    `);

    await queryRunner.query(`
      UPDATE fornecedores 
      SET 
        inscricao_estadual = '254.771.889.330',
        contato_nome = 'Cristiane Beck (Vendas Corporativas)',
        cep = '89219-500',
        logradouro = 'Rua Dona Francisca',
        numero = '8300',
        bairro = 'Zona Industrial Norte',
        condicoes_pagamento = '15/30 dias boleto',
        observacoes = 'Indústria líder em sinalização fotoluminescente e placas de rota de fuga NBR 13434.'
      WHERE id_fornecedor = 4;
    `);

    // 4. Atualizar custos de compra padrão na tabela produto_fornecedor com base nos produtos
    await queryRunner.query(`
      UPDATE produto_fornecedor pf
      JOIN produtos p ON p.id_produto = pf.id_produto
      SET pf.custo_compra = CASE 
        WHEN p.custo > 0 THEN p.custo
        ELSE ROUND(p.preco * 0.55, 2)
      END
      WHERE pf.custo_compra = 0.00;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const colunas = [
      'observacoes',
      'condicoes_pagamento',
      'bairro',
      'numero',
      'logradouro',
      'cep',
      'contato_nome',
      'inscricao_estadual',
    ];

    for (const c of colunas) {
      await queryRunner.query(`ALTER TABLE fornecedores DROP COLUMN IF EXISTS ${c};`);
    }

    await queryRunner.query(`ALTER TABLE produto_fornecedor DROP COLUMN IF EXISTS custo_compra;`);
  }
}
