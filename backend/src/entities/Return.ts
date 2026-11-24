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
import { Customer } from './Customer';
import { ReturnItem } from './ReturnItem';

export type ReturnStatus = 'ABERTA' | 'EM_ANALISE' | 'CONCLUIDA' | 'RECUSADA';
export type ReturnResolutionType = 'REEMBOLSO' | 'TROCA' | 'CREDITO' | 'REPARO';

@Entity('devolucoes')
@Index('idx_dev_pedido', ['idPedido'])
@Index('idx_dev_status', ['status'])
@Index('idx_dev_abertura', ['dataAbertura'])
@Index('idx_dev_conclusao', ['dataConclusao'])
export class Return {
  @PrimaryGeneratedColumn({ name: 'id_devolucao', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'codigo_devolucao', type: 'varchar', length: 50, unique: true })
  codigoDevolucao: string;

  @Column({ name: 'id_pedido', type: 'int', unsigned: true })
  idPedido: number;

  @ManyToOne(() => Pedido, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_pedido' })
  pedido: Pedido;

  @Column({ name: 'id_cliente', type: 'int', unsigned: true, nullable: true })
  idCliente: number | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_cliente' })
  cliente: Customer | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['ABERTA', 'EM_ANALISE', 'CONCLUIDA', 'RECUSADA'],
    default: 'ABERTA',
  })
  status: ReturnStatus;

  @Column({
    name: 'tipo_resolucao',
    type: 'enum',
    enum: ['REEMBOLSO', 'TROCA', 'CREDITO', 'REPARO'],
    default: 'REEMBOLSO',
  })
  tipoResolucao: ReturnResolutionType;

  @Column({ name: 'custo_frete_reverso', type: 'decimal', precision: 10, scale: 2, default: 0 })
  custoFreteReverso: number;

  @Column({ name: 'valor_total_reembolso', type: 'decimal', precision: 10, scale: 2, default: 0 })
  valorTotalReembolso: number;

  @Column({ name: 'data_abertura', type: 'datetime' })
  dataAbertura: Date;

  @Column({ name: 'data_conclusao', type: 'datetime', nullable: true })
  dataConclusao: Date | null;

  @Column({ name: 'prazo_limite_dias', type: 'int', default: 7 })
  prazoLimiteDias: number;

  @Column({ name: 'observacoes', type: 'text', nullable: true })
  observacoes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => ReturnItem, (item) => item.devolucao, { cascade: true })
  itens: ReturnItem[];
}
