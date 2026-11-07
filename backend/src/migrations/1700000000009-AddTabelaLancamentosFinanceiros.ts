import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTabelaLancamentosFinanceiros1700000000009 implements MigrationInterface {
  name = 'AddTabelaLancamentosFinanceiros1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
        id_lancamento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        descricao VARCHAR(255) NOT NULL,
        valor DECIMAL(10, 2) NOT NULL,
        tipo ENUM('Receita', 'Despesa') NOT NULL DEFAULT 'Despesa',
        classificacao ENUM('Empresa', 'Pessoal') NOT NULL DEFAULT 'Empresa',
        categoria VARCHAR(100) NOT NULL DEFAULT 'Operacional',
        data_competencia DATE NOT NULL,
        comprovante_url VARCHAR(500) NULL,
        observacoes TEXT NULL,
        id_usuario INT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_lancamento_classificacao (classificacao),
        INDEX idx_lancamento_tipo (tipo),
        INDEX idx_lancamento_competencia (data_competencia),
        CONSTRAINT fk_lancamento_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seeds de demonstração para segregação patrimonial Empresa (PJ) x Pessoal (PF)
    const gestorRes = await queryRunner.query(`SELECT id_usuario FROM usuarios WHERE email = 'gestor@rezfire.com.br' LIMIT 1`);
    const idGestor = gestorRes.length > 0 ? gestorRes[0].id_usuario : null;

    const dataHoje = new Date().toISOString().split('T')[0];
    const dataOntem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataCincoDias = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await queryRunner.query(`
      INSERT INTO lancamentos_financeiros 
        (descricao, valor, tipo, classificacao, categoria, data_competencia, observacoes, id_usuario)
      VALUES 
        ('Compra de Caixas e Plástico Bolha para Despacho ML', 450.00, 'Despesa', 'Empresa', 'Insumos / Embalagem', '${dataCincoDias}', 'Despesa operacional corporativa para proteção de cilindros.', ${idGestor ? idGestor : 'NULL'}),
        ('Lote de 500 Lacres e Anéis INMETRO de Extintores', 850.00, 'Despesa', 'Empresa', 'Certificação / Inmetro', '${dataCincoDias}', 'Conformidade legal e laudos técnicos perante Bombeiros.', ${idGestor ? idGestor : 'NULL'}),
        ('Pró-labore Mensal do Gestor (Retirada PJ -> PF)', 3500.00, 'Despesa', 'Empresa', 'Pró-labore / Retiradas', '${dataOntem}', 'Transferência formal de pró-labore corporativo para conta física.', ${idGestor ? idGestor : 'NULL'}),
        ('Aluguel Residencial do Gestor', 1800.00, 'Despesa', 'Pessoal', 'Despesa Pessoal', '${dataOntem}', 'Despesa estritamente pessoal do gestor (não dedutível PJ).', ${idGestor ? idGestor : 'NULL'}),
        ('Plano de Saúde Familiar do Gestor', 920.00, 'Despesa', 'Pessoal', 'Saúde Pessoal', '${dataHoje}', 'Pagamento via conta PF.', ${idGestor ? idGestor : 'NULL'}),
        ('Recebimento de Pró-labore / Dividendos RezFire', 3500.00, 'Receita', 'Pessoal', 'Rendimento Pessoal', '${dataOntem}', 'Crédito em conta pessoal oriundo da operação RezFire.', ${idGestor ? idGestor : 'NULL'})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lancamentos_financeiros`);
  }
}
