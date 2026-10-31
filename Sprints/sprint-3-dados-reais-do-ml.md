# Sprint 3: Dados reais do Mercado Livre

## Contexto do projeto

Sistema web de apoio à gestão da operação de e-commerce da **ResFire** (venda de extintores pelo Mercado Livre), estruturado em três módulos iniciais, **Gestão de Estoque**, **Gestão de Pedidos** e **Monitoramento de Anúncios**, com um **dashboard central** de indicadores e alertas. A integração com a API do Mercado Livre é um diferencial técnico incremental, começando pela autenticação e consulta de anúncios.

Convenções: `#N` é o número da história no backlog; `SCRUM-N` é a chave no Jira; cards "A criar" ainda não existem no Jira. A coluna "Depende de" é uma sugestão de ordem de implementação.

## Objetivo da sprint

Reduzir o trabalho manual sincronizando anúncios, pedidos e estoque com a API do Mercado Livre, e apurar o lucro real por venda. Os itens #18abc, #22 e #24 (antes Won't) foram reavaliados para esta sprint.

## Escopo e capacidade

Capacidade planejada: 45 SP. Planejado: **45 SP**.

| Card | # | História | MoSCoW | SP | Depende de |
|---|---|---|---|---|---|
| A criar | #29 | Sincronizar status de anúncios via API | Could | 5 | #26, #27 |
| A criar | #30 | Sincronizar pedidos do ML | Could | 10 | #26 |
| A criar | #31 | Baixa automática de estoque por pedido | Could | 8 | #30, #1, #2 |
| A criar | #32 | Alertas por notificação de pausa/rebaixamento | Could | 8 | #29 |
| SCRUM-23 | #18abc | Lucro real por venda | Won't | 8 | #30 (sugerido) |
| SCRUM-28 | #22 | Respostas padrão de pré-venda | Won't | 3 | - |
| SCRUM-27 | #24 | Modalidade de envio | Won't | 3 | #9a |
| | | **Total** | | **45** | |

## Ordem sugerida de implementação

1. **Onda 1 - sincronização base:** #29, #30
2. **Onda 2 - consequências da sincronização:** #31, #32
3. **Onda 3 - reavaliados (antes Won't):** #18abc, #22, #24

## Histórias

### A criar · #29 · Sincronizar status de anúncios via API

- **SP:** 5 | **MoSCoW:** Could | **Depende de:** #26, #27

> Como gestor, quero que o status dos anúncios seja atualizado automaticamente a partir do Mercado Livre, para não precisar atualizá-lo manualmente e ver pausas ou rebaixamentos sem demora.

**Critérios de aceite**

- [ ] O sistema atualiza o status dos anúncios periodicamente, na frequência definida.
- [ ] Cada mudança de status é registrada com data e hora, alimentando o histórico do #14.
- [ ] A tela única do #12 passa a refletir o status sincronizado.
- [ ] Falhas de sincronização ficam visíveis ao gestor, com a data da última sincronização bem-sucedida.
- [ ] Anúncios novos ou removidos no Mercado Livre são tratados sem duplicar registros.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Stories #26 e #27 concluídas.
- [ ] Frequência de sincronização definida e compatível com os limites de requisição da API.
- [ ] Mapeamento entre os status do Mercado Livre e os status do sistema (ativo, pausado, rebaixado etc.) definido.
- [ ] Definido como o anúncio do sistema se liga ao anúncio do Mercado Livre (identificador).
- [ ] Decidido o destino dos status já informados manualmente (migrar, sobrescrever ou manter como fallback).
- [ ] Estimativa (5 SP) revisada após a conclusão da Sprint 2.

---

### A criar · #30 · Sincronizar pedidos do ML

- **SP:** 10 | **MoSCoW:** Could | **Depende de:** #26

> Como gestor, quero que os pedidos feitos no Mercado Livre sejam importados automaticamente para o sistema, para não cadastrá-los manualmente e acompanhar os prazos de postagem.

**Critérios de aceite**

- [ ] Pedidos novos do Mercado Livre são importados com os campos definidos (itens, quantidades, data, prazo de postagem e status).
- [ ] Um pedido já importado não é duplicado.
- [ ] Mudanças de status do pedido no Mercado Livre são refletidas no sistema.
- [ ] Os pedidos importados aparecem na listagem do #9a e alimentam o alerta de prazo do #10.
- [ ] Falhas de importação são registradas e ficam visíveis ao gestor.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Story #26 concluída.
- [ ] Endpoints de pedidos e escopos de permissão levantados na documentação.
- [ ] Campos a importar definidos, limitados ao necessário para a operação (avaliar cuidado com dados pessoais do comprador, LGPD).
- [ ] Definido o modelo de atualização (consulta periódica ou notificação do Mercado Livre).
- [ ] Regra de conciliação com pedidos já cadastrados manualmente definida.
- [ ] Mapeamento entre os status do Mercado Livre e os status internos do #9b definido.
- [ ] Estimativa (10 SP) revisada, por ser a de maior incerteza técnica; considerar spike antes da sprint.

---

### A criar · #31 · Baixa automática de estoque por pedido

- **SP:** 8 | **MoSCoW:** Could | **Depende de:** #30, #1, #2

> Como gestor, quero que o estoque seja baixado automaticamente quando um pedido do Mercado Livre for importado, para evitar divergência entre o saldo do sistema e as vendas reais.

**Critérios de aceite**

- [ ] Cada pedido importado gera a saída correspondente no estoque do produto vinculado.
- [ ] A mesma saída não é gerada duas vezes para o mesmo pedido.
- [ ] A movimentação de estoque indica o pedido de origem.
- [ ] Quando o saldo é insuficiente, o sistema gera um alerta em vez de registrar saldo negativo.
- [ ] A baixa pode disparar o alerta de estoque mínimo do #4 quando aplicável.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Stories #30, #1 e #2 concluídas.
- [ ] Vínculo entre o anúncio/SKU do Mercado Livre e o produto cadastrado no estoque definido.
- [ ] Momento da baixa definido (ao importar, ao confirmar pagamento ou ao enviar).
- [ ] Regra para cancelamentos e devoluções definida (estorno automático ou manual).
- [ ] Pendência do #2 resolvida: o saldo considera só o estoque interno ou também a quantidade anunciada no ML.
- [ ] Estimativa (8 SP) acordada pelo time.

---

### A criar · #32 · Alertas por notificação de pausa/rebaixamento

- **SP:** 8 | **MoSCoW:** Could | **Depende de:** #29

> Como gestor, quero ser avisado por notificação quando um anúncio for pausado ou rebaixado, para agir rapidamente mesmo sem estar com o sistema aberto.

**Critérios de aceite**

- [ ] Quando a sincronização detecta mudança para pausado ou rebaixado, uma notificação é enviada ao gestor.
- [ ] A notificação informa o anúncio, o novo status e a data e hora da mudança.
- [ ] O mesmo alerta aparece no painel central do #19.
- [ ] Uma mesma mudança não gera notificações duplicadas.
- [ ] O tempo entre a mudança no Mercado Livre e a notificação respeita o limite acordado com o cliente.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Story #29 concluída.
- [ ] Canal(is) de notificação definido(s) (por exemplo, e-mail) e sua viabilidade técnica e de custo confirmadas.
- [ ] Verificado se o Mercado Livre oferece notificações (webhooks) para anúncios; caso contrário, a detecção usa a sincronização periódica.
- [ ] Expectativa de "tempo quase real" quantificada (tempo máximo aceitável) e alinhada com o cliente.
- [ ] Destinatários das notificações definidos.
- [ ] Regra para evitar excesso de notificações (agrupamento ou intervalo mínimo) definida.
- [ ] Estimativa (8 SP) acordada pelo time.

---

### SCRUM-23 · #18abc · Lucro real por venda

- **SP:** 8 | **MoSCoW:** Won't | **Depende de:** #30 (sugerido)

> Como gestor, quero que o sistema calcule automaticamente o lucro real de cada venda (custos, impostos, tarifas do ML, frete, embalagem, ads), para substituir o cálculo hoje feito manualmente em planilha.

**Critérios de aceite**

- [ ] É possível associar custo de produto, impostos e embalagem a cada venda registrada.
- [ ] O sistema apresenta o total de custos fixos por venda.
- [ ] O sistema calcula automaticamente a tarifa do Mercado Livre conforme o tipo de anúncio (clássico ou premium).
- [ ] O frete aplicável é somado ao cálculo da tarifa.
- [ ] O sistema soma custos fixos (#18a), tarifas variáveis e frete (#18b), ads e transporte, apresentando o lucro líquido por venda.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Lista fechada de categorias de custo fixo validada com o cliente.
- [ ] Confirmado com o cliente se esta story deve entrar no MVP: o diagnóstico indica valor incremental baixo, já que a planilha atual já resolve bem esse cálculo.
- [ ] Tabela de tarifas do Mercado Livre levantada e definido se será parametrizável pelo gestor (já que é uma regra externa sujeita a mudança) ou fixa no sistema.
- [ ] Story #18a concluída.
- [ ] Stories #18a e #18b concluídas.
- [ ] Confirmada a prioridade real desta story com o cliente: o gestor não relatou esse cálculo consolidado como uma dor não resolvida no diagnóstico.

---

### SCRUM-28 · #22 · Respostas padrão de pré-venda

- **SP:** 3 | **MoSCoW:** Won't | **Depende de:** -

> Como gestor, quero manter uma base de respostas padrão para dúvidas frequentes (validade, capacidade extintora), para agilizar o atendimento pré-venda.

**Critérios de aceite**

- [ ] É possível cadastrar perguntas e respostas padrão.
- [ ] As respostas padrão podem ser consultadas pelo gestor durante o atendimento.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Confirmada a não priorização para o MVP: o diagnóstico aponta o atendimento pré-venda atual como rápido e eficiente, ou seja, dor de baixa prioridade.
- [ ] Caso avance, taxonomia das perguntas frequentes definida com o cliente.

---

### SCRUM-27 · #24 · Modalidade de envio

- **SP:** 3 | **MoSCoW:** Won't | **Depende de:** #9a

> Como gestor, quero registrar a modalidade de envio em uso (tradicional, coleta, Full), para acompanhar custos e prazos por modalidade.

**Critérios de aceite**

- [ ] É possível registrar a modalidade de envio de um pedido entre as opções disponíveis.
- [ ] Custos e prazos podem ser comparados por modalidade.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Confirmado com o cliente se a story deve aguardar a liberação da modalidade Full para extintores pelo Mercado Livre (ainda não liberada, segundo o diagnóstico), ou se deve ser desenvolvida já contemplando as três modalidades mesmo sem uso real de Full no momento.

---

## Riscos e pontos de atenção

- **Incerteza das estimativas:** #29 a #32 foram estimados sem spike; considerar spike do #30 (10 SP, maior incerteza) antes da sprint.
- **LGPD no #30:** importar apenas os campos necessários dos pedidos; avaliar cuidado com dados pessoais do comprador.
- **#18abc depende de tarifas externas e mutáveis do Mercado Livre;** #24 depende da liberação do Full para extintores. Se algum estiver bloqueado, trocar por item da Sprint 4.
- **Regras do #31** (momento da baixa, cancelamentos, saldo insuficiente) precisam estar definidas antes de iniciar.
- **Substituição do fluxo manual:** definir como ficam os dados lançados manualmente na Sprint 1 e 2 (migrar, sobrescrever ou manter como fallback).

## Encerramento da sprint

- [ ] Todos os critérios de aceite das histórias entregues foram atendidos.
- [ ] O objetivo da sprint pode ser demonstrado ao cliente (revisão da sprint).
- [ ] Histórias não concluídas foram reavaliadas e devolvidas ao backlog com a prioridade atualizada.
- [ ] Pendências de DoR ainda em aberto para a próxima sprint foram registradas.
- [ ] A velocidade real da sprint foi registrada para recalibrar o planejamento.
