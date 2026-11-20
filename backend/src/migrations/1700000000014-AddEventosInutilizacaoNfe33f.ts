import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventosInutilizacaoNfe33f1700000000014 implements MigrationInterface {
  name = 'AddEventosInutilizacaoNfe33f1700000000014';

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
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'cancelada_em', 'TIMESTAMP NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'protocolo_cancelamento', 'VARCHAR(64) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'justificativa_cancelamento', 'TEXT NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'total_cartas_correcao', 'INT UNSIGNED NOT NULL DEFAULT 0');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'ultima_carta_correcao_em', 'TIMESTAMP NULL');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notas_fiscais_eventos (
        id_evento INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_nota_fiscal INT UNSIGNED NOT NULL,
        id_usuario INT UNSIGNED NULL,
        tipo_evento ENUM('cancelamento', 'carta_correcao') NOT NULL,
        codigo_tipo_evento VARCHAR(6) NOT NULL,
        sequencia INT UNSIGNED NOT NULL DEFAULT 1,
        ambiente ENUM('homologacao', 'producao') NOT NULL DEFAULT 'homologacao',
        modo_transporte ENUM('simulado', 'sefaz_soap') NOT NULL DEFAULT 'simulado',
        status ENUM('registrado', 'rejeitado', 'indisponivel') NOT NULL,
        descricao_evento TEXT NOT NULL,
        condicao_uso TEXT NULL,
        codigo_sefaz VARCHAR(10) NULL,
        motivo_sefaz TEXT NULL,
        mensagem_amigavel TEXT NULL,
        protocolo_evento VARCHAR(64) NULL,
        data_evento TIMESTAMP NULL,
        xml_envio LONGTEXT NULL,
        xml_retorno LONGTEXT NULL,
        xml_evento_autorizado LONGTEXT NULL,
        xml_evento_path VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_evento),
        INDEX idx_nfev_nota (id_nota_fiscal),
        INDEX idx_nfev_tipo (tipo_evento),
        INDEX idx_nfev_created (created_at),
        CONSTRAINT fk_nfev_nota FOREIGN KEY (id_nota_fiscal)
          REFERENCES notas_fiscais (id_nota_fiscal) ON DELETE CASCADE,
        CONSTRAINT fk_nfev_usuario FOREIGN KEY (id_usuario)
          REFERENCES usuarios (id_usuario) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notas_fiscais_inutilizacoes (
        id_inutilizacao INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_usuario INT UNSIGNED NULL,
        ambiente ENUM('homologacao', 'producao') NOT NULL DEFAULT 'homologacao',
        modo_transporte ENUM('simulado', 'sefaz_soap') NOT NULL DEFAULT 'simulado',
        uf VARCHAR(2) NOT NULL,
        ano VARCHAR(2) NOT NULL,
        cnpj VARCHAR(14) NOT NULL,
        serie INT UNSIGNED NOT NULL,
        numero_inicial INT UNSIGNED NOT NULL,
        numero_final INT UNSIGNED NOT NULL,
        justificativa TEXT NOT NULL,
        status ENUM('autorizada', 'rejeitada', 'indisponivel') NOT NULL,
        codigo_sefaz VARCHAR(10) NULL,
        motivo_sefaz TEXT NULL,
        mensagem_amigavel TEXT NULL,
        protocolo VARCHAR(64) NULL,
        xml_envio LONGTEXT NULL,
        xml_retorno LONGTEXT NULL,
        xml_inutilizacao_autorizada LONGTEXT NULL,
        xml_inutilizacao_path VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_inutilizacao),
        INDEX idx_nfinut_faixa (ambiente, serie, numero_inicial, numero_final),
        CONSTRAINT fk_nfinut_usuario FOREIGN KEY (id_usuario)
          REFERENCES usuarios (id_usuario) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notas_fiscais_inutilizacoes`);
    await queryRunner.query(`DROP TABLE IF EXISTS notas_fiscais_eventos`);

    const cols = [
      'ultima_carta_correcao_em',
      'total_cartas_correcao',
      'justificativa_cancelamento',
      'protocolo_cancelamento',
      'cancelada_em',
    ];
    for (const col of cols) {
      await this.removerColunaSeExistir(queryRunner, 'notas_fiscais', col);
    }
  }
}

