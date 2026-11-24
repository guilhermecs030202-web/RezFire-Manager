import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmissaoNfe33a33b1700000000010 implements MigrationInterface {
  name = 'AddEmissaoNfe33a33b1700000000010';

  private async adicionarColunaSeNaoExistir(
    queryRunner: QueryRunner,
    tabela: string,
    coluna: string,
    definicao: string
  ) {
    const existing = await queryRunner.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tabela, coluna]
    );
    if (!existing || existing.length === 0) {
      await queryRunner.query(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tabela de configuração do emitente fiscal e cofre do certificado A1 (Story 33a)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS emitente_fiscal (
        id_emitente INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        razao_social VARCHAR(255) NOT NULL,
        nome_fantasia VARCHAR(255) NULL,
        cnpj VARCHAR(14) NOT NULL,
        inscricao_estadual VARCHAR(20) NOT NULL,
        regime_tributario ENUM('1', '2', '3', '4') NOT NULL DEFAULT '1',
        cep VARCHAR(8) NOT NULL,
        logradouro VARCHAR(255) NOT NULL,
        numero VARCHAR(20) NOT NULL,
        complemento VARCHAR(100) NULL,
        bairro VARCHAR(100) NOT NULL,
        municipio VARCHAR(100) NOT NULL,
        codigo_municipio_ibge VARCHAR(7) NULL,
        uf VARCHAR(2) NOT NULL DEFAULT 'SP',
        serie_nfe INT UNSIGNED NOT NULL DEFAULT 1,
        proximo_numero_nfe INT UNSIGNED NOT NULL DEFAULT 1,
        ambiente ENUM('homologacao', 'producao') NOT NULL DEFAULT 'homologacao',
        modo_integracao ENUM('sefaz_direto', 'intermediario') NOT NULL DEFAULT 'sefaz_direto',
        ambiente_producao_confirmado_em TIMESTAMP NULL,
        ambiente_producao_confirmado_por INT UNSIGNED NULL,
        certificado_arquivo_enc VARCHAR(255) NULL,
        senha_certificado_enc TEXT NULL,
        certificado_hash_sha256 VARCHAR(64) NULL,
        certificado_titular VARCHAR(255) NULL,
        certificado_emissor VARCHAR(255) NULL,
        certificado_cnpj VARCHAR(14) NULL,
        certificado_serial VARCHAR(128) NULL,
        certificado_valido_de TIMESTAMP NULL,
        certificado_valido_ate TIMESTAMP NULL,
        certificado_atualizado_em TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_emitente_cnpj (cnpj)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Campos fiscais na tabela de produtos (Story 33b)
    await this.adicionarColunaSeNaoExistir(queryRunner, 'produtos', 'ncm', 'VARCHAR(8) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'produtos', 'cfop', 'VARCHAR(4) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'produtos', 'origem_mercadoria', 'VARCHAR(1) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'produtos', 'cst_csosn', 'VARCHAR(3) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'produtos', 'unidade_comercial', 'VARCHAR(6) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'produtos', 'cest', 'VARCHAR(7) NULL');

    // 3. Fundação de notas fiscais e snapshot imutável dos itens emitidos (Story 33b critério 3 + base 33c)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notas_fiscais (
        id_nota_fiscal INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_pedido INT UNSIGNED NULL,
        ambiente ENUM('homologacao', 'producao') NOT NULL DEFAULT 'homologacao',
        serie INT UNSIGNED NOT NULL,
        numero INT UNSIGNED NOT NULL,
        chave_acesso VARCHAR(44) NULL,
        status ENUM('rascunho', 'em_processamento', 'autorizada', 'rejeitada', 'denegada', 'cancelada') NOT NULL DEFAULT 'rascunho',
        protocolo_autorizacao VARCHAR(64) NULL,
        emitente_snapshot JSON NULL,
        valor_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        emitida_em TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_nf_ambiente_serie_numero (ambiente, serie, numero),
        UNIQUE KEY uq_nf_chave_acesso (chave_acesso),
        CONSTRAINT fk_nf_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notas_fiscais_itens (
        id_nota_fiscal_item INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_nota_fiscal INT UNSIGNED NOT NULL,
        id_produto INT UNSIGNED NULL,
        sku_snapshot VARCHAR(64) NOT NULL,
        nome_snapshot VARCHAR(255) NOT NULL,
        ncm_snapshot VARCHAR(8) NOT NULL,
        cfop_snapshot VARCHAR(4) NOT NULL,
        origem_snapshot VARCHAR(1) NOT NULL,
        cst_csosn_snapshot VARCHAR(3) NOT NULL,
        unidade_snapshot VARCHAR(6) NOT NULL,
        cest_snapshot VARCHAR(7) NULL,
        quantidade INT NOT NULL DEFAULT 1,
        valor_unitario DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        valor_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        CONSTRAINT fk_nf_item_nf FOREIGN KEY (id_nota_fiscal) REFERENCES notas_fiscais(id_nota_fiscal) ON DELETE CASCADE,
        CONSTRAINT fk_nf_item_produto FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notas_fiscais_itens`);
    await queryRunner.query(`DROP TABLE IF EXISTS notas_fiscais`);

    const colunas = ['cest', 'unidade_comercial', 'cst_csosn', 'origem_mercadoria', 'cfop', 'ncm'];
    for (const col of colunas) {
      const existing = await queryRunner.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produtos' AND COLUMN_NAME = ?`,
        [col]
      );
      if (existing && existing.length > 0) {
        await queryRunner.query(`ALTER TABLE produtos DROP COLUMN ${col}`);
      }
    }

    await queryRunner.query(`DROP TABLE IF EXISTS emitente_fiscal`);
  }
}

