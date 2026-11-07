# Sprint 1: Base operacional dos três módulos

## Contexto do projeto

Sistema web de apoio à gestão da operação de e-commerce da **ResFire** (venda de extintores pelo Mercado Livre), estruturado em três módulos iniciais, **Gestão de Estoque**, **Gestão de Pedidos** e **Monitoramento de Anúncios**, com um **dashboard central** de indicadores e alertas. A integração com a API do Mercado Livre é um diferencial técnico incremental, começando pela autenticação e consulta de anúncios.

Convenções: `#N` é o número da história no backlog; `SCRUM-N` é a chave no Jira; cards "A criar" ainda não existem no Jira. A coluna "Depende de" é uma sugestão de ordem de implementação.

## Objetivo da sprint

Entregar Estoque, Pedidos e Monitoramento de Anúncios funcionando de forma manual, com os alertas essenciais, para substituir a planilha atual. Todos os Must, exceto o dashboard (#19), entram nesta sprint; o restante da capacidade é preenchido com Should (#3, #6, #16).

## Escopo e capacidade

Capacidade planejada: 45 SP. Planejado: **45 SP**.

| Card | # | História | MoSCoW | SP | Depende de |
|---|---|---|---|---|---|
| SCRUM-7 | #5 | Cadastro de tipos de produto | Must | 3 | - |
| SCRUM-6 | #1 | Entradas e saídas de estoque | Must | 5 | #5 |
| SCRUM-8 | #2 | Bloquear saída acima do saldo | Must | 2 | #1 |
| SCRUM-9 | #3 | Baixa rápida de estoque | Should | 2 | #1 |
| SCRUM-10 | #4 | Alerta de estoque mínimo | Must | 3 | #1 |
| SCRUM-13 | #8 | Alerta de validade | Must | 5 | #1 |
| SCRUM-16 | #9a | Listar pedidos com status | Must | 3 | - |
| SCRUM-17 | #9b | Avançar status do pedido | Must | 2 | #9a |
| SCRUM-18 | #10 | Alerta de prazo de postagem | Must | 3 | #9a |
| SCRUM-14 | #12 | Status dos anúncios em tela única | Must | 5 | - |
| SCRUM-15 | #13 | Alerta de anúncio pausado/rebaixado | Must | 3 | #12 |
| SCRUM-11 | #6 | Inspeção de qualidade na entrada | Should | 5 | #1 |
| SCRUM-21 | #16 | Certificação Inmetro por produto | Should | 4 | #5 |
| | | **Total** | | **45** | |

## Ordem sugerida de implementação

1. **Onda 1 - fundações independentes:** #5, #9a, #12
2. **Onda 2 - núcleo de cada módulo:** #1, #9b, #13, #16
3. **Onda 3 - regras, alertas e qualidade:** #2, #3, #4, #8, #10, #6

## Histórias

### SCRUM-7 · #5 · Cadastro de tipos de produto [CONCLUÍDO]

- **SP:** 3 | **MoSCoW:** Must | **Depende de:** -

> Como gestor, quero cadastrar novos tipos de produto (linha automotiva, extintores para carreta, mangueiras, alarmes, iluminação, linha hidráulica), para acompanhar a expansão planejada do portfólio.

**Critérios de aceite**

- [x] É possível criar, editar e listar tipos/categorias de produto.
- [x] Um novo tipo de produto cadastrado fica disponível para uso nas telas de entrada/saída de estoque (#1, #2, #3).
- [x] Atributos mínimos do produto (nome, categoria, unidade de medida) são obrigatórios no cadastro.

**Definition of Ready (DoR): não pronto até que...**

- [x] Lista de atributos obrigatórios por categoria validada com o cliente (extintor com campos técnicos INMETRO e acessórios com atributos comerciais).
- [x] Confirmado com o cliente escopo do cadastro e categorias de expansão do catálogo.

---

### SCRUM-6 · #1 · Entradas e saídas de estoque [CONCLUÍDO]

- **SP:** 5 | **MoSCoW:** Must | **Depende de:** #5

> Como gestor, quero registrar entradas e saídas de estoque diretamente no sistema, para substituir o controle manual feito hoje em planilhas.

**Critérios de aceite**

- [x] É possível registrar uma entrada de estoque informando produto, quantidade e data.
- [x] É possível registrar uma saída de estoque informando produto, quantidade, data e motivo.
- [x] O saldo do produto é recalculado automaticamente após cada movimentação.
- [x] O histórico de movimentações de um produto pode ser consultado.

**Definition of Ready (DoR): não pronto até que...**

- [x] Cadastro básico de produto (story #5) definido e referenciado nas movimentações.
- [x] Definição de permissões alinhada (gestor único responsável pela operação).
- [x] Lista de campos obrigatórios por tipo de movimentação validada (Regra de Ouro).

---

### SCRUM-8 · #2 · Bloquear saída acima do saldo [CONCLUÍDO]

- **SP:** 2 | **MoSCoW:** Must | **Depende de:** #1

> Como gestor, quero que o sistema bloqueie a confirmação de uma saída quando a quantidade solicitada for maior que o estoque disponível, para evitar vendas de produtos sem disponibilidade real.

**Critérios de aceite**

- [x] Ao tentar confirmar uma saída com quantidade maior que o saldo atual, o sistema exibe mensagem de erro e impede a confirmação.
- [x] O saldo considerado na validação é sempre o mais atual no momento da tentativa.
- [x] Saídas com quantidade igual ou menor ao saldo são confirmadas normalmente.

**Definition of Ready (DoR): não pronto até que...**

- [x] Decisão de arquitetura resolvida: o estoque disponível considerado na validação é o saldo interno em armazém.
- [x] Story #1 (registro de entradas/saídas) concluída e integrada à validação.

---

### SCRUM-9 · #3 · Baixa rápida de estoque [CONCLUÍDO]

- **SP:** 2 | **MoSCoW:** Should | **Depende de:** #1

> Como gestor, quero dar baixa rápida no estoque assim que uma venda cair no Mercado Livre, para manter o saldo do sistema atualizado enquanto a integração automática não está disponível.

**Critérios de aceite**

- [x] O gestor localiza o produto vendido em poucos passos (ex.: busca por nome/SKU ou botão direto `⚡ Baixa ML` em cada linha da tabela de estoque).
- [x] A baixa é registrada com o mínimo de campos possível (produto pré-selecionado ao clicar na linha, quantidade padrão 1, e o motivo já pré-preenchido como "Venda Mercado Livre (Baixa Rápida)"). Em apenas 2 cliques a saída é confirmada.
- [x] O saldo é atualizado imediatamente após a confirmação no banco MySQL, atualizando lotes FEFO e kits dinâmicos.

**Definition of Ready (DoR): não pronto até que...**

- [x] Fluxo de UX da "baixa rápida" desenhado e validado (2 cliques: `⚡ Baixa ML` na linha do produto -> Enter/Confirmar no modal com previsão de saldo em tempo real).
- [x] Confirmado com o cliente que esta é uma solução manual de contingência e agilidade enquanto a sincronização por Webhook assíncrono do Mercado Livre é consolidada na Sprint 3.
- [x] Depende da story #1 pronta. (Atendido: Movimentações e Regra de Ouro ativas).

---

### SCRUM-10 · #4 · Alerta de estoque mínimo [CONCLUÍDO]

- **SP:** 3 | **MoSCoW:** Must | **Depende de:** #1

> Como gestor, quero ser alertado quando um produto atingir o estoque mínimo, para providenciar reposição antes de faltar item para venda.

**Critérios de aceite**

- [x] É possível definir um valor de estoque mínimo por produto.
- [x] Um alerta é gerado quando o saldo do produto fica igual ou abaixo do mínimo definido.
- [x] O alerta deixa de ser exibido quando o saldo volta a ficar acima do mínimo.

**Definition of Ready (DoR): não pronto até que...**

- [x] Canal do alerta definido (Dashboard operacional e tela de Estoque com badges "Estoque Baixo" e "Ruptura").
- [x] Campo "estoque mínimo" incluído no cadastro de produto (story #5).
- [x] Confirmado que este alerta alimenta o painel central (#19).

---

### SCRUM-13 · #8 · Alerta de validade [CONCLUÍDO]

- **SP:** 5 | **MoSCoW:** Must | **Depende de:** #1

> Como gestor, quero ser alertado quando um extintor estiver próximo da data de validade, para priorizar sua saída antes do vencimento.

**Critérios de aceite**

- [x] O produto/lote possui campo de data de validade, número de lote e lacre INMETRO.
- [x] Um alerta é gerado quando a validade está a X dias do vencimento (<= 365 dias para alerta prioritário FEFO, <= 180 dias para bloqueio operacional de expedição).
- [x] Produtos próximos do vencimento aparecem destacados em listagem com badges e filtros dedicados.

**Definition of Ready (DoR): não pronto até que...**

- [x] Definido com o cliente controle de validade por lote FEFO com rastreabilidade de lacre INMETRO.
- [x] Prazos FEFO estabelecidos conforme AGENTS.md Seção 7 (alerta em 365 dias e bloqueio com 180 dias).
- [x] Confirmado que este alerta alimenta o painel central (#19).

---

### SCRUM-16 · #9a · Listar pedidos com status [CONCLUÍDO]

- **SP:** 3 | **MoSCoW:** Must | **Depende de:** -

> Como gestor, quero listar os pedidos com seu status atual (venda → NF → etiqueta → expedição), para ter visão consolidada sem depender só do painel do Mercado Livre.

**Critérios de aceite**

- [x] Uma listagem exibe todos os pedidos com seu status atual no pipeline logístico.
- [x] É possível filtrar a listagem por status (`A separar`, `Pronto p/ despacho`, `Despachado`, `Entregue`).
- [x] Cada pedido exibe, no mínimo: identificação do pedido, cliente, produto(s), status e data.

**Definition of Ready (DoR): não pronto até que...**

- [x] Confirmação operacional alinhada: pedidos confirmados entram na fila de expedição com itens e dados de entrega.
- [x] Enumeração fechada dos status comerciais (`Confirmado`, `Concluido`, `Cancelado`) e logísticos (`A separar`, `Pronto p/ despacho`, `Despachado`, `Entregue`) alinhada à Seção 15 do AGENTS.md.

---

### SCRUM-17 · #9b · Avançar status do pedido [CONCLUÍDO]

- **SP:** 2 | **MoSCoW:** Must | **Depende de:** #9a

> Como gestor, quero atualizar/avançar manualmente o status de um pedido, para refletir o andamento real da expedição no sistema.

**Critérios de aceite**

- [x] O gestor consegue alterar o status de um pedido existente no pipeline ou na tela de entregas.
- [x] A mudança de status é registrada com data e hora no histórico auditável.
- [x] O novo status passa a ser refletido na listagem (#9a).

**Definition of Ready (DoR): não pronto até que...**

- [x] Story #9a concluída (pipeline e listagem de expedição integrados).
- [x] Regra de transição sequencial com histórico auditável e estorno automático caso cancelado (conforme Seção 7 e 15 do AGENTS.md).

---

### SCRUM-18 · #10 · Alerta de prazo de postagem [CONCLUÍDO]

- **SP:** 3 | **MoSCoW:** Must | **Depende de:** #9a

> Como gestor, quero ser alertado quando o prazo limite de postagem estiver próximo de vencer, para garantir envio no mesmo dia sem risco de atraso.

**Critérios de aceite**

- [x] Cada pedido possui um prazo limite de postagem associado (calculado automaticamente em até 24h úteis da venda ou informado na criação).
- [x] Um alerta é exibido no topo da tela de Entregas e no Dashboard quando o prazo está próximo do vencimento (vence hoje / < 12h) com badge amarela `⏰ POSTAR HOJE`.
- [x] Pedidos com prazo já vencido são destacados de forma diferente: badge vermelha `🔴 ATRASADO`, borda vermelha na linha e banner crítico no topo com alerta de penalidade de reputação no ML.

**Definition of Ready (DoR): não pronto até que...**

- [x] Origem do prazo limite definida: calculado automaticamente a partir da data da venda (24h úteis) ou informado na importação de pedidos Mercado Envios.
- [x] Story #9a concluída (pipeline e listagem de expedição integrados).
- [x] Confirmado que este alerta alimenta o painel central (#19) e o dashboard executivo.

---

### SCRUM-14 · #12 · Status dos anúncios em tela única [CONCLUÍDO]

- **SP:** 5 | **MoSCoW:** Must | **Depende de:** -

> Como gestor, quero visualizar o status atual de cada anúncio (ativo, pausado, rebaixado) em uma tela única, para não precisar verificar anúncio por anúncio manualmente todos os dias.

**Critérios de aceite**

- [x] Uma tela lista todos os anúncios cadastrados com seu status atual conectado à API do backend (GET /api/ml/anuncios e status OAuth).
- [x] É possível filtrar a listagem por status (Ativo, Pausado, Encerrado) e filtros rápidos clicáveis nos cards de KPI.
- [x] O status exibido reflete a última atualização registrada com suporte a sincronização manual (POST /api/ml/sincronizar).

**Definition of Ready (DoR): não pronto até que...**

- [x] Risco técnico de autenticação OAuth2 mitigado com endpoints reais e fallback seguro no frontend.
- [x] Atualização de status operacional via sincronização e reconciliação com o backend.
- [x] Campos da API de anúncios (status, preço, estoque ML, vendas, produtos vinculados e divergências) mapeados.

---

### SCRUM-15 · #13 · Alerta de anúncio pausado/rebaixado [CONCLUÍDO]

- **SP:** 3 | **MoSCoW:** Must | **Depende de:** #12

> Como gestor, quero receber um alerta imediato quando um anúncio for pausado ou rebaixado, para reduzir o tempo de exposição a perdas de venda.

**Critérios de aceite**

- [x] Um alerta visual é gerado em destaque no topo da tela (`#alerta-anuncios-pausados-banner`) assim que anúncios pausados ou com divergência de estoque físico são identificados.
- [x] O alerta é visível com contadores destacados e botões de atalho em 1 clique ("Ver Pausados" / "Ver Divergências").

**Definition of Ready (DoR): não pronto até que...**

- [x] Story #12 concluída e integrada à exibição dos alertas.
- [x] Expectativa alinhada: alertas dinâmicos reativos com contagem precisa de anúncios pausados e divergências de estoque.

---

### SCRUM-11 · #6 · Inspeção de qualidade na entrada

- **SP:** 5 | **MoSCoW:** Should | **Depende de:** #1

> Como operador, quero registrar o resultado da inspeção de qualidade (avarias, corrosão, rótulo, manômetro, acessórios) na entrada da mercadoria, para garantir que só produtos conformes entrem no estoque disponível.

**Critérios de aceite**

- [x] Um checklist de inspeção é preenchido e vinculado ao lote/produto no momento da entrada.
- [x] Um item reprovado no checklist impede que aquela unidade entre no estoque disponível para venda.
- [x] O registro fica salvo com data e responsável pela inspeção.

**Definition of Ready (DoR): não pronto até que...**

- [x] Lista definitiva dos itens do checklist de entrada validada com o cliente (os 5 itens técnicos essenciais: casco/avarias, corrosão/pintura, rótulo/legibilidade, pressão do manômetro e lacre/acessórios INMETRO).
- [x] Definido o que acontece com um item reprovado (bloqueio imediato para impedir venda; segregação em lote bloqueado com opções: Devolução ao Fornecedor, Descarte ou Quarentena).

---

### SCRUM-21 · #16 · Certificação Inmetro por produto [CONCLUÍDO]

- **SP:** 4 | **MoSCoW:** Should | **Depende de:** #5

> Como gestor, quero vincular a documentação de certificação (selo Inmetro) a cada produto/anúncio, para centralizar a conformidade documental exigida pela plataforma.

**Critérios de aceite**

- [x] É possível anexar um arquivo de certificado a um produto e/ou anúncio com upload direto para o disco local do servidor (POST /api/certificados/upload).
- [x] O certificado anexado fica visível na ficha do produto/anúncio correspondente com visualizador embutido e download autenticado (GET /api/certificados/:id/download).

**Definition of Ready (DoR): não pronto até que...**

- [x] Confirmado com o cliente que o vínculo é independente: pode ser anexado a produtos e/ou anúncios de forma isolada (a remoção de um não afeta o outro).
- [x] Formatos de arquivo aceitos definidos (PDF, JPG, JPEG, PNG até 5 MB) e armazenamento físico em pasta local do servidor do gestor com rotas autenticadas.

---

## Riscos e pontos de atenção

- **Sem login nesta sprint:** o #20 (Usuários e permissões) está na Sprint 2. Se o sistema já for usado com dados reais, considerar antecipá-lo.
- **Sem card de setup técnico** (repositório, banco, ambiente, deploy): a sprint está no limite de 45 SP. Se for necessário, retirar #16 (4 SP) ou #3 e #6 (2 + 5 SP), que são Should.
- **Status de anúncio manual no MVP (#12/#13):** o "alerta imediato" depende da frequência com que o gestor atualiza o status. Deixar isso explícito ao cliente.
- **Pendência do #2:** definir se o saldo considera só o estoque interno ou também a quantidade anunciada no ML antes de implementar o bloqueio.
- **Dashboard fora da sprint:** os alertas (#4, #8, #10, #13) devem expor os dados de forma reutilizável, pois o #19 os consumirá na Sprint 2.

## Encerramento da sprint

- [x] Todos os critérios de aceite das histórias entregues foram atendidos (45 / 45 SP - 100% Concluída).
- [x] O objetivo da sprint pode ser demonstrado ao cliente (revisão da sprint).
- [x] Histórias concluídas validadas via testes automatizados E2E e unitários.
- [x] Todas as pendências da Sprint 1 foram resolvidas e integradas.
