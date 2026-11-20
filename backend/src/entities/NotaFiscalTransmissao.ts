import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { NotaFiscal } from './NotaFiscal';
import { Usuario } from './Usuario';

export type TipoOperacaoTransmissao = 'autorizacao' | 'consulta_protocolo' | 'status_servico';
export type ResultadoTransmissao =
  | 'autorizada'
  | 'em_processamento'
  | 'rejeitada'
  | 'denegada'
  | 'indisponivel'
  | 'consulta_vazia'
  | 'erro_interno';

@Entity('notas_fiscais_transmissoes')
@Index(['id_nota_fiscal'])
@Index(['created_at'])
export class NotaFiscalTransmissao {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_transmissao: number;

  @Column({ type: 'int', unsigned: true })
  id_nota_fiscal: number;

  @ManyToOne(() => NotaFiscal, (nf) => nf.transmissoes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_nota_fiscal' })
  nota_fiscal: NotaFiscal;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_usuario: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario | null;

  @Column({
    type: 'enum',
    enum: ['autorizacao', 'consulta_protocolo', 'status_servico'],
  })
  tipo_operacao: TipoOperacaoTransmissao;

  @Column({
    type: 'enum',
    enum: ['simulado', 'sefaz_soap'],
    default: 'simulado',
  })
  modo_transporte: 'simulado' | 'sefaz_soap';

  @Column({
    type: 'enum',
    enum: ['homologacao', 'producao'],
    default: 'homologacao',
  })
  ambiente: 'homologacao' | 'producao';

  @Column({ type: 'int', unsigned: true, default: 1 })
  tentativa_numero: number;

  @Column({ type: 'boolean', default: false })
  sucesso_comunicacao: boolean;

  @Column({
    type: 'enum',
    enum: [
      'autorizada',
      'em_processamento',
      'rejeitada',
      'denegada',
      'indisponivel',
      'consulta_vazia',
      'erro_interno',
    ],
  })
  resultado: ResultadoTransmissao;

  @Column({ type: 'int', nullable: true })
  http_status: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  codigo_sefaz: string | null;

  @Column({ type: 'text', nullable: true })
  motivo_sefaz: string | null;

  @Column({ type: 'text', nullable: true })
  mensagem_amigavel: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  numero_recibo: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  protocolo: string | null;

  @Column({ type: 'varchar', length: 44, nullable: true })
  chave_acesso: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  endpoint_url: string | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  duracao_ms: number | null;

  @Column({ type: 'text', nullable: true })
  erro_rede: string | null;

  @Column({ type: 'longtext', nullable: true })
  xml_requisicao: string | null;

  @Column({ type: 'longtext', nullable: true })
  xml_resposta: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

