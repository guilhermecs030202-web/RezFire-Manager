import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTabelaClientesEVinculoPedidos1700000000016 implements MigrationInterface {
  name = 'AddTabelaClientesEVinculoPedidos1700000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Criação da tabela clientes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id_cliente INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        documento VARCHAR(20) NULL,
        email VARCHAR(150) NULL,
        telefone VARCHAR(30) NULL,
        cidade VARCHAR(100) NULL,
        estado VARCHAR(10) NULL,
        cep VARCHAR(15) NULL,
        observacoes TEXT NULL,
        origem ENUM('PRESENCIAL', 'MERCADO_LIVRE') NOT NULL DEFAULT 'PRESENCIAL',
        external_id VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cliente_source (origem),
        INDEX idx_cliente_document (documento),
        INDEX idx_cliente_nome (nome),
        UNIQUE INDEX idx_cliente_external_id (external_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Adição da coluna id_cliente e chave estrangeira na tabela pedidos
    const colExists = await queryRunner.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'pedidos' 
        AND COLUMN_NAME = 'id_cliente';
    `);

    if (!colExists || colExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE pedidos 
        ADD COLUMN id_cliente INT UNSIGNED NULL AFTER cliente_nome;
      `);

      await queryRunner.query(`
        ALTER TABLE pedidos
        ADD CONSTRAINT fk_pedido_cliente 
        FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE SET NULL;
      `);

      await queryRunner.query(`
        CREATE INDEX idx_pedido_cliente ON pedidos (id_cliente);
      `);
    }

    // 3. Seeds de demonstração
    await queryRunner.query(`
      INSERT INTO clientes 
        (nome, documento, email, telefone, cidade, estado, cep, observacoes, origem, external_id)
      VALUES 
        ('Construtora Horizonte LTDA', '12.345.678/0001-90', 'compras@horizonteeng.com.br', '(41) 3344-5566', 'Curitiba', 'PR', '80010-000', 'Cliente corporativo com recarga anual de extintores e manutenção predial.', 'PRESENCIAL', NULL),
        ('Carlos Eduardo Silva', '284.912.839-44', 'carlos.silva@gmail.com', '(43) 99887-1122', 'Londrina', 'PR', '86010-100', 'Compra balcão para restaurante e veículos leves.', 'PRESENCIAL', NULL),
        ('Marcos Vinicius Santos (COMPRADOR_ML_OFICIAL)', NULL, 'comprador.ml@mercadolivre.com', '(11) 98765-4321', 'São Paulo', 'SP', '01310-100', 'Cliente gerado automaticamente a partir de pedido no Mercado Livre.', 'MERCADO_LIVRE', '20000049281729')
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
    `);

    // 4. Vinculação retroativa de pedidos existentes se houver
    await queryRunner.query(`
      UPDATE pedidos p
      JOIN clientes c ON (
        (p.origem = 'Mercado Livre' AND c.external_id = '20000049281729') OR
        (p.cliente_nome LIKE CONCAT('%', c.nome, '%'))
      )
      SET p.id_cliente = c.id_cliente
      WHERE p.id_cliente IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`ALTER TABLE pedidos DROP FOREIGN KEY fk_pedido_cliente;`);
    } catch (e) {}

    try {
      await queryRunner.query(`ALTER TABLE pedidos DROP COLUMN id_cliente;`);
    } catch (e) {}

    await queryRunner.query(`DROP TABLE IF EXISTS clientes;`);
  }
}
