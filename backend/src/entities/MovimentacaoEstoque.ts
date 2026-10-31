import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Produto } from './Produto';
import { Usuario } from './Usuario';

@Entity('movimentacoes_estoque')
export class MovimentacaoEstoque {
  @PrimaryGeneratedColumn()
  id_movimentacao!: number;

  @Column({ name: 'id_produto' })
  id_produto!: number;

  @ManyToOne(() => Produto, (produto) => produto.movimentacoes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_produto' })
  produto!: Produto;

  @Column({ name: 'id_usuario', nullable: true })
  id_usuario!: number | null;

  @ManyToOne(() => Usuario, (usuario) => usuario.movimentacoes, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_usuario' })
  usuario!: Usuario | null;

  @Column({ type: 'varchar', length: 20 })
  tipo!: string; // 'Entrada' | 'Saída'

  @Column({ type: 'int' })
  quantidade!: number;

  @Column({ type: 'varchar', length: 120 })
  motivo!: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  data_movimentacao!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  preco_unitario!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  valor_total!: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true, default: 'Gestor RezFire' })
  responsavel!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  codigo_pedido!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  canal!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  tipo_envio!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  cliente!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  uf!: string | null;

  @Column({ type: 'json', nullable: true })
  detalhes_remessa!: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at!: Date;
}
