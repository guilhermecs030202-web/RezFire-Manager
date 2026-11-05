import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Usuario } from './Usuario';
import { AnuncioML } from './AnuncioML';

@Entity('conexoes_mercado_livre')
export class ConexaoMercadoLivre {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_conexao: number;

  @Column({ type: 'int', unsigned: true })
  id_usuario: number;

  @ManyToOne(() => Usuario, (usuario) => usuario.conexoes_ml, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ml_user_id: string;

  @Column({ type: 'text', nullable: true })
  access_token: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refresh_token: string;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @Column({
    type: 'enum',
    enum: ['Conectado', 'Desconectado', 'Expirado'],
    default: 'Desconectado',
  })
  status: 'Conectado' | 'Desconectado' | 'Expirado';

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => AnuncioML, (anuncio) => anuncio.conexao)
  anuncios: AnuncioML[];
}

