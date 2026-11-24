import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Usuario } from './Usuario';

export type StatusInutilizacaoFiscal = 'autorizada' | 'rejeitada' | 'indisponivel';

@Entity('notas_fiscais_inutilizacoes')
@Index(['ambiente', 'serie', 'numero_inicial', 'numero_final'])
export class NotaFiscalInutilizacao {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_inutilizacao: number;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_usuario: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario | null;

  @Column({ type: 'enum', enum: ['homologacao', 'producao'], default: 'homologacao' })
  ambiente: 'homologacao' | 'producao';

  @Column({ type: 'enum', enum: ['simulado', 'sefaz_soap'], default: 'simulado' })
  modo_transporte: 'simulado' | 'sefaz_soap';

  @Column({ type: 'varchar', length: 2 })
  uf: string;

  @Column({ type: 'varchar', length: 2 })
  ano: string;

  @Column({ type: 'varchar', length: 14 })
  cnpj: string;

  @Column({ type: 'int', unsigned: true })
  serie: number;

  @Column({ type: 'int', unsigned: true })
  numero_inicial: number;

  @Column({ type: 'int', unsigned: true })
  numero_final: number;

  @Column({ type: 'text' })
  justificativa: string;

  @Column({ type: 'enum', enum: ['autorizada', 'rejeitada', 'indisponivel'] })
  status: StatusInutilizacaoFiscal;

  @Column({ type: 'varchar', length: 10, nullable: true })
  codigo_sefaz: string | null;

  @Column({ type: 'text', nullable: true })
  motivo_sefaz: string | null;

  @Column({ type: 'text', nullable: true })
  mensagem_amigavel: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  protocolo: string | null;

  @Column({ type: 'longtext', nullable: true })
  xml_envio: string | null;

  @Column({ type: 'longtext', nullable: true })
  xml_retorno: string | null;

  @Column({ type: 'longtext', nullable: true })
  xml_inutilizacao_autorizada: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  xml_inutilizacao_path: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

