import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddTabelaNotificacoes1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('notificacoes');
    if (!tableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'notificacoes',
          columns: [
            {
              name: 'id_notificacao',
              type: 'int',
              unsigned: true,
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'id_usuario',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'tipo',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'canal',
              type: 'varchar',
              length: '20',
              default: "'TODOS'",
            },
            {
              name: 'titulo',
              type: 'varchar',
              length: '200',
              isNullable: false,
            },
            {
              name: 'mensagem',
              type: 'text',
              isNullable: false,
            },
            {
              name: 'link',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'dados_origem',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'lida',
              type: 'boolean',
              default: false,
            },
            {
              name: 'enviado_email',
              type: 'boolean',
              default: true,
            },
            {
              name: 'created_at',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true
      );

      await queryRunner.createForeignKey(
        'notificacoes',
        new TableForeignKey({
          columnNames: ['id_usuario'],
          referencedTableName: 'usuarios',
          referencedColumnNames: ['id_usuario'],
          onDelete: 'CASCADE',
        })
      );

      await queryRunner.createIndices('notificacoes', [
        new TableIndex({
          name: 'IDX_NOTIFICACAO_USUARIO_DATA',
          columnNames: ['id_usuario', 'created_at'],
        }),
        new TableIndex({
          name: 'IDX_NOTIFICACAO_USUARIO_LIDA',
          columnNames: ['id_usuario', 'lida'],
        }),
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('notificacoes');
    if (tableExists) {
      await queryRunner.dropTable('notificacoes', true);
    }
  }
}
