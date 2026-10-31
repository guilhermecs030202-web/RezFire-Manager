import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { AppDataSource } from './config/database';
import produtosRouter from './routes/produtos';

const app = express();
const PORT = process.env.PORT || 3333;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.use('/api/produtos', produtosRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rota não encontrada
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Inicializa conexão com o banco e sobe o servidor
AppDataSource.initialize()
  .then(() => {
    console.log('✅ Banco de dados conectado com sucesso.');
    app.listen(PORT, () => {
      console.log(`🚀 Servidor RezFire Manager rodando em http://localhost:${PORT}`);
      console.log(`📋 API de produtos: http://localhost:${PORT}/api/produtos`);
    });
  })
  .catch((err) => {
    console.error('❌ Erro ao conectar no banco de dados:', err);
    process.exit(1);
  });
