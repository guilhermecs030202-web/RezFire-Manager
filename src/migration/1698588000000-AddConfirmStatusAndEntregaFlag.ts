import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to:
 *   1. Expand the `status` enum of the `pedidos` table to include the new
 *      value "Confirmado" used when the gestor confirma o pedido.
 *   2. Add a boolean flag `exibir_na_entrega` (default false) that can be used
 *      by the frontend to filter pedidos that should appear on the deliveries
 *      screen.
 *
 * This migration works for MySQL. The enum is altered by redefining the column
 * with the extended set of values. The new flag is added with a default of
 * FALSE, preserving existing rows.
 */
export class AddConfirmStatusAndEntregaFlag1698588000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1️⃣ Ajusta enum para os 3 status comerciais únicos do sistema:
    // 'Confirmado' (pago/confirmado em separação/expedição), 'Concluido' (entregue), 'Cancelado'
    await queryRunner.query(
      "ALTER TABLE pedidos MODIFY status ENUM('Confirmado','Concluido','Cancelado') NOT NULL DEFAULT 'Confirmado'",
    );

    // 2️⃣ Add the flag used by the deliveries screen.
    await queryRunner.query(
      "ALTER TABLE pedidos ADD COLUMN exibir_na_entrega BOOLEAN NOT NULL DEFAULT FALSE",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the flag.
    await queryRunner.query("ALTER TABLE pedidos DROP COLUMN exibir_na_entrega");

    // Revert enum to previous definition (without 'Confirmado').
    await queryRunner.query(
      "ALTER TABLE pedidos MODIFY status ENUM('Rascunho','Pendente','Cancelado','Entregue') NOT NULL DEFAULT 'Rascunho'",
    );
  }
}

