import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Produto } from './Produto';
import { LoteEstoque } from './LoteEstoque';
import { MovimentacaoEstoque } from './MovimentacaoEstoque';
import { Usuario } from './Usuario';
import { Pedido } from './Pedido';

export interface ChecklistQualidadeEntrada {
  avarias_casco: boolean;     // Ausência de mossas, amassados ou deformações
  sem_corrosao: boolean;      // Ausência de corrosão / ferrugem
  rotulo_legivel: boolean;    // Rótulo, serigrafia e instruções legíveis
  manometro_pressao: boolean; // Manômetro com ponteiro na faixa verde
  lacre_acessorios: boolean;  // Lacre/selo Inmetro intacto e acessórios completos
}

export interface ChecklistQualidadeSeparacao {
  lacre_inmetro_intacto: boolean;  // Lacre e selo Inmetro intactos e legíveis
  manometro_faixa_verde: boolean;  // Manômetro com ponteiro na faixa verde
  sem_avarias_transporte: boolean; // Casco e pintura sem amassados ou deformações
  suporte_acessorios: boolean;     // Acessórios completos (mangueira, bico, suporte)
  rotulo_instrucoes: boolean;      // Rótulo e instruções de operação legíveis
}

@Entity('inspecoes_qualidade')
@Index(['id_produto', 'data_inspecao'])
@Index(['resultado', 'data_inspecao'])
export class InspecaoQualidade {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id_inspecao: number;

  @Column({ type: 'int', unsigned: true })
  id_produto: number;

  @ManyToOne(() => Produto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_produto' })
  produto: Produto;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_lote: number | null;

  @ManyToOne(() => LoteEstoque, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_lote' })
  lote: LoteEstoque | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_movimentacao: number | null;

  @ManyToOne(() => MovimentacaoEstoque, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_movimentacao' })
  movimentacao: MovimentacaoEstoque | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_pedido: number | null;

  @ManyToOne(() => Pedido, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_pedido' })
  pedido: Pedido | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  id_usuario: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario | null;

  @Column({ type: 'enum', enum: ['Entrada', 'Separacao'], default: 'Entrada' })
  tipo_inspecao: 'Entrada' | 'Separacao';

  @Column({ type: 'json' })
  checklist: ChecklistQualidadeEntrada | ChecklistQualidadeSeparacao | Record<string, boolean>;

  @Column({
    type: 'enum',
    enum: ['Aprovado', 'Reprovado', 'Aprovado Parcial'],
    default: 'Aprovado',
  })
  resultado: 'Aprovado' | 'Reprovado' | 'Aprovado Parcial';

  @Column({ type: 'int' })
  quantidade_total: number;

  @Column({ type: 'int' })
  quantidade_aprovada: number;

  @Column({ type: 'int', default: 0 })
  quantidade_reprovada: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo_reprovacao: string | null;

  @Column({
    type: 'enum',
    enum: ['Devolucao Fornecedor', 'Descarte', 'Quarentena'],
    nullable: true,
  })
  destino_reprovados: 'Devolucao Fornecedor' | 'Descarte' | 'Quarentena' | null;

  @Column({ type: 'text', nullable: true })
  observacoes: string | null;

  @Column({ type: 'varchar', length: 150 })
  responsavel: string;

  @CreateDateColumn({ type: 'timestamp' })
  data_inspecao: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

