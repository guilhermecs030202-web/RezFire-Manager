import { AppDataSource } from '../config/database';
import { EventoMercadoLivre } from '../entities/EventoMercadoLivre';
import { Usuario } from '../entities/Usuario';
import { MercadoLivreService } from '../services/mercadolivre.service';

const mlService = new MercadoLivreService();

export class MLWebhookWorker {
  private isRunning: boolean = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  /**
   * Processa os próximos eventos pendentes na fila
   */
  async processarProximosEventos(limite: number = 5) {
    if (!AppDataSource.isInitialized) return;

    const eventoRepo = AppDataSource.getRepository(EventoMercadoLivre);
    const usuarioRepo = AppDataSource.getRepository(Usuario);

    const gestor = await usuarioRepo.findOne({ where: { ativo: true } });
    if (!gestor) return;

    const eventosPendentes = await eventoRepo.find({
      where: { status: 'PENDENTE' },
      order: { created_at: 'ASC' },
      take: limite,
    });

    for (const evento of eventosPendentes) {
      try {
        await mlService.processarEvento(evento.id, gestor.id_usuario);
      } catch (err) {
        console.error(`[Worker ML] Erro ao processar evento #${evento.id}:`, err);
      }
    }
  }

  /**
   * Inicia o worker em background com intervalo configurável
   */
  iniciar(intervaloMs: number = 10000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`⚡ [Worker ML] Fila de Webhooks do Mercado Livre iniciada (polling a cada ${intervaloMs / 1000}s)...`);

    this.intervalTimer = setInterval(async () => {
      try {
        await this.processarProximosEventos();
      } catch (err) {
        console.error('[Worker ML] Erro no loop de processamento:', err);
      }
    }, intervaloMs);
  }

  /**
   * Para o worker graciosamente
   */
  parar() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('🛑 [Worker ML] Worker encerrado.');
  }
}

export const mlWebhookWorker = new MLWebhookWorker();

