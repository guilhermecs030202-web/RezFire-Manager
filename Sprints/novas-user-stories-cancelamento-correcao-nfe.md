# Histórias de cancelamento e correção de NF-e (33f.1 e 33f.2)

## Contexto

Sistema web de apoio à gestão da operação de e-commerce da **ResFire** (venda de extintores pelo Mercado Livre). Estas histórias detalham o cancelamento e a correção de uma NF-e já emitida e integrada à SEFAZ, e **substituem a história 33f** ("Cancelar NF-e e corrigir por evento, 5 SP") do épico de emissão de NF-e (#33), que passou a ser dividida em duas porque as regras de cancelamento e de correção são bem diferentes.

## Regras fiscais que motivaram a divisão

As informações abaixo vêm de fontes consultadas em 24/11/2026 e **precisam ser confirmadas com o contador da ResFire** antes da implementação.

| Tema | O que as fontes indicam |
|---|---|
| Cancelamento normal | Só é possível quando a mercadoria ainda não saiu do estabelecimento, no prazo regular de 24 horas após a autorização. |
| Cancelamento fora do prazo | É um pedido de cancelamento extemporâneo feito à SEFAZ-SP, hoje com limite de 480 horas (20 dias) após a autorização. Não é possível quando há evento que o impeça, como CT-e ou MDF-e válido. |
| Carta de correção (CC-e) | Não corrige campos do cálculo do imposto, remetente, destinatário nem datas. Só vale para nota autorizada, não para nota cancelada. Uma das fontes indica prazo de até 720 horas, com várias cartas permitidas (a confirmar). |
| Erro fora do alcance da carta | Cancelar (se ainda for possível) e emitir uma nova nota. |

## Resumo

| # | História | SP | MoSCoW sugerido | Sprint sugerida | Depende de |
|---|---|---|---|---|---|
| 33f.1 | Cancelar NF-e já emitida | 3 | Should | 5 | 33d |
| 33f.2 | Corrigir NF-e por carta de correção | 3 | Should | 5 | 33d |
| | **Total** | **6** | | | |

As duas podem ser feitas em qualquer ordem, depois da 33d.

---

## 33f.1 · Cancelar NF-e já emitida

- **SP:** 3 | **MoSCoW sugerido:** Should | **Depende de:** 33d

> Como gestor, quero cancelar uma NF-e autorizada diretamente no sistema, para desfazer notas emitidas por engano ou de pedidos cancelados sem precisar acessar outro sistema da SEFAZ.

**Critérios de aceite**

- [x] A ação "Cancelar NF-e" só aparece para notas autorizadas e mostra o prazo restante para o cancelamento normal antes de confirmar.
- [x] A justificativa é obrigatória.
- [x] O sistema envia o evento de cancelamento à SEFAZ e mostra o resultado: aceito ou rejeitado, com o motivo.
- [x] Após o aceite, o status fiscal do pedido passa a "cancelada" e o XML do evento fica guardado.
- [x] Fora do prazo normal, ou quando a mercadoria já saiu, o sistema bloqueia a ação, explica o motivo e orienta sobre o pedido de cancelamento extemporâneo. Esse pedido é feito à SEFAZ, fora do sistema.
- [x] Depois do cancelamento, o pedido pode receber uma nova NF-e.
- [x] Cada cancelamento registra quem fez, quando e a justificativa.
- [x] (DoD) A funcionalidade continua utilizável sem a conta do Mercado Livre conectada (modo manual, #34).

**Definition of Ready (DoR): não pronto até que...**

- [ ] Story 33d concluída.
- [ ] Prazo, condições e tamanho mínimo da justificativa confirmados com o contador e com o manual da SEFAZ-SP.
- [ ] Definido como o sistema sabe que a mercadoria já saiu (por exemplo, pelo status do pedido no #9b).
- [ ] Definido o que acontece com o pedido e o estoque quando a nota é cancelada (relação com #1 e #9b).
- [ ] Definido quem pode cancelar (perfil de acesso, #20).
- [ ] Estimativa (3 SP) acordada pelo time.

---

## 33f.2 · Corrigir NF-e por carta de correção

- **SP:** 3 | **MoSCoW sugerido:** Should | **Depende de:** 33d

> Como gestor, quero registrar uma carta de correção em uma NF-e autorizada, para corrigir erros permitidos, como informações adicionais, sem cancelar e reemitir a nota.

**Critérios de aceite**

- [x] A ação "Corrigir NF-e" só aparece para notas autorizadas, nunca para notas canceladas.
- [x] Antes do envio, o sistema avisa o que a carta não pode corrigir (valores, campos do cálculo do imposto, remetente, destinatário e datas) e orienta cancelar e reemitir quando o erro estiver nessa lista.
- [x] O gestor escreve o texto da correção, e o sistema o envia à SEFAZ e mostra o resultado.
- [x] É possível registrar mais de uma carta na mesma nota, com a sequência de cada uma, e o histórico fica visível no pedido.
- [x] Fora do prazo permitido, o sistema bloqueia e explica o motivo.
- [x] O XML de cada evento fica guardado.
- [x] (DoD) A funcionalidade continua utilizável sem a conta do Mercado Livre conectada (modo manual, #34).

**Definition of Ready (DoR): não pronto até que...**

- [ ] Story 33d concluída.
- [ ] Lista de campos que podem e não podem ser corrigidos, vigente em SP, confirmada com o contador.
- [ ] Prazo limite da carta confirmado (as fontes consultadas indicam até 720 horas).
- [ ] Definidos o tamanho mínimo do texto e o limite de cartas por nota.
- [ ] Definido se a correção é comunicada ao comprador e como (a verificar).
- [ ] Estimativa (3 SP) acordada pelo time.

---

## Verificação rápida do INVEST (avaliação inicial)

| # | I | N | V | E | S | T | Observação |
|---|---|---|---|---|---|---|---|
| 33f.1 | ~ | ✔ | ✔ | ✔ | ✔ | ✔ | Depende da 33d; as regras de prazo precisam ser confirmadas. |
| 33f.2 | ~ | ✔ | ✔ | ✔ | ✔ | ✔ | Depende da 33d; a lista de campos corrigíveis precisa ser confirmada. |

Legenda: ✔ atende · ~ atende parcialmente.

## Impacto no plano de sprints

- **Sprint 5:** a 33f (5 SP) é substituída por 33f.1 e 33f.2 (3 + 3 SP). Com a 33g (2 SP) e o #23 (5 SP), a Sprint 5 passa a ter **14 SP**, bem abaixo dos 45 SP de capacidade.
- **Inutilização de numeração:** estava dentro da 33f e ficou de fora destas duas histórias. Pode virar uma história própria (cerca de 2 SP), a definir com o time. Enquanto isso, não está coberta no backlog.

## Pontos de atenção

- **Regras fiscais:** prazos e restrições variam e mudam. Este documento não substitui a orientação do contador.
- **Cancelamento extemporâneo:** o pedido à SEFAZ fica fora do sistema. O sistema apenas detecta a situação e orienta o gestor.
- **Estoque e pedido:** o que acontece com eles quando uma nota é cancelada precisa estar definido antes da 33f.1 (relação com #1 e #9b).
- **Estimativas:** os valores de SP são sugestões iniciais e ainda não foram validados com o time.

## Fontes consultadas

- SEFAZ-SP, cancelamento extemporâneo de NF-e: https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/cancelamentoextemp.aspx
- SEFAZ-SP, Resposta à Consulta 33544/2026 (carta de correção e campos do cálculo do imposto): https://legislacao.fazenda.sp.gov.br/Paginas/RC33544_2026.aspx
- SEFAZ-SP, Resposta à Consulta 32546/2025 (cancelamento e circulação da mercadoria): https://www.legisweb.com.br/legislacao/?id=491054
- Regras de cancelamento de NF-e (Portaria CAT 162/2008): https://contadores.cnt.br/projetos/34/noticias/tecnicas/2019/04/04/nf-e-regras-de-cancelamento.html
- Diferenças entre cancelamento, carta de correção e inutilização: https://jornalcontabil.com.br/noticia/principais-diferencas-entre-cancelamento-carta-de-correcao-e-inutilizacao-de-notas-fiscais/
- Como cancelar ou corrigir uma NF-e (prazo de 720 horas da carta): https://aegro.com.br/suporte/fiscal/como-cancelar-ou-corrigir-uma-nf-e/
- Prazo de cancelamento por UF: https://ajuda.alterdata.com.br/shopbase/prazo-para-cancelamento-de-nf-e-por-estado-uf-tabela-completa-297894232.html
