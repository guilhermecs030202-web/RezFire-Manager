import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('emitente_fiscal')
export class EmitenteFiscal {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_emitente: number;

  @Column({ type: 'varchar', length: 255 })
  razao_social: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nome_fantasia: string | null;

  @Column({ type: 'varchar', length: 14, unique: true })
  cnpj: string;

  @Column({ type: 'varchar', length: 20 })
  inscricao_estadual: string;

  @Column({ type: 'enum', enum: ['1', '2', '3', '4'], default: '1' })
  regime_tributario: '1' | '2' | '3' | '4';

  @Column({ type: 'varchar', length: 8 })
  cep: string;

  @Column({ type: 'varchar', length: 255 })
  logradouro: string;

  @Column({ type: 'varchar', length: 20 })
  numero: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  complemento: string | null;

  @Column({ type: 'varchar', length: 100 })
  bairro: string;

  @Column({ type: 'varchar', length: 100 })
  municipio: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  codigo_municipio_ibge: string | null;

  @Column({ type: 'varchar', length: 2, default: 'SP' })
  uf: string;

  @Column({ type: 'int', unsigned: true, default: 1 })
  serie_nfe: number;

  @Column({ type: 'int', unsigned: true, default: 1 })
  proximo_numero_nfe: number;

  @Column({ type: 'enum', enum: ['homologacao', 'producao'], default: 'homologacao' })
  ambiente: 'homologacao' | 'producao';

  @Column({ type: 'enum', enum: ['sefaz_direto', 'intermediario'], default: 'sefaz_direto' })
  modo_integracao: 'sefaz_direto' | 'intermediario';

  @Column({ type: 'timestamp', nullable: true })
  ambiente_producao_confirmado_em: Date | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  ambiente_producao_confirmado_por: number | null;

  // Segredos do Certificado A1 protegidos com AES-256-GCM e select: false
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  certificado_arquivo_enc: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  senha_certificado_enc: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  certificado_hash_sha256: string | null;

  // Metadados públicos do certificado instalado
  @Column({ type: 'varchar', length: 255, nullable: true })
  certificado_titular: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  certificado_emissor: string | null;

  @Column({ type: 'varchar', length: 14, nullable: true })
  certificado_cnpj: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  certificado_serial: string | null;

  @Column({ type: 'timestamp', nullable: true })
  certificado_valido_de: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  certificado_valido_ate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  certificado_atualizado_em: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}

