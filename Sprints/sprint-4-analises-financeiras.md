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

### Concluída · SCRUM-25 · #17 · Faturamento x quedas de anúncio

- **SP:** 10 | **MoSCoW:** Won't | **Depende de:** #14, #29

> Como gestor, quero visualizar no dashboard a variação de faturamento associada a quedas de anúncio, para dimensionar o impacto financeiro das instabilidades da plataforma.

**Observação do card**

> Story classificada no diagnóstico como não aderente ao INVEST (viola Independent e Small): só é testável depois que os módulos de estoque/pedidos e de anúncios já estiverem gerando dado real em produção. Implementada com cruzamento analítico temporal diário entre ocorrências (#14), status sincronizados (#29) e faturamento real de pedidos (#9a, #30).

**Critérios de aceite**

- [x] Um indicador/gráfico cruza períodos de anúncio pausado ou rebaixado com a variação de faturamento no mesmo período (implementado via `GET /api/dashboard/impacto-quedas-anuncios`, aba dedicada Mercado Livre em `dashboard.html` com gráfico misto ApexCharts linha/área de receita real vs potencial e barras de anúncios caídos).
- [x] Cálculo de faturamento cessante (perda estimada) por run-rate diário durante os dias de pausa/rebaixamento.
- [x] Ranking de anúncios mais prejudicados com ações corretivas (FEFO / conformidade cadastral) e gráfico de causas raiz das quedas.

**Definition of Ready (DoR): não pronto até que...**

- [x] Stories #1 a #3 (estoque) e #12/#13 (anúncios) em produção e gerando dados reais por tempo suficiente para permitir cruzamento histórico (atendido).
- [x] Fonte e granularidade dos dados de faturamento definidas (granularidade diária com cruzamento direto no banco MySQL via pedidos confirmados).
- [x] Decomposição da story em partes menores e testáveis realizada antes de entrar no Sprint Backlog (atendido com teste automatizado `unit_test_faturamento_quedas_anuncios.mjs`).

**Status de prontidão (do card)**

> PRONTA E HOMOLOGADA. Story satisfaz todos os critérios de aceite e DoR. Implementação e testes automatizados 100% concluídos.

---

### Concluída · SCRUM-29 · #25 · Financeiro empresa x pessoal

- **SP:** 5 | **MoSCoW:** Won't | **Depende de:** -

> Como gestor, quero separar os lançamentos financeiros da empresa dos pessoais dentro do sistema, para maior controle financeiro e planejamento tributário.

**Critérios de aceite**

- [x] Lançamentos financeiros podem ser classificados explicitamente como "Empresa" ou "Pessoal" (implementado via entidade `LancamentoFinanceiro`, tabela `lancamentos_financeiros`, validação no service/controller e formulário modal no frontend).
- [x] É possível gerar relatórios financeiros e consultas filtradas por essa classificação (segregação patrimonial PJ x PF, KPIs segregados, gráficos comparativos ApexCharts e endpoint `GET /api/financeiro/relatorio-segregacao`).

**Definition of Ready (DoR): não pronto até que...**

- [x] Confirmada a priorização e conformidade com o Simples Nacional da RezFire (evitar autuações por confusão patrimonial entre sócio e PJ).
- [x] Escopo do módulo financeiro (relacionado às stories #18a-c) harmonizado e integrado na aba Financeiro do Dashboard.

**Status de prontidão (do card)**

> PRONTA E HOMOLOGADA. Story satisfaz todos os critérios de aceite e DoR. Teste automatizado de aceite `unit_test_financeiro_empresa_pessoal.mjs` executado com 100% de sucesso (24/24 verificações aprovadas).

---

## Riscos e pontos de atenção

- **#17 é um épico** (não atende ao INVEST): implementado com cruzamento temporal analítico diário entre pedidos e histórico de ocorrências.
- **#17 exige dados históricos**: atendido com dados de sincronização e histórico ativo de anúncios.
- **Capacidade livre de 30 SP:** disponível para dívida técnica ou expansões futuras pós-Sprint 4.

## Encerramento da sprint

- [x] Todos os critérios de aceite das histórias entregues foram atendidos (#17 com 10 SP e #25 com 5 SP - total 15 SP).
- [x] O objetivo da sprint pode ser demonstrado ao cliente (revisão da sprint).
- [x] Histórias planejadas para a sprint foram 100% concluídas.
- [x] Pendências de DoR foram atendidas e cobertas por testes automatizados.
- [x] A velocidade real da sprint foi registrada (15 SP entregues com folga de capacidade).
