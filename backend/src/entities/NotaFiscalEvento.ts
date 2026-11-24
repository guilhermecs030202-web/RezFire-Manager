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

export type TipoEventoFiscal = 'cancelamento' | 'carta_correcao';
export type StatusEventoFiscal = 'registrado' | 'rejeitado' | 'indisponivel';

@Entity('notas_fiscais_eventos')
@Index(['id_nota_fiscal'])
@Index(['tipo_evento'])
@Index(['created_at'])
export class NotaFiscalEvento {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_evento: number;

  @Column({ type: 'int', unsigned: true })
  id_nota_fiscal: number;

  @ManyToOne(() => NotaFiscal, (nf) => nf.eventos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_nota_fiscal' })
  nota_fiscal: NotaFiscal;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_usuario: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario | null;

  @Column({ type: 'enum', enum: ['cancelamento', 'carta_correcao'] })
  tipo_evento: TipoEventoFiscal;

  @Column({ type: 'varchar', length: 6 })
  codigo_tipo_evento: string;

  @Column({ type: 'int', unsigned: true, default: 1 })
  sequencia: number;

  @Column({ type: 'enum', enum: ['homologacao', 'producao'], default: 'homologacao' })
  ambiente: 'homologacao' | 'producao';

  @Column({ type: 'enum', enum: ['simulado', 'sefaz_soap'], default: 'simulado' })
  modo_transporte: 'simulado' | 'sefaz_soap';

  @Column({ type: 'enum', enum: ['registrado', 'rejeitado', 'indisponivel'] })
  status: StatusEventoFiscal;

  @Column({ type: 'text' })
  descricao_evento: string;

  @Column({ type: 'text', nullable: true })
  condicao_uso: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  codigo_sefaz: string | null;

  @Column({ type: 'text', nullable: true })
  motivo_sefaz: string | null;

  @Column({ type: 'text', nullable: true })
  mensagem_amigavel: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  protocolo_evento: string | null;

  @Column({ type: 'timestamp', nullable: true })
  data_evento: Date | null;

  @Column({ type: 'longtext', nullable: true })
  xml_envio: string | null;

  @Column({ type: 'longtext', nullable: true })
  xml_retorno: string | null;

  @Column({ type: 'longtext', nullable: true })
  xml_evento_autorizado: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  xml_evento_path: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

