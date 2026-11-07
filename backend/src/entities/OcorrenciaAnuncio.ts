import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AnuncioML } from './AnuncioML';

@Entity('ocorrencias_anuncio')
@Index(['id_anuncio', 'data_ocorrencia'])
export class OcorrenciaAnuncio {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_ocorrencia: number;

  @Column({ type: 'int', unsigned: true })
  id_anuncio: number;

  @ManyToOne(() => AnuncioML, (a) => a.ocorrencias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_anuncio' })
  anuncio: AnuncioML;

  @Column({ type: 'varchar', length: 64 })
  tipo_evento: string;

  @Column({ type: 'varchar', length: 150 })
  titulo: string;

  @Column({ type: 'text' })
  detalhe: string;

  @Column({ type: 'varchar', length: 100, default: 'Gestor RezFire' })
  autor: string;

  @Column({ type: 'json', nullable: true })
  dados_anteriores: Record<string, any> | null;

  @Column({ type: 'timestamp' })
  data_ocorrencia: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
