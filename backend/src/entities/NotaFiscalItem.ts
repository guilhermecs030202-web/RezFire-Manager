import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { NotaFiscal } from './NotaFiscal';
import { Produto } from './Produto';

@Entity('notas_fiscais_itens')
export class NotaFiscalItem {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_nota_fiscal_item: number;

  @Column({ type: 'int', unsigned: true })
  id_nota_fiscal: number;

  @ManyToOne(() => NotaFiscal, (nf) => nf.itens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_nota_fiscal' })
  nota_fiscal: NotaFiscal;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_produto: number | null;

  @ManyToOne(() => Produto, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_produto' })
  produto: Produto | null;

  @Column({ type: 'varchar', length: 64 })
  sku_snapshot: string;

  @Column({ type: 'varchar', length: 255 })
  nome_snapshot: string;

  @Column({ type: 'varchar', length: 8 })
  ncm_snapshot: string;

  @Column({ type: 'varchar', length: 4 })
  cfop_snapshot: string;

  @Column({ type: 'varchar', length: 1 })
  origem_snapshot: string;

  @Column({ type: 'varchar', length: 3 })
  cst_csosn_snapshot: string;

  @Column({ type: 'varchar', length: 6 })
  unidade_snapshot: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  cest_snapshot: string | null;

  @Column({ type: 'int', default: 1 })
  quantidade: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  valor_unitario: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  valor_total: number;
}

