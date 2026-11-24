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
import { Return } from './Return';
import { Produto } from './Produto';

export type ReturnReason =
  | 'DEFEITO'
  | 'AVARIA_TRANSPORTE'
  | 'PRODUTO_ERRADO'
  | 'DIVERGENCIA_DESCRICAO'
  | 'ARREPENDIMENTO'
  | 'OUTRO';

export type ReturnItemDestination = 'RECUPERADO' | 'DESCARTADO' | 'EM_AVALIACAO';

@Entity('itens_devolucao')
@Index('idx_item_dev_devolucao', ['idDevolucao'])
@Index('idx_item_dev_produto', ['idProduto'])
@Index('idx_item_dev_motivo', ['motivo'])
export class ReturnItem {
  @PrimaryGeneratedColumn({ name: 'id_item_devolucao', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'id_devolucao', type: 'int', unsigned: true })
  idDevolucao: number;

  @ManyToOne(() => Return, (ret) => ret.itens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_devolucao' })
  devolucao: Return;

  @Column({ name: 'id_produto', type: 'int', unsigned: true })
  idProduto: number;

  @ManyToOne(() => Produto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_produto' })
  produto: Produto;

  @Column({ name: 'quantidade', type: 'int' })
  quantidade: number;

  @Column({ name: 'valor_unitario', type: 'decimal', precision: 10, scale: 2 })
  valorUnitario: number;

  @Column({ name: 'subtotal', type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({
    name: 'motivo',
    type: 'enum',
    enum: [
      'DEFEITO',
      'AVARIA_TRANSPORTE',
      'PRODUTO_ERRADO',
      'DIVERGENCIA_DESCRICAO',
      'ARREPENDIMENTO',
      'OUTRO',
    ],
  })
  motivo: ReturnReason;

  @Column({ name: 'detalhe_motivo', type: 'text', nullable: true })
  detalheMotivo: string | null;

  @Column({
    name: 'destino_item',
    type: 'enum',
    enum: ['RECUPERADO', 'DESCARTADO', 'EM_AVALIACAO'],
    default: 'EM_AVALIACAO',
  })
  destinoItem: ReturnItemDestination;

  @Column({ name: 'custo_perda_item', type: 'decimal', precision: 10, scale: 2, default: 0 })
  custoPerdaItem: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
