import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { MovimentacaoEstoque } from './MovimentacaoEstoque';
import { ConexaoMercadoLivre } from './ConexaoMercadoLivre';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_usuario: number;

  @Column({ type: 'varchar', length: 150 })
  nome: string;

  @Column({ type: 'varchar', length: 191, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  senha_hash: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @OneToMany(() => MovimentacaoEstoque, (mov) => mov.usuario)
  movimentacoes: MovimentacaoEstoque[];

  @OneToMany(() => ConexaoMercadoLivre, (conexao) => conexao.usuario)
  conexoes_ml: ConexaoMercadoLivre[];
}

