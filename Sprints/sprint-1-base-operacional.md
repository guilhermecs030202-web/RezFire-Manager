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

### SCRUM-7 · #5 · Cadastro de tipos de produto

- **SP:** 3 | **MoSCoW:** Must | **Depende de:** -

> Como gestor, quero cadastrar novos tipos de produto (linha automotiva, extintores para carreta, mangueiras, alarmes, iluminação, linha hidráulica), para acompanhar a expansão planejada do portfólio.

**Critérios de aceite**

- [ ] É possível criar, editar e listar tipos/categorias de produto.
- [ ] Um novo tipo de produto cadastrado fica disponível para uso nas telas de entrada/saída de estoque (#1, #2, #3).
- [ ] Atributos mínimos do produto (nome, categoria, unidade de medida) são obrigatórios no cadastro.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Lista de atributos obrigatórios por categoria validada com o cliente (ex.: extintor exige validade e certificação; mangueira pode não exigir).
- [ ] Confirmado com o cliente que, apesar de estar priorizada como P0 · Fundação no backlog, o valor real desta story é para expansão futura do portfólio — validar se o escopo do MVP pode usar um cadastro simplificado.

---

### SCRUM-6 · #1 · Entradas e saídas de estoque

- **SP:** 5 | **MoSCoW:** Must | **Depende de:** #5

> Como gestor, quero registrar entradas e saídas de estoque diretamente no sistema, para substituir o controle manual feito hoje em planilhas.

**Critérios de aceite**

- [ ] É possível registrar uma entrada de estoque informando produto, quantidade e data.
- [ ] É possível registrar uma saída de estoque informando produto, quantidade, data e motivo.
- [ ] O saldo do produto é recalculado automaticamente após cada movimentação.
- [ ] O histórico de movimentações de um produto pode ser consultado.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Cadastro básico de produto (story #5) definido, ainda que de forma simplificada, para que a movimentação tenha o que referenciar.
- [ ] Definição de quais papéis de usuário podem registrar movimentações (depende da matriz de permissões da story #20).
- [ ] Lista de campos obrigatórios por tipo de movimentação validada com o gestor.

---

### SCRUM-8 · #2 · Bloquear saída acima do saldo

- **SP:** 2 | **MoSCoW:** Must | **Depende de:** #1

> Como gestor, quero que o sistema bloqueie a confirmação de uma saída quando a quantidade solicitada for maior que o estoque disponível, para evitar vendas de produtos sem disponibilidade real.

**Critérios de aceite**

- [ ] Ao tentar confirmar uma saída com quantidade maior que o saldo atual, o sistema exibe mensagem de erro e impede a confirmação.
- [ ] O saldo considerado na validação é sempre o mais atual no momento da tentativa.
- [ ] Saídas com quantidade igual ou menor ao saldo são confirmadas normalmente.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Decisão de arquitetura CRÍTICA e ainda em aberto: o "estoque disponível" usado na validação é apenas o saldo interno do sistema, ou precisa refletir também o estoque anunciado no Mercado Livre? Essa definição muda a lógica de validação e deve ser resolvida com o cliente antes da estimativa.
- [ ] Story #1 (registro de entradas/saídas) concluída, pois é a base sobre a qual a validação atua.

---

### SCRUM-9 · #3 · Baixa rápida de estoque

- **SP:** 2 | **MoSCoW:** Should | **Depende de:** #1

> Como gestor, quero dar baixa rápida no estoque assim que uma venda cair no Mercado Livre, para manter o saldo do sistema atualizado enquanto a integração automática não está disponível.

**Critérios de aceite**

- [ ] O gestor localiza o produto vendido em poucos passos (ex.: busca por nome/SKU).
- [ ] A baixa é registrada com o mínimo de campos possível (produto, quantidade, e o motivo já pré-preenchido como "venda ML").
- [ ] O saldo é atualizado imediatamente após a confirmação.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Fluxo de UX da "baixa rápida" desenhado e validado (quantidade mínima de cliques/campos), já que a proposta de valor da story é velocidade.
- [ ] Confirmado com o cliente que esta é uma solução manual temporária, a ser revisitada quando a integração com a API do Mercado Livre existir — registrar esse ponto como débito técnico conhecido.
- [ ] Depende da story #1 pronta.

---

### SCRUM-10 · #4 · Alerta de estoque mínimo

- **SP:** 3 | **MoSCoW:** Must | **Depende de:** #1

> Como gestor, quero ser alertado quando um produto atingir o estoque mínimo, para providenciar reposição antes de faltar item para venda.

**Critérios de aceite**

- [ ] É possível definir um valor de estoque mínimo por produto.
- [ ] Um alerta é gerado quando o saldo do produto fica igual ou abaixo do mínimo definido.
- [ ] O alerta deixa de ser exibido quando o saldo volta a ficar acima do mínimo.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Canal do alerta definido com o cliente (painel/dashboard, notificação in-app, e-mail) — não especificado no diagnóstico.
- [ ] Campo "estoque mínimo" incluído no cadastro de produto (depende da story #5).
- [ ] Confirmado que este alerta alimentará o painel central (#19).

---

### SCRUM-13 · #8 · Alerta de validade

- **SP:** 5 | **MoSCoW:** Must | **Depende de:** #1

> Como gestor, quero ser alertado quando um extintor estiver próximo da data de validade, para priorizar sua saída antes do vencimento.

**Critérios de aceite**

- [ ] O produto/lote possui campo de data de validade.
- [ ] Um alerta é gerado quando a validade está a X dias do vencimento (limiar configurável).
- [ ] Produtos próximos do vencimento aparecem destacados em listagem.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Definido com o cliente se o controle de validade é por produto ou por lote (rastreabilidade de lote não é mencionada explicitamente no diagnóstico).
- [ ] Prazo padrão de antecedência do alerta definido (ex.: 30, 60, 90 dias).
- [ ] Confirmado que este alerta alimentará o painel central (#19).

---

### SCRUM-16 · #9a · Listar pedidos com status

- **SP:** 3 | **MoSCoW:** Must | **Depende de:** -

> Como gestor, quero listar os pedidos com seu status atual (venda → NF → etiqueta → expedição), para ter visão consolidada sem depender só do painel do Mercado Livre.

**Critérios de aceite**

- [ ] Uma listagem exibe todos os pedidos com seu status atual.
- [ ] É possível filtrar a listagem por status.
- [ ] Cada pedido exibe, no mínimo: identificação do pedido, cliente, produto(s), status e data.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Confirmado com o cliente se o pedido é cadastrado manualmente pelo gestor nesta fase, já que a integração com a API do Mercado Livre ainda não está implementada.
- [ ] Enumeração fechada dos status possíveis validada (venda, NF, etiqueta, expedição — confirmar se há outros estados intermediários).

---

### SCRUM-17 · #9b · Avançar status do pedido

- **SP:** 2 | **MoSCoW:** Must | **Depende de:** #9a

> Como gestor, quero atualizar/avançar manualmente o status de um pedido, para refletir o andamento real da expedição no sistema.

**Critérios de aceite**

- [ ] O gestor consegue alterar o status de um pedido existente.
- [ ] A mudança de status é registrada com data e hora.
- [ ] O novo status passa a ser refletido na listagem (#9a).

**Definition of Ready (DoR): não pronto até que...**

- [ ] Story #9a concluída (listagem de pedidos como pré-requisito).
- [ ] Regra de transição entre status definida com o cliente (avanço apenas sequencial vs. avanço livre entre quaisquer status).

---

### SCRUM-18 · #10 · Alerta de prazo de postagem

- **SP:** 3 | **MoSCoW:** Must | **Depende de:** #9a

> Como gestor, quero ser alertado quando o prazo limite de postagem estiver próximo de vencer, para garantir envio no mesmo dia sem risco de atraso.

**Critérios de aceite**

- [ ] Cada pedido possui um prazo limite de postagem associado.
- [ ] Um alerta é exibido quando o prazo está próximo do vencimento (limiar configurável).
- [ ] Pedidos com prazo já vencido são destacados de forma diferente dos que estão apenas próximos do limite.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Origem do prazo limite definida: calculado automaticamente a partir da data da venda + regra do Mercado Livre, ou informado manualmente pelo gestor.
- [ ] Story #9a concluída.
- [ ] Confirmado que este alerta alimentará o painel central (#19).

---

### SCRUM-14 · #12 · Status dos anúncios em tela única

- **SP:** 5 | **MoSCoW:** Must | **Depende de:** -

> Como gestor, quero visualizar o status atual de cada anúncio (ativo, pausado, rebaixado) em uma tela única, para não precisar verificar anúncio por anúncio manualmente todos os dias.

**Critérios de aceite**

- [ ] Uma tela lista todos os anúncios cadastrados com seu status atual.
- [ ] É possível filtrar a listagem por status.
- [ ] O status exibido reflete a última atualização registrada.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Ponto de atenção crítico do diagnóstico ainda não resolvido: a autenticação com a API do Mercado Livre usa OAuth2 e exige cadastro de app no painel de desenvolvedores — esse risco técnico precisa estar mapeado no cronograma antes de se estimar qualquer story que dependa da integração.
- [ ] Definido explicitamente se, no MVP, a atualização de status é manual (o gestor informa o status) ou já depende da integração com a API — para não gerar expectativa de automação prematura.
- [ ] Caso a integração seja usada, os campos da API de anúncios a consultar (status, estoque no ML, preço, perguntas) definidos — atualmente não especificados no diagnóstico.

---

### SCRUM-15 · #13 · Alerta de anúncio pausado/rebaixado

- **SP:** 3 | **MoSCoW:** Must | **Depende de:** #12

> Como gestor, quero receber um alerta imediato quando um anúncio for pausado ou rebaixado, para reduzir o tempo de exposição a perdas de venda.

**Critérios de aceite**

- [ ] Um alerta é gerado assim que o status de um anúncio muda para pausado ou rebaixado.
- [ ] O alerta é visível no painel/notificação do sistema.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Story #12 concluída, pois é a fonte do status do anúncio.
- [ ] Expectativa de tempo real alinhada com o cliente: se a origem do status for manual (gestor atualiza), o "imediato" fica limitado à frequência com que o gestor atualiza a tela — deixar isso explícito para não gerar expectativa de automação que a solução do MVP não entrega.

---

### SCRUM-11 · #6 · Inspeção de qualidade na entrada

- **SP:** 5 | **MoSCoW:** Should | **Depende de:** #1

> Como operador, quero registrar o resultado da inspeção de qualidade (avarias, corrosão, rótulo, manômetro, acessórios) na entrada da mercadoria, para garantir que só produtos conformes entrem no estoque disponível.

**Critérios de aceite**

- [ ] Um checklist de inspeção é preenchido e vinculado ao lote/produto no momento da entrada.
- [ ] Um item reprovado no checklist impede que aquela unidade entre no estoque disponível para venda.
- [ ] O registro fica salvo com data e responsável pela inspeção.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Lista definitiva dos itens do checklist de entrada validada com o cliente (o diagnóstico cita 5 itens — avarias, corrosão, rótulo, manômetro, acessórios — mas não confirma se é exaustiva).
- [ ] Definido o que acontece com um item reprovado (descarte, devolução ao fornecedor, estoque separado para análise).

---

### SCRUM-21 · #16 · Certificação Inmetro por produto

- **SP:** 4 | **MoSCoW:** Should | **Depende de:** #5

> Como gestor, quero vincular a documentação de certificação (selo Inmetro) a cada produto/anúncio, para centralizar a conformidade documental exigida pela plataforma.

**Critérios de aceite**

- [ ] É possível anexar um arquivo de certificado a um produto e/ou anúncio.
- [ ] O certificado anexado fica visível na ficha do produto/anúncio correspondente.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Confirmado com o cliente se o vínculo é por produto (mais provável, já que a certificação normalmente é do produto) ou por anúncio individual.
- [ ] Formatos de arquivo aceitos e forma de armazenamento definidos.

---

## Riscos e pontos de atenção

- **Sem login nesta sprint:** o #20 (Usuários e permissões) está na Sprint 2. Se o sistema já for usado com dados reais, considerar antecipá-lo.
- **Sem card de setup técnico** (repositório, banco, ambiente, deploy): a sprint está no limite de 45 SP. Se for necessário, retirar #16 (4 SP) ou #3 e #6 (2 + 5 SP), que são Should.
- **Status de anúncio manual no MVP (#12/#13):** o "alerta imediato" depende da frequência com que o gestor atualiza o status. Deixar isso explícito ao cliente.
- **Pendência do #2:** definir se o saldo considera só o estoque interno ou também a quantidade anunciada no ML antes de implementar o bloqueio.
- **Dashboard fora da sprint:** os alertas (#4, #8, #10, #13) devem expor os dados de forma reutilizável, pois o #19 os consumirá na Sprint 2.

## Encerramento da sprint

- [ ] Todos os critérios de aceite das histórias entregues foram atendidos.
- [ ] O objetivo da sprint pode ser demonstrado ao cliente (revisão da sprint).
- [ ] Histórias não concluídas foram reavaliadas e devolvidas ao backlog com a prioridade atualizada.
- [ ] Pendências de DoR ainda em aberto para a próxima sprint foram registradas.
- [ ] A velocidade real da sprint foi registrada para recalibrar o planejamento.
