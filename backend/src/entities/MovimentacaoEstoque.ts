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
import { Usuario } from './Usuario';

@Entity('movimentacoes_estoque')
@Index(['id_produto', 'data_movimentacao'])
@Index(['tipo', 'data_movimentacao'])
export class MovimentacaoEstoque {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_movimentacao: number;

  @Column({ type: 'int', unsigned: true })
  id_produto: number;

  @ManyToOne(() => Produto, (produto) => produto.movimentacoes, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_produto' })
  produto: Produto;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_usuario: number | null;

  @ManyToOne(() => Usuario, (usuario) => usuario.movimentacoes, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario | null;

  @Column({ type: 'enum', enum: ['Entrada', 'Saída'] })
  tipo: 'Entrada' | 'Saída';

  @Column({ type: 'int' })
  quantidade: number;

  @Column({ type: 'varchar', length: 255 })
  motivo: string;

  @CreateDateColumn({ type: 'timestamp' })
  data_movimentacao: Date;
}

