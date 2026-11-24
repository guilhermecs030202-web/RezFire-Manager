import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndicesEDadosHistoricoClientes1700000000017 implements MigrationInterface {
  name = 'AddIndicesEDadosHistoricoClientes1700000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Cria índice em clientes.created_at para acelerar filtros de novos clientes por período
    const idxExists = await queryRunner.query(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'clientes' 
        AND INDEX_NAME = 'idx_cliente_created_at';
    `);

    if (!idxExists || idxExists.length === 0) {
      await queryRunner.query(`
        CREATE INDEX idx_cliente_created_at ON clientes (created_at);
      `);
    }

    // 2. Garante índice em pedidos.data_pedido
    const idxPedidoData = await queryRunner.query(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'pedidos' 
        AND INDEX_NAME = 'idx_pedido_data_pedido';
    `);

    if (!idxPedidoData || idxPedidoData.length === 0) {
      await queryRunner.query(`
        CREATE INDEX idx_pedido_data_pedido ON pedidos (data_pedido);
      `);
    }

    // 3. Cadastra clientes adicionais para garantir diversidade geográfica e canais nos gráficos
    await queryRunner.query(`
      INSERT INTO clientes 
        (id_cliente, nome, documento, email, telefone, cidade, estado, cep, observacoes, origem, external_id, created_at)
      VALUES 
        (10, 'Indústria Metalúrgica Paranaense SA', '33.444.555/0001-88', 'seguranca@indmetal.com.br', '(41) 3388-9900', 'São José dos Pinhais', 'PR', '83005-000', 'Cliente recorrente de recarga e cilindros industriais CO2.', 'PRESENCIAL', NULL, DATE_SUB(NOW(), INTERVAL 45 DAY)),
        (11, 'Auto Posto PetroSul LTDA', '11.222.333/0001-44', 'gerencia@petrosul.com.br', '(44) 3022-1100', 'Maringá', 'PR', '87010-000', 'Extintores PQS 4kg e 6kg para pistas de abastecimento.', 'PRESENCIAL', NULL, DATE_SUB(NOW(), INTERVAL 75 DAY)),
        (12, 'Logística & Transportes Catarinense', '22.333.444/0001-55', 'frotas@transcatarina.com.br', '(47) 3455-8899', 'Joinville', 'SC', '89201-000', 'Kit de extintores automotivos para caminhões.', 'PRESENCIAL', NULL, DATE_SUB(NOW(), INTERVAL 15 DAY)),
        (13, 'Juliana Andrade (COMPRADOR_ML_SP)', NULL, 'juliana.andrade.ml@gmail.com', '(11) 97654-3210', 'Campinas', 'SP', '13010-100', 'Compra online pelo Mercado Livre.', 'MERCADO_LIVRE', 'ML_BUYER_SP_01', DATE_SUB(NOW(), INTERVAL 20 DAY)),
        (14, 'Rodrigo Meirelles (COMPRADOR_ML_RJ)', NULL, 'rodrigo.m@yahoo.com.br', '(21) 98877-6655', 'Niterói', 'RJ', '24020-000', 'Extintor ABC 4kg residência.', 'MERCADO_LIVRE', 'ML_BUYER_RJ_02', DATE_SUB(NOW(), INTERVAL 5 DAY)),
        (15, 'Transportadora Rápido Minas LTDA', '44.555.666/0001-77', 'operacoes@rapidominas.com.br', '(31) 3299-4400', 'Belo Horizonte', 'MG', '30110-000', 'Cliente inativo há mais de 100 dias.', 'PRESENCIAL', NULL, DATE_SUB(NOW(), INTERVAL 120 DAY))
      ON DUPLICATE KEY UPDATE updated_at = NOW();
    `);

    // 4. Cadastra pedidos históricos vinculados a esses clientes para dar vida aos KPIs, gráficos de receita,
    // top clientes e análise de recorrência / inatividade
    await queryRunner.query(`
      INSERT INTO pedidos 
        (codigo_pedido, status, cliente_nome, id_cliente, origem, data_pedido, valor_total, modalidade_envio, status_entrega)
      VALUES 
        ('DIR-2026-IND01', 'Concluido', 'Indústria Metalúrgica Paranaense SA', 10, 'Venda Direta', DATE_SUB(NOW(), INTERVAL 35 DAY), 3450.00, 'Logística Própria', 'Entregue'),
        ('DIR-2026-IND02', 'Concluido', 'Indústria Metalúrgica Paranaense SA', 10, 'Venda Direta', DATE_SUB(NOW(), INTERVAL 10 DAY), 4200.00, 'Logística Própria', 'Entregue'),
        ('DIR-2026-PETRO1', 'Concluido', 'Auto Posto PetroSul LTDA', 11, 'Venda Direta', DATE_SUB(NOW(), INTERVAL 70 DAY), 1850.00, 'Logística Própria', 'Entregue'),
        ('DIR-2026-CAT01', 'Concluido', 'Logística & Transportes Catarinense', 12, 'Venda Direta', DATE_SUB(NOW(), INTERVAL 12 DAY), 2150.00, 'Logística Própria', 'Entregue'),
        ('MLB-20000049281729-A', 'Confirmado', 'Marcos Vinicius Santos (COMPRADOR_ML_OFICIAL)', 3, 'Mercado Livre', DATE_SUB(NOW(), INTERVAL 8 DAY), 288.90, 'Coleta', 'Pronto p/ despacho'),
        ('MLB-ML_BUYER_SP_01', 'Concluido', 'Juliana Andrade (COMPRADOR_ML_SP)', 13, 'Mercado Livre', DATE_SUB(NOW(), INTERVAL 18 DAY), 378.00, 'Coleta', 'Entregue'),
        ('MLB-ML_BUYER_RJ_02', 'Confirmado', 'Rodrigo Meirelles (COMPRADOR_ML_RJ)', 14, 'Mercado Livre', DATE_SUB(NOW(), INTERVAL 4 DAY), 188.80, 'Full', 'A separar'),
        ('DIR-2026-INATIVO', 'Concluido', 'Transportadora Rápido Minas LTDA', 15, 'Venda Direta', DATE_SUB(NOW(), INTERVAL 115 DAY), 980.00, 'Logística Própria', 'Entregue')
      ON DUPLICATE KEY UPDATE updated_at = NOW();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`DROP INDEX idx_cliente_created_at ON clientes;`);
    } catch (e) {}

    try {
      await queryRunner.query(`DROP INDEX idx_pedido_data_pedido ON pedidos;`);
    } catch (e) {}
  }
}
