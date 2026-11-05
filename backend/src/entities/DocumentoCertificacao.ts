import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('documentos_certificacao')
@Index(['tipo_entidade', 'entidade_id'])
export class DocumentoCertificacao {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_documento: number;

  @Column({ type: 'enum', enum: ['PRODUTO', 'ANUNCIO'] })
  tipo_entidade: 'PRODUTO' | 'ANUNCIO';

  @Column({ type: 'int', unsigned: true })
  entidade_id: number;

  @Column({ type: 'varchar', length: 255 })
  nome_arquivo_original: string;

  @Column({ type: 'varchar', length: 500 })
  caminho_disco: string;

  @Column({ type: 'int', unsigned: true })
  tamanho_bytes: number;

  @Column({ type: 'varchar', length: 100 })
  mime_type: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

