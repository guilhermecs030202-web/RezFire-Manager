import 'reflect-metadata';
import app from './app';
import { env } from './config/env';
import { AppDataSource } from './config/database';
import { mlWebhookWorker } from './workers/mlWebhookWorker';
import { mlReconciliationCron } from './cron/mlReconciliationCron';

async function bootstrap() {
  console.log('🔥 Inicializando RezFire Manager API...');

  try {
    // 1. Conexão com o Banco de Dados MySQL
    console.log(`🔌 Conectando ao MySQL em ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}...`);
    await AppDataSource.initialize();
    console.log('✅ Conexão com o MySQL estabelecida com sucesso!');

    // 2. Executa migrations pendentes automaticamente na inicialização
    console.log('🔄 Verificando e executando migrations pendentes...');
    const migrations = await AppDataSource.runMigrations();
    if (migrations.length > 0) {
      console.log(`✓ ${migrations.length} migration(s) executada(s) com sucesso:`);
      migrations.forEach((m) => console.log(`   - ${m.name}`));
    } else {
      console.log('✓ Nenhuma migration pendente. Schema atualizado.');
    }

    // 3. Inicializa o servidor HTTP
    app.listen(env.PORT, () => {
      console.log(`🚀 Servidor RezFire Manager rodando na porta ${env.PORT}`);
      console.log(`🔗 Health check: http://localhost:${env.PORT}/api/health`);

      // 4. Inicia o Worker de Webhooks e Cron do Mercado Livre
      mlWebhookWorker.iniciar(10000); // Processa fila a cada 10s
      mlReconciliationCron.iniciar(30); // Reconciliação periódica preventiva
    });
  } catch (error) {
    console.error('❌ Falha crítica ao inicializar o servidor RezFire:', error);
    process.exit(1);
  }
}

bootstrap();

