import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTabelaComprasEFornecedores1700000000018 implements MigrationInterface {
  name = 'AddTabelaComprasEFornecedores1700000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tabela fornecedores
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fornecedores (
        id_fornecedor INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        razao_social VARCHAR(150) NOT NULL,
        nome_fantasia VARCHAR(100) NULL,
        cnpj VARCHAR(20) NOT NULL UNIQUE,
        email VARCHAR(150) NULL,
        telefone VARCHAR(30) NULL,
        cidade VARCHAR(100) NULL,
        estado VARCHAR(10) NULL,
        prazo_padrao_dias INT NOT NULL DEFAULT 7,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_fornecedor_cnpj (cnpj),
        INDEX idx_fornecedor_ativo (ativo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Tabela pedidos_compra
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pedidos_compra (
        id_pedido_compra INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        numero_pedido VARCHAR(50) NOT NULL UNIQUE,
        id_fornecedor INT UNSIGNED NOT NULL,
        data_emissao DATETIME NOT NULL,
        data_previsao_entrega DATE NOT NULL,
        data_recebimento DATETIME NULL,
        status ENUM('Aberto', 'Parcial', 'Recebido', 'Atrasado', 'Cancelado') NOT NULL DEFAULT 'Aberto',
        valor_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        valor_frete DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        observacoes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pc_fornecedor (id_fornecedor),
        INDEX idx_pc_status (status),
        INDEX idx_pc_emissao (data_emissao),
        INDEX idx_pc_recebimento (data_recebimento),
        CONSTRAINT fk_pc_fornecedor FOREIGN KEY (id_fornecedor) REFERENCES fornecedores(id_fornecedor) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Tabela itens_pedido_compra
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS itens_pedido_compra (
        id_item_compra INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_pedido_compra INT UNSIGNED NOT NULL,
        id_produto INT UNSIGNED NOT NULL,
        quantidade_pedida INT NOT NULL,
        quantidade_entregue INT NOT NULL DEFAULT 0,
        preco_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_item_compra_pedido (id_pedido_compra),
        INDEX idx_item_compra_produto (id_produto),
        CONSTRAINT fk_item_compra_pc FOREIGN KEY (id_pedido_compra) REFERENCES pedidos_compra(id_pedido_compra) ON DELETE CASCADE,
        CONSTRAINT fk_item_compra_prod FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Tabela produto_fornecedor (Vínculo para identificação de fornecedor único/múltiplo)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS produto_fornecedor (
        id_produto_fornecedor INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_produto INT UNSIGNED NOT NULL,
        id_fornecedor INT UNSIGNED NOT NULL,
        principal TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_prod_forn_unique (id_produto, id_fornecedor),
        INDEX idx_prod_forn_produto (id_produto),
        INDEX idx_prod_forn_fornecedor (id_fornecedor),
        CONSTRAINT fk_pf_prod FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE CASCADE,
        CONSTRAINT fk_pf_forn FOREIGN KEY (id_fornecedor) REFERENCES fornecedores(id_fornecedor) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Inserção de Fornecedores Seed
    await queryRunner.query(`
      INSERT INTO fornecedores 
        (id_fornecedor, razao_social, nome_fantasia, cnpj, email, telefone, cidade, estado, prazo_padrao_dias, ativo)
      VALUES
        (1, 'Resil Comercial e Industrial LTDA', 'Resil Extintores', '61.123.456/0001-90', 'vendas@resil.com.br', '(11) 4589-2200', 'São Paulo', 'SP', 5, 1),
        (2, 'Metalúrgica Bucka Spiero S/A', 'Bucka Fire Systems', '52.987.654/0001-12', 'pedidos@bucka.com.br', '(11) 2468-1000', 'Guarulhos', 'SP', 7, 1),
        (3, 'Extinpel Indústria e Comércio de Extintores', 'Extinpel Brasil', '14.555.777/0001-33', 'comercial@extinpel.com.br', '(41) 3344-8899', 'Curitiba', 'PR', 10, 1),
        (4, 'Sinalize Comunicação Visual Indústria e Comércio', 'Sinalize Placas', '08.222.333/0001-44', 'atendimento@sinalize.com.br', '(47) 3451-9000', 'Joinville', 'SC', 4, 1)
      ON DUPLICATE KEY UPDATE razao_social = VALUES(razao_social);
    `);

    // 6. Inserção de Vínculos Produto-Fornecedor Seed (defensivo se produtos seed 11..20 não existirem)
    await queryRunner.query(`
      INSERT IGNORE INTO produto_fornecedor (id_produto, id_fornecedor, principal)
      VALUES
        (11, 1, 1), -- Extintor AP 10L -> Resil
        (12, 1, 1), -- Extintor PQS 4kg -> Resil (principal)
        (12, 3, 0), -- Extintor PQS 4kg -> Extinpel (secundário)
        (13, 1, 1), -- Extintor PQS 6kg -> Resil
        (14, 1, 1), -- Extintor CO2 4kg -> Resil
        (15, 1, 1), -- Extintor CO2 6kg -> Resil
        (16, 1, 1), -- Extintor Classe K -> Resil (fornecedor único!)
        (17, 2, 1), -- Suporte de Parede -> Bucka (fornecedor único!)
        (18, 2, 1), -- Suporte Solo Tripé -> Bucka
        (19, 4, 1), -- Placa Fotoluminescente -> Sinalize (fornecedor único!)
        (20, 2, 1); -- Detector de Fumaça -> Bucka (fornecedor único!)
    `);

    // 7. Inserção de Pedidos de Compra Seed (Histórico com compras anteriores e recentes)
    await queryRunner.query(`
      INSERT INTO pedidos_compra 
        (id_pedido_compra, numero_pedido, id_fornecedor, data_emissao, data_previsao_entrega, data_recebimento, status, valor_total, valor_frete, observacoes)
      VALUES
        -- Período anterior (31 a 60 dias atrás)
        (1, 'PC-2026-088', 1, DATE_SUB(NOW(), INTERVAL 52 DAY), DATE_SUB(NOW(), INTERVAL 47 DAY), DATE_SUB(NOW(), INTERVAL 47 DAY), 'Recebido', 10200.00, 250.00, 'Remessa mensal de extintores PQS e AP.'),
        (2, 'PC-2026-089', 2, DATE_SUB(NOW(), INTERVAL 48 DAY), DATE_SUB(NOW(), INTERVAL 41 DAY), DATE_SUB(NOW(), INTERVAL 40 DAY), 'Recebido', 2450.00, 80.00, 'Lote de suportes de parede e tripés de solo.'),
        (3, 'PC-2026-090', 4, DATE_SUB(NOW(), INTERVAL 42 DAY), DATE_SUB(NOW(), INTERVAL 38 DAY), DATE_SUB(NOW(), INTERVAL 38 DAY), 'Recebido', 1300.00, 45.00, 'Placas fotoluminescentes 20x20cm.'),
        (4, 'PC-2026-091', 1, DATE_SUB(NOW(), INTERVAL 35 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 31 DAY), 'Recebido', 8900.00, 200.00, 'Cilindros de CO2 4kg e 6kg.'),

        -- Período atual (últimos 30 dias)
        (5, 'PC-2026-101', 1, DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), 'Recebido', 14280.00, 320.00, 'Extintores PQS 4kg e 6kg com reajuste de insumos.'),
        (6, 'PC-2026-102', 2, DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 11 DAY), DATE_SUB(NOW(), INTERVAL 8 DAY), 'Recebido', 4560.00, 110.00, 'Entrega com 3 dias de atraso devido a fila na galvanização.'),
        (7, 'PC-2026-103', 3, DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY), 'Recebido', 3400.00, 150.00, 'Carga de extintores PQS 4kg alternativos.'),
        (8, 'PC-2026-104', 4, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY), 'Recebido', 1560.00, 60.00, 'Placas de sinalização de emergência.'),
        (9, 'PC-2026-105', 1, DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), NULL, 'Atrasado', 8200.00, 200.00, 'Extintores Classe K e CO2 pendentes de liberação na fábrica.'),
        (10, 'PC-2026-106', 2, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_ADD(NOW(), INTERVAL 4 DAY), NULL, 'Aberto', 2980.00, 90.00, 'Detectores ópticos e suportes de extintor.')
      ON DUPLICATE KEY UPDATE status = VALUES(status);
    `);

    // 8. Inserção de Itens dos Pedidos de Compra (defensivo se produtos seed 11..20 não existirem)
    await queryRunner.query(`
      INSERT IGNORE INTO itens_pedido_compra 
        (id_pedido_compra, id_produto, quantidade_pedida, quantidade_entregue, preco_unitario, subtotal)
      VALUES
        -- Itens do PC-088 (Período anterior)
        (1, 12, 100, 100, 60.00, 6000.00), -- PQS 4kg a R$ 60 no período anterior
        (1, 13, 50, 50, 84.00, 4200.00),

        -- Itens do PC-089 (Período anterior)
        (2, 17, 200, 200, 6.00, 1200.00),
        (2, 18, 35, 35, 35.71, 1250.00),

        -- Itens do PC-090 (Período anterior)
        (3, 19, 260, 260, 5.00, 1300.00),

        -- Itens do PC-091 (Período anterior)
        (4, 14, 20, 20, 225.00, 4500.00),
        (4, 15, 15, 15, 293.33, 4400.00),

        -- Itens do PC-101 (Período atual)
        (5, 12, 120, 120, 68.00, 8160.00), -- PQS 4kg a R$ 68 (+13.3% de aumento!)
        (5, 13, 70, 70, 87.43, 6120.00),

        -- Itens do PC-102 (Período atual)
        (6, 17, 300, 300, 6.50, 1950.00),
        (6, 18, 50, 50, 38.00, 1900.00),
        (6, 20, 17, 17, 41.76, 710.00),

        -- Itens do PC-103 (Período atual)
        (7, 12, 50, 50, 68.00, 3400.00),

        -- Itens do PC-104 (Período atual)
        (8, 19, 300, 300, 5.20, 1560.00),

        -- Itens do PC-105 (Período atual - Atrasado)
        (9, 16, 20, 0, 410.00, 8200.00),

        -- Itens do PC-106 (Período atual - Aberto)
        (10, 20, 70, 0, 42.57, 2980.00);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS produto_fornecedor;');
    await queryRunner.query('DROP TABLE IF EXISTS itens_pedido_compra;');
    await queryRunner.query('DROP TABLE IF EXISTS pedidos_compra;');
    await queryRunner.query('DROP TABLE IF EXISTS fornecedores;');
  }
}
