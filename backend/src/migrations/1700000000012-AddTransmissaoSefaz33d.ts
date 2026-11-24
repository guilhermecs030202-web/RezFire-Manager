import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransmissaoSefaz33d1700000000012 implements MigrationInterface {
  name = 'AddTransmissaoSefaz33d1700000000012';

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

  private async removerColunaSeExistir(
    queryRunner: QueryRunner,
    tabela: string,
    coluna: string
  ) {
    const existing = await queryRunner.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tabela, coluna]
    );
    if (existing && existing.length > 0) {
      await queryRunner.query(`ALTER TABLE ${tabela} DROP COLUMN ${coluna}`);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Campos de retorno SEFAZ e histórico resumido na tabela notas_fiscais
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'ultimo_codigo_sefaz', 'VARCHAR(10) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'ultimo_motivo_sefaz', 'TEXT NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'ultima_mensagem_amigavel', 'TEXT NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'numero_recibo', 'VARCHAR(64) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'xml_autorizado', 'LONGTEXT NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'autorizada_em', 'TIMESTAMP NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'tentativas_envio', 'INT UNSIGNED NOT NULL DEFAULT 0');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'ultima_tentativa_em', 'TIMESTAMP NULL');

    // 2. Tabela de auditoria de tentativas de envio e consulta à SEFAZ
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notas_fiscais_transmissoes (
        id_transmissao INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_nota_fiscal INT UNSIGNED NOT NULL,
        id_usuario INT UNSIGNED NULL,
        tipo_operacao ENUM('autorizacao', 'consulta_protocolo', 'status_servico') NOT NULL,
        modo_transporte ENUM('simulado', 'sefaz_soap') NOT NULL DEFAULT 'simulado',
        ambiente ENUM('homologacao', 'producao') NOT NULL DEFAULT 'homologacao',
        tentativa_numero INT UNSIGNED NOT NULL DEFAULT 1,
        sucesso_comunicacao BOOLEAN NOT NULL DEFAULT FALSE,
        resultado ENUM('autorizada', 'em_processamento', 'rejeitada', 'denegada', 'indisponivel', 'consulta_vazia', 'erro_interno') NOT NULL,
        http_status INT NULL,
        codigo_sefaz VARCHAR(10) NULL,
        motivo_sefaz TEXT NULL,
        mensagem_amigavel TEXT NULL,
        numero_recibo VARCHAR(64) NULL,
        protocolo VARCHAR(64) NULL,
        chave_acesso VARCHAR(44) NULL,
        endpoint_url VARCHAR(255) NULL,
        duracao_ms INT UNSIGNED NULL,
        erro_rede TEXT NULL,
        xml_requisicao LONGTEXT NULL,
        xml_resposta LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_transmissao),
        INDEX idx_nft_nota_fiscal (id_nota_fiscal),
        INDEX idx_nft_created_at (created_at),
        CONSTRAINT fk_nft_nota_fiscal FOREIGN KEY (id_nota_fiscal)
          REFERENCES notas_fiscais (id_nota_fiscal) ON DELETE CASCADE,
        CONSTRAINT fk_nft_usuario FOREIGN KEY (id_usuario)
          REFERENCES usuarios (id_usuario) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notas_fiscais_transmissoes`);

    const cols = [
      'ultima_tentativa_em',
      'tentativas_envio',
      'autorizada_em',
      'xml_autorizado',
      'numero_recibo',
      'ultima_mensagem_amigavel',
      'ultimo_motivo_sefaz',
      'ultimo_codigo_sefaz',
    ];
    for (const col of cols) {
      await this.removerColunaSeExistir(queryRunner, 'notas_fiscais', col);
    }
  }
}

