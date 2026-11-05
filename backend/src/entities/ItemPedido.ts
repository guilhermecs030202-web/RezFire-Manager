import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Pedido } from './Pedido';
import { Produto } from './Produto';

@Entity('itens_pedido')
export class ItemPedido {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_item: number;

  @Column({ type: 'int', unsigned: true })
  id_pedido: number;

  @ManyToOne(() => Pedido, (pedido) => pedido.itens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_pedido' })
  pedido: Pedido;

  @Column({ type: 'int', unsigned: true })
  id_produto: number;

  @ManyToOne(() => Produto, (produto) => produto.itens_pedido, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_produto' })
  produto: Produto;

  @Column({ type: 'int', default: 1 })
  quantidade: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  preco_unitario: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;
}

