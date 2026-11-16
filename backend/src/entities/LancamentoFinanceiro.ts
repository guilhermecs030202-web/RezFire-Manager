import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from './Usuario';

export type TipoLancamento = 'Receita' | 'Despesa';
export type ClassificacaoLancamento = 'Empresa' | 'Pessoal';

@Entity('lancamentos_financeiros')
export class LancamentoFinanceiro {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_lancamento: number;

  @Column({ type: 'varchar', length: 255 })
  descricao: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valor: number;

  @Column({
    type: 'enum',
    enum: ['Receita', 'Despesa'],
    default: 'Despesa',
  })
  tipo: TipoLancamento;

  @Column({
    type: 'enum',
    enum: ['Empresa', 'Pessoal'],
    default: 'Empresa',
  })
  classificacao: ClassificacaoLancamento;

  @Column({ type: 'varchar', length: 100, default: 'Operacional' })
  categoria: string;

  @Column({ type: 'date' })
  data_competencia: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comprovante_url: string | null;

  @Column({ type: 'text', nullable: true })
  observacoes: string | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_usuario: number | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}

