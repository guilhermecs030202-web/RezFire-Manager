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
import { Produto } from './Produto';

@Entity('lotes_estoque')
@Index(['id_produto', 'data_validade'])
export class LoteEstoque {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_lote: number;

  @Column({ type: 'int', unsigned: true })
  id_produto: number;

  @ManyToOne(() => Produto, (produto) => produto.lotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_produto' })
  produto: Produto;

  @Column({ type: 'varchar', length: 64 })
  numero_lote: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  numero_lacre_inmetro: string;

  @Column({ type: 'date', nullable: true })
  data_fabricacao: Date | string;

  @Column({ type: 'date' })
  data_validade: Date | string;

  @Column({ type: 'int', default: 0 })
  quantidade_disponivel: number;

  @Column({
    type: 'enum',
    enum: ['Ativo', 'Bloqueado', 'Vencido', 'Esgotado'],
    default: 'Ativo',
  })
  status: 'Ativo' | 'Bloqueado' | 'Vencido' | 'Esgotado';

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}

