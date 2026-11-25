import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddTabelaFreteConfiguracoes1700000000022 implements MigrationInterface {
  name = 'AddTabelaFreteConfiguracoes1700000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const freteTabelaExiste = await queryRunner.hasTable('frete_configuracoes');
    if (!freteTabelaExiste) {
      await queryRunner.createTable(
        new Table({
          name: 'frete_configuracoes',
          columns: [
            {
              name: 'frete_configuracao_id',
              type: 'int',
              unsigned: true,
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'frete_taxa_percentual_padrao',
              type: 'decimal',
              precision: 6,
              scale: 4,
              default: '4.5000',
              isNullable: false,
            },
            {
              name: 'frete_transportadora_padrao',
              type: 'varchar',
              length: '80',
              isNullable: true,
            },
            {
              name: 'frete_atualizado_por_usuario_id',
              type: 'int',
              unsigned: true,
              isNullable: true,
            },
            {
              name: 'frete_configuracao_criada_em',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'frete_configuracao_atualizada_em',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            },
          ],
        }),
        true
      );

      const usuariosExiste = await queryRunner.hasTable('usuarios');
      if (usuariosExiste) {
        await queryRunner.createForeignKey(
          'frete_configuracoes',
          new TableForeignKey({
            name: 'FK_FRETE_CONFIGURACOES_USUARIO',
            columnNames: ['frete_atualizado_por_usuario_id'],
            referencedTableName: 'usuarios',
            referencedColumnNames: ['id_usuario'],
            onDelete: 'SET NULL',
          })
        );
      }

      // Garante registro padrão inicial com taxa de 4,5% (Mercado Livre)
      await queryRunner.query(
        `INSERT INTO frete_configuracoes (frete_taxa_percentual_padrao, frete_transportadora_padrao)
         VALUES (4.5000, NULL)`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const freteTabelaExiste = await queryRunner.hasTable('frete_configuracoes');
    if (freteTabelaExiste) {
      await queryRunner.dropTable('frete_configuracoes', true);
    }
  }
}
