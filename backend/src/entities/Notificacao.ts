import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Usuario } from './Usuario';

@Entity('notificacoes')
@Index(['id_usuario', 'created_at'])
@Index(['id_usuario', 'lida'])
export class Notificacao {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_notificacao: number;

  @Column({ type: 'int', unsigned: true })
  id_usuario: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @Column({ type: 'varchar', length: 50 })
  tipo: string; // 'ANUNCIO_PAUSADO' | 'ANUNCIO_REBAIXADO' | 'ESTOQUE_CRITICO' | 'PEDIDO_NOVO'

  @Column({ type: 'varchar', length: 20, default: 'TODOS' })
  canal: string; // 'SISTEMA' | 'EMAIL' | 'TODOS'

  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ type: 'text' })
  mensagem: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  link: string | null;

  @Column({ type: 'json', nullable: true })
  dados_origem: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  lida: boolean;

  @Column({ type: 'boolean', default: true })
  enviado_email: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

