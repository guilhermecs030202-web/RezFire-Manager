import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ItemPedido } from './ItemPedido';
import { Customer } from './Customer';

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

  @Column({ name: 'id_cliente', type: 'int', unsigned: true, nullable: true })
  id_cliente: number | null;

  @ManyToOne(() => Customer, (cliente) => cliente.pedidos, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_cliente' })
  cliente: Customer | null;

  @Column({ type: 'varchar', length: 50, default: 'Mercado Livre' })
  origem: string;

  @Column({
    type: 'enum',
    enum: ['manual', 'mercado_livre'],
    default: 'manual',
  })
  origem_dado: 'manual' | 'mercado_livre';

  @Column({ type: 'varchar', length: 64, nullable: true })
  codigo_externo_ml: string | null;

  @Column({ type: 'boolean', default: true })
  baixa_estoque_realizada: boolean;

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

  // ── Modalidade de Envio e Prazos (SCRUM-27 / #24) ──
  @Column({ type: 'varchar', length: 50, default: 'Coleta' })
  modalidade_envio: 'Tradicional' | 'Coleta' | 'Full' | 'Logística Própria' | string;

  @Column({ type: 'int', default: 3 })
  prazo_dias_estimado: number;

  @Column({ type: 'timestamp', nullable: true })
  data_entrega_efetiva: Date | null;

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

  // ── Dados Fiscais do Destinatário & Desconto Comercial (Story 33c) ──
  @Column({ type: 'varchar', length: 14, nullable: true })
  destinatario_documento: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  destinatario_ie: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  destinatario_cep: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  destinatario_logradouro: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  destinatario_numero: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  destinatario_complemento: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  destinatario_bairro: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  destinatario_municipio: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  destinatario_codigo_municipio_ibge: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  destinatario_uf: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  destinatario_email: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  valor_desconto: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => ItemPedido, (item) => item.pedido, { cascade: true })
  itens: ItemPedido[];
}

