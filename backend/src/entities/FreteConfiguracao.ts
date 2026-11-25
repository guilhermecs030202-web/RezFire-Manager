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

@Entity('frete_configuracoes')
export class FreteConfiguracao {
  @PrimaryGeneratedColumn({ name: 'frete_configuracao_id', type: 'int', unsigned: true })
  frete_configuracao_id: number;

  @Column({
    name: 'frete_taxa_percentual_padrao',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 4.5,
  })
  frete_taxa_percentual_padrao: number;

  @Column({
    name: 'frete_transportadora_padrao',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  frete_transportadora_padrao: string | null;

  @Column({
    name: 'frete_atualizado_por_usuario_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  frete_atualizado_por_usuario_id: number | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'frete_atualizado_por_usuario_id' })
  frete_atualizado_por_usuario?: Usuario | null;

  @CreateDateColumn({ name: 'frete_configuracao_criada_em', type: 'timestamp' })
  frete_configuracao_criada_em: Date;

  @UpdateDateColumn({ name: 'frete_configuracao_atualizada_em', type: 'timestamp' })
  frete_configuracao_atualizada_em: Date;
}
