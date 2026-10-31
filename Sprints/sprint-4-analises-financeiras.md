# Sprint 4: Análises financeiras e folga de capacidade

## Contexto do projeto

Sistema web de apoio à gestão da operação de e-commerce da **ResFire** (venda de extintores pelo Mercado Livre), estruturado em três módulos iniciais, **Gestão de Estoque**, **Gestão de Pedidos** e **Monitoramento de Anúncios**, com um **dashboard central** de indicadores e alertas. A integração com a API do Mercado Livre é um diferencial técnico incremental, começando pela autenticação e consulta de anúncios.

Convenções: `#N` é o número da história no backlog; `SCRUM-N` é a chave no Jira; cards "A criar" ainda não existem no Jira. A coluna "Depende de" é uma sugestão de ordem de implementação.

## Objetivo da sprint

Adicionar a análise de faturamento e o controle financeiro sobre os dados reais já sincronizados. Os 30 SP restantes ficam livres para o que a retrospectiva da Sprint 3 indicar: dívida técnica, novos requisitos ou ajustes de integração.

## Escopo e capacidade

Capacidade planejada: 45 SP. Planejado: **15 SP** (+30 SP livres).

| Card | # | História | MoSCoW | SP | Depende de |
|---|---|---|---|---|---|
| SCRUM-25 | #17 | Faturamento x quedas de anúncio | Won't | 10 | #14, #29 |
| SCRUM-29 | #25 | Financeiro empresa x pessoal | Won't | 5 | - |
| | | **Total** | | **15** | |

## Ordem sugerida de implementação

1. **Onda 1 - independente:** #25
2. **Onda 2 - depende de histórico e sincronização:** #17

## Histórias

### SCRUM-25 · #17 · Faturamento x quedas de anúncio

- **SP:** 10 | **MoSCoW:** Won't | **Depende de:** #14, #29

> Como gestor, quero visualizar no dashboard a variação de faturamento associada a quedas de anúncio, para dimensionar o impacto financeiro das instabilidades da plataforma.

**Observação do card**

> Story classificada no diagnóstico como não aderente ao INVEST (viola Independent e Small): só é testável depois que os módulos de estoque/pedidos e de anúncios já estiverem gerando dado real em produção. Recomenda-se tratá-la como épico, a ser decomposto quando houver dados históricos suficientes.

**Critérios de aceite**

- [ ] Um indicador/gráfico cruza períodos de anúncio pausado ou rebaixado com a variação de faturamento no mesmo período.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Stories #1 a #3 (estoque) e #12/#13 (anúncios) em produção e gerando dados reais por tempo suficiente para permitir cruzamento histórico.
- [ ] Fonte e granularidade dos dados de faturamento definidas (por venda, por dia, por produto).
- [ ] Decomposição da story em partes menores e testáveis realizada antes de entrar no Sprint Backlog.

**Status de prontidão (do card)**

> NÃO PRONTA. Story ainda não satisfaz a Definition of Ready — ver pendências acima. Não deve ser puxada para a Sprint enquanto as dependências não forem resolvidas.

---

### SCRUM-29 · #25 · Financeiro empresa x pessoal

- **SP:** 5 | **MoSCoW:** Won't | **Depende de:** -

> Como gestor, quero separar os lançamentos financeiros da empresa dos pessoais dentro do sistema, para maior controle financeiro e planejamento tributário.

**Critérios de aceite**

- [ ] Lançamentos financeiros podem ser classificados como "empresa" ou "pessoal".
- [ ] É possível gerar relatórios financeiros filtrados por essa classificação.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Confirmada a não priorização para o momento atual, conforme relatado no diagnóstico.
- [ ] Escopo do módulo financeiro (relacionado às stories #18a-c) definido antes de estimar esta story, já que dependem de estruturas de dados semelhantes.

---

## Riscos e pontos de atenção

- **#17 é um épico** (não atende ao INVEST): dividir em histórias menores antes de iniciar.
- **#17 exige dados históricos** que só existirão após a sincronização (#29) e o histórico (#14) estarem rodando por tempo suficiente.
- **Capacidade livre de 30 SP:** definir o uso na retrospectiva da Sprint 3 e registrar as novas histórias no backlog antes do planejamento.

## Encerramento da sprint

- [ ] Todos os critérios de aceite das histórias entregues foram atendidos.
- [ ] O objetivo da sprint pode ser demonstrado ao cliente (revisão da sprint).
- [ ] Histórias não concluídas foram reavaliadas e devolvidas ao backlog com a prioridade atualizada.
- [ ] Pendências de DoR ainda em aberto para a próxima sprint foram registradas.
- [ ] A velocidade real da sprint foi registrada para recalibrar o planejamento.
