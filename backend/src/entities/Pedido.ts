import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ItemPedido } from './ItemPedido';

@Entity('pedidos')
@Index(['status', 'data_pedido'])
export class Pedido {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_pedido: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  codigo_pedido: string;

  @Column({
    type: 'enum',
    enum: ['Confirmado', 'Concluido', 'Cancelado'],
    default: 'Confirmado',
  })
  status: 'Confirmado' | 'Concluido' | 'Cancelado';

  @Column({ type: 'varchar', length: 150, nullable: true })
  cliente_nome: string;

  @Column({ type: 'varchar', length: 50, default: 'Mercado Livre' })
  origem: string;

  @Column({ type: 'timestamp' })
  data_pedido: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  valor_total: number;

  @Column({ type: 'boolean', default: false })
  exibir_na_entrega: boolean;

  @Column({
    type: 'enum',
    enum: ['A separar', 'Pronto p/ despacho', 'Despachado', 'Entregue'],
    default: 'A separar',
  })
  status_entrega: 'A separar' | 'Pronto p/ despacho' | 'Despachado' | 'Entregue';

  @Column({ type: 'timestamp', nullable: true })
  prazo_despacho: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  data_despacho: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  motivo_devolucao: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tipo_ocorrencia: 'Cancelamento' | 'Devolucao' | 'Mediacao' | string | null;

  @Column({ type: 'text', nullable: true })
  detalhe_devolucao: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  protocolo_mediacao: string | null;

  @Column({ type: 'timestamp', nullable: true })
  data_devolucao: Date | null;

  // ── Módulo Financeiro: Lucro Real por Venda (SCRUM-23 / #18abc) ──
  @Column({ type: 'varchar', length: 20, default: 'Classico' })
  tipo_anuncio: 'Classico' | 'Premium' | 'Direta' | string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  custo_produtos: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 6.00 })
  aliquota_imposto_percentual: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  custo_impostos: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 5.00 })
  custo_embalagem: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 12.00 })
  tarifa_ml_percentual: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tarifa_ml_comissao: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tarifa_ml_fixa: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  custo_frete: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  custo_ads: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_custos_fixos: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_tarifas_plataforma: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  lucro_liquido: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  margem_liquida_percentual: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => ItemPedido, (item) => item.pedido, { cascade: true })
  itens: ItemPedido[];
}

