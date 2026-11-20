import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModoManualOrigemDado341700000000015 implements MigrationInterface {
  name = 'AddModoManualOrigemDado341700000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Campos em pedidos: origem_dado ('manual' | 'mercado_livre'), codigo_externo_ml e baixa_estoque_realizada
    const hasOrigemDadoPedidos = await queryRunner.hasColumn('pedidos', 'origem_dado');
    if (!hasOrigemDadoPedidos) {
      await queryRunner.query(`
        ALTER TABLE \`pedidos\`
        ADD COLUMN \`origem_dado\` ENUM('manual', 'mercado_livre') NOT NULL DEFAULT 'manual' AFTER \`origem\`
      `);
      await queryRunner.query(`
        UPDATE \`pedidos\`
        SET \`origem_dado\` = CASE
          WHEN \`codigo_pedido\` LIKE 'MLB-%' AND \`origem\` = 'Mercado Livre' THEN 'mercado_livre'
          ELSE 'manual'
        END
      `);
    }

    const hasCodigoExternoPedidos = await queryRunner.hasColumn('pedidos', 'codigo_externo_ml');
    if (!hasCodigoExternoPedidos) {
      await queryRunner.query(`
        ALTER TABLE \`pedidos\`
        ADD COLUMN \`codigo_externo_ml\` VARCHAR(64) NULL AFTER \`origem_dado\`
      `);
      await queryRunner.query(`
        UPDATE \`pedidos\`
        SET \`codigo_externo_ml\` = REPLACE(\`codigo_pedido\`, 'MLB-', '')
        WHERE \`codigo_pedido\` LIKE 'MLB-%' AND \`codigo_externo_ml\` IS NULL
      `);
    }

    const hasBaixaRealizadaPedidos = await queryRunner.hasColumn('pedidos', 'baixa_estoque_realizada');
    if (!hasBaixaRealizadaPedidos) {
      await queryRunner.query(`
        ALTER TABLE \`pedidos\`
        ADD COLUMN \`baixa_estoque_realizada\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`codigo_externo_ml\`
      `);
    }

    // 2. Campos em anuncios_ml: tornar id_conexao nullable (para cadastro manual sem conta conectada),
    // adicionar origem_dado ('manual' | 'mercado_livre') e codigo_externo_ml
    await queryRunner.query(`
      ALTER TABLE \`anuncios_ml\`
      MODIFY COLUMN \`id_conexao\` INT UNSIGNED NULL
    `);

    const hasOrigemDadoAnuncios = await queryRunner.hasColumn('anuncios_ml', 'origem_dado');
    if (!hasOrigemDadoAnuncios) {
      await queryRunner.query(`
        ALTER TABLE \`anuncios_ml\`
        ADD COLUMN \`origem_dado\` ENUM('manual', 'mercado_livre') NOT NULL DEFAULT 'manual' AFTER \`ml_item_id\`
      `);
      await queryRunner.query(`
        UPDATE \`anuncios_ml\`
        SET \`origem_dado\` = CASE
          WHEN \`ml_item_id\` LIKE 'MAN-%' THEN 'manual'
          WHEN \`ultima_sincronizacao\` IS NOT NULL THEN 'mercado_livre'
          ELSE 'manual'
        END
      `);
    }

    const hasCodigoExternoAnuncios = await queryRunner.hasColumn('anuncios_ml', 'codigo_externo_ml');
    if (!hasCodigoExternoAnuncios) {
      await queryRunner.query(`
        ALTER TABLE \`anuncios_ml\`
        ADD COLUMN \`codigo_externo_ml\` VARCHAR(64) NULL AFTER \`origem_dado\`
      `);
      await queryRunner.query(`
        UPDATE \`anuncios_ml\`
        SET \`codigo_externo_ml\` = \`ml_item_id\`
        WHERE \`ml_item_id\` LIKE 'MLB%' AND \`codigo_externo_ml\` IS NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('anuncios_ml', 'codigo_externo_ml')) {
      await queryRunner.query(`ALTER TABLE \`anuncios_ml\` DROP COLUMN \`codigo_externo_ml\``);
    }
    if (await queryRunner.hasColumn('anuncios_ml', 'origem_dado')) {
      await queryRunner.query(`ALTER TABLE \`anuncios_ml\` DROP COLUMN \`origem_dado\``);
    }
    if (await queryRunner.hasColumn('pedidos', 'baixa_estoque_realizada')) {
      await queryRunner.query(`ALTER TABLE \`pedidos\` DROP COLUMN \`baixa_estoque_realizada\``);
    }
    if (await queryRunner.hasColumn('pedidos', 'codigo_externo_ml')) {
      await queryRunner.query(`ALTER TABLE \`pedidos\` DROP COLUMN \`codigo_externo_ml\``);
    }
    if (await queryRunner.hasColumn('pedidos', 'origem_dado')) {
      await queryRunner.query(`ALTER TABLE \`pedidos\` DROP COLUMN \`origem_dado\``);
    }
  }
}

