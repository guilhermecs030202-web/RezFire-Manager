import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { authMiddleware } from './middlewares/authMiddleware';

import routes from './routes';

const app = express();

// Configurações de Middlewares Globais
app.use(
  cors({
    origin: true, // Permite conexões do frontend local (Live Server / browser / file://)
    credentials: true, // Essencial para envio e recebimento de cookies HttpOnly
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(env.COOKIE_SECRET));

// Rota de Health Check da API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    servico: 'RezFire Manager API',
  });
});

// Rotas da API
app.use('/api', routes);

// Servir arquivos estáticos do Frontend (HTML, CSS, JS)
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Redireciona a raiz para a tela de Login
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

// Arquivos de Certificação Inmetro (Acesso seguro no disco local do gestor)
app.use(
  '/uploads/certificados',
  authMiddleware, // Apenas o gestor autenticado pode visualizar ou baixar
  express.static(env.UPLOAD_DIR)
);

// Middleware centralizado de tratamento de erros
app.use(errorHandler);

export default app;
