# RezFire Manager --- AGENTS.md

> Contexto e regras para desenvolvimento do projeto com Cursor/Agentes
> de IA.

## 1. Objetivo

O **RezFire Manager** é um sistema web desenvolvido para a **RezFire**,
empresa que vende extintores pelo Mercado Livre.

O sistema deve centralizar:

-   cadastro e consulta de produtos;
-   controle de estoque;
-   movimentações de estoque;
-   pedidos;
-   dashboard e indicadores;
-   alertas operacionais;
-   integração com o Mercado Livre.

O sistema **não deve prometer aumento direto de vendas**. Seu papel é
organizar dados, operações, acompanhamento e apoio à tomada de decisão.

## 2. Usuário e Perfis de Acesso (RBAC)

O sistema foi concebido centrado no **gestor da RezFire** e, para atender à contingência operacional em casos de ausência do gestor (SCRUM-5 / #20), suporta **perfis de acesso diferenciados**:

1. **Gestor (Administrador)**: Acesso irrestrito a todos os módulos, configurações, relatórios financeiros e gestão de usuários.
2. **Operador (Armazém/Expedição)**: Acesso focado na operação diária (estoque, lotes FEFO, movimentações, conferência de pedidos e checklist de despacho de entregas). Acesso estritamente bloqueado a relatórios financeiros e gerenciamento de usuários.

Como o sistema é web, é obrigatório impedir acesso de pessoas não autenticadas.

### Autenticação

-   Login com e-mail e senha.
-   Não existe cadastro público (apenas o Gestor cadastra operadores).
-   Gerenciamento de usuários restrito ao perfil `GESTOR`.
-   Senhas nunca podem ser armazenadas em texto puro.
-   Armazenar somente `senha_hash`.
-   Rotas protegidas devem ser verificadas no backend.
-   Não usar apenas esconder elementos do frontend como mecanismo de
    segurança.
-   Usar sessão/cookie seguro ou mecanismo equivalente.
-   HTTPS deve ser utilizado em produção.

A tabela `usuarios` registra o responsável pelas movimentações de estoque, histórico de ocorrências e pedidos.

## 3. Stack

### Frontend

-   HTML
-   CSS
-   JavaScript
-   Tailwind CSS
-   ApexCharts

### Backend

-   Node.js
-   TypeScript
-   Express
-   TypeORM

### Banco

-   MySQL

### Regra

**Não utilizar Python para a implementação principal.**

Não trocar a stack sem solicitação explícita.

## 4. Arquitetura

``` text
Frontend
   |
   | HTTP / API
   v
Backend Node.js + TypeScript + Express
   |
   | TypeORM
   v
MySQL
```

O frontend nunca deve acessar o banco diretamente.

O backend é responsável por:

-   autenticação;
-   validação;
-   regras de negócio;
-   acesso ao banco;
-   integração com Mercado Livre;
-   tratamento de erros;
-   proteção de credenciais.

## 5. Banco de dados

### `usuarios`

``` text
id_usuario       PK
nome
email            UNIQUE
senha_hash
ativo
created_at
```

Deve existir apenas um gestor no cenário atual.

### `produtos`

``` text
id_produto       PK
sku              UNIQUE
nome
descricao
preco
ativo
created_at
updated_at
```

Responsável pelos dados cadastrais.

### `estoque`

``` text
id_estoque       PK
id_produto       FK UNIQUE
quantidade_atual
estoque_minimo
updated_at
```

Relacionamento:

``` text
PRODUTO 1 ───── 1 ESTOQUE
```

O sistema considera inicialmente um único estoque por produto. Não criar
múltiplos depósitos sem requisito real.

### `lotes_estoque`

``` text
id_lote               PK
id_produto            FK
numero_lote
numero_lacre_inmetro
data_fabricacao
data_validade
quantidade_disponivel
status                ENUM('Ativo','Bloqueado','Vencido','Esgotado')
created_at
updated_at
```

Relacionamento:

``` text
PRODUTO 1 ───── N LOTES_ESTOQUE
```

### `movimentacoes_estoque`

``` text
id_movimentacao       PK
id_produto            FK
id_usuario             FK
tipo
quantidade
motivo
data_movimentacao
```

Relacionamentos:

``` text
PRODUTO 1 ───── N MOVIMENTACOES_ESTOQUE
USUARIO 1 ───── N MOVIMENTACOES_ESTOQUE
```

### `pedidos`

``` text
id_pedido             PK
codigo_pedido         UNIQUE
status
data_pedido
valor_total
created_at
updated_at
```

### `itens_pedido`

``` text
id_item               PK
id_pedido             FK
id_produto            FK
quantidade
preco_unitario
subtotal
```

Relacionamentos:

``` text
PEDIDO 1 ───── N ITENS_PEDIDO
PRODUTO 1 ───── N ITENS_PEDIDO
```

### `conexoes_mercado_livre`

``` text
id_conexao          PK
id_usuario          FK
ml_user_id
access_token
refresh_token
expires_at
status
created_at
updated_at
```

Tokens são dados sensíveis. Nunca expor no frontend, Git, logs ou
respostas desnecessárias da API.

### `anuncios_ml`

``` text
id_anuncio              PK
id_conexao              FK
ml_item_id              UNIQUE
titulo
preco
status
quantidade_disponivel
quantidade_vendida
url
ultima_sincronizacao
```

Relacionamento:

``` text
CONEXAO_MERCADO_LIVRE 1 ───── N ANUNCIOS_ML
```

### `produto_anuncio`

Tabela associativa:

``` text
id_produto             PK, FK
id_anuncio             PK, FK
quantidade_anunciada
```

Relacionamento:

``` text
PRODUTO N ───── N ANUNCIO_ML
```

A relação N:N é resolvida por `produto_anuncio`.

## 6. Resumo do DER

``` text
USUARIO
   |
   +---- 1:N ---- MOVIMENTACAO_ESTOQUE
   |
   +---- 1:N ---- CONEXAO_MERCADO_LIVRE
                         |
                         +---- 1:N ---- ANUNCIO_ML
                                           |
                                           +---- N:N ---- PRODUTO
                                                       |
                                                       +---- 1:1 ---- ESTOQUE
                                                       |
                                                       +---- 1:N ---- MOVIMENTACAO_ESTOQUE
                                                       |
                                                       +---- 1:N ---- ITEM_PEDIDO
                                                                    |
PEDIDO ---------------------------------------------------- 1:N ----+
```

## 7. Regra de estoque

Definição alinhada com a RezFire:

``` text
Pedido aprovado -> estoque diminuído (baixa imediata via movimentação de saída)
```

- **Momento da baixa:** O débito no banco de dados é realizado no momento da **aprovação do pedido** (pagamento confirmado / pedido liberado para operação).
- **Cancelamento pós-aprovação:** Caso um pedido aprovado seja posteriormente cancelado, deve ser gerada automaticamente uma movimentação de estoque do tipo **entrada** (estorno/devolução) para repor as quantidades dos itens.
- **Cancelamento pré-aprovação:** Se o pedido for cancelado antes da aprovação, nenhuma alteração de estoque é realizada.

### Regra de Ouro das Movimentações de Estoque

- **Nenhum saldo é alterado sem movimentação:** Todo e qualquer ajuste de saldo na tabela `estoque` (seja por venda, chegada de mercadoria, perda, avaria ou balanço físico) deve gerar obrigatoriamente um registro em `movimentacoes_estoque`.
- **Reabastecimento por Nota Fiscal (Entrada):** O reabastecimento é realizado via tela de Movimentações (ou atalho no Estoque), informando Nota Fiscal, fornecedor e itens recebidos. Para extintores já cadastrados no catálogo, o gestor apenas informa lote, lacre INMETRO e validade da remessa, sem necessidade de recadastrar o produto base.
- **Saídas Avulsas (Não-Comerciais):** Utilizadas para perdas operacionais, avarias no galpão, despressurização/válvula com defeito, extintores vencidos para recarga e amostras.
- **Ajustes de Inventário / Balanço:** Quando o gestor realiza a contagem física no galpão e ajusta o saldo na tela de Estoque, o sistema gera automaticamente uma movimentação do tipo *Entrada* ou *Saída* com o motivo *"Ajuste de Balanço / Inventário Físico"*.

### Regra de Produtos em Combo / Kit

- **Composição de Itens:** O catálogo permite cadastrar produtos do tipo `Combo` (ex.: 1x Extintor + 1x Suporte + 1x Placa).
- **Estoque Dinâmico:** O combo não possui estoque físico próprio travado; seu saldo disponível para venda é calculado dinamicamente com base no item componente de menor disponibilidade no galpão.
- **Baixa Proporcional:** Ao vender 1 unidade de um combo (no Mercado Livre ou Venda Direta), o sistema debita automaticamente cada um dos itens físicos individuais e seus respectivos lotes.

### Regra de Validade de Extintores (FEFO - First Expired, First Out)

- **Critério de Alerta de Validade:** Lotes com validade restante inferior ou igual a **365 dias (1 ano)** geram alerta operacional no sistema e entram com prioridade máxima de expedição pelo método FEFO.
- **Critério de Bloqueio de Expedição (Prazo mínimo de 6 meses):** Lotes com validade restante inferior ou igual a **180 dias (6 meses)** ficam **automaticamente bloqueados para venda e despacho**, garantindo que nenhum cliente receba um extintor com tempo útil inferior a 6 meses.
- **Extintor Vencido:** Validade $\le 0$ dias gera bloqueio total imediato e notificação de perda/revisão necessária.
- **Ordenação Padrão:** O estoque com controle de lote é ordenado por padrão pela data de validade mais próxima (ascendente).

## 8. Telas planejadas

### Acesso

1.  **Login** --- entrada do gestor.
2.  **Meu Perfil** --- dados e alteração de senha.

Não criar tela de usuários no escopo atual.

### Produtos e estoque

3.  **Lista de Produtos** --- busca, filtros e acesso ao cadastro.
4.  **Cadastro/Edição de Produto** --- SKU, nome, descrição, preço e
    situação.
5.  **Estoque** --- quantidade atual, estoque mínimo e itens abaixo do
    mínimo.
6.  **Movimentação de Estoque** --- entradas e saídas.
7.  **Histórico de Estoque** --- histórico filtrável.

### Pedidos

8.  **Lista de Pedidos** --- pesquisa e filtros.
9.  **Detalhes do Pedido** --- itens, valores e status.
10. **Cadastro de Pedido** --- registro manual quando necessário.

### Gestão

11. **Dashboard** --- visão geral da operação.
12. **Central de Alertas** --- situações que exigem atenção.

### Mercado Livre

13. **Conexão com Mercado Livre** --- autorização e status da
    integração.
14. **Lista de Anúncios** --- anúncios, preços, status e quantidades.
15. **Detalhes do Anúncio** --- informações e vínculo com produto.

### Configurações

16. **Configurações Gerais** --- parâmetros que não pertencem aos
    módulos principais.

Algumas dessas funções podem ser modais, abas ou painéis laterais em vez
de páginas independentes. Não criar páginas desnecessariamente.

## 9. Indicadores

Indicadores planejados:

1.  Ticket médio de venda
2.  Quantidade total de estoque
3.  Custo médio de aquisição
4.  Frequência média de movimentação
5.  Valor total de estoque
6.  Produtos com estoque baixo
7.  Giro de estoque
8.  Entradas de produtos
9.  Saídas de produtos
10. Cobertura de estoque

Cada KPI precisa ter uma origem de dados clara. Não criar gráficos
apenas para preencher espaço.

## 10. Mercado Livre

A integração deve ocorrer preferencialmente pelo backend.

Fluxo:

``` text
Sistema
  -> Backend
  -> OAuth Mercado Livre
  -> autorização do gestor
  -> tokens
  -> backend armazena com segurança
  -> API Mercado Livre
  -> anúncios/dados
  -> banco local
  -> dashboard/telas
```

Regras:

-   Client Secret nunca vai para o frontend.
-   Tokens nunca vão para o Git.
-   Tokens não devem aparecer em logs.
-   Tratar erros de integração.
-   Registrar a última sincronização.
-   Não assumir disponibilidade de endpoints/dados sem verificar a
    documentação atual do Mercado Livre.

### Estratégia de Sincronização (Webhooks + Processamento Assíncrono + Cron)

1. **Endpoint de Webhook (Push / Rápido):**
   - O endpoint que recebe notificações do Mercado Livre apenas valida a autenticidade, registra o evento recebido em uma tabela (ou fila de eventos) e responde status `200 OK` imediatamente.
   - Isso evita *timeouts* e reenvios desnecessários pela plataforma do Mercado Livre.

2. **Processamento Assíncrono Idempotente:**
   - Um worker/job interno consome os eventos da fila/tabela, consulta o recurso detalhado na API do Mercado Livre e persiste no banco.
   - O processamento deve ser **estritamente idempotente**, garantindo que o reenvio de um mesmo evento não gere duplicidade de pedidos, movimentações ou baixas de estoque.
   - Apenas pedidos com status de pagamento aprovado são importados como `Confirmado`.

3. **Cron de Reconciliação (Rede de Segurança):**
   - Rotina agendada (ex.: a cada 15 a 60 minutos, ou diária/noturna) que busca pedidos e recursos alterados no Mercado Livre desde a última sincronização registrada.
   - Serve como redundância para cobrir eventuais falhas temporárias na entrega dos webhooks pelo ML ou instabilidade de rede.

4. **Registro de Última Sincronização por Recurso:**
   - O sistema mantém registrado o *timestamp* da última sincronização bem-sucedida para cada recurso (pedidos, anúncios, envios), permitindo consultas incrementais otimizadas no Cron (buscando apenas o que mudou).

## 11. Backlog

### ÉP01 --- Acesso e Segurança

-   US01 Login
-   US02 Logout
-   US03 Proteção das credenciais

### ÉP02 --- Produtos

-   US04 Cadastrar produto
-   US05 Consultar produtos
-   US06 Editar produto

### ÉP03 --- Estoque

-   US07 Consultar estoque
-   US08 Registrar entrada
-   US09 Registrar saída
-   US10 Consultar histórico
-   US11 Definir estoque mínimo
-   US12 Alertar estoque baixo

### ÉP04 --- Pedidos

-   US13 Registrar pedido
-   US14 Consultar pedidos
-   US15 Atualizar status
-   US16 Integrar pedido com estoque

### ÉP05 --- Dashboard e Alertas

-   US17 Dashboard
-   US18 Indicadores
-   US19 Alertas operacionais

### ÉP06 --- Mercado Livre

-   US20 Configurar aplicação
-   US21 Conectar conta
-   US22 OAuth
-   US23 Renovar acesso
-   US24 Consultar anúncios
-   US25 Visualizar anúncios
-   US26 Sincronizar informações

### ÉP07 --- Qualidade

-   US27 Mensagens de erro
-   US28 Responsividade
-   US29 Validar funcionalidades

## 12. Sprints planejadas

### Sprint 1 --- Base

-   estrutura do projeto;
-   banco;
-   backend;
-   autenticação;
-   produtos;
-   estoque;
-   movimentações;
-   estoque mínimo;
-   alertas básicos.

### Sprint 2 --- Operação

-   pedidos;
-   itens de pedido;
-   status;
-   integração pedido/estoque;
-   dashboard;
-   indicadores;
-   alertas;
-   tratamento de erros.

### Sprint 3 --- Mercado Livre e qualidade

-   OAuth;
-   tokens;
-   anúncios;
-   sincronização;
-   responsividade;
-   testes;
-   correções.

A integração com Mercado Livre não deve bloquear o MVP principal.

## 13. Regras de desenvolvimento

### Não fazer

-   Não inventar requisitos.
-   Não criar funcionalidades fora do escopo.
-   Não trocar tecnologias sem autorização.
-   Não criar multiusuário.
-   Não criar múltiplos depósitos sem requisito.
-   Não colocar credenciais reais no código.
-   Não remover funcionalidades existentes sem necessidade.
-   Não fazer refatorações grandes sem solicitação.
-   Não instalar dependências sem justificar.

### Fazer

Antes de mudanças relevantes:

1.  analisar o código existente;
2.  identificar a causa;
3.  propor a solução;
4.  alterar somente o necessário;
5.  testar;
6.  explicar o resultado.

Prioridade:

``` text
1. Funcionamento
2. Integridade dos dados
3. Segurança
4. Usabilidade
5. Manutenibilidade
6. Integração Mercado Livre
7. Melhorias visuais
```

## 14. Regra para IA

Quando algo não estiver definido, classificar como:

-   `REQUISITO EXISTENTE`
-   `DECISÃO TÉCNICA`
-   `REGRA DE NEGÓCIO PENDENTE`
-   `SUGESTÃO`

Se for regra de negócio pendente, **não inventar a resposta**.

Exemplo:

> "Quando um pedido deve diminuir o estoque?"

A IA deve informar que a regra precisa ser definida.

## 15. Estado atual

Decisões já tomadas:

-   Projeto: **RezFire Manager**
-   Empresa: **RezFire**
-   Usuário: **um gestor**
-   Plataforma: **web**
-   Banco: **MySQL**
-   Backend: **Node.js + TypeScript + Express + TypeORM**
-   Frontend: **HTML + CSS + JavaScript + Tailwind + ApexCharts**
-   Python: **não utilizar na implementação principal**
-   Produto e estoque: inicialmente separados
-   Movimentações: registradas
-   Pedidos: possuem itens
-   Mercado Livre: integração planejada como diferencial
-   Controle de Usuários: suporta contingência com perfis `GESTOR` (acesso total) e `OPERADOR` (focado em armazém/expedição; bloqueado de financeiro e gestão de usuários)
-   Autenticação: obrigatória
-   Status comercial de pedidos: exclusivamente `Confirmado`, `Concluido` e `Cancelado` (vendas diretas nascem como `Confirmado`)
-   Tela de entregas (expedição): pedidos confirmados entram como `A separar`, avançam para `Pronto p/ despacho`, `Despachado` e concluem como `Entregue`
-   Badges logísticas: `Aguardando Envio`, `Despacho Atrasado`, `Em trânsito` e `Entregue`
-   Integração Mercado Livre: webhook rápido com persistência em fila/tabela (resposta 200 imediata), processamento assíncrono idempotente e Cron de reconciliação periódica com timestamp da última sincronização por recurso
-   Controle de validade de extintores: FEFO prioritário, alerta com $\le$ 365 dias (1 ano), bloqueio operacional de expedição com $\le$ 180 dias (prazo mínimo de 6 meses para o cliente) e bloqueio total se vencido
-   Documentos de certificação e selo Inmetro: vinculados a produtos e anúncios de forma independente; armazenamento definitivo em pasta de disco local do servidor do gestor (com rotas autenticadas); finalidade prioritária voltada para auditoria técnica e conformidade interna do gestor perante o Mercado Livre (sem envio automático via API do ML no momento)

## 16. Próximo passo para o Cursor

O desenvolvimento deve ser incremental.

Ordem sugerida:

``` text
1. Inicializar repositório
2. Configurar frontend
3. Configurar backend
4. Configurar TypeScript
5. Configurar Express
6. Configurar MySQL
7. Configurar TypeORM
8. Criar entidades
9. Criar migrations
10. Implementar autenticação
11. Implementar produtos
12. Implementar estoque
13. Implementar movimentações
14. Implementar pedidos
15. Implementar dashboard
16. Implementar indicadores
17. Implementar Mercado Livre
18. Testar
19. Corrigir
20. Fazer deploy
```

**Não implemente tudo de uma vez.** Trabalhe por pequenas etapas e
valide cada etapa antes de avançar.

## 17. Instrução final

Este é um projeto acadêmico real e também será usado para aprendizado.

Priorize código:

-   simples;
-   legível;
-   seguro;
-   modular;
-   explicável;
-   adequado ao escopo.

Ao concluir uma tarefa importante, informe:

-   o que foi alterado;
-   arquivos alterados;
-   como testar;
-   decisões técnicas tomadas;
-   pontos que ainda dependem de decisão.
