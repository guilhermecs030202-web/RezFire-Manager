import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Pedido } from './Pedido';

export type CustomerSource = 'PRESENCIAL' | 'MERCADO_LIVRE';

@Entity('clientes')
@Index('idx_cliente_source', ['source'])
@Index('idx_cliente_document', ['document'])
export class Customer {
  @PrimaryGeneratedColumn({ name: 'id_cliente', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'nome', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'documento', type: 'varchar', length: 20, nullable: true })
  document: string | null;

  @Column({ name: 'email', type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ name: 'telefone', type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ name: 'cidade', type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ name: 'estado', type: 'varchar', length: 10, nullable: true })
  state: string | null;

  @Column({ name: 'cep', type: 'varchar', length: 15, nullable: true })
  zipCode: string | null;

  @Column({ name: 'observacoes', type: 'text', nullable: true })
  notes: string | null;

  @Column({
    name: 'origem',
    type: 'enum',
    enum: ['PRESENCIAL', 'MERCADO_LIVRE'],
    default: 'PRESENCIAL',
  })
  source: CustomerSource;

  @Index('idx_cliente_external_id', { unique: true })
  @Column({ name: 'external_id', type: 'varchar', length: 100, nullable: true })
  externalId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => Pedido, (pedido) => pedido.cliente)
  pedidos: Pedido[];
}
