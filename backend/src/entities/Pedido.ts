import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ItemPedido } from './ItemPedido';

@Entity('pedidos')
@Index(['status', 'data_pedido'])
export class Pedido {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_pedido: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  codigo_pedido: string;

  @Column({
    type: 'enum',
    enum: ['Confirmado', 'Concluido', 'Cancelado'],
    default: 'Confirmado',
  })
  status: 'Confirmado' | 'Concluido' | 'Cancelado';

  @Column({ type: 'varchar', length: 150, nullable: true })
  cliente_nome: string;

  @Column({ type: 'varchar', length: 50, default: 'Mercado Livre' })
  origem: string;

  @Column({ type: 'timestamp' })
  data_pedido: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  valor_total: number;

  @Column({ type: 'boolean', default: false })
  exibir_na_entrega: boolean;

  @Column({
    type: 'enum',
    enum: ['A separar', 'Pronto p/ despacho', 'Despachado', 'Entregue'],
    default: 'A separar',
  })
  status_entrega: 'A separar' | 'Pronto p/ despacho' | 'Despachado' | 'Entregue';

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => ItemPedido, (item) => item.pedido, { cascade: true })
  itens: ItemPedido[];
}

