import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArquivoXmlDanfe33e1700000000013 implements MigrationInterface {
  name = 'AddArquivoXmlDanfe33e1700000000013';

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
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'codigo_pedido_snapshot', 'VARCHAR(100) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'xml_autorizado_path', 'VARCHAR(255) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'xml_autorizado_sha256', 'VARCHAR(64) NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'xml_arquivado_em', 'TIMESTAMP NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'guarda_legal_ate', 'DATE NULL');
    await this.adicionarColunaSeNaoExistir(queryRunner, 'notas_fiscais', 'danfe_gerado_em', 'TIMESTAMP NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cols = [
      'danfe_gerado_em',
      'guarda_legal_ate',
      'xml_arquivado_em',
      'xml_autorizado_sha256',
      'xml_autorizado_path',
      'codigo_pedido_snapshot',
    ];
    for (const col of cols) {
      await this.removerColunaSeExistir(queryRunner, 'notas_fiscais', col);
    }
  }
}

