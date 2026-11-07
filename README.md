# 🔥 RezFire Manager

> Sistema web de gestão de estoque, vendas e indicadores operacionais desenvolvido para a **RezFire**, empresa especializada no comércio e distribuição de extintores de incêndio e equipamentos de segurança.

---

## 🛠️ Stack Tecnológica

* **Frontend:** HTML5, CSS3, JavaScript (ES6+), Tailwind CSS, ApexCharts.
* **Backend:** Node.js, TypeScript, Express, TypeORM.
* **Banco de Dados:** MySQL 8.0.
* **Infraestrutura:** Docker & Docker Compose.

---

## 🚀 Como Rodar o Projeto com Docker (Recomendado)

Todo o ecossistema (MySQL, Backend Node/TypeScript compilado, Frontend e phpMyAdmin) está configurado para subir com **um único comando**.

### Pré-requisitos
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução.

### Passo 1: Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/RezFire-Manager.git
cd RezFire-Manager
```

### Passo 2: Iniciar os Contêineres
```bash
docker compose up -d --build
```

O Docker fará o seguinte automaticamente:
1. Subirá o contêiner do **MySQL 8.0** com persistência em volume.
2. Aguardará o banco ficar saudável (*healthcheck* ativo).
3. Construirá a imagem do **Backend**.
4. Executará as **Migrations** do TypeORM (criando todas as 12 tabelas).
5. Executará o **Seed** inicial (criando o usuário gestor, catálogo de extintores, lotes FEFO e estoque).
6. Subirá a aplicação na porta `3001` e o **phpMyAdmin** na porta `8080`.

---

## 🌐 URLs e Acessos

| Serviço | URL | Descrição |
| :--- | :--- | :--- |
| **Aplicação RezFire Manager** | [http://localhost:3001](http://localhost:3001) | Tela de Login, Dashboard, Produtos, Estoque e Pedidos |
| **Health Check API** | [http://localhost:3001/api/health](http://localhost:3001/api/health) | Status operacional da API backend |
| **phpMyAdmin** | [http://localhost:8080](http://localhost:8080) | Painel web para inspecionar e gerenciar o MySQL |
| **MySQL Direto** | `localhost:3306` | Para conexões via DBeaver, MySQL Workbench, etc. |

### 🔑 Credenciais de Acesso Padrão

* **Acesso ao Sistema (RezFire Manager):**
  * **E-mail:** `gestor@rezfire.com.br`
  * **Senha:** `rezfire2026`
* **Acesso ao Banco de Dados (MySQL e phpMyAdmin):**
  * **Usuário:** `root`
  * **Senha:** `root`
  * **Database:** `RezFireDB`

---

## 💻 Desenvolvimento com Hot-Reload (Docker)

Se você for alterar arquivos do backend ou frontend e quiser que o servidor reinicie automaticamente sem precisar recriar a imagem:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## 🛠️ Comandos Úteis do Docker

* **Ver logs em tempo real:**
  ```bash
  docker compose logs -f
  ```
* **Ver logs apenas do backend:**
  ```bash
  docker compose logs -f backend
  ```
* **Parar os serviços:**
  ```bash
  docker compose down
  ```
* **Parar e limpar os volumes (reiniciar banco do zero):**
  ```bash
  docker compose down -v
  ```
* **Rodar migrations manualmente dentro do contêiner:**
  ```bash
  docker compose exec backend npm run migration:run
  ```
* **Rodar seed novamente dentro do contêiner:**
  ```bash
  docker compose exec backend npm run seed
  ```

---

## ⚙️ Executando sem Docker (Ambiente Local Tradicional)

Caso prefira rodar localmente sem Docker:

### 1. Requisitos
* Node.js 20+ instalado
* MySQL 8.0 rodando localmente na porta 3306

### 2. Configurar o Banco
1. Crie o database no MySQL:
   ```sql
   CREATE DATABASE RezFireDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Configure o arquivo `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   # Ajuste DB_USER e DB_PASSWORD conforme seu MySQL local
   ```

### 3. Instalar Dependências e Executar
```bash
cd backend
npm install
npm run migration:run   # Cria as tabelas
npm run seed            # Insere dados de teste
npm run dev             # Inicia o servidor em modo desenvolvimento
```
Acesse [http://localhost:3001](http://localhost:3001) no navegador.

---

## 📁 Estrutura do Projeto

```text
RezFire-Manager/
├── backend/
│   ├── src/
│   │   ├── config/         # Configurações do TypeORM e variáveis de ambiente
│   │   ├── controllers/    # Controladores de rota
│   │   ├── entities/       # Entidades ORM (MySQL)
│   │   ├── migrations/     # Migrações versionadas de banco de dados
│   │   ├── database/       # Seed de inicialização de dados
│   │   ├── routes/         # Definição das rotas da API
│   │   ├── services/       # Regras de negócio e serviços
│   │   └── server.ts       # Ponto de entrada da API Express
│   ├── Dockerfile          # Imagem de produção multi-stage do backend
│   └── docker-entrypoint.sh# Script de inicialização automática (wait, migrations, seed)
├── frontend/               # Páginas HTML, CSS (Tailwind) e JavaScript
├── docker-compose.yml      # Orquestração principal (MySQL, Backend, phpMyAdmin)
├── docker-compose.dev.yml  # Override para desenvolvimento com Hot-Reload
├── .dockerignore           # Arquivos excluídos do build Docker
└── README.md               # Guia oficial de documentação
```
