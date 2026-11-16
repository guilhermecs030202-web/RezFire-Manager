import 'reflect-metadata';
import { DataSource } from 'typeorm';
import path from 'path';
import { env } from './env';
import {
  Usuario,
  Produto,
  Estoque,
  LoteEstoque,
  MovimentacaoEstoque,
  Pedido,
  ItemPedido,
  ConexaoMercadoLivre,
  AnuncioML,
  ProdutoAnuncio,
  DocumentoCertificacao,
  EventoMercadoLivre,
  InspecaoQualidade,
  OcorrenciaAnuncio,
  MidiaAnuncio,
  Notificacao,
  RespostaPadrao,
  LancamentoFinanceiro,
} from '../entities';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  synchronize: false, // Usamos migrations para controle seguro e versionado de schema
  logging: process.env.NODE_ENV === 'development',
  entities: [
    Usuario,
    Produto,
    Estoque,
    LoteEstoque,
    MovimentacaoEstoque,
    Pedido,
    ItemPedido,
    ConexaoMercadoLivre,
    AnuncioML,
    ProdutoAnuncio,
    DocumentoCertificacao,
    EventoMercadoLivre,
    InspecaoQualidade,
    OcorrenciaAnuncio,
    MidiaAnuncio,
    Notificacao,
    RespostaPadrao,
    LancamentoFinanceiro,
  ],
  migrations: [path.join(__dirname, '../migrations/*{.ts,.js}')],
  subscribers: [],
});

