import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerfilEAtualizacoesSprint2170000000002 implements MigrationInterface {
  name = 'AddPerfilEAtualizacoesSprint2170000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Adiciona coluna 'perfil' na tabela usuarios caso ainda não exista
    const temPerfil = await queryRunner.hasColumn('usuarios', 'perfil');
    if (!temPerfil) {
      await queryRunner.query(`
        ALTER TABLE usuarios ADD COLUMN perfil VARCHAR(50) NOT NULL DEFAULT 'GESTOR' AFTER senha_hash;
      `);
      // Garante que o gestor existente tenha perfil GESTOR
      await queryRunner.query(`
        UPDATE usuarios SET perfil = 'GESTOR' WHERE email = 'gestor@rezfire.com.br';
      `);
    }

    // 2. Colunas de devolução/mediação em pedidos (SCRUM-22 / #11)
    const colunasPedidos = [
      { nome: 'motivo_devolucao', tipo: 'VARCHAR(100) NULL' },
      { nome: 'tipo_ocorrencia', tipo: 'VARCHAR(50) NULL' },
      { nome: 'detalhe_devolucao', tipo: 'TEXT NULL' },
      { nome: 'protocolo_mediacao', tipo: 'VARCHAR(100) NULL' },
      { nome: 'data_devolucao', tipo: 'TIMESTAMP NULL' },
    ];

    for (const col of colunasPedidos) {
      const existe = await queryRunner.hasColumn('pedidos', col.nome);
      if (!existe) {
        await queryRunner.query(`ALTER TABLE pedidos ADD COLUMN ${col.nome} ${col.tipo};`);
      }
    }

    // 3. Colunas de reposicionamento em anuncios_ml (SCRUM-20 / #15)
    const colunasAnuncios = [
      { nome: 'foi_recriado', tipo: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { nome: 'motivo_exclusao', tipo: 'VARCHAR(255) NULL' },
      { nome: 'data_exclusao', tipo: 'TIMESTAMP NULL' },
      { nome: 'data_recriacao', tipo: 'TIMESTAMP NULL' },
      { nome: 'tempo_reposicionamento_dias', tipo: 'INT NULL' },
      { nome: 'id_anuncio_substituto', tipo: 'INT UNSIGNED NULL' },
      { nome: 'ml_item_id_substituto', tipo: 'VARCHAR(50) NULL' },
      { nome: 'id_anuncio_origem', tipo: 'INT UNSIGNED NULL' },
      { nome: 'ml_item_id_origem', tipo: 'VARCHAR(50) NULL' },
    ];

    for (const col of colunasAnuncios) {
      const existe = await queryRunner.hasColumn('anuncios_ml', col.nome);
      if (!existe) {
        await queryRunner.query(`ALTER TABLE anuncios_ml ADD COLUMN ${col.nome} ${col.tipo};`);
      }
    }

    // 4. Cria tabela de ocorrências de anúncio (SCRUM-19 / #14)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ocorrencias_anuncio (
        id_ocorrencia INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_anuncio INT UNSIGNED NOT NULL,
        tipo_evento VARCHAR(50) NOT NULL,
        titulo VARCHAR(150) NOT NULL,
        detalhe TEXT NOT NULL,
        autor VARCHAR(100) NOT NULL DEFAULT 'Gestor RezFire',
        dados_adicionais JSON NULL,
        data_ocorrencia TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ocorrencia_anuncio (id_anuncio, data_ocorrencia),
        CONSTRAINT fk_ocorrencia_anuncio FOREIGN KEY (id_anuncio) REFERENCES anuncios_ml(id_anuncio) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Cria tabela de mídias de anúncio (SCRUM-26 / #23)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS midias_anuncio (
        id_midia INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_anuncio INT UNSIGNED NOT NULL,
        tipo ENUM('FOTO', 'VIDEO') NOT NULL DEFAULT 'FOTO',
        rotulo VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        ordem INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_midia_anuncio (id_anuncio, ordem),
        CONSTRAINT fk_midia_anuncio FOREIGN KEY (id_anuncio) REFERENCES anuncios_ml(id_anuncio) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS midias_anuncio;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ocorrencias_anuncio;`);
    const temPerfil = await queryRunner.hasColumn('usuarios', 'perfil');
    if (temPerfil) {
      await queryRunner.query(`ALTER TABLE usuarios DROP COLUMN perfil;`);
    }
  }
}
