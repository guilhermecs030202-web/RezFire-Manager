# Sprint 2: Fechar o MVP e dar o primeiro passo no Mercado Livre

## Contexto do projeto

Sistema web de apoio à gestão da operação de e-commerce da **ResFire** (venda de extintores pelo Mercado Livre), estruturado em três módulos iniciais, **Gestão de Estoque**, **Gestão de Pedidos** e **Monitoramento de Anúncios**, com um **dashboard central** de indicadores e alertas. A integração com a API do Mercado Livre é um diferencial técnico incremental, começando pela autenticação e consulta de anúncios.

Convenções: `#N` é o número da história no backlog; `SCRUM-N` é a chave no Jira; cards "A criar" ainda não existem no Jira. A coluna "Depende de" é uma sugestão de ordem de implementação.

## Objetivo da sprint

Concluir o MVP com o dashboard central, controle de acesso e rastreabilidade, e validar a conexão real com o Mercado Livre (autenticação e consulta de anúncios), encerrando com a homologação do MVP.

## Escopo e capacidade

Capacidade planejada: 45 SP. Planejado: **45 SP**.

| Card | # | História | MoSCoW | SP | Depende de |
|---|---|---|---|---|---|
| SCRUM-24 | #19 | Painel central de alertas | Must | 10 | #4, #8, #10, #13 |
| SCRUM-5 | #20 | Usuários e permissões | Should | 5 | - |
| SCRUM-19 | #14 | Histórico de ocorrências do anúncio | Should | 3 | #12, #13 |
| SCRUM-12 | #7 | Segunda inspeção na separação | Could | 3 | #6, #9a |
| SCRUM-22 | #11 | Motivo de devoluções/mediações | Could | 3 | #9a |
| SCRUM-20 | #15 | Anúncio excluído/recriado | Could | 2 | #12 |
| SCRUM-26 | #23 | Fotos e vídeos nos anúncios | Could | 5 | #12 |
| A criar | #26 | Autenticação OAuth2 com o Mercado Livre | Could | 5 | - |
| A criar | #27 | Consulta de anúncios via API do ML | Could | 5 | #26 |
| A criar | #28 | Homologação do MVP (testes e correções) | Must | 4 | MVP concluído |
| | | **Total** | | **45** | |

## Ordem sugerida de implementação

1. **Onda 1 - acesso e conexão:** #20, #26
2. **Onda 2 - dashboard e rastreabilidade:** #19, #14, #27
3. **Onda 3 - complementos (Could):** #15, #23, #7, #11
4. **Onda 4 - fechamento:** #28

## Histórias

### SCRUM-24 · #19 · Painel central de alertas

- **SP:** 10 | **MoSCoW:** Must | **Depende de:** #4, #8, #10, #13

> Como gestor, quero um painel central com as situações que exigem atenção (estoque, validade, anúncios, prazos), para priorizar minhas ações do dia.

**Observação do card**

> Story classificada no diagnóstico como não aderente ao INVEST (viola Independent): depende de #4, #8, #10 e #13 já existirem para ter o que agregar. Recomenda-se tratá-la como story de agregação, a ser puxada apenas ao final da sprint em que as dependências forem concluídas.

**Critérios de aceite**

- [ ] Um painel único agrega, em uma mesma tela, os alertas gerados pelas stories #4, #8, #10 e #13.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Stories #4, #8, #10 e #13 concluídas e gerando alerta em produção.
- [ ] Layout e critério de priorização dos itens no painel definidos com o cliente (o que aparece primeiro quando há múltiplos alertas simultâneos).

**Status de prontidão (do card)**

> NÃO PRONTA. Story ainda não satisfaz a Definition of Ready — ver pendências acima. Não deve ser puxada para a Sprint enquanto as dependências não forem resolvidas.

---

### SCRUM-5 · #20 · Usuários e permissões

- **SP:** 5 | **MoSCoW:** Should | **Depende de:** -

> Como administrador, quero cadastrar diferentes usuários com permissões específicas de acesso, para permitir que outra pessoa opere o sistema caso o gestor precise se ausentar.

**Critérios de aceite**

- [ ] É possível cadastrar, editar e desativar usuários.
- [ ] Cada usuário possui um perfil/papel que determina o que ele pode acessar no sistema.
- [ ] Um usuário sem permissão para uma funcionalidade não consegue acessá-la.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Ponto de atenção crítico do diagnóstico ainda não resolvido: ausência de definição dos papéis de usuário (gestor único vs. operador/estoquista com permissões diferentes). Essa definição é pré-requisito bloqueante e precisa ser fechada com o cliente antes de iniciar o desenvolvimento, pois define a matriz de permissões usada por praticamente todas as demais stories.

---

### SCRUM-19 · #14 · Histórico de ocorrências do anúncio

- **SP:** 3 | **MoSCoW:** Should | **Depende de:** #12, #13

> Como gestor, quero manter um histórico de ocorrências de cada anúncio (pausas, rebaixamentos, exclusões), para identificar padrões do sistema automatizado do Mercado Livre.

**Critérios de aceite**

- [ ] Cada mudança de status relevante de um anúncio gera um registro histórico com data/hora e tipo de ocorrência.
- [ ] O histórico de um anúncio pode ser consultado de forma cronológica.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Stories #12 e #13 concluídas, pois são a fonte dos eventos que compõem o histórico.

---

### SCRUM-12 · #7 · Segunda inspeção na separação

- **SP:** 3 | **MoSCoW:** Could | **Depende de:** #6, #9a

> Como operador, quero registrar a segunda inspeção de qualidade no momento da separação do pedido, para manter a checagem dupla já feita hoje manualmente, com histórico auditável.

**Critérios de aceite**

- [ ] Um checklist de inspeção é preenchido no momento da separação do pedido.
- [ ] O resultado da inspeção fica vinculado ao pedido correspondente.
- [ ] O histórico de inspeções é auditável (quem, quando, resultado).

**Definition of Ready (DoR): não pronto até que...**

- [ ] Confirmado se o checklist da separação reaproveita os itens da inspeção de entrada (#6) ou possui itens próprios.
- [ ] Story #6 concluída, e módulo de pedidos minimamente definido (para permitir o vínculo da inspeção ao pedido).

---

### SCRUM-22 · #11 · Motivo de devoluções/mediações

- **SP:** 3 | **MoSCoW:** Could | **Depende de:** #9a

> Como gestor, quero registrar o motivo de devoluções ou mediações quando ocorrerem, para identificar padrões e agir preventivamente.

**Critérios de aceite**

- [ ] É possível registrar uma devolução/mediação vinculada a um pedido, com motivo selecionado de uma lista.
- [ ] Os registros podem ser consultados posteriormente para identificar padrões.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Confirmado com o cliente se esta story entra no MVP: o diagnóstico aponta baixa urgência atual (sem aumento relatado de devoluções).
- [ ] Taxonomia mínima de motivos de devolução/mediação definida com o cliente.

---

### SCRUM-20 · #15 · Anúncio excluído/recriado

- **SP:** 2 | **MoSCoW:** Could | **Depende de:** #12

> Como gestor, quero registrar quando um anúncio precisou ser excluído e recriado do zero, para acompanhar a perda de histórico e o tempo de reposicionamento.

**Critérios de aceite**

- [ ] É possível marcar um anúncio como "excluído/recriado", vinculando o anúncio antigo ao novo.
- [ ] O sistema registra a data da exclusão e da recriação, permitindo calcular o tempo de reposicionamento.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Mecanismo de vínculo entre anúncio antigo e novo definido — como o novo anúncio é criado do zero no Mercado Livre, não há um identificador comum automático; o vínculo provavelmente será feito manualmente pelo gestor, o que precisa ser confirmado.

---

### SCRUM-26 · #23 · Fotos e vídeos nos anúncios

- **SP:** 5 | **MoSCoW:** Could | **Depende de:** #12

> Como gestor, quero anexar fotos e vídeos de demonstração a cada anúncio, para apoiar a reestruturação visual apontada como prioridade.

**Critérios de aceite**

- [ ] É possível anexar fotos e vídeos a um anúncio.
- [ ] A mídia anexada fica visível na ficha do anúncio.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Reavaliação de prioridade com o cliente recomendada: apesar de estar classificada como fora do MVP, o próprio gestor apontou a reestruturação visual dos anúncios como prioridade urgente — vale confirmar se deve subir de prioridade.
- [ ] Limites de tamanho e formato de arquivo (foto/vídeo) definidos.

---

### A criar · #26 · Autenticação OAuth2 com o Mercado Livre

- **SP:** 5 | **MoSCoW:** Could | **Depende de:** -

> Como gestor, quero conectar o sistema à minha conta do Mercado Livre por autenticação segura (OAuth2), para que o sistema acesse os dados dos meus anúncios sem que eu compartilhe minha senha.

**Critérios de aceite**

- [ ] Há uma ação "Conectar ao Mercado Livre" que direciona o gestor à tela de autorização do Mercado Livre.
- [ ] Após autorizar, o sistema armazena os tokens de acesso de forma segura e exibe a conta como conectada.
- [ ] O token é renovado automaticamente antes de expirar, sem exigir nova autorização do gestor.
- [ ] O gestor pode desconectar a conta, revogando o acesso do sistema.
- [ ] Falhas de autorização (negada, expirada, erro da API) exibem mensagem clara e não deixam a conta em estado inconsistente.

**Definition of Ready (DoR): não pronto até que...**

- [ ] App cadastrado no painel de desenvolvedores do Mercado Livre, com client ID, client secret e redirect URI definidos.
- [ ] Conta do vendedor ResFire (ou conta de teste) disponível para validar a autorização.
- [ ] Escopos/permissões necessários mapeados (no mínimo, leitura de anúncios) e o fluxo OAuth2 estudado na documentação oficial.
- [ ] Definido onde e como os tokens e segredos serão guardados (banco com proteção, variáveis de ambiente), sem expô-los no código.
- [ ] Definido se o MVP atende uma única conta de vendedor (ResFire) ou múltiplas contas.
- [ ] Ambiente com URL de callback acessível para o redirecionamento do OAuth2.
- [ ] Estimativa (5 SP) acordada pelo time.

---

### A criar · #27 · Consulta de anúncios via API do ML

- **SP:** 5 | **MoSCoW:** Could | **Depende de:** #26

> Como gestor, quero que o sistema consulte meus anúncios diretamente no Mercado Livre, para visualizar dados reais (título, status, preço e quantidade disponível) sem digitá-los manualmente.

**Critérios de aceite**

- [ ] Com a conta conectada (#26), uma tela lista os anúncios do vendedor retornados pela API.
- [ ] A listagem exibe os campos definidos: identificador do anúncio, título, status, preço e quantidade disponível.
- [ ] A listagem funciona com paginação para vendedores com muitos anúncios.
- [ ] O gestor pode atualizar a consulta sob demanda.
- [ ] Erros e limites de requisição da API são tratados com mensagem clara, sem quebrar a tela.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Story #26 concluída (autenticação funcionando).
- [ ] Campos da API a consultar definidos (status, quantidade no ML, preço e, se necessário, perguntas): pendência herdada do #12.
- [ ] Endpoints de anúncios e limites de requisição (rate limit) levantados na documentação do Mercado Livre.
- [ ] Definido que a consulta desta story é sob demanda (a atualização periódica fica para o #29).
- [ ] Anúncios reais ou de teste disponíveis para validar a consulta.
- [ ] Definida a relação com o #12: a tela única continua com status manual ou passa a ler esta consulta.
- [ ] Estimativa (5 SP) acordada pelo time.

---

### A criar · #28 · Homologação do MVP (testes e correções)

- **SP:** 4 | **MoSCoW:** Must | **Depende de:** MVP concluído

> Como gestor, quero validar o MVP com testes de aceitação usando dados reais da operação, para confirmar que o sistema reduz minha dependência exclusiva na operação antes de ampliar o escopo.

**Critérios de aceite**

- [ ] Existe um roteiro de testes de aceitação cobrindo as histórias Must do MVP.
- [ ] O roteiro é executado com dados reais ou amostra representativa de produtos, estoque, pedidos e anúncios.
- [ ] Defeitos críticos encontrados são corrigidos; os demais são registrados no backlog com prioridade.
- [ ] O gestor registra o aceite do MVP ou uma lista objetiva de ajustes pendentes.
- [ ] O critério de sucesso do SCRUM-33 (#21) é verificado e o resultado é documentado.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Histórias do MVP concluídas e implantadas em ambiente de homologação.
- [ ] Critério de sucesso do SCRUM-33 (#21) transformado em verificação objetiva (o que será observado e como será medido).
- [ ] Dados de amostra definidos (produtos, saldos, pedidos e anúncios) para a execução dos testes.
- [ ] Definido o que é defeito crítico (bloqueia o aceite) e o que vai para o backlog.
- [ ] Disponibilidade do gestor confirmada para participar da validação.
- [ ] Estimativa (4 SP) acordada pelo time.

---

## Riscos e pontos de atenção

- **Risco técnico do OAuth2:** exige cadastro de app no painel de desenvolvedores do Mercado Livre. Iniciar o #26 no começo da sprint para destravar o #27 e a Sprint 3.
- **Dashboard (#19) agrega 4 fontes de alerta:** só começar após os alertas da Sprint 1 estarem estáveis.
- **#20 como Should:** assume-se MVP com perfil único; a matriz de papéis completa pode ser simplificada, confirmando com o cliente.
- **Os Could (#15, #23, #7, #11) são os primeiros a sair** se a sprint apertar, assim como #27 se o #26 atrasar.
- **#28 é o fechamento:** só inicia com o restante do MVP implantado em homologação.

## Encerramento da sprint

- [ ] Todos os critérios de aceite das histórias entregues foram atendidos.
- [ ] O objetivo da sprint pode ser demonstrado ao cliente (revisão da sprint).
- [ ] Histórias não concluídas foram reavaliadas e devolvidas ao backlog com a prioridade atualizada.
- [ ] Pendências de DoR ainda em aberto para a próxima sprint foram registradas.
- [ ] A velocidade real da sprint foi registrada para recalibrar o planejamento.
