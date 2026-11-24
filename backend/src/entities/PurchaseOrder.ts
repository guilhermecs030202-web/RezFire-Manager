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
import { Supplier } from './Supplier';
import { PurchaseOrderItem } from './PurchaseOrderItem';

export type PurchaseOrderStatus =
  | 'RASCUNHO'
  | 'ABERTO'
  | 'PARCIAL'
  | 'RECEBIDO'
  | 'CANCELADO'
  | 'ATRASADO';

@Entity('pedidos_compra')
@Index('idx_pc_fornecedor', ['idFornecedor'])
@Index('idx_pc_status', ['status'])
@Index('idx_pc_emissao', ['dataEmissao'])
@Index('idx_pc_previsao', ['dataPrevisaoEntrega'])
@Index('idx_pc_recebimento', ['dataRecebimento'])
export class PurchaseOrder {
  @PrimaryGeneratedColumn({ name: 'id_pedido_compra', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'numero_pedido', type: 'varchar', length: 50, unique: true })
  numeroPedido: string;

  @Column({ name: 'id_fornecedor', type: 'int', unsigned: true })
  idFornecedor: number;

  @ManyToOne(() => Supplier, (s) => s.purchaseOrders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_fornecedor' })
  supplier: Supplier;

  @Column({ name: 'data_emissao', type: 'datetime' })
  dataEmissao: Date;

  @Column({ name: 'data_previsao_entrega', type: 'date' })
  dataPrevisaoEntrega: Date;

  @Column({ name: 'data_recebimento', type: 'datetime', nullable: true })
  dataRecebimento: Date | null;

  @Column({
    name: 'condicoes_pagamento',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  condicoesPagamento: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['RASCUNHO', 'ABERTO', 'PARCIAL', 'RECEBIDO', 'CANCELADO', 'ATRASADO'],
    default: 'RASCUNHO',
  })
  status: PurchaseOrderStatus;

  @Column({ name: 'valor_total', type: 'decimal', precision: 12, scale: 2, default: 0 })
  valorTotal: number;

  @Column({ name: 'valor_frete', type: 'decimal', precision: 10, scale: 2, default: 0 })
  valorFrete: number;

  @Column({ name: 'valor_desconto', type: 'decimal', precision: 10, scale: 2, default: 0 })
  valorDesconto: number;

  @Column({ name: 'observacoes', type: 'text', nullable: true })
  observacoes: string | null;

  @Column({ name: 'motivo_cancelamento', type: 'text', nullable: true })
  motivoCancelamento: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, { cascade: true })
  items: PurchaseOrderItem[];
}
