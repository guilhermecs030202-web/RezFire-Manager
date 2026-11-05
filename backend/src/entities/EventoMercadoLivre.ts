import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('eventos_mercado_livre')
@Index(['status', 'created_at'])
export class EventoMercadoLivre {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  id_evento_ml: string;

  @Column({ type: 'varchar', length: 64 })
  topic: string; // ex: 'orders_v2', 'items'

  @Column({ type: 'varchar', length: 255 })
  resource: string; // ex: '/orders/20000049281729'

  @Column({ type: 'json', nullable: true })
  payload: any;

  @Column({
    type: 'enum',
    enum: ['PENDENTE', 'PROCESSADO', 'ERRO', 'IGNORADO'],
    default: 'PENDENTE',
  })
  status: 'PENDENTE' | 'PROCESSADO' | 'ERRO' | 'IGNORADO';

  @Column({ type: 'int', default: 0 })
  tentativas: number;

  @Column({ type: 'text', nullable: true })
  erro_mensagem: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}

