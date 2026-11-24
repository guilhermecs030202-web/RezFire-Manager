import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTabelaDevolucoesEQualidade1700000000019 implements MigrationInterface {
  name = 'AddTabelaDevolucoesEQualidade1700000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tabela devolucoes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS devolucoes (
        id_devolucao INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        codigo_devolucao VARCHAR(50) NOT NULL UNIQUE,
        id_pedido INT UNSIGNED NOT NULL,
        id_cliente INT UNSIGNED NULL,
        status ENUM('ABERTA', 'EM_ANALISE', 'CONCLUIDA', 'RECUSADA') NOT NULL DEFAULT 'ABERTA',
        tipo_resolucao ENUM('REEMBOLSO', 'TROCA', 'CREDITO', 'REPARO') NOT NULL DEFAULT 'REEMBOLSO',
        custo_frete_reverso DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        valor_total_reembolso DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        data_abertura DATETIME NOT NULL,
        data_conclusao DATETIME NULL,
        prazo_limite_dias INT NOT NULL DEFAULT 7,
        observacoes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dev_pedido (id_pedido),
        INDEX idx_dev_cliente (id_cliente),
        INDEX idx_dev_status (status),
        INDEX idx_dev_abertura (data_abertura),
        INDEX idx_dev_conclusao (data_conclusao),
        CONSTRAINT fk_dev_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE RESTRICT,
        CONSTRAINT fk_dev_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Tabela itens_devolucao
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS itens_devolucao (
        id_item_devolucao INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_devolucao INT UNSIGNED NOT NULL,
        id_produto INT UNSIGNED NOT NULL,
        quantidade INT NOT NULL,
        valor_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        motivo ENUM('DEFEITO', 'AVARIA_TRANSPORTE', 'PRODUTO_ERRADO', 'DIVERGENCIA_DESCRICAO', 'ARREPENDIMENTO', 'OUTRO') NOT NULL,
        detalhe_motivo TEXT NULL,
        destino_item ENUM('RECUPERADO', 'DESCARTADO', 'EM_AVALIACAO') NOT NULL DEFAULT 'EM_AVALIACAO',
        custo_perda_item DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_item_dev_devolucao (id_devolucao),
        INDEX idx_item_dev_produto (id_produto),
        INDEX idx_item_dev_motivo (motivo),
        INDEX idx_item_dev_destino (destino_item),
        CONSTRAINT fk_item_dev_devolucao FOREIGN KEY (id_devolucao) REFERENCES devolucoes(id_devolucao) ON DELETE CASCADE,
        CONSTRAINT fk_item_dev_produto FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Seeds de demonstração para métricas de Devoluções & Qualidade
    const devExistentes = await queryRunner.query(`SELECT COUNT(*) as total FROM devolucoes;`);
    if (Number(devExistentes[0]?.total || 0) === 0) {
      // Buscar pedidos existentes
      const pedidos = await queryRunner.query(`SELECT id_pedido, id_cliente, valor_total FROM pedidos ORDER BY id_pedido ASC LIMIT 10;`);
      // Buscar produtos
      const produtos = await queryRunner.query(`SELECT id_produto, preco FROM produtos ORDER BY id_produto ASC LIMIT 10;`);

      if (pedidos.length > 0 && produtos.length > 0) {
        const ped1 = pedidos[0].id_pedido;
        const cli1 = pedidos[0].id_cliente;
        const ped2 = pedidos.length > 1 ? pedidos[1].id_pedido : ped1;
        const cli2 = pedidos.length > 1 ? pedidos[1].id_cliente : cli1;
        const ped3 = pedidos.length > 2 ? pedidos[2].id_pedido : ped1;
        const cli3 = pedidos.length > 2 ? pedidos[2].id_cliente : cli1;
        const ped4 = pedidos.length > 3 ? pedidos[3].id_pedido : ped1;
        const cli4 = pedidos.length > 3 ? pedidos[3].id_cliente : cli1;

        const prod1 = produtos[0].id_produto; // ex: Extintor Pó ABC
        const preco1 = Number(produtos[0].preco || 120);
        const prod2 = produtos.length > 1 ? produtos[1].id_produto : prod1;
        const preco2 = produtos.length > 1 ? Number(produtos[1].preco || 150) : 150;
        const prod3 = produtos.length > 2 ? produtos[2].id_produto : prod1;
        const preco3 = produtos.length > 2 ? Number(produtos[2].preco || 85) : 85;

        // Datas
        const now = Date.now();
        const dAgo = (days: number) => new Date(now - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');

        // Devolução 1: 5 dias atrás, Concluída com Reembolso (DEFEITO no manômetro)
        await queryRunner.query(`
          INSERT INTO devolucoes (codigo_devolucao, id_pedido, id_cliente, status, tipo_resolucao, custo_frete_reverso, valor_total_reembolso, data_abertura, data_conclusao, prazo_limite_dias, observacoes)
          VALUES ('DEV-2026-001', ${ped1}, ${cli1 ? cli1 : 'NULL'}, 'CONCLUIDA', 'REEMBOLSO', 28.50, ${preco1}, '${dAgo(5)}', '${dAgo(2)}', 7, 'Válvula despressurizada no recebimento. Reembolso aprovado.');
        `);
        const dev1Id = (await queryRunner.query(`SELECT LAST_INSERT_ID() as id;`))[0].id;
        await queryRunner.query(`
          INSERT INTO itens_devolucao (id_devolucao, id_produto, quantidade, valor_unitario, subtotal, motivo, detalhe_motivo, destino_item, custo_perda_item)
          VALUES (${dev1Id}, ${prod1}, 1, ${preco1}, ${preco1}, 'DEFEITO', 'Manômetro com ponteiro no vermelho (despressurizado)', 'DESCARTADO', ${preco1});
        `);

        // Devolução 2: 12 dias atrás, Concluída com Troca (AVARIA_TRANSPORTE)
        await queryRunner.query(`
          INSERT INTO devolucoes (codigo_devolucao, id_pedido, id_cliente, status, tipo_resolucao, custo_frete_reverso, valor_total_reembolso, data_abertura, data_conclusao, prazo_limite_dias, observacoes)
          VALUES ('DEV-2026-002', ${ped2}, ${cli2 ? cli2 : 'NULL'}, 'CONCLUIDA', 'TROCA', 32.00, 0.00, '${dAgo(12)}', '${dAgo(8)}', 7, 'Amassado na base durante transporte via transportadora. Trocado por novo item.');
        `);
        const dev2Id = (await queryRunner.query(`SELECT LAST_INSERT_ID() as id;`))[0].id;
        await queryRunner.query(`
          INSERT INTO itens_devolucao (id_devolucao, id_produto, quantidade, valor_unitario, subtotal, motivo, detalhe_motivo, destino_item, custo_perda_item)
          VALUES (${dev2Id}, ${prod2}, 1, ${preco2}, ${preco2}, 'AVARIA_TRANSPORTE', 'Cilindro com amassado na lateral ocorrido no frete', 'DESCARTADO', ${preco2});
        `);

        // Devolução 3: 8 dias atrás, Concluída com Reembolso (ARREPENDIMENTO, produto perfeito)
        await queryRunner.query(`
          INSERT INTO devolucoes (codigo_devolucao, id_pedido, id_cliente, status, tipo_resolucao, custo_frete_reverso, valor_total_reembolso, data_abertura, data_conclusao, prazo_limite_dias, observacoes)
          VALUES ('DEV-2026-003', ${ped3}, ${cli3 ? cli3 : 'NULL'}, 'CONCLUIDA', 'REEMBOLSO', 25.00, ${preco3}, '${dAgo(8)}', '${dAgo(5)}', 7, 'Cliente comprou especificação errada por engano (7 dias CDC). Produto lacrado retornado ao estoque.');
        `);
        const dev3Id = (await queryRunner.query(`SELECT LAST_INSERT_ID() as id;`))[0].id;
        await queryRunner.query(`
          INSERT INTO itens_devolucao (id_devolucao, id_produto, quantidade, valor_unitario, subtotal, motivo, detalhe_motivo, destino_item, custo_perda_item)
          VALUES (${dev3Id}, ${prod3}, 1, ${preco3}, ${preco3}, 'ARREPENDIMENTO', 'Desistência no prazo legal. Lacre intacto.', 'RECUPERADO', 0.00);
        `);

        // Devolução 4: 9 dias atrás, Em Aberto / Atrasada (EM_ANALISE além do prazo de 7 dias)
        await queryRunner.query(`
          INSERT INTO devolucoes (codigo_devolucao, id_pedido, id_cliente, status, tipo_resolucao, custo_frete_reverso, valor_total_reembolso, data_abertura, data_conclusao, prazo_limite_dias, observacoes)
          VALUES ('DEV-2026-004', ${ped4}, ${cli4 ? cli4 : 'NULL'}, 'EM_ANALISE', 'TROCA', 30.00, 0.00, '${dAgo(9)}', NULL, 7, 'Aguardando laudo técnico da fábrica do fornecedor sobre defeito na rosca.');
        `);
        const dev4Id = (await queryRunner.query(`SELECT LAST_INSERT_ID() as id;`))[0].id;
        await queryRunner.query(`
          INSERT INTO itens_devolucao (id_devolucao, id_produto, quantidade, valor_unitario, subtotal, motivo, detalhe_motivo, destino_item, custo_perda_item)
          VALUES (${dev4Id}, ${prod1}, 1, ${preco1}, ${preco1}, 'DEFEITO', 'Rosca da mangueira com folga mecânica', 'EM_AVALIACAO', 0.00);
        `);

        // Devolução 5: 2 dias atrás, Aberta recente (PRODUTO_ERRADO)
        await queryRunner.query(`
          INSERT INTO devolucoes (codigo_devolucao, id_pedido, id_cliente, status, tipo_resolucao, custo_frete_reverso, valor_total_reembolso, data_abertura, data_conclusao, prazo_limite_dias, observacoes)
          VALUES ('DEV-2026-005', ${ped1}, ${cli1 ? cli1 : 'NULL'}, 'ABERTA', 'TROCA', 0.00, 0.00, '${dAgo(2)}', NULL, 7, 'Enviado extintor 6kg em vez de 4kg por divergência na expedição.');
        `);
        const dev5Id = (await queryRunner.query(`SELECT LAST_INSERT_ID() as id;`))[0].id;
        await queryRunner.query(`
          INSERT INTO itens_devolucao (id_devolucao, id_produto, quantidade, valor_unitario, subtotal, motivo, detalhe_motivo, destino_item, custo_perda_item)
          VALUES (${dev5Id}, ${prod2}, 1, ${preco2}, ${preco2}, 'PRODUTO_ERRADO', 'Divergência de capacidade na separação do lote', 'EM_AVALIACAO', 0.00);
        `);

        // Devolução 6 (Período anterior: 40 dias atrás para base de comparação)
        await queryRunner.query(`
          INSERT INTO devolucoes (codigo_devolucao, id_pedido, id_cliente, status, tipo_resolucao, custo_frete_reverso, valor_total_reembolso, data_abertura, data_conclusao, prazo_limite_dias, observacoes)
          VALUES ('DEV-2026-000', ${ped2}, ${cli2 ? cli2 : 'NULL'}, 'CONCLUIDA', 'REEMBOLSO', 25.00, ${preco1}, '${dAgo(42)}', '${dAgo(38)}', 7, 'Registro de período anterior.');
        `);
        const dev0Id = (await queryRunner.query(`SELECT LAST_INSERT_ID() as id;`))[0].id;
        await queryRunner.query(`
          INSERT INTO itens_devolucao (id_devolucao, id_produto, quantidade, valor_unitario, subtotal, motivo, detalhe_motivo, destino_item, custo_perda_item)
          VALUES (${dev0Id}, ${prod1}, 1, ${preco1}, ${preco1}, 'DEFEITO', 'Problema na alavanca', 'DESCARTADO', ${preco1});
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS itens_devolucao;`);
    await queryRunner.query(`DROP TABLE IF EXISTS devolucoes;`);
  }
}
