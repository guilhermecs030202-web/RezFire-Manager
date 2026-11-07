import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColunasLucroRealPedidos1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const colunas: { nome: string; tipo: string }[] = [
      { nome: 'tipo_anuncio', tipo: "VARCHAR(20) DEFAULT 'Classico'" },
      { nome: 'custo_produtos', tipo: 'DECIMAL(10,2) DEFAULT 0.00' },
      { nome: 'aliquota_imposto_percentual', tipo: 'DECIMAL(5,2) DEFAULT 6.00' },
      { nome: 'custo_impostos', tipo: 'DECIMAL(10,2) DEFAULT 0.00' },
      { nome: 'custo_embalagem', tipo: 'DECIMAL(10,2) DEFAULT 5.00' },
      { nome: 'tarifa_ml_percentual', tipo: 'DECIMAL(5,2) DEFAULT 12.00' },
      { nome: 'tarifa_ml_comissao', tipo: 'DECIMAL(10,2) DEFAULT 0.00' },
      { nome: 'tarifa_ml_fixa', tipo: 'DECIMAL(10,2) DEFAULT 0.00' },
      { nome: 'custo_frete', tipo: 'DECIMAL(10,2) DEFAULT 0.00' },
      { nome: 'custo_ads', tipo: 'DECIMAL(10,2) DEFAULT 0.00' },
      { nome: 'total_custos_fixos', tipo: 'DECIMAL(10,2) DEFAULT 0.00' },
      { nome: 'total_tarifas_plataforma', tipo: 'DECIMAL(10,2) DEFAULT 0.00' },
      { nome: 'lucro_liquido', tipo: 'DECIMAL(10,2) DEFAULT 0.00' },
      { nome: 'margem_liquida_percentual', tipo: 'DECIMAL(5,2) DEFAULT 0.00' },
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
      'margem_liquida_percentual',
      'lucro_liquido',
      'total_tarifas_plataforma',
      'total_custos_fixos',
      'custo_ads',
      'custo_frete',
      'tarifa_ml_fixa',
      'tarifa_ml_comissao',
      'tarifa_ml_percentual',
      'custo_embalagem',
      'custo_impostos',
      'aliquota_imposto_percentual',
      'custo_produtos',
      'tipo_anuncio',
    ];

    for (const col of colunas) {
      const existe = await queryRunner.hasColumn('pedidos', col);
      if (existe) {
        await queryRunner.query(`ALTER TABLE pedidos DROP COLUMN ${col};`);
      }
    }
  }
}

