# Épico #33: Emissão de NF-e dentro da aplicação (integração com a SEFAZ)

## Contexto

Sistema web de apoio à gestão da operação de e-commerce da **ResFire** (venda de extintores pelo Mercado Livre), com os módulos **Gestão de Estoque**, **Gestão de Pedidos** e **Monitoramento de Anúncios**, e um dashboard central de indicadores e alertas.

Este épico adiciona a **emissão de nota fiscal eletrônica (NF-e)** dentro do sistema, a partir dos pedidos.

**Sobre a referência indicada:** a página `https://www.fazenda.sp.gov.br/nfe/emissor.asp` descreve o *Emissor de NF-e* da SEFAZ-SP, um programa avulso (instalado e operado manualmente), e não uma API. Ela serve como referência dos requisitos: certificado digital ICP-Brasil (A1 ou A3), credenciamento prévio na SEFAZ/SP e uso de um ambiente de testes antes da produção. Para emitir dentro do sistema, a integração é feita pelos web services da SEFAZ, diretamente ou por um serviço intermediário. Essa decisão está na DoR da história 33a.

## História original (épico)

> Como gestor, quero emitir a nota fiscal eletrônica de um pedido diretamente no sistema, com envio automático à SEFAZ, para não digitar os dados em outro emissor e reduzir erros e retrabalho.

A história, como está, **não atende ao INVEST**: é grande demais (S), difícil de estimar (E) e depende de pedidos, produtos e decisões externas (I). Por isso foi dividida nas histórias 33a a 33g abaixo.

## Resumo

| # | História | SP | MoSCoW sugerido | Sprint sugerida | Depende de |
|---|---|---|---|---|---|
| 33a | Configurar o emitente fiscal | 5 | Should | 4 | - |
| 33b | Cadastrar dados fiscais dos produtos | 3 | Should | 4 | #5 |
| 33c | Montar, validar e assinar a NF-e a partir de um pedido | 8 | Should | 4 | 33a, 33b, #9a (ou #30) |
| 33d | Transmitir à SEFAZ e tratar o retorno | 8 | Should | 4 | 33c |
| 33e | Guardar o XML autorizado e gerar o DANFE | 3 | Should | 4 | 33d |
| 33f | Cancelar NF-e e corrigir por evento | 5 | Should | 5 | 33d |
| 33g | Alertar o vencimento do certificado digital | 2 | Could | 5 | 33a |
| | **Total** | **34** | | | |

- As histórias 33a a 33e somam **27 SP** e cabem nos 30 SP livres da Sprint 4.
- As histórias 33f e 33g (7 SP) ficam para uma Sprint 5.
- As estimativas e o MoSCoW são sugestões e devem ser validados com o time e o cliente. O MoSCoW depende de como a ResFire emite as notas hoje.

**Ordem sugerida de implementação:** 33a e 33b (em paralelo) → 33c → 33d → 33e → 33f e 33g.

---

## 33a · Configurar o emitente fiscal · *(Implementada em 20/11/2026)*

- **SP:** 5 | **MoSCoW sugerido:** Should | **Depende de:** -

> Como gestor, quero cadastrar os dados fiscais da ResFire e o certificado digital no sistema, para que o sistema possa emitir notas em nome da empresa com segurança.

**Critérios de aceite**

- [x] É possível cadastrar o emitente com razão social, CNPJ, inscrição estadual, regime tributário, endereço, série e próximo número de nota. (`emitente_fiscal`, `/api/fiscal/emitente` e `frontend/fiscal.html`)
- [x] O certificado digital A1 pode ser enviado com sua senha e é validado: senha correta, dentro da validade e com CNPJ compatível com o do emitente. (`backend/src/utils/certificadoA1Parser.ts` via `node-forge`, checando PKCS#12, janela `notBefore`/`notAfter` e CNPJ via OID ICP-Brasil `2.16.76.1.3.3`/CN)
- [x] O certificado e a senha são armazenados de forma protegida e nunca aparecem em tela, em arquivos de log ou no código. (`backend/src/utils/cryptoVault.ts` com AES-256-GCM em `uploads/fiscal-vault/*.pfx.enc`, colunas `select: false` no TypeORM e sanitização em DTO/logs)
- [x] O ambiente (homologação ou produção) é selecionável, com homologação como padrão; trocar para produção exige confirmação explícita. (`homologacao` como padrão e trava dupla com checkbox + texto `ATIVAR PRODUCAO` + certificado A1 válido no modal e em `PATCH /api/fiscal/emitente/ambiente`)
- [x] Certificado inválido, vencido ou com senha errada exibe mensagem clara, sem deixar a configuração em estado inconsistente. (validação integral em memória antes de alterar banco/cofre)

**Definition of Ready (DoR): não pronto até que...**

- [ ] Certificado digital ICP-Brasil da ResFire disponível. *(Externo — pendente envio do `.pfx` real da empresa na tela `fiscal.html`; mecanismo validado com PKCS#12 sintético nos testes.)*
- [ ] Dados fiscais da empresa (regime tributário, inscrição estadual, série) conferidos pelo contador. *(Pendente validação contábil final da ResFire antes da troca para produção.)*
- [ ] Credenciamento da ResFire na SEFAZ/SP para o ambiente de homologação concluído, e data do credenciamento para produção definida. *(Externo — requerido a partir de 33d.)*
- [x] Decisão tomada entre integração direta com os web services da SEFAZ ou serviço intermediário de emissão, com custo e prazo comparados. *(Modelo arquitetural parametrizado em `modo_integracao`: `sefaz_direto` padrão ou `intermediario`.)*
- [x] Definido onde e como os segredos (certificado e senha) serão guardados. *(Cofre local cifrado AES-256-GCM em `FISCAL_VAULT_DIR` + `senha_certificado_enc` com `FISCAL_ENCRYPTION_KEY`.)*
- [x] Definido que apenas o perfil de gestor acessa esta configuração (relação com o #20). *(Protegido por `requerPerfil(['GESTOR'])` no backend e bloqueio no frontend.)*
- [x] Estimativa (5 SP) acordada pelo time.

---

## 33b · Cadastrar dados fiscais dos produtos · *(Implementada em 20/11/2026)*

- **SP:** 3 | **MoSCoW sugerido:** Should | **Depende de:** #5

> Como gestor, quero informar os dados fiscais de cada produto (NCM, CFOP, origem, CST/CSOSN e unidade), para que as notas saiam com os impostos corretos.

**Critérios de aceite**

- [x] Cada produto possui os campos fiscais definidos, com validação de formato (por exemplo, NCM com 8 dígitos). (`ncm`, `cfop`, `origem_mercadoria`, `cst_csosn`, `unidade_comercial` e `cest` em `produtos` + `fiscalValidator.ts`)
- [x] Um produto sem dados fiscais completos fica identificado e não pode ser usado na emissão, com indicação clara do que falta. (`fiscal_status` no catálogo, badge/filtro em `produtos.html` e `fiscal.html`, e bloqueio HTTP 422 em `POST /api/fiscal/validar-emissao`)
- [x] Alterar os dados fiscais de um produto não altera notas já emitidas. (snapshots imutáveis em `notas_fiscais_itens` verificados no teste `unit_test_emissao_nfe_33a_33b.mjs`)

**Definition of Ready (DoR): não pronto até que...**

- [ ] Lista de produtos da ResFire e seus dados fiscais fornecida e validada pelo contador. *(Pendente validação contábil por SKU antes da emissão oficial; sugestões de extintores `84241000` disponibilizadas no formulário.)*
- [x] Definido se o CFOP é fixo por produto ou depende do tipo de operação. *(CFOP padrão por produto cadastrado no catálogo; ajustável por operação na montagem da nota 33c.)*
- [x] Relação com o cadastro de tipos de produto (#5) definida, para não duplicar campos. *(Campos acoplados diretamente à entidade `Produto`, com verificação adicional de componentes em `Combo`.)*
- [x] Definido se as tabelas de referência (NCM, CST/CSOSN) serão listas prontas no sistema ou preenchimento livre com validação de formato. *(CST/CSOSN e Origem via lista oficial SEFAZ; NCM, CFOP e Unidade com listas de sugestões rápidas e validação estrita de formato.)*
- [x] Estimativa (3 SP) acordada pelo time.

---

## 33c · Montar, validar e assinar a NF-e a partir de um pedido

- **SP:** 8 | **MoSCoW sugerido:** Should | **Depende de:** 33a, 33b, #9a (ou #30)

> Como gestor, quero que o sistema monte a NF-e a partir de um pedido, valide os dados e a assine digitalmente, para ter uma nota pronta para envio sem digitar nada manualmente.

**Critérios de aceite**

- [ ] No pedido, a ação "Preparar NF-e" monta a nota com emitente, destinatário, itens, impostos, frete e totais.
- [ ] O sistema valida os dados antes da assinatura e mostra os erros indicando o campo e o motivo.
- [ ] A nota é assinada digitalmente com o certificado do emitente.
- [ ] Um pedido sem dados obrigatórios (destinatário ou dados fiscais do produto) é bloqueado, com a lista do que falta.
- [ ] A numeração é sequencial e não se repete.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Stories 33a e 33b concluídas.
- [ ] Origem dos dados do pedido e do destinatário (CPF/CNPJ e endereço) definida: pedidos manuais (#9a) ou importados do Mercado Livre (#30).
- [ ] Versão vigente do layout da NF-e confirmada, incluindo as exigências da Reforma Tributária (IBS e CBS).
- [ ] Regras de cálculo de impostos fornecidas pelo contador, e definido quem calcula (o sistema ou valor informado).
- [ ] Regra de série e numeração definida.
- [ ] Exemplos reais de notas (sem dados pessoais) disponíveis para comparação.
- [ ] Estimativa (8 SP) revisada após a decisão entre integração direta e serviço intermediário.

---

## 33d · Transmitir à SEFAZ e tratar o retorno

- **SP:** 8 | **MoSCoW sugerido:** Should | **Depende de:** 33c

> Como gestor, quero enviar a NF-e à SEFAZ e ver o resultado da autorização, para saber se a nota foi aceita ou o que preciso corrigir.

**Critérios de aceite**

- [ ] A nota é transmitida ao ambiente de homologação por padrão; a produção só é usada após ativação explícita (33a).
- [ ] O resultado é exibido: autorizada (com protocolo), rejeitada (com código e motivo) ou denegada.
- [ ] Uma nota rejeitada pode ser corrigida e reenviada, seguindo a regra de numeração definida.
- [ ] Quando o retorno não chega na hora, o sistema consulta a situação da nota antes de reenviar, evitando envio duplicado.
- [ ] O pedido mostra o status fiscal (sem nota, em processamento, autorizada, rejeitada, cancelada).
- [ ] Se a SEFAZ estiver indisponível, o sistema informa e permite tentar novamente depois.
- [ ] Cada envio e retorno fica registrado.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Story 33c concluída.
- [ ] Acesso aos serviços da SEFAZ/SP em homologação confirmado.
- [ ] Lista das rejeições mais comuns levantada, com a mensagem amigável para cada uma.
- [ ] Regra para reaproveitar ou descartar o número de uma nota rejeitada validada com o contador.
- [ ] Política de nova tentativa e tempo limite de resposta definida.
- [ ] Definido se a contingência (emissão quando a SEFAZ está fora do ar) entra no escopo ou fica para depois.
- [ ] Checklist de liberação para produção definido.
- [ ] Estimativa (8 SP) revisada após um teste inicial de comunicação com o ambiente de homologação (spike).

---

## 33e · Guardar o XML autorizado e gerar o DANFE

- **SP:** 3 | **MoSCoW sugerido:** Should | **Depende de:** 33d

> Como gestor, quero guardar o XML autorizado e gerar o DANFE de cada nota, para ter o documento fiscal disponível para impressão, envio e arquivo.

**Critérios de aceite**

- [ ] O XML autorizado fica armazenado e vinculado ao pedido, com opção de download.
- [ ] O DANFE é gerado e pode ser visualizado e impresso a partir do pedido.
- [ ] O DANFE exibe a chave de acesso e o protocolo de autorização.
- [ ] Os documentos de uma nota continuam disponíveis depois de alterações no pedido.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Story 33d concluída.
- [ ] Prazo legal de guarda do XML e forma de armazenamento definidos.
- [ ] Modelo do DANFE (padrão oficial) aceito pelo cliente.
- [ ] Definido se XML e DANFE serão enviados ao comprador e como a nota chega ao Mercado Livre (a verificar).
- [ ] Estimativa (3 SP) acordada pelo time.

---

## 33f · Cancelar NF-e e corrigir por evento

- **SP:** 5 | **MoSCoW sugerido:** Should | **Depende de:** 33d

> Como gestor, quero cancelar uma NF-e e registrar uma carta de correção, para tratar erros e desistências sem precisar emitir fora do sistema.

**Critérios de aceite**

- [ ] O cancelamento só é permitido para nota autorizada e dentro do prazo e das regras aplicáveis, com justificativa obrigatória.
- [ ] A carta de correção é registrada com o texto informado e respeita as regras do que pode ser corrigido.
- [ ] Cancelamento e correção são enviados à SEFAZ, e o status fiscal do pedido é atualizado.
- [ ] Os eventos ficam registrados com seu protocolo.
- [ ] Quando a operação não for permitida (fora do prazo ou regra), o sistema explica o motivo.
- [ ] Numeração pulada e não utilizada pode ser inutilizada.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Story 33d concluída.
- [ ] Prazos e regras de cancelamento e de carta de correção confirmados com o contador.
- [ ] Definido o que acontece com o estoque e com o pedido quando a nota é cancelada (relação com #1 e #9b).
- [ ] Definido o fluxo para casos que exigem nota de devolução ou complementar (no escopo ou fora).
- [ ] Estimativa (5 SP) revisada, pois o escopo de eventos pode crescer.

---

## 33g · Alertar o vencimento do certificado digital

- **SP:** 2 | **MoSCoW sugerido:** Could | **Depende de:** 33a

> Como gestor, quero ser avisado antes de o certificado digital vencer, para renová-lo a tempo e não ficar impedido de emitir notas.

**Critérios de aceite**

- [ ] O sistema identifica a data de validade do certificado cadastrado.
- [ ] Um alerta aparece com a antecedência definida e entra no painel central (#19).
- [ ] Com o certificado vencido, a emissão é bloqueada com uma mensagem clara.
- [ ] Substituir o certificado não apaga o histórico de notas emitidas.

**Definition of Ready (DoR): não pronto até que...**

- [ ] Story 33a concluída.
- [ ] Antecedência do aviso definida com o cliente.
- [ ] Definido se o alerta aparece apenas no painel (#19) ou também por notificação (#32).
- [ ] Estimativa (2 SP) acordada pelo time.

---

## Verificação rápida do INVEST (avaliação inicial)

| # | I | N | V | E | S | T | Observação |
|---|---|---|---|---|---|---|---|
| 33a | ✔ | ✔ | ~ | ✔ | ✔ | ✔ | Habilitadora; o valor aparece com 33c a 33e. |
| 33b | ~ | ✔ | ~ | ✔ | ✔ | ✔ | Habilitadora; depende do #5. |
| 33c | ✖ | ✔ | ~ | ~ | ~ | ✔ | Depende de 33a, 33b e de pedidos; 8 SP, estimativa sensível ao layout. |
| 33d | ✖ | ✔ | ✔ | ~ | ~ | ✔ | Depende de 33c; incerteza técnica, considerar spike. |
| 33e | ✖ | ✔ | ✔ | ✔ | ✔ | ✔ | Depende de 33d. |
| 33f | ✖ | ✔ | ✔ | ~ | ✔ | ✔ | Escopo de eventos pode crescer. |
| 33g | ~ | ✔ | ✔ | ✔ | ✔ | ✔ | Pequena e testável. |

Legenda: ✔ atende · ~ atende parcialmente · ✖ não atende. A dependência sequencial entre 33c, 33d, 33e e 33f é natural neste tipo de fluxo. Se necessário, o time pode tratar 33c, 33d e 33e como uma entrega única de ponta a ponta.

## Pontos de atenção

- **Regras fiscais:** as definições de NCM, CFOP, regime tributário e prazos de cancelamento precisam ser validadas com o contador da ResFire. Este documento não substitui orientação contábil.
- **Decisão de arquitetura:** integração direta com a SEFAZ ou serviço intermediário muda custo, prazo e esforço de 33c e 33d. Decidir antes da Sprint 4.
- **Layout da NF-e em transição:** as exigências da Reforma Tributária (IBS e CBS) mudam o layout das notas e podem alterar as estimativas.
- **Homologação primeiro:** nenhuma nota com validade fiscal deve ser emitida antes de a liberação para produção ser validada pelo checklist de 33d.
- **Capacidade da Sprint 4:** os 27 SP de 33a a 33e consomem quase todos os 30 SP livres. Se a retrospectiva da Sprint 3 indicar outras prioridades, mover 33c a 33e para a Sprint 5.
- **Estimativas:** os valores de SP são sugestões iniciais e ainda não foram validados com o time.
