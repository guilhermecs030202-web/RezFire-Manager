import { AppDataSource } from '../config/database';
import { Usuario } from '../entities/Usuario';
import { MercadoLivreService } from '../services/mercadolivre.service';

const mlService = new MercadoLivreService();

export class MLReconciliationCron {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Executa a reconciliação preventiva
   */
  async executarReconciliacao() {
    if (!AppDataSource.isInitialized) return;

    try {
      const usuarioRepo = AppDataSource.getRepository(Usuario);
      const gestor = await usuarioRepo.findOne({ where: { ativo: true } });
      if (!gestor) return;

      console.log('🔄 [Cron Reconciliação ML] Iniciando reconciliação preventiva de anúncios e pedidos...');
      const resultado = await mlService.reconciliar(gestor.id_usuario);
      console.log(`✓ [Cron Reconciliação ML] ${resultado.mensagem}`);
    } catch (err) {
      console.error('❌ [Cron Reconciliação ML] Falha na reconciliação periódica:', err);
    }
  }

  /**
   * Agenda a execução a cada X minutos (padrão 30 min)
   */
  iniciar(intervaloMinutos: number = 30) {
    if (this.isRunning) return;
    this.isRunning = true;
    const ms = intervaloMinutos * 60 * 1000;
    console.log(`⏰ [Cron Reconciliação ML] Agendado para executar a cada ${intervaloMinutos} minutos.`);

    this.timer = setInterval(() => {
      this.executarReconciliacao();
    }, ms);
  }

  parar() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }
}

export const mlReconciliationCron = new MLReconciliationCron();

