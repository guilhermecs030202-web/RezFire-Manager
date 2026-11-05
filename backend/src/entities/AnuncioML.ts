import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { ConexaoMercadoLivre } from './ConexaoMercadoLivre';
import { ProdutoAnuncio } from './ProdutoAnuncio';

@Entity('anuncios_ml')
export class AnuncioML {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_anuncio: number;

  @Column({ type: 'int', unsigned: true })
  id_conexao: number;

  @ManyToOne(() => ConexaoMercadoLivre, (c) => c.anuncios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_conexao' })
  conexao: ConexaoMercadoLivre;

  @Column({ type: 'varchar', length: 64, unique: true })
  ml_item_id: string;

  @Column({ type: 'varchar', length: 255 })
  titulo: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  preco: number;

  @Column({ type: 'varchar', length: 32, default: 'Ativo' })
  status: string;

  @Column({ type: 'int', default: 0 })
  quantidade_disponivel: number;

  @Column({ type: 'int', default: 0 })
  quantidade_vendida: number;

  @Column({ type: 'int', default: 0 })
  visitas: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url: string;

  @Column({ type: 'timestamp', nullable: true })
  ultima_sincronizacao: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => ProdutoAnuncio, (pa) => pa.anuncio)
  produto_anuncios: ProdutoAnuncio[];
}

