import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('respostas_padrao')
@Index(['categoria', 'ativo'])
export class RespostaPadrao {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_resposta: number;

  @Column({ type: 'varchar', length: 150 })
  titulo: string;

  @Column({ type: 'varchar', length: 50, default: 'Geral' })
  categoria: string; // 'Validade' | 'Capacidade Extintora' | 'INMETRO & Normas' | 'Instalação & Suporte' | 'Geral'

  @Column({ type: 'varchar', length: 255, nullable: true })
  pergunta_exemplo: string | null;

  @Column({ type: 'text' })
  resposta: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tags: string | null;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ type: 'int', unsigned: true, default: 0 })
  vezes_utilizada: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
