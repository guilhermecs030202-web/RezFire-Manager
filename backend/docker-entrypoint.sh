#!/bin/sh
set -e

echo "=================================================="
echo "🔥 RezFire Manager - Inicializando Container"
echo "=================================================="

# Aguarda o banco de dados estar acessível
echo "⏳ Verificando disponibilidade do banco MySQL..."
while ! nc -z "$DB_HOST" "$DB_PORT"; do
  echo "Aguardando MySQL responder em ${DB_HOST}:${DB_PORT}..."
  sleep 2
done
echo "✅ MySQL conectado com sucesso!"

# Executa migrações pendentes
echo "🔄 Sincronizando schema via Migrations..."
npm run migration:run || true

# Executa o seed de dados iniciais (gestor, produtos e estoque)
echo "🌱 Verificando e populando dados iniciais..."
node dist/database/seed.js || true

echo "=================================================="
echo "🚀 RezFire Manager pronto na porta ${PORT:-3001}"
echo "=================================================="

# Inicia a aplicação
exec node dist/server.js

