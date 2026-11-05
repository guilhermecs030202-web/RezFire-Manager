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
import { LoteEstoque } from './LoteEstoque';
import { MovimentacaoEstoque } from './MovimentacaoEstoque';
import { ItemPedido } from './ItemPedido';
import { ProdutoAnuncio } from './ProdutoAnuncio';

@Entity('produtos')
export class Produto {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_produto: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  custo: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  preco: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  categoria: string;

  @Column({ type: 'enum', enum: ['Simples', 'Combo'], default: 'Simples' })
  tipo: 'Simples' | 'Combo';

  @Column({ type: 'json', nullable: true })
  combo_items: { id_produto: number; quantidade: number }[] | null;

  @Column({ type: 'json', nullable: true })
  detalhes_extintor: {
    registro_inmetro?: string;
    tipo_extintor?: string;
    capacidade_peso?: string;
    classe_incendio?: string;
    fabricante?: string;
    data_fabricacao?: string;
    data_validade?: string;
    numero_lacre?: string;
    selo_conformidade?: string;
    id_lote?: string;
    peso_bruto_kg?: number | string;
    dimensoes?: string;
  } | null;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToOne(() => Estoque, (estoque) => estoque.produto)
  estoque: Estoque;

  @OneToMany(() => LoteEstoque, (lote) => lote.produto)
  lotes: LoteEstoque[];

  @OneToMany(() => MovimentacaoEstoque, (mov) => mov.produto)
  movimentacoes: MovimentacaoEstoque[];

  @OneToMany(() => ItemPedido, (item) => item.produto)
  itens_pedido: ItemPedido[];

  @OneToMany(() => ProdutoAnuncio, (pa) => pa.produto)
  produto_anuncios: ProdutoAnuncio[];
}

