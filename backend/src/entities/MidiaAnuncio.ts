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

@Entity('midias_anuncio')
@Index(['id_anuncio', 'ordem'])
export class MidiaAnuncio {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_midia: number;

  @Column({ type: 'int', unsigned: true })
  id_anuncio: number;

  @ManyToOne(() => AnuncioML, (a) => a.midias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_anuncio' })
  anuncio: AnuncioML;

  @Column({ type: 'varchar', length: 16, default: 'imagem' })
  tipo: 'imagem' | 'video';

  @Column({ type: 'varchar', length: 150 })
  rotulo: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
