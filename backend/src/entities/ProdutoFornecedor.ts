import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Produto } from './Produto';
import { Supplier } from './Supplier';

@Entity('produto_fornecedor')
@Index('idx_prod_forn_unique', ['idProduto', 'idFornecedor'], { unique: true })
@Index('idx_prod_forn_produto', ['idProduto'])
@Index('idx_prod_forn_fornecedor', ['idFornecedor'])
export class ProdutoFornecedor {
  @PrimaryGeneratedColumn({ name: 'id_produto_fornecedor', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'id_produto', type: 'int', unsigned: true })
  idProduto: number;

  @ManyToOne(() => Produto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_produto' })
  produto: Produto;

  @Column({ name: 'id_fornecedor', type: 'int', unsigned: true })
  idFornecedor: number;

  @ManyToOne(() => Supplier, (s) => s.produtosFornecedor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_fornecedor' })
  supplier: Supplier;

  @Column({ name: 'principal', type: 'boolean', default: true })
  principal: boolean;

  @Column({ name: 'custo_compra', type: 'decimal', precision: 10, scale: 2, default: 0 })
  custoCompra: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
