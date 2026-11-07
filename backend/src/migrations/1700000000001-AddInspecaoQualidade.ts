import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInspecaoQualidade1700000000001 implements MigrationInterface {
  name = 'AddInspecaoQualidade1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inspecoes_qualidade (
        id_inspecao INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_produto INT UNSIGNED NOT NULL,
        id_lote INT UNSIGNED NULL,
        id_movimentacao INT UNSIGNED NULL,
        id_usuario INT UNSIGNED NULL,
        tipo_inspecao ENUM('Entrada', 'Separacao') NOT NULL DEFAULT 'Entrada',
        checklist JSON NOT NULL,
        resultado ENUM('Aprovado', 'Reprovado', 'Aprovado Parcial') NOT NULL DEFAULT 'Aprovado',
        quantidade_total INT NOT NULL,
        quantidade_aprovada INT NOT NULL,
        quantidade_reprovada INT NOT NULL DEFAULT 0,
        motivo_reprovacao VARCHAR(255) NULL,
        destino_reprovados ENUM('Devolucao Fornecedor', 'Descarte', 'Quarentena') NULL,
        observacoes TEXT NULL,
        responsavel VARCHAR(150) NOT NULL,
        data_inspecao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_inspecao_prod_data (id_produto, data_inspecao),
        INDEX idx_inspecao_resultado_data (resultado, data_inspecao),
        CONSTRAINT fk_inspecao_produto FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE RESTRICT,
        CONSTRAINT fk_inspecao_lote FOREIGN KEY (id_lote) REFERENCES lotes_estoque(id_lote) ON DELETE SET NULL,
        CONSTRAINT fk_inspecao_movimentacao FOREIGN KEY (id_movimentacao) REFERENCES movimentacoes_estoque(id_movimentacao) ON DELETE SET NULL,
        CONSTRAINT fk_inspecao_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS inspecoes_qualidade;`);
  }
}

