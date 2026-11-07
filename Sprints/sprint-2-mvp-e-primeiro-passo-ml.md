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

### SCRUM-24 · #19 · Painel central de alertas [CONCLUÍDO]

- **SP:** 10 | **MoSCoW:** Must | **Depende de:** #4, #8, #10, #13

> Como gestor, quero um painel central com as situações que exigem atenção (estoque, validade, anúncios, prazos), para priorizar minhas ações do dia.

**Observação do card**

> Story de agregação que unifica as 4 fontes de alertas (#4 Estoque Mínimo/Ruptura, #8 Validade FEFO, #10 Prazo de Postagem e #13 Anúncios ML). Concluída e homologada com sucesso.

**Critérios de aceite**

- [x] Um painel único (`alertas.html` / `alertas.js`) agrega, em uma mesma tela, os alertas gerados pelas stories #4, #8, #10 e #13 com rota dedicada `GET /api/alertas/central`.
- [x] Classificação estrita de prioridade operacional: Críticos (Ação Imediata) precedem Atenção (No decorrer do dia).
- [x] Filtros por criticidade, categoria e busca textual, além de atalhos rápidos direcionados para resolução em 1 clique.
- [x] Badge dinâmico no menu lateral sincronizado com a contagem de alertas pendentes.

**Definition of Ready (DoR): não pronto até que...**

- [x] Stories #4, #8, #10 e #13 concluídas, ativas e gerando alertas operacionais no sistema.
- [x] Layout e critério de priorização definidos: Crítico (atraso de envio, ruptura de estoque, extintor vencido/bloqueado, anúncio pausado) precede Atenção (postar hoje, estoque baixo, alerta FEFO <= 365d, divergência ML).

**Status de prontidão (do card)**

> [CONCLUÍDO]: Histórias dependentes concluídas e tela central de alertas entregue e validada com suíte de testes automatizados.

---

### SCRUM-5 · #20 · Usuários e permissões [CONCLUÍDO]

- **SP:** 5 | **MoSCoW:** Should | **Depende de:** -

> Como administrador, quero cadastrar diferentes usuários com permissões específicas de acesso, para permitir que outra pessoa opere o sistema caso o gestor precise se ausentar.

**Critérios de aceite**

- [x] É possível cadastrar, editar e desativar usuários (tela `usuarios.html`, modal `#modal-usuario` e endpoints backend `GET/POST/PUT/PATCH /api/usuarios`).
- [x] Cada usuário possui um perfil/papel que determina o que ele pode acessar no sistema (`GESTOR` com acesso irrestrito total vs `OPERADOR` com acesso focado a Estoque, Entregas e Pedidos).
- [x] Um usuário sem permissão para uma funcionalidade não consegue acessá-la (middleware backend `requerPerfil(['GESTOR'])` retornando HTTP 403 e menu dinâmico no frontend).

**Definition of Ready (DoR): não pronto até que...**

- [x] Ponto de atenção resolvido por decisão explícita do gestor (Opção B): implementada matriz RBAC com perfis `GESTOR` e `OPERADOR`, permitindo contingência operacional segura quando o gestor se ausentar.

---

### SCRUM-19 · #14 · Histórico de ocorrências do anúncio [CONCLUÍDO]

- **SP:** 3 | **MoSCoW:** Should | **Depende de:** #12, #13

> Como gestor, quero manter um histórico de ocorrências de cada anúncio (pausas, rebaixamentos, exclusões), para identificar padrões do sistema automatizado do Mercado Livre.

**Critérios de aceite**

- [x] Cada mudança de status relevante de um anúncio gera um registro histórico com data/hora e tipo de ocorrência (pausas por estoque, alterações de preço, advertências, sincronizações e anotações técnicas manuais).
- [x] O histórico de um anúncio pode ser consultado de forma cronológica na ficha lateral detalhada do anúncio (Drawer com badges e visualização de timeline auditável).

**Definition of Ready (DoR): não pronto até que...**

- [x] Stories #12 e #13 concluídas, pois são a fonte dos eventos que compõem o histórico.

---

### SCRUM-12 · #7 · Segunda inspeção na separação [CONCLUÍDO]

- **SP:** 3 | **MoSCoW:** Could | **Depende de:** #6, #9a

> Como operador, quero registrar a segunda inspeção de qualidade no momento da separação do pedido, para manter a checagem dupla já feita hoje manualmente, com histórico auditável.

**Critérios de aceite**

- [x] Um checklist de inspeção de 5 itens técnicos (lacre INMETRO, manômetro na faixa verde, casco/pintura sem avarias, acessórios completos e rótulo legível) é preenchido no momento da separação do pedido (`modal-segunda-inspecao` em `entregas.html`).
- [x] O resultado da inspeção fica vinculado ao pedido correspondente no frontend e backend (campo `id_pedido` na entidade `InspecaoQualidade`).
- [x] O histórico de inspeções é auditável com registro cronológico de quem inspecionou, quando e resultado.

**Definition of Ready (DoR): não pronto até que...**

- [x] Checklist de separação alinhado aos 5 itens de checagem dupla pré-despacho dos extintores.
- [x] Story #6 concluída e vínculo com a entidade Pedido implementado e testado.

---

### SCRUM-22 · #11 · Motivo de devoluções/mediações [CONCLUÍDO]

- **SP:** 3 | **MoSCoW:** Could | **Depende de:** #9a

> Como gestor, quero registrar o motivo de devoluções ou mediações quando ocorrerem, para identificar padrões e agir preventivamente.

**Critérios de aceite**

- [x] É possível registrar uma devolução/mediação vinculada a um pedido, com motivo selecionado de uma lista padronizada (Avaria no Transporte, Compra Equivocada, Desistência/CDC 7d, Atraso, Defeito/Despressurização, Outro).
- [x] Os registros podem ser consultados posteriormente para identificar padrões (modal e painel de análise com ranking percentual, filtro por motivo na tabela de pedidos e histórico auditável).

**Definition of Ready (DoR): não pronto até que...**

- [x] Confirmado com o cliente se esta story entra no MVP: o diagnóstico aponta baixa urgência atual (sem aumento relatado de devoluções).
- [x] Taxonomia mínima de motivos de devolução/mediação definida com o cliente (alinhada à operação de extintores e regras de estorno pós-aprovação do AGENTS.md Seção 7).

---

### SCRUM-20 · #15 · Anúncio excluído/recriado [CONCLUÍDO]

- **SP:** 2 | **MoSCoW:** Could | **Depende de:** #12

> Como gestor, quero registrar quando um anúncio precisou ser excluído e recriado do zero, para acompanhar a perda de histórico e o tempo de reposicionamento.

**Critérios de aceite**

- [x] É possível marcar um anúncio como "excluído/recriado", vinculando o anúncio antigo ao novo (modal `#modal-marcar-recriado` vinculando o MLB antigo ao novo com registro bidirecional).
- [x] O sistema registra a data da exclusão e da recriação, permitindo calcular o tempo de reposicionamento em dias e gerando relatório comparativo (`#modal-relatorio-recriados`).

**Definition of Ready (DoR): não pronto até que...**

- [x] Mecanismo de vínculo entre anúncio antigo e novo definido — como o novo anúncio é criado do zero no Mercado Livre, o gestor informa o novo `ml_item_id` no modal, preservando herança histórica e cálculo automático de dias de reposicionamento.

---

### SCRUM-26 · #23 · Fotos e vídeos nos anúncios [CONCLUÍDO]

- **SP:** 5 | **MoSCoW:** Could | **Depende de:** #12

> Como gestor, quero anexar fotos e vídeos de demonstração a cada anúncio, para apoiar a reestruturação visual apontada como prioridade.

**Critérios de aceite**

- [x] É possível anexar fotos e vídeos a um anúncio (modal `#modal-adicionar-midia` com suporte a fotos de alta resolução, links de YouTube/Vimeo com player embutido e arquivos MP4 diretos com ordenação).
- [x] A mídia anexada fica visível na ficha do anúncio (seção 3.5 no Drawer lateral com galeria visual, miniaturas, botões de ação, lightbox de imagem ampliada e player de vídeo `#modal-visualizador-midia`).

**Definition of Ready (DoR): não pronto até que...**

- [x] Reavaliação de prioridade com o cliente recomendada: concluída no escopo de diferenciação do catálogo e reestruturação visual dos anúncios do Mercado Livre.
- [x] Limites de tamanho e formato de arquivo (foto/vídeo) definidos (suporte a URLs públicas de imagens JPG/PNG/WEBP, embeds automáticos do YouTube/Vimeo e tags HTML5 `<video>` nativas para MP4).

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
