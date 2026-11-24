import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCamposCompletosPedidosCompra1700000000021 implements MigrationInterface {
  name = 'AddCamposCompletosPedidosCompra1700000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Atualizar enum de status para suportar RASCUNHO, ABERTO, PARCIAL, RECEBIDO, CANCELADO (e compatibilidade)
    // Nota: Como a collation é _ci (case-insensitive), definimos os valores em maiúsculo solicitados
    await queryRunner.query(`
      ALTER TABLE pedidos_compra 
      MODIFY COLUMN status ENUM(
        'RASCUNHO', 'ABERTO', 'PARCIAL', 'RECEBIDO', 'CANCELADO', 'ATRASADO'
      ) NOT NULL DEFAULT 'RASCUNHO';
    `);

    // 2. Adicionar condicoes_pagamento se não existir
    const checkCond = await queryRunner.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'pedidos_compra' 
        AND COLUMN_NAME = 'condicoes_pagamento';
    `);
    if (checkCond.length === 0) {
      await queryRunner.query(`
        ALTER TABLE pedidos_compra 
        ADD COLUMN condicoes_pagamento VARCHAR(150) NULL AFTER data_recebimento;
      `);
    }

    // 3. Adicionar valor_desconto se não existir
    const checkDesc = await queryRunner.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'pedidos_compra' 
        AND COLUMN_NAME = 'valor_desconto';
    `);
    if (checkDesc.length === 0) {
      await queryRunner.query(`
        ALTER TABLE pedidos_compra 
        ADD COLUMN valor_desconto DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER valor_frete;
      `);
    }

    // 4. Adicionar motivo_cancelamento se não existir
    const checkCancel = await queryRunner.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'pedidos_compra' 
        AND COLUMN_NAME = 'motivo_cancelamento';
    `);
    if (checkCancel.length === 0) {
      await queryRunner.query(`
        ALTER TABLE pedidos_compra 
        ADD COLUMN motivo_cancelamento TEXT NULL AFTER observacoes;
      `);
    }

    // 5. Adicionar índice em data_previsao_entrega se não existir
    const checkIdxPrevisao = await queryRunner.query(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'pedidos_compra' 
        AND INDEX_NAME = 'idx_pc_previsao';
    `);
    if (checkIdxPrevisao.length === 0) {
      await queryRunner.query(`
        CREATE INDEX idx_pc_previsao ON pedidos_compra (data_previsao_entrega);
      `);
    }

    // 6. Atualizar condições de pagamento dos pedidos existentes com base no fornecedor
    await queryRunner.query(`
      UPDATE pedidos_compra pc
      JOIN fornecedores f ON f.id_fornecedor = pc.id_fornecedor
      SET pc.condicoes_pagamento = COALESCE(f.condicoes_pagamento, '28 DDL faturado')
      WHERE pc.condicoes_pagamento IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`DROP INDEX idx_pc_previsao ON pedidos_compra;`);
    } catch (e) {}

    try {
      await queryRunner.query(`ALTER TABLE pedidos_compra DROP COLUMN motivo_cancelamento;`);
    } catch (e) {}

    try {
      await queryRunner.query(`ALTER TABLE pedidos_compra DROP COLUMN valor_desconto;`);
    } catch (e) {}

    try {
      await queryRunner.query(`ALTER TABLE pedidos_compra DROP COLUMN condicoes_pagamento;`);
    } catch (e) {}
  }
}
