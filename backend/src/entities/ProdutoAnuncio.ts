import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Produto } from './Produto';
import { AnuncioML } from './AnuncioML';

@Entity('produto_anuncio')
export class ProdutoAnuncio {
  @PrimaryColumn({ type: 'int', unsigned: true })
  id_produto: number;

  @PrimaryColumn({ type: 'int', unsigned: true })
  id_anuncio: number;

  @ManyToOne(() => Produto, (produto) => produto.produto_anuncios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_produto' })
  produto: Produto;

  @ManyToOne(() => AnuncioML, (anuncio) => anuncio.produto_anuncios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_anuncio' })
  anuncio: AnuncioML;

  @Column({ type: 'int', default: 1 })
  quantidade_anunciada: number;
}

