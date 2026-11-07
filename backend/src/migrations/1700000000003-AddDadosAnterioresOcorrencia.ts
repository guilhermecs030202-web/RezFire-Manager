import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDadosAnterioresOcorrencia1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const temDadosAnteriores = await queryRunner.hasColumn('ocorrencias_anuncio', 'dados_anteriores');
    if (!temDadosAnteriores) {
      await queryRunner.query(`ALTER TABLE ocorrencias_anuncio ADD COLUMN dados_anteriores JSON NULL;`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const temDadosAnteriores = await queryRunner.hasColumn('ocorrencias_anuncio', 'dados_anteriores');
    if (temDadosAnteriores) {
      await queryRunner.query(`ALTER TABLE ocorrencias_anuncio DROP COLUMN dados_anteriores;`);
    }
  }
}

