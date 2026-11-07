# Multi-stage build para manter a imagem leve, segura e rápida
# ==============================================================================
# Estágio 1: Build
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Dependências do sistema para compilação de módulos nativos (bcrypt)
RUN apk add --no-cache python3 make g++

# Copia manifestos de pacotes
COPY backend/package*.json ./backend/

# Instala todas as dependências necessárias para a compilação
RUN cd backend && npm install

# Copia código-fonte do backend e frontend
COPY backend ./backend
COPY frontend ./frontend

# Compila TypeScript para JavaScript (gera /app/backend/dist)
RUN cd backend && npm run build

# ==============================================================================
# Estágio 2: Runner de Execução
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Utilitários de rede para o entrypoint
RUN apk add --no-cache bash netcat-openbsd

# Copia os manifestos e instala apenas dependências de produção
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev && npm cache clean --force

# Copia os artefatos compilados e arquivos do frontend
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend ./frontend
COPY backend/src/migrations ./backend/src/migrations
COPY backend/docker-entrypoint.sh ./backend/docker-entrypoint.sh

# Permissões do script de inicialização
RUN chmod +x ./backend/docker-entrypoint.sh

# Cria diretório de armazenamento de uploads
RUN mkdir -p /app/backend/uploads/certificados

WORKDIR /app/backend

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]

