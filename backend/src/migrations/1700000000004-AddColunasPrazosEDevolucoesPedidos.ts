import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColunasPrazosEDevolucoesPedidos1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const colunas: { nome: string; tipo: string }[] = [
      { nome: 'prazo_despacho', tipo: 'TIMESTAMP NULL' },
      { nome: 'data_despacho', tipo: 'TIMESTAMP NULL' },
      { nome: 'motivo_devolucao', tipo: 'VARCHAR(100) NULL' },
      { nome: 'tipo_ocorrencia', tipo: 'VARCHAR(50) NULL' },
      { nome: 'detalhe_devolucao', tipo: 'TEXT NULL' },
      { nome: 'protocolo_mediacao', tipo: 'VARCHAR(100) NULL' },
      { nome: 'data_devolucao', tipo: 'TIMESTAMP NULL' },
    ];

    for (const col of colunas) {
      const existe = await queryRunner.hasColumn('pedidos', col.nome);
      if (!existe) {
        await queryRunner.query(`ALTER TABLE pedidos ADD COLUMN ${col.nome} ${col.tipo};`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const colunas = [
      'data_devolucao',
      'protocolo_mediacao',
      'detalhe_devolucao',
      'tipo_ocorrencia',
      'motivo_devolucao',
      'data_despacho',
      'prazo_despacho',
    ];

    for (const col of colunas) {
      const existe = await queryRunner.hasColumn('pedidos', col);
      if (existe) {
        await queryRunner.query(`ALTER TABLE pedidos DROP COLUMN ${col};`);
      }
    }
  }
}
