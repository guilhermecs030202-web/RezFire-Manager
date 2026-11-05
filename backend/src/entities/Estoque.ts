import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Produto } from './Produto';

@Entity('estoque')
export class Estoque {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_estoque: number;

  @Column({ type: 'int', unsigned: true, unique: true })
  id_produto: number;

  @OneToOne(() => Produto, (produto) => produto.estoque, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_produto' })
  produto: Produto;

  @Column({ type: 'int', default: 0 })
  quantidade_atual: number;

  @Column({ type: 'int', default: 0 })
  estoque_minimo: number;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}

