import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tabela usuarios
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        email VARCHAR(191) NOT NULL UNIQUE,
        senha_hash VARCHAR(255) NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Tabela produtos
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS produtos (
        id_produto INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        sku VARCHAR(64) NOT NULL UNIQUE,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT NULL,
        custo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        categoria VARCHAR(100) NULL,
        tipo ENUM('Simples', 'Combo') NOT NULL DEFAULT 'Simples',
        combo_items JSON NULL,
        detalhes_extintor JSON NULL,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Tabela estoque
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS estoque (
        id_estoque INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_produto INT UNSIGNED NOT NULL UNIQUE,
        quantidade_atual INT NOT NULL DEFAULT 0,
        estoque_minimo INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_estoque_produto FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Tabela lotes_estoque
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lotes_estoque (
        id_lote INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_produto INT UNSIGNED NOT NULL,
        numero_lote VARCHAR(64) NOT NULL,
        numero_lacre_inmetro VARCHAR(64) NULL,
        data_fabricacao DATE NULL,
        data_validade DATE NOT NULL,
        quantidade_disponivel INT NOT NULL DEFAULT 0,
        status ENUM('Ativo', 'Bloqueado', 'Vencido', 'Esgotado') NOT NULL DEFAULT 'Ativo',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_lotes_prod_validade (id_produto, data_validade),
        CONSTRAINT fk_lotes_produto FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Tabela movimentacoes_estoque
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
        id_movimentacao INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_produto INT UNSIGNED NOT NULL,
        id_usuario INT UNSIGNED NULL,
        tipo ENUM('Entrada', 'Saída') NOT NULL,
        quantidade INT NOT NULL,
        motivo VARCHAR(255) NOT NULL,
        data_movimentacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mov_prod_data (id_produto, data_movimentacao),
        INDEX idx_mov_tipo_data (tipo, data_movimentacao),
        CONSTRAINT fk_mov_produto FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE RESTRICT,
        CONSTRAINT fk_mov_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Tabela pedidos
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id_pedido INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        codigo_pedido VARCHAR(64) NOT NULL UNIQUE,
        status ENUM('Confirmado', 'Concluido', 'Cancelado') NOT NULL DEFAULT 'Confirmado',
        cliente_nome VARCHAR(150) NULL,
        origem VARCHAR(50) NOT NULL DEFAULT 'Mercado Livre',
        data_pedido TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        valor_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        exibir_na_entrega BOOLEAN NOT NULL DEFAULT FALSE,
        status_entrega ENUM('A separar', 'Pronto p/ despacho', 'Despachado', 'Entregue') NOT NULL DEFAULT 'A separar',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pedidos_status_data (status, data_pedido)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Tabela itens_pedido
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS itens_pedido (
        id_item INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_pedido INT UNSIGNED NOT NULL,
        id_produto INT UNSIGNED NOT NULL,
        quantidade INT NOT NULL DEFAULT 1,
        preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        CONSTRAINT fk_item_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
        CONSTRAINT fk_item_produto FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Tabela conexoes_mercado_livre
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS conexoes_mercado_livre (
        id_conexao INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT UNSIGNED NOT NULL,
        ml_user_id VARCHAR(64) NULL,
        access_token TEXT NULL,
        refresh_token VARCHAR(255) NULL,
        expires_at TIMESTAMP NULL,
        status ENUM('Conectado', 'Desconectado', 'Expirado') NOT NULL DEFAULT 'Desconectado',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_conexao_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Tabela anuncios_ml
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS anuncios_ml (
        id_anuncio INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_conexao INT UNSIGNED NOT NULL,
        ml_item_id VARCHAR(64) NOT NULL UNIQUE,
        titulo VARCHAR(255) NOT NULL,
        preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(32) NOT NULL DEFAULT 'Ativo',
        quantidade_disponivel INT NOT NULL DEFAULT 0,
        quantidade_vendida INT NOT NULL DEFAULT 0,
        visitas INT NOT NULL DEFAULT 0,
        url VARCHAR(500) NULL,
        ultima_sincronizacao TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_anuncio_conexao FOREIGN KEY (id_conexao) REFERENCES conexoes_mercado_livre(id_conexao) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Tabela associativa produto_anuncio
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS produto_anuncio (
        id_produto INT UNSIGNED NOT NULL,
        id_anuncio INT UNSIGNED NOT NULL,
        quantidade_anunciada INT NOT NULL DEFAULT 1,
        PRIMARY KEY (id_produto, id_anuncio),
        CONSTRAINT fk_pa_produto FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE CASCADE,
        CONSTRAINT fk_pa_anuncio FOREIGN KEY (id_anuncio) REFERENCES anuncios_ml(id_anuncio) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Tabela documentos_certificacao
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS documentos_certificacao (
        id_documento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tipo_entidade ENUM('PRODUTO', 'ANUNCIO') NOT NULL,
        entidade_id INT UNSIGNED NOT NULL,
        nome_arquivo_original VARCHAR(255) NOT NULL,
        caminho_disco VARCHAR(500) NOT NULL,
        tamanho_bytes INT UNSIGNED NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_doc_entidade (tipo_entidade, entidade_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. Tabela eventos_mercado_livre (Fila de Webhooks)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS eventos_mercado_livre (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_evento_ml VARCHAR(128) NULL,
        topic VARCHAR(64) NOT NULL,
        resource VARCHAR(255) NOT NULL,
        payload JSON NULL,
        status ENUM('PENDENTE', 'PROCESSADO', 'ERRO', 'IGNORADO') NOT NULL DEFAULT 'PENDENTE',
        tentativas INT NOT NULL DEFAULT 0,
        erro_mensagem TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_eventos_status_data (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS eventos_mercado_livre;`);
    await queryRunner.query(`DROP TABLE IF EXISTS documentos_certificacao;`);
    await queryRunner.query(`DROP TABLE IF EXISTS produto_anuncio;`);
    await queryRunner.query(`DROP TABLE IF EXISTS anuncios_ml;`);
    await queryRunner.query(`DROP TABLE IF EXISTS conexoes_mercado_livre;`);
    await queryRunner.query(`DROP TABLE IF EXISTS itens_pedido;`);
    await queryRunner.query(`DROP TABLE IF EXISTS pedidos;`);
    await queryRunner.query(`DROP TABLE IF EXISTS movimentacoes_estoque;`);
    await queryRunner.query(`DROP TABLE IF EXISTS lotes_estoque;`);
    await queryRunner.query(`DROP TABLE IF EXISTS estoque;`);
    await queryRunner.query(`DROP TABLE IF EXISTS produtos;`);
    await queryRunner.query(`DROP TABLE IF EXISTS usuarios;`);
  }
}

