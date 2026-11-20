import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pedido } from './Pedido';
import { NotaFiscalItem } from './NotaFiscalItem';

@Entity('notas_fiscais')
@Index(['ambiente', 'serie', 'numero'], { unique: true })
export class NotaFiscal {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_nota_fiscal: number;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_pedido: number | null;

  @ManyToOne(() => Pedido, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_pedido' })
  pedido: Pedido | null;

  @Column({ type: 'enum', enum: ['homologacao', 'producao'], default: 'homologacao' })
  ambiente: 'homologacao' | 'producao';

  @Column({ type: 'int', unsigned: true })
  serie: number;

  @Column({ type: 'int', unsigned: true })
  numero: number;

  @Column({ type: 'varchar', length: 44, nullable: true, unique: true })
  chave_acesso: string | null;

  @Column({
    type: 'enum',
    enum: ['rascunho', 'em_processamento', 'autorizada', 'rejeitada', 'denegada', 'cancelada'],
    default: 'rascunho',
  })
  status: 'rascunho' | 'em_processamento' | 'autorizada' | 'rejeitada' | 'denegada' | 'cancelada';

  @Column({ type: 'varchar', length: 64, nullable: true })
  protocolo_autorizacao: string | null;

  @Column({ type: 'json', nullable: true })
  emitente_snapshot: Record<string, any> | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  valor_total: number;

  @Column({ type: 'timestamp', nullable: true })
  emitida_em: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => NotaFiscalItem, (item) => item.nota_fiscal, { cascade: true })
  itens: NotaFiscalItem[];
}

