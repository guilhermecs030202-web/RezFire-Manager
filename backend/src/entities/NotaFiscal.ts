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
import { Pedido } from './Pedido';
import { NotaFiscalItem } from './NotaFiscalItem';
import { NotaFiscalTransmissao } from './NotaFiscalTransmissao';
import { NotaFiscalEvento } from './NotaFiscalEvento';

@Entity('notas_fiscais')
@Index(['ambiente', 'serie', 'numero'], { unique: true })
export class NotaFiscal {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_nota_fiscal: number;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_pedido: number | null;

  @ManyToOne(() => Pedido, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_pedido' })
  pedido: Pedido | null;

  @Column({ type: 'enum', enum: ['homologacao', 'producao'], default: 'homologacao' })
  ambiente: 'homologacao' | 'producao';

  @Column({ type: 'int', unsigned: true })
  serie: number;

  @Column({ type: 'int', unsigned: true })
  numero: number;

  @Column({ type: 'varchar', length: 44, nullable: true, unique: true })
  chave_acesso: string | null;

  @Column({
    type: 'enum',
    enum: ['rascunho', 'assinada', 'em_processamento', 'autorizada', 'rejeitada', 'denegada', 'cancelada'],
    default: 'rascunho',
  })
  status: 'rascunho' | 'assinada' | 'em_processamento' | 'autorizada' | 'rejeitada' | 'denegada' | 'cancelada';

  @Column({ type: 'varchar', length: 64, nullable: true })
  protocolo_autorizacao: string | null;

  @Column({ type: 'json', nullable: true })
  emitente_snapshot: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  destinatario_snapshot: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  totais_snapshot: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  impostos_snapshot: Record<string, any> | null;

  @Column({ type: 'longtext', nullable: true })
  xml_gerado: string | null;

  @Column({ type: 'longtext', nullable: true })
  xml_assinado: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  digest_value: string | null;

  @Column({ type: 'boolean', default: false })
  assinatura_valida: boolean;

  @Column({ type: 'timestamp', nullable: true })
  assinada_em: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  assinada_por_certificado_serial: string | null;

  @Column({ type: 'varchar', length: 10, default: '4.00' })
  versao_layout: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  valor_total: number;

  @Column({ type: 'timestamp', nullable: true })
  emitida_em: Date | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  ultimo_codigo_sefaz: string | null;

  @Column({ type: 'text', nullable: true })
  ultimo_motivo_sefaz: string | null;

  @Column({ type: 'text', nullable: true })
  ultima_mensagem_amigavel: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  numero_recibo: string | null;

  @Column({ type: 'longtext', nullable: true })
  xml_autorizado: string | null;

  @Column({ type: 'timestamp', nullable: true })
  autorizada_em: Date | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  tentativas_envio: number;

  @Column({ type: 'timestamp', nullable: true })
  ultima_tentativa_em: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  codigo_pedido_snapshot: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  xml_autorizado_path: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  xml_autorizado_sha256: string | null;

  @Column({ type: 'timestamp', nullable: true })
  xml_arquivado_em: Date | null;

  @Column({ type: 'date', nullable: true })
  guarda_legal_ate: string | null;

  @Column({ type: 'timestamp', nullable: true })
  danfe_gerado_em: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelada_em: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  protocolo_cancelamento: string | null;

  @Column({ type: 'text', nullable: true })
  justificativa_cancelamento: string | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  total_cartas_correcao: number;

  @Column({ type: 'timestamp', nullable: true })
  ultima_carta_correcao_em: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => NotaFiscalItem, (item) => item.nota_fiscal, { cascade: true })
  itens: NotaFiscalItem[];

  @OneToMany(() => NotaFiscalTransmissao, (transmissao) => transmissao.nota_fiscal)
  transmissoes: NotaFiscalTransmissao[];

  @OneToMany(() => NotaFiscalEvento, (evento) => evento.nota_fiscal)
  eventos: NotaFiscalEvento[];
}

