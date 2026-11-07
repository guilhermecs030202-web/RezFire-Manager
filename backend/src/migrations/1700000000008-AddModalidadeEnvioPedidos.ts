import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModalidadeEnvioPedidos1700000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const colunas: { nome: string; tipo: string }[] = [
      { nome: 'modalidade_envio', tipo: "VARCHAR(50) DEFAULT 'Coleta'" },
      { nome: 'prazo_dias_estimado', tipo: 'INT DEFAULT 3' },
      { nome: 'data_entrega_efetiva', tipo: 'TIMESTAMP NULL' },
    ];

    for (const col of colunas) {
      const existe = await queryRunner.hasColumn('pedidos', col.nome);
      if (!existe) {
        await queryRunner.query(`ALTER TABLE pedidos ADD COLUMN ${col.nome} ${col.tipo};`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const colunas = ['data_entrega_efetiva', 'prazo_dias_estimado', 'modalidade_envio'];
    for (const col of colunas) {
      const existe = await queryRunner.hasColumn('pedidos', col);
      if (existe) {
        await queryRunner.query(`ALTER TABLE pedidos DROP COLUMN ${col};`);
      }
    }
  }
}
