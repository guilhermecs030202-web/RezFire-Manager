import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { PurchaseOrder } from './PurchaseOrder';
import { ProdutoFornecedor } from './ProdutoFornecedor';

@Entity('fornecedores')
@Index('idx_fornecedor_cnpj', ['cnpj'], { unique: true })
@Index('idx_fornecedor_ativo', ['ativo'])
export class Supplier {
  @PrimaryGeneratedColumn({ name: 'id_fornecedor', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'razao_social', type: 'varchar', length: 150 })
  razaoSocial: string;

  @Column({ name: 'nome_fantasia', type: 'varchar', length: 100, nullable: true })
  nomeFantasia: string | null;

  @Column({ name: 'cnpj', type: 'varchar', length: 20 })
  cnpj: string;

  @Column({ name: 'inscricao_estadual', type: 'varchar', length: 30, nullable: true })
  inscricaoEstadual: string | null;

  @Column({ name: 'contato_nome', type: 'varchar', length: 100, nullable: true })
  contatoNome: string | null;

  @Column({ name: 'email', type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ name: 'telefone', type: 'varchar', length: 30, nullable: true })
  telefone: string | null;

  @Column({ name: 'cep', type: 'varchar', length: 15, nullable: true })
  cep: string | null;

  @Column({ name: 'logradouro', type: 'varchar', length: 150, nullable: true })
  logradouro: string | null;

  @Column({ name: 'numero', type: 'varchar', length: 30, nullable: true })
  numero: string | null;

  @Column({ name: 'bairro', type: 'varchar', length: 100, nullable: true })
  bairro: string | null;

  @Column({ name: 'cidade', type: 'varchar', length: 100, nullable: true })
  cidade: string | null;

  @Column({ name: 'estado', type: 'varchar', length: 10, nullable: true })
  estado: string | null;

  @Column({ name: 'prazo_padrao_dias', type: 'int', default: 7 })
  prazoPadraoDias: number;

  @Column({ name: 'condicoes_pagamento', type: 'varchar', length: 150, nullable: true })
  condicoesPagamento: string | null;

  @Column({ name: 'observacoes', type: 'text', nullable: true })
  observacoes: string | null;

  @Column({ name: 'ativo', type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => PurchaseOrder, (po) => po.supplier)
  purchaseOrders: PurchaseOrder[];

  @OneToMany(() => ProdutoFornecedor, (pf) => pf.supplier)
  produtosFornecedor: ProdutoFornecedor[];
}
