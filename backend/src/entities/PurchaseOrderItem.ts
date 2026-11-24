import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PurchaseOrder } from './PurchaseOrder';
import { Produto } from './Produto';

@Entity('itens_pedido_compra')
@Index('idx_item_compra_pedido', ['idPedidoCompra'])
@Index('idx_item_compra_produto', ['idProduto'])
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn({ name: 'id_item_compra', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'id_pedido_compra', type: 'int', unsigned: true })
  idPedidoCompra: number;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_pedido_compra' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'id_produto', type: 'int', unsigned: true })
  idProduto: number;

  @ManyToOne(() => Produto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_produto' })
  produto: Produto;

  @Column({ name: 'quantidade_pedida', type: 'int' })
  quantidadePedida: number;

  @Column({ name: 'quantidade_entregue', type: 'int', default: 0 })
  quantidadeEntregue: number;

  @Column({ name: 'preco_unitario', type: 'decimal', precision: 10, scale: 2 })
  precoUnitario: number;

  @Column({ name: 'subtotal', type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
