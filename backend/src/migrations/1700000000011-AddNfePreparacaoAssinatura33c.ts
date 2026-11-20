import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNfePreparacaoAssinatura33c1700000000011 implements MigrationInterface {
  name = 'AddNfePreparacaoAssinatura33c1700000000011';

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
    // 1. Dados do destinatário fiscal e desconto comercial em pedidos (Story 33c)
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'destinatario_documento', 'VARCHAR(14) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'destinatario_ie', 'VARCHAR(20) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'destinatario_cep', 'VARCHAR(8) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'destinatario_logradouro', 'VARCHAR(255) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'destinatario_numero', 'VARCHAR(20) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'destinatario_complemento', 'VARCHAR(100) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'destinatario_bairro', 'VARCHAR(100) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'destinatario_municipio', 'VARCHAR(100) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'destinatario_codigo_municipio_ibge', 'VARCHAR(7) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'destinatario_uf', 'VARCHAR(2) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'destinatario_email', 'VARCHAR(150) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'pedidos', 'valor_desconto', 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00');

    // 2. Evolução de notas_fiscais para preparo e assinatura XMLDSig (Story 33c)
    await queryRunner.query(`
      ALTER TABLE notas_fiscais
      MODIFY COLUMN status ENUM('rascunho', 'assinada', 'em_processamento', 'autorizada', 'rejeitada', 'denegada', 'cancelada') NOT NULL DEFAULT 'rascunho'
    `);

    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'destinatario_snapshot', 'JSON NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'totais_snapshot', 'JSON NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'impostos_snapshot', 'JSON NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'xml_gerado', 'LONGTEXT NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'xml_assinado', 'LONGTEXT NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'digest_value', 'VARCHAR(128) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'assinatura_valida', 'BOOLEAN NOT NULL DEFAULT FALSE');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'assinada_em', 'TIMESTAMP NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'assinada_por_certificado_serial', 'VARCHAR(128) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'versao_layout', "VARCHAR(10) NOT NULL DEFAULT '4.00'");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const nfCols = [
      'versao_layout',
      'assinada_por_certificado_serial',
      'assinada_em',
      'assinatura_valida',
      'digest_value',
      'xml_assinado',
      'xml_gerado',
      'impostos_snapshot',
      'totais_snapshot',
      'destinatario_snapshot',
    ];
    for (const col of nfCols) {
      await this.removerColunaSeExistir(queryRunner, 'notas_fiscais', col);
    }

    await queryRunner.query(`
      ALTER TABLE notas_fiscais
      MODIFY COLUMN status ENUM('rascunho', 'em_processamento', 'autorizada', 'rejeitada', 'denegada', 'cancelada') NOT NULL DEFAULT 'rascunho'
    `);

    const pedCols = [
      'valor_desconto',
      'destinatario_email',
      'destinatario_uf',
      'destinatario_codigo_municipio_ibge',
      'destinatario_municipio',
      'destinatario_bairro',
      'destinatario_complemento',
      'destinatario_numero',
      'destinatario_logradouro',
      'destinatario_cep',
      'destinatario_ie',
      'destinatario_documento',
    ];
    for (const col of pedCols) {
      await this.removerColunaSeExistir(queryRunner, 'pedidos', col);
    }
  }
}

