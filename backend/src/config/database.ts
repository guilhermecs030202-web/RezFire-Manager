import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Produto } from '../entities/Produto';
import { Estoque } from '../entities/Estoque';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'rezfire',
  synchronize: true, // Em desenvolvimento: cria/atualiza tabelas automaticamente
  logging: false,
  entities: [Produto, Estoque],
  migrations: [],
  subscribers: [],
});
