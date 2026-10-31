import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Estoque } from './Estoque';
import { MovimentacaoEstoque } from './MovimentacaoEstoque';

@Entity('produtos')
export class Produto {
  @PrimaryGeneratedColumn()
  id_produto!: number;

  @Column({ type: 'varchar', length: 40, unique: true })
  sku!: string;

  @Column({ type: 'varchar', length: 120 })
  nome!: string;

  @Column({ type: 'text', nullable: true, default: null })
  descricao!: string | null;

  @Column({ type: 'varchar', length: 60 })
  categoria!: string;

  @Column({ type: 'varchar', length: 20, default: 'Simples' })
  tipo!: string;

  @Column({ type: 'varchar', length: 10, default: 'un' })
  unidade_medida!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  custo!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  preco!: number;

  @Column({ type: 'boolean', default: true })
  ativo!: boolean;

  @Column({ type: 'json', nullable: true, default: null })
  detalhes_extintor!: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToOne(() => Estoque, (estoque) => estoque.produto)
  estoque!: Estoque;

  @OneToMany(() => MovimentacaoEstoque, (mov) => mov.produto)
  movimentacoes!: MovimentacaoEstoque[];
}
