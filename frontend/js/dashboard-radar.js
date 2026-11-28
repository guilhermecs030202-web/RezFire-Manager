/**
 * dashboard-radar.js
 * Aba 1: "Visão Geral" (Radar Executivo de Decisão Rápida) — RezFire Manager.
 *
 * Objetivo: Apresentar em poucos segundos a saúde crítica (Vermelho / Amarelo / Verde)
 * de cada uma das 10 abas do Painel Executivo, mantendo ordem fixa por padrão com
 * opção de alternar instantaneamente para ordenação por peso/prioridade crítica,
 * e redirecionando em 1 clique para o dashboard correspondente.
 */
(function () {
  const state = {
    dias: 30,
    modoOrdenacao: "fixa", // Padrão solicitado: "fixa" | alternativa: "prioridade"
    filtroStatus: "todos", // "todos" | "critico" | "atencao" | "saudavel"
    dados: null,
    carregando: false,
  };

  function esc(val) {
    return String(val ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function isUsuarioOperador() {
    try {
      const raw = localStorage.getItem("rezfire_user");
      if (!raw) return false;
      const u = JSON.parse(raw);
      return Boolean(u && u.perfil && String(u.perfil).toUpperCase() === "OPERADOR");
    } catch {
      return false;
    }
  }

  function aplicarRestricaoPerfilAbas() {
    if (!isUsuarioOperador()) return;
    const btnFin = document.getElementById("dash-tab-btn-financeiro");
    const btnFis = document.getElementById("dash-tab-btn-fiscal");
    if (btnFin) btnFin.style.display = "none";
    if (btnFis) btnFis.style.display = "none";
  }

  function svgIcon(name) {
    const map = {
      "trending-up":
        '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
      box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      "shopping-bag":
        '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 8h10"/><path d="M7 12h6"/>',
      truck:
        '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 4v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
      package: '<path d="M4 7h16v12H4z"/><path d="M8 7V5h8v2"/><path d="M8 12h8"/>',
      "dollar-sign":
        '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
      users:
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      clipboard:
        '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14h6"/><path d="M9 10h6"/>',
      "refresh-cw":
        '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
      "file-text":
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    };
    const path = map[name] || map.box;
    return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }

  function calcScore(status, pesoBase, extra = 0) {
    const bonus = Math.max(0, Math.min(9, Math.round(extra || 0)));
    if (status === "critico") return 200 + pesoBase * 10 + bonus;
    if (status === "atencao") return 100 + pesoBase * 10 + bonus;
    return pesoBase;
  }

  /**
   * Cálculo local instantâneo (modo demonstração / primeiro paint antes do MySQL)
   * utilizando exatamente as mesmas regras de negócio do RadarDashboardService no backend.
   */
  function gerarVisaoGeralLocal(dias = 30) {
    const money = window.RezFireData ? window.RezFireData.formatMoney : (v) => `R$ ${Number(v || 0).toFixed(2)}`;
    const products = typeof window.getDashboardProducts === "function"
      ? window.getDashboardProducts()
      : window.RezFireData?.loadProducts() || [];
    const orders = typeof window.getDashboardOrders === "function"
      ? window.getDashboardOrders()
      : window.RezFireData?.loadOrders() || [];
    const lotes = window.RezFireData?.loadLotes ? window.RezFireData.loadLotes() : [];
    const isOperador = isUsuarioOperador();

    const blocos = [];

    // 1. VENDAS (Peso 6)
    {
      const pesoBase = 6;
      const sales = window.RezFireData.computeSalesMetrics(orders, dias, "todos");
      const delta = Number(sales.deltaFaturamento || 0);
      const totalPed = Number(sales.totalPedidos || 0);
      const cancCount = Math.max(0, totalPed - Number(sales.pedidosConcluidos || 0));
      const taxaCanc = totalPed > 0 ? Number(((cancCount / totalPed) * 100).toFixed(1)) : 0;

      let status = "saudavel";
      const alertas = [];
      if (sales.pedidosConcluidos === 0) {
        status = "critico";
        alertas.push(`Nenhuma venda aprovada registrada nos últimos ${dias} dias.`);
      } else {
        if (delta <= -20) {
          status = "critico";
          alertas.push(`Queda acentuada de faturamento (${delta}% vs período anterior).`);
        } else if (delta < -5) {
          status = "atencao";
          alertas.push(`Retração moderada de vendas (${delta}% vs período anterior).`);
        }
        if (totalPed >= 3 && taxaCanc > 10) {
          status = "critico";
          alertas.push(`Cancelamento elevado: ${taxaCanc}% dos pedidos no período.`);
        } else if (totalPed >= 3 && taxaCanc > 5 && status === "saudavel") {
          status = "atencao";
          alertas.push(`Taxa de cancelamento em ${taxaCanc}% dos pedidos.`);
        }
      }

      blocos.push({
        id: "vendas",
        ordem_fixa: 1,
        titulo: "Vendas",
        subtitulo_curto: "Faturamento, volume e conversão",
        icone: "trending-up",
        aba_destino: "vendas",
        status,
        peso_base: pesoBase,
        score_prioridade: calcScore(status, pesoBase, status === "critico" ? 3 : 1),
        manchete:
          alertas[0] ||
          `Ritmo saudável com ${sales.pedidosConcluidos} pedidos válidos (${delta >= 0 ? "+" : ""}${delta}% no período).`,
        acao_recomendada: status === "saudavel" ? "Acompanhar curva de vendas" : "Investigar queda / cancelamentos",
        indicadores: [
          {
            rotulo: `Faturamento (${dias}d)`,
            valor: `${money(sales.faturamentoTotal)} (${delta >= 0 ? "+" : ""}${delta}%)`,
            destaque: delta <= -20 ? "danger" : delta < -5 ? "warning" : "ok",
          },
          {
            rotulo: "Ticket Médio · Aprovação",
            valor: `${money(sales.ticketMedio)} · ${sales.taxaConclusao}%`,
            destaque: taxaCanc > 10 ? "danger" : taxaCanc > 5 ? "warning" : "neutral",
          },
        ],
        alertas_resumo: alertas,
      });
    }

    // 2. ESTOQUE & FEFO (Peso 9)
    {
      const pesoBase = 9;
      const st = window.RezFireData.computeStockDashboardMetrics(products, "todos", "todos", orders);
      const zerados = st.skusRuptura.length;
      const baixos = st.skusCriticos.length;

      let vencidos = 0;
      let bloqueados = 0;
      let alertaFefo = 0;
      lotes.forEach((l) => {
        if (Number(l.quantidade_disponivel || 0) <= 0) return;
        const val = l.validade || l.data_validade;
        if (!val || !window.RezFireData.computeLoteStatus) return;
        const info = window.RezFireData.computeLoteStatus(val);
        if (info.statusKey === "vencido") vencidos++;
        else if (info.statusKey === "bloqueado") bloqueados++;
        else if (info.statusKey === "alerta") alertaFefo++;
      });

      let status = "saudavel";
      const alertas = [];
      let filtroSugerido;

      if (zerados > 0) {
        status = "critico";
        alertas.push(`${zerados} SKU(s) ativo(s) em ruptura total (saldo zero).`);
        filtroSugerido = { estoqueRisco: "ruptura" };
      }
      if (vencidos > 0 || bloqueados > 0) {
        status = "critico";
        alertas.push(
          `${vencidos + bloqueados} lote(s) travado(s) p/ venda (${vencidos} vencido(s), ${bloqueados} ≤ 180 dias).`
        );
      }
      if (baixos > 0) {
        if (status === "saudavel") status = "atencao";
        alertas.push(`${baixos} produto(s) operando abaixo do estoque mínimo.`);
        if (!filtroSugerido) filtroSugerido = { estoqueRisco: "critico" };
      }
      if (alertaFefo > 0) {
        if (status === "saudavel") status = "atencao";
        alertas.push(`${alertaFefo} lote(s) em prioridade FEFO (validade ≤ 1 ano).`);
      }

      blocos.push({
        id: "estoque",
        ordem_fixa: 2,
        titulo: "Estoque & FEFO",
        subtitulo_curto: "Rupturas, mínimos e validade INMETRO",
        icone: "box",
        aba_destino: "estoque",
        status,
        peso_base: pesoBase,
        score_prioridade: calcScore(status, pesoBase, zerados + vencidos + bloqueados),
        manchete:
          alertas[0] ||
          `Estoque abastecido e todos os lotes dentro da janela de validade segura.`,
        acao_recomendada:
          zerados > 0
            ? "Repor SKUs zerados imediatamente"
            : vencidos + bloqueados > 0
            ? "Tratar lotes bloqueados / vencidos"
            : status === "atencao"
            ? "Revisar reposição e fila FEFO"
            : "Ver posição de inventário",
        indicadores: [
          {
            rotulo: "Ruptura · Abaixo do Mín.",
            valor: `${zerados} zerados · ${baixos} baixos`,
            destaque: zerados > 0 ? "danger" : baixos > 0 ? "warning" : "ok",
          },
          {
            rotulo: "Lotes FEFO (Travados / Alerta)",
            valor: `${vencidos + bloqueados} bloq. · ${alertaFefo} alerta`,
            destaque: vencidos + bloqueados > 0 ? "danger" : alertaFefo > 0 ? "warning" : "ok",
          },
        ],
        alertas_resumo: alertas,
        filtro_sugerido: filtroSugerido,
      });
    }

    // 3. MERCADO LIVRE (Peso 9)
    {
      const pesoBase = 9;
      const mlData = typeof window.gerarFallbackImpactoQuedas === "function"
        ? window.gerarFallbackImpactoQuedas(dias)
        : { kpis: { anuncios_ativos_atualmente: 8, anuncios_pausados_atualmente: 1, faturamento_perdido_total: 0, impacto_percentual_receita: 0 } };
      const pausados = Number(mlData.kpis?.anuncios_pausados_atualmente || 0);
      const ativos = Number(mlData.kpis?.anuncios_ativos_atualmente || 0);
      const perda = Number(mlData.kpis?.faturamento_perdido_total || 0);
      const impPct = Number(mlData.kpis?.impacto_percentual_receita || 0);

      let status = "saudavel";
      const alertas = [];
      if (pausados > 0) {
        status = "critico";
        alertas.push(`${pausados} anúncio(s) pausado(s)/inativo(s) no Mercado Livre perdendo exposição.`);
      }
      if (impPct > 5) {
        if (status === "saudavel") status = "atencao";
        alertas.push(`Receita cessante estimada em ${money(perda)} (-${impPct}% no período).`);
      }

      blocos.push({
        id: "ml",
        ordem_fixa: 3,
        titulo: "Mercado Livre",
        subtitulo_curto: "Anúncios, pausas e receita cessante",
        icone: "shopping-bag",
        aba_destino: "ml",
        status,
        peso_base: pesoBase,
        score_prioridade: calcScore(status, pesoBase, pausados),
        manchete:
          alertas[0] ||
          `Todos os ${ativos} anúncios ativos e sincronizados sem perdas relevantes.`,
        acao_recomendada: pausados > 0 ? "Reativar / regularizar anúncios no ML" : "Ver performance de anúncios",
        indicadores: [
          {
            rotulo: "Anúncios (Ativos / Quedas)",
            valor: `${ativos} ativos · ${pausados} inativos`,
            destaque: pausados > 0 ? "danger" : "ok",
          },
          {
            rotulo: "Receita Cessante Estimada",
            valor: `${money(perda)} (${impPct}%)`,
            destaque: impPct > 10 ? "danger" : impPct > 5 ? "warning" : "neutral",
          },
        ],
        alertas_resumo: alertas,
      });
    }

    // 4. ENTREGAS (Peso 10)
    {
      const pesoBase = 10;
      let atrasados = 0;
      let venceHoje = 0;
      let pendentes = 0;
      let ocorrencias = 0;

      if (window.RezFireEntregas && typeof window.RezFireEntregas.loadEntregas === "function") {
        const refDate = window.RezFireEntregas.ENTREGAS_REF_DATE
          ? new Date(window.RezFireEntregas.ENTREGAS_REF_DATE)
          : new Date();
        const entregas = window.RezFireEntregas.loadEntregas();
        const SL = window.RezFireEntregas.STATUS_LOGISTICO || {};
        const SI = window.RezFireEntregas.STATUS_INTERNO || {};

        entregas.forEach((e) => {
          if (e.status_interno === SI.CANCELADO || e.status_logistico === SL.ENTREGUE) return;
          if (!e.data_despacho) {
            pendentes++;
            if (e.prazo_despacho) {
              const dPrazo = new Date(e.prazo_despacho);
              const startP = new Date(dPrazo.getFullYear(), dPrazo.getMonth(), dPrazo.getDate()).getTime();
              const startR = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
              const diffDias = Math.round((startP - startR) / 86400000);
              if (diffDias < 0) atrasados++;
              else if (diffDias === 0) venceHoje++;
            }
          } else if (e.status_logistico === SL.OCORRENCIA || e.status_logistico === SL.ATRASADO) {
            ocorrencias++;
          }
        });
      }

      let status = "saudavel";
      const alertas = [];
      let filtroSugerido;

      if (atrasados > 0 || ocorrencias > 0) {
        status = "critico";
        if (atrasados > 0) {
          alertas.push(`${atrasados} pedido(s) com postagem ATRASADA — risco direto de reputação no ML.`);
        }
        if (ocorrencias > 0) {
          alertas.push(`${ocorrencias} entrega(s) em trânsito com ocorrência ou atraso na transportadora.`);
        }
        filtroSugerido = { entregaRisco: "critico" };
      }
      if (venceHoje > 0) {
        if (status === "saudavel") status = "atencao";
        alertas.push(`${venceHoje} pedido(s) com prazo limite de despacho vencendo HOJE.`);
      }

      blocos.push({
        id: "entregas",
        ordem_fixa: 4,
        titulo: "Entregas",
        subtitulo_curto: "Fila de separação, SLA de despacho e trânsito",
        icone: "truck",
        aba_destino: "entregas",
        status,
        peso_base: pesoBase,
        score_prioridade: calcScore(status, pesoBase, atrasados * 2 + ocorrencias + venceHoje),
        manchete:
          alertas[0] ||
          `Expedição fluindo no prazo (${pendentes} pedido(s) em preparação sem atraso).`,
        acao_recomendada:
          atrasados > 0
            ? `Despachar ${atrasados} pedido(s) atrasado(s)`
            : ocorrencias > 0
            ? `Tratar ${ocorrencias} ocorrência(s) logística(s)`
            : venceHoje > 0
            ? `Priorizar ${venceHoje} envio(s) de hoje`
            : "Acompanhar fila logística",
        indicadores: [
          {
            rotulo: "Despacho Atrasado · Hoje",
            valor: `${atrasados} atrasados · ${venceHoje} p/ hoje`,
            destaque: atrasados > 0 ? "danger" : venceHoje > 0 ? "warning" : "ok",
          },
          {
            rotulo: "Fila de Envio · Ocorrências",
            valor: `${pendentes} pendentes · ${ocorrencias} ocorr.`,
            destaque: ocorrencias > 0 ? "danger" : "neutral",
          },
        ],
        alertas_resumo: alertas,
        filtro_sugerido: filtroSugerido,
      });
    }

    // 5. PRODUTOS (Peso 4)
    {
      const pesoBase = 4;
      const ativosList = products.filter((p) => p.ativo !== false);
      const totalAtivos = ativosList.length;
      const defasados = ativosList.filter((p) => Number(p.custo || 0) > 0 && Number(p.preco || 0) <= Number(p.custo || 0)).length;

      const cutoff = Date.now() - dias * 86400000;
      const vendidosSet = new Set();
      orders.forEach((o) => {
        if (o.status === "Cancelado") return;
        if (o.data_pedido && new Date(o.data_pedido).getTime() < cutoff) return;
        (o.itens || []).forEach((it) => vendidosSet.add(Number(it.id_produto)));
      });
      const parados = ativosList.filter((p) => !vendidosSet.has(Number(p.id_produto))).length;
      const pctParados = totalAtivos > 0 ? Math.round((parados / totalAtivos) * 100) : 0;

      let status = "saudavel";
      const alertas = [];
      if (defasados > 0) {
        status = "critico";
        alertas.push(`${defasados} produto(s) ativo(s) com preço de venda menor ou igual ao custo.`);
      }
      if (totalAtivos >= 4 && pctParados > 35) {
        if (status === "saudavel") status = "atencao";
        alertas.push(`${parados} de ${totalAtivos} produtos ativos sem giro nos últimos ${dias} dias.`);
      }

      blocos.push({
        id: "produtos",
        ordem_fixa: 5,
        titulo: "Produtos",
        subtitulo_curto: "Mix ativo, giro por SKU e cadastro",
        icone: "package",
        aba_destino: "produtos",
        status,
        peso_base: pesoBase,
        score_prioridade: calcScore(status, pesoBase, defasados),
        manchete:
          alertas[0] ||
          `Catálogo saudável: ${totalAtivos} SKUs ativos girando e com precificação positiva.`,
        acao_recomendada:
          defasados > 0
            ? "Corrigir preços abaixo do custo"
            : status === "atencao"
            ? "Revisar SKUs parados no catálogo"
            : "Analisar curva ABC de produtos",
        indicadores: [
          {
            rotulo: "Catálogo Ativo · Sem Giro",
            valor: `${totalAtivos} ativos · ${parados} parados`,
            destaque: pctParados > 35 ? "warning" : "ok",
          },
          {
            rotulo: "Preço ≤ Custo",
            valor: `${defasados} defasado(s)`,
            destaque: defasados > 0 ? "danger" : "ok",
          },
        ],
        alertas_resumo: alertas,
      });
    }

    // 6. FINANCEIRO (Peso 8 · Apenas GESTOR)
    if (!isOperador) {
      const pesoBase = 8;
      const fin = window.RezFireData.computeFinancialDashboardMetrics(products, orders, dias, "todos", "todos");
      const emRisco = (fin.skusRiscoMargem || []).length;
      const prejuizo = (fin.allItems || []).filter((i) => Number(i.margem_unit_rs || 0) <= 0).length;
      const margemLiq = Number(fin.margemLiquidaPct || fin.margemContribuicaoPct || 0);

      let status = "saudavel";
      const alertas = [];
      let filtroSugerido;

      if (prejuizo > 0 || Number(fin.lucroLiquidoTotal || 0) < 0) {
        status = "critico";
        alertas.push(
          prejuizo > 0
            ? `${prejuizo} SKU(s) com margem negativa/prejuízo na operação.`
            : `Resultado líquido negativo no período analisado.`
        );
        filtroSugerido = { financeiroMargem: "low" };
      } else if (emRisco > 0) {
        status = "atencao";
        alertas.push(`${emRisco} produto(s) com margem comprimida (< 40% bruta antes de tarifas ML).`);
        filtroSugerido = { financeiroMargem: "low" };
      }

      blocos.push({
        id: "financeiro",
        ordem_fixa: 6,
        titulo: "Financeiro",
        subtitulo_curto: "Margens, lucro líquido e caixa PJ × PF",
        icone: "dollar-sign",
        aba_destino: "financeiro",
        status,
        peso_base: pesoBase,
        score_prioridade: calcScore(status, pesoBase, prejuizo + emRisco),
        manchete:
          alertas[0] ||
          `Rentabilidade saudável com lucro líquido de ${money(fin.lucroLiquidoTotal)}.`,
        acao_recomendada:
          status !== "saudavel" ? `Revisar ${emRisco || prejuizo} SKU(s) com margem apertada` : "Ver demonstrativo financeiro",
        indicadores: [
          {
            rotulo: "Lucro Líquido Estimado",
            valor: `${money(fin.lucroLiquidoTotal)} (${margemLiq.toFixed(1)}%)`,
            destaque: Number(fin.lucroLiquidoTotal || 0) < 0 ? "danger" : emRisco > 0 ? "warning" : "ok",
          },
          {
            rotulo: "SKUs em Risco de Margem",
            valor: `${emRisco} produto(s)`,
            destaque: prejuizo > 0 ? "danger" : emRisco > 0 ? "warning" : "ok",
          },
        ],
        alertas_resumo: alertas,
        filtro_sugerido: filtroSugerido,
      });
    }

    // 7. CLIENTES (Peso 5)
    {
      const pesoBase = 5;
      const cli = typeof window.gerarMetricasClientesFallback === "function"
        ? window.gerarMetricasClientesFallback(dias, "ALL", 90)
        : { alertas: [], kpis: {} };
      const alertasArr = cli.alertas || [];
      const criticos = alertasArr.filter((a) => a.severidade === "critico");
      const atencao = alertasArr.filter((a) => a.severidade === "atencao");

      const status = criticos.length > 0 ? "critico" : atencao.length > 0 ? "atencao" : "saudavel";
      const titulos = [...criticos, ...atencao].map((a) => a.titulo);
      const ativos = Number(cli.kpis?.clientesAtivos?.valor || 0);
      const recorr = Number(cli.kpis?.taxaRecorrencia?.valor || 0);
      const inatPct = Number(cli.kpis?.clientesInativos?.taxaPercentual || 0);

      blocos.push({
        id: "clientes",
        ordem_fixa: 7,
        titulo: "Clientes",
        subtitulo_curto: "Aquisição, recorrência e retenção VIP",
        icone: "users",
        aba_destino: "clientes",
        status,
        peso_base: pesoBase,
        score_prioridade: calcScore(status, pesoBase, criticos.length),
        manchete: titulos[0] || `Base ativa saudável (${ativos} compradores e ${recorr}% de recompra).`,
        acao_recomendada:
          criticos.length > 0
            ? "Reativar clientes VIP em risco"
            : atencao.length > 0
            ? "Trabalhar recompra da carteira"
            : "Ver carteira de clientes",
        indicadores: [
          {
            rotulo: "Compradores Ativos · Recompra",
            valor: `${ativos} ativos · ${recorr}% recorr.`,
            destaque: recorr < 25 ? "warning" : "ok",
          },
          {
            rotulo: "Inatividade da Base (>90d)",
            valor: `${inatPct}% inativos`,
            destaque: inatPct > 45 ? "danger" : inatPct > 30 ? "warning" : "neutral",
          },
        ],
        alertas_resumo: titulos,
      });
    }

    // 8. COMPRAS E FORNECEDORES (Peso 7)
    {
      const pesoBase = 7;
      const comp = typeof window.gerarMetricasComprasFallback === "function"
        ? window.gerarMetricasComprasFallback(dias, "ALL", "ALL")
        : { alertas: [], kpis: {} };
      const alertasArr = comp.alertas || [];
      const criticos = alertasArr.filter((a) => a.severidade === "critico");
      const atencao = alertasArr.filter((a) => a.severidade === "atencao");
      const atrasados = Number(comp.kpis?.pedidosAtrasados?.valor || 0);

      const status = criticos.length > 0 ? "critico" : atencao.length > 0 || atrasados > 0 ? "atencao" : "saudavel";
      const titulos = [...criticos, ...atencao].map((a) => a.titulo);
      const pontualidade = comp.kpis?.entregasNoPrazo?.valorFormatado || "92%";
      const gastoFmt = comp.kpis?.gastoTotal?.valorFormatado || money(0);

      blocos.push({
        id: "compras",
        ordem_fixa: 8,
        titulo: "Compras e Fornecedores",
        subtitulo_curto: "Reposição, prazos de entrega e custos",
        icone: "clipboard",
        aba_destino: "compras",
        status,
        peso_base: pesoBase,
        score_prioridade: calcScore(status, pesoBase, criticos.length + atrasados),
        manchete: titulos[0] || `Suprimentos sob controle: pontualidade em ${pontualidade}.`,
        acao_recomendada:
          criticos.length > 0
            ? "Emitir compra urgente / cobrar atrasados"
            : status === "atencao"
            ? "Revisar scorecard de fornecedores"
            : "Ver painel de suprimentos",
        indicadores: [
          {
            rotulo: "POs Atrasados · Pontualidade",
            valor: `${atrasados} atrasados · ${pontualidade}`,
            destaque: criticos.length > 0 ? "danger" : atrasados > 0 ? "warning" : "ok",
          },
          {
            rotulo: `Volume Comprado (${dias}d)`,
            valor: gastoFmt,
            destaque: "neutral",
          },
        ],
        alertas_resumo: titulos,
      });
    }

    // 9. DEVOLUÇÕES E QUALIDADE (Peso 7)
    {
      const pesoBase = 7;
      const dev = typeof window.gerarMetricasDevolucoesFallback === "function"
        ? window.gerarMetricasDevolucoesFallback(dias, "ALL", "ALL", "ALL")
        : { alertas: [], kpis: {} };
      const alertasArr = dev.alertas || [];
      const criticos = alertasArr.filter((a) => a.severidade === "critico");
      const atencao = alertasArr.filter((a) => a.severidade === "atencao");
      const atrasadas = Number(dev.kpis?.devolucoesAbertas?.atrasadas || 0);
      const taxaDev = Number(dev.kpis?.taxaDevolucao?.valor || 0);
      const custoDev = Number(dev.kpis?.custoTotalDevolucoes?.valor || 0);

      const status = criticos.length > 0 || atrasadas > 0 ? "critico" : atencao.length > 0 ? "atencao" : "saudavel";
      const titulos = [...criticos, ...atencao].map((a) => a.titulo);

      blocos.push({
        id: "devolucoes",
        ordem_fixa: 9,
        titulo: "Devoluções e Qualidade",
        subtitulo_curto: "Logística reversa, garantias e avarias",
        icone: "refresh-cw",
        aba_destino: "devolucoes",
        status,
        peso_base: pesoBase,
        score_prioridade: calcScore(status, pesoBase, atrasadas + criticos.length),
        manchete: titulos[0] || `Qualidade controlada: taxa de devolução em ${taxaDev}% sem atrasos.`,
        acao_recomendada:
          atrasadas > 0
            ? `Concluir ${atrasadas} devolução(ões) fora do SLA`
            : status !== "saudavel"
            ? "Analisar causas de devolução"
            : "Ver indicadores de qualidade",
        indicadores: [
          {
            rotulo: "Taxa de Devolução · SLA",
            valor: `${taxaDev}% · ${atrasadas} atrasadas`,
            destaque: atrasadas > 0 || taxaDev > 5 ? "danger" : "ok",
          },
          {
            rotulo: "Custo Total Reverso",
            valor: money(custoDev),
            destaque: taxaDev > 5 ? "warning" : "neutral",
          },
        ],
        alertas_resumo: titulos,
      });
    }

    // 10. FISCAL & NF-E (Peso 8 · Apenas GESTOR)
    if (!isOperador) {
      const pesoBase = 8;
      const fis = typeof window.gerarMetricasFiscalFallback === "function"
        ? window.gerarMetricasFiscalFallback(dias, "ALL", "ALL", "ALL")
        : { alertas: [], kpis: {} };
      const alertasArr = fis.alertas || [];
      const criticos = alertasArr.filter((a) => a.severidade === "critico");
      const atencao = alertasArr.filter((a) => a.severidade === "atencao");
      const semNfe = Number(fis.kpis?.pedidosSemNfe?.valor || 0);
      const emitidas = fis.kpis?.notasEmitidas?.valorFormatado || "0 notas";
      const inconf = Number(fis.kpis?.inconformidades?.valor || 0);

      const status = criticos.length > 0 ? "critico" : atencao.length > 0 ? "atencao" : "saudavel";
      const titulos = [...criticos, ...atencao].map((a) => a.titulo);

      blocos.push({
        id: "fiscal",
        ordem_fixa: 10,
        titulo: "Fiscal & NF-e",
        subtitulo_curto: "SEFAZ, notas pendentes e Certificado A1",
        icone: "file-text",
        aba_destino: "fiscal",
        status,
        peso_base: pesoBase,
        score_prioridade: calcScore(status, pesoBase, criticos.length + semNfe),
        manchete: titulos[0] || `Faturamento fiscal em dia (${emitidas} autorizadas).`,
        acao_recomendada:
          criticos.length > 0
            ? "Regularizar rejeições / pedidos sem NF-e"
            : atencao.length > 0
            ? "Verificar alertas fiscais preventivos"
            : "Ver faturamento e impostos",
        indicadores: [
          {
            rotulo: "Pedidos s/ NF-e (>24h)",
            valor: `${semNfe} pendente(s)`,
            destaque: semNfe > 0 ? "danger" : "ok",
          },
          {
            rotulo: "Autorizadas · Inconformidades",
            valor: `${emitidas} · ${inconf} ocorr.`,
            destaque: criticos.length > 0 ? "danger" : inconf > 0 ? "warning" : "ok",
          },
        ],
        alertas_resumo: titulos,
      });
    }

    const criticosCount = blocos.filter((b) => b.status === "critico").length;
    const atencaoCount = blocos.filter((b) => b.status === "atencao").length;
    const saudaveisCount = blocos.filter((b) => b.status === "saudavel").length;

    const statusGeral = criticosCount > 0 ? "critico" : atencaoCount > 0 ? "atencao" : "saudavel";
    const mensagemExecutiva =
      criticosCount > 0
        ? `Ação imediata necessária: ${criticosCount} ${criticosCount === 1 ? "setor apresenta" : "setores apresentam"} gargalo crítico no negócio.`
        : atencaoCount > 0
        ? `Nenhum bloqueio grave, mas ${atencaoCount} ${atencaoCount === 1 ? "setor pede" : "setores pedem"} acompanhamento preventivo.`
        : "Operação 100% saudável: todos os painéis operando dentro das metas estabelecidas.";

    const prioridades = [...blocos]
      .filter((b) => b.status === "critico" || b.status === "atencao")
      .sort((a, b) => b.score_prioridade - a.score_prioridade)
      .slice(0, 3)
      .map((b) => ({
        id_bloco: b.id,
        aba_destino: b.aba_destino,
        severidade: b.status,
        setor: b.titulo,
        titulo: b.manchete,
        acao_label: b.acao_recomendada,
        peso: b.peso_base,
        score_prioridade: b.score_prioridade,
        filtro_sugerido: b.filtro_sugerido,
      }));

    return {
      sucesso: true,
      atualizado_em: new Date().toISOString(),
      periodo_dias: dias,
      resumo: {
        total_setores: blocos.length,
        criticos: criticosCount,
        atencao: atencaoCount,
        saudaveis: saudaveisCount,
        status_geral: statusGeral,
        mensagem_executiva: mensagemExecutiva,
      },
      prioridades_imediatas: prioridades,
      blocos,
    };
  }

  /**
   * Atualiza as bolinhas indicadoras (🔴 / 🟡 / 🟢) nas 10 abas superiores do Painel Executivo
   */
  function atualizarBolinhasAbas(blocos) {
    (blocos || []).forEach((b) => {
      const dot = document.getElementById(`tab-dot-${b.aba_destino}`);
      const btn = document.querySelector(`.dash-tab[data-tab="${b.aba_destino}"]`);
      if (dot) {
        dot.classList.remove("is-critico", "is-atencao", "is-saudavel");
        dot.classList.add(`is-${b.status}`);
      }
      if (btn) {
        const prefixo = b.status === "critico" ? "CRÍTICO" : b.status === "atencao" ? "ATENÇÃO" : "SAUDÁVEL";
        btn.title = `[${prefixo}] ${b.manchete}`;
      }
    });
  }

  /**
   * Navega diretamente para a aba do dashboard correspondente e aplica filtros contextuais se houver
   */
  function abrirDashboardEspecifico(abaDestino, filtroSugerido) {
    if (typeof window.RezFireActivateDashboardTab === "function") {
      window.RezFireActivateDashboardTab(abaDestino);
    } else {
      const btn = document.querySelector(`.dash-tab[data-tab="${abaDestino}"]`);
      btn?.click();
    }

    // Aplica filtro inteligente na aba destino se disponível
    setTimeout(() => {
      if (filtroSugerido && typeof filtroSugerido === "object") {
        if (filtroSugerido.estoqueRisco && typeof window.filtrarRiscoEstoque === "function") {
          window.filtrarRiscoEstoque(filtroSugerido.estoqueRisco);
        }
        if (filtroSugerido.financeiroMargem && typeof window.filtrarMargemFinanceiro === "function") {
          window.filtrarMargemFinanceiro(filtroSugerido.financeiroMargem);
        }
      }
      const tabsEl = document.getElementById("painel-dash-tabs");
      if (tabsEl) {
        tabsEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 60);
  }

  /**
   * Renderiza a interface completa da Visão Geral (banner, contadores, prioridades e cards)
   */
  function pintarTelaRadar() {
    const dados = state.dados;
    if (!dados) return;

    atualizarBolinhasAbas(dados.blocos);

    // 1. Horário de atualização
    const lblHora = document.getElementById("radar-last-updated");
    if (lblHora && dados.atualizado_em) {
      const dt = new Date(dados.atualizado_em);
      lblHora.textContent = `Atualizado às ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }

    // 2. Banner de Saúde Geral + Pílulas de Filtro Rápido
    const banner = document.getElementById("radar-summary-banner");
    const badgeGeral = document.getElementById("radar-geral-badge");
    const msgGeral = document.getElementById("radar-geral-mensagem");
    const countersBar = document.getElementById("radar-counters-bar");

    if (banner && dados.resumo) {
      const st = dados.resumo.status_geral;
      banner.className = `radar-summary-banner is-${st}`;
      if (badgeGeral) {
        badgeGeral.className = `radar-status-badge ${st}`;
        badgeGeral.textContent =
          st === "critico" ? "🔴 ATENÇÃO CRÍTICA" : st === "atencao" ? "🟡 MONITORAMENTO" : "🟢 TUDO EM DIA";
      }
      if (msgGeral) {
        msgGeral.textContent = dados.resumo.mensagem_executiva;
      }
      if (countersBar) {
        const r = dados.resumo;
        countersBar.innerHTML = `
          <button type="button" class="radar-counter-pill todos ${state.filtroStatus === "todos" ? "is-active" : ""}" data-radar-filter="todos" title="Mostrar todos os painéis">
            <span>Todos (${r.total_setores})</span>
          </button>
          <button type="button" class="radar-counter-pill critico ${state.filtroStatus === "critico" ? "is-active" : ""}" data-radar-filter="critico" title="Filtrar apenas setores vermelhos">
            <span>🔴 ${r.criticos} Crítico${r.criticos === 1 ? "" : "s"}</span>
          </button>
          <button type="button" class="radar-counter-pill atencao ${state.filtroStatus === "atencao" ? "is-active" : ""}" data-radar-filter="atencao" title="Filtrar apenas setores amarelos">
            <span>🟡 ${r.atencao} Atenção</span>
          </button>
          <button type="button" class="radar-counter-pill saudavel ${state.filtroStatus === "saudavel" ? "is-active" : ""}" data-radar-filter="saudavel" title="Filtrar apenas setores verdes">
            <span>🟢 ${r.saudaveis} Saudáve${r.saudaveis === 1 ? "l" : "is"}</span>
          </button>
        `;
      }
    }

    // 3. Top 3 Prioridades Imediatas
    const prioSection = document.getElementById("radar-priority-section");
    const prioList = document.getElementById("radar-priority-list");
    const prios = dados.prioridades_imediatas || [];

    if (prioSection && prioList) {
      if (prios.length === 0) {
        prioSection.style.display = "none";
      } else {
        prioSection.style.display = "block";
        prioList.innerHTML = prios
          .map((p, idx) => {
            const isCrit = p.severidade === "critico";
            const filtroAttr = p.filtro_sugerido ? encodeURIComponent(JSON.stringify(p.filtro_sugerido)) : "";
            return `
              <button
                type="button"
                class="radar-priority-item is-${p.severidade}"
                data-goto-tab="${esc(p.aba_destino)}"
                data-goto-filter="${filtroAttr}"
              >
                <div style="min-width: 0; flex: 1;">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-black ${isCrit ? "text-red-700" : "text-amber-800"}">
                      ${idx + 1}º PRIORIDADE · ${esc(p.setor.toUpperCase())}
                    </span>
                  </div>
                  <div class="text-xs font-bold text-stone-900" style="line-height: 1.38;">
                    ${esc(p.titulo)}
                  </div>
                  <div class="text-xs font-semibold ${isCrit ? "text-red-700" : "text-amber-700"} mt-1.5">
                    ${esc(p.acao_label)} →
                  </div>
                </div>
              </button>
            `;
          })
          .join("");
      }
    }

    // 4. Ordenação e Filtragem dos 10 Blocos
    const grid = document.getElementById("radar-blocos-grid");
    if (!grid) return;

    let lista = [...(dados.blocos || [])];

    if (state.filtroStatus !== "todos") {
      lista = lista.filter((b) => b.status === state.filtroStatus);
    }

    if (state.modoOrdenacao === "prioridade") {
      lista.sort((a, b) => {
        if (b.score_prioridade !== a.score_prioridade) return b.score_prioridade - a.score_prioridade;
        return a.ordem_fixa - b.ordem_fixa;
      });
    } else {
      lista.sort((a, b) => a.ordem_fixa - b.ordem_fixa);
    }

    if (lista.length === 0) {
      grid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; padding: 32px 20px; text-align: center;">
          <p class="text-sm font-bold text-stone-700 m-0">Nenhum setor encontrado com o filtro selecionado.</p>
          <button type="button" class="btn-ghost" style="margin-top: 12px; padding: 6px 14px; font-size: 0.8rem;" data-radar-filter="todos">
            Mostrar todos os setores
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = lista
      .map((b) => {
        const badgeTexto =
          b.status === "critico" ? "🔴 CRÍTICO" : b.status === "atencao" ? "🟡 ATENÇÃO" : "🟢 SAUDÁVEL";
        const extras = (b.alertas_resumo || []).slice(1, 3);
        const extrasHtml =
          extras.length > 0
            ? `<ul class="radar-extra-alerts">${extras.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
            : "";

        const indicadoresHtml = (b.indicadores || [])
          .slice(0, 2)
          .map(
            (ind) => `
            <div class="radar-mini-metric">
              <span class="radar-mini-label" title="${esc(ind.rotulo)}">${esc(ind.rotulo)}</span>
              <span class="radar-mini-value ${esc(ind.destaque || "neutral")}" title="${esc(ind.valor)}">${esc(ind.valor)}</span>
            </div>
          `
          )
          .join("");

        const filtroAttr = b.filtro_sugerido ? encodeURIComponent(JSON.stringify(b.filtro_sugerido)) : "";

        return `
          <article
            class="radar-card is-${esc(b.status)}"
            role="button"
            tabindex="0"
            data-goto-tab="${esc(b.aba_destino)}"
            data-goto-filter="${filtroAttr}"
            aria-label="${esc(b.titulo)} - ${badgeTexto}: ${esc(b.manchete)}"
          >
            <div>
              <div class="radar-card-header">
                <div class="radar-card-title-wrap">
                  <span class="radar-card-icon">${svgIcon(b.icone)}</span>
                  <div>
                    <h3 class="radar-card-title">${esc(b.titulo)}</h3>
                    <p class="radar-card-subtitle">${esc(b.subtitulo_curto || "")}</p>
                  </div>
                </div>
                <span class="radar-status-badge ${esc(b.status)}">${badgeTexto}</span>
              </div>

              <div class="radar-headline-box">
                ${esc(b.manchete)}
              </div>

              ${extrasHtml}
            </div>

            <div>
              <div class="radar-metrics-row">
                ${indicadoresHtml}
              </div>

              <div class="radar-card-footer">
                <span>${esc(b.acao_recomendada)}</span>
                <div class="flex items-center gap-2">
                  <span class="radar-weight-tag" title="Peso estratégico de impacto na operação (1 a 10)">Peso ${b.peso_base}/10</span>
                  <span aria-hidden="true">→</span>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  /**
   * Carrega primeiro o cálculo instantâneo local e em seguida sincroniza com o MySQL via API
   */
  async function carregarRadar(forcarBackend = true) {
    aplicarRestricaoPerfilAbas();

    const selectPeriodo = document.getElementById("filtro-radar-periodo");
    if (selectPeriodo) {
      state.dias = Number(selectPeriodo.value) || 30;
    }

    // Paint imediato caso ainda não tenha dados do servidor
    if (!state.dados || !forcarBackend) {
      state.dados = gerarVisaoGeralLocal(state.dias);
      pintarTelaRadar();
    }

    if (!forcarBackend || !window.RezFireAPI?.dashboard?.visaoGeral) return;

    const btnSync = document.getElementById("btn-atualizar-radar");
    try {
      state.carregando = true;
      if (btnSync) btnSync.disabled = true;

      const res = await window.RezFireAPI.dashboard.visaoGeral(state.dias);
      if (res && res.sucesso && Array.isArray(res.blocos)) {
        state.dados = res;
        pintarTelaRadar();
      }
    } catch {
      // Permanece com o cálculo local já exibido na tela sem travar a decisão do gestor
      state.dados = gerarVisaoGeralLocal(state.dias);
      pintarTelaRadar();
    } finally {
      state.carregando = false;
      if (btnSync) btnSync.disabled = false;
    }
  }

  function bindEventosRadar() {
    const selectPeriodo = document.getElementById("filtro-radar-periodo");
    const btnFixa = document.getElementById("btn-radar-ordem-fixa");
    const btnPrio = document.getElementById("btn-radar-ordem-prioridade");
    const btnSync = document.getElementById("btn-atualizar-radar");
    const containerAba = document.getElementById("tab-visao-geral");

    if (selectPeriodo && !selectPeriodo.dataset.bound) {
      selectPeriodo.dataset.bound = "true";
      selectPeriodo.addEventListener("change", () => {
        state.dias = Number(selectPeriodo.value) || 30;
        carregarRadar(true);
      });
    }

    function setModoOrdenacao(modo) {
      state.modoOrdenacao = modo === "prioridade" ? "prioridade" : "fixa";
      btnFixa?.classList.toggle("is-active", state.modoOrdenacao === "fixa");
      btnPrio?.classList.toggle("is-active", state.modoOrdenacao === "prioridade");
      pintarTelaRadar();
    }

    if (btnFixa && !btnFixa.dataset.bound) {
      btnFixa.dataset.bound = "true";
      btnFixa.addEventListener("click", () => setModoOrdenacao("fixa"));
    }

    if (btnPrio && !btnPrio.dataset.bound) {
      btnPrio.dataset.bound = "true";
      btnPrio.addEventListener("click", () => setModoOrdenacao("prioridade"));
    }

    if (btnSync && !btnSync.dataset.bound) {
      btnSync.dataset.bound = "true";
      btnSync.addEventListener("click", () => carregarRadar(true));
    }

    if (containerAba && !containerAba.dataset.bound) {
      containerAba.dataset.bound = "true";

      containerAba.addEventListener("click", (e) => {
        const filterBtn = e.target.closest("[data-radar-filter]");
        if (filterBtn) {
          const novoFiltro = filterBtn.getAttribute("data-radar-filter") || "todos";
          state.filtroStatus = state.filtroStatus === novoFiltro && novoFiltro !== "todos" ? "todos" : novoFiltro;
          pintarTelaRadar();
          return;
        }

        const cardTarget = e.target.closest("[data-goto-tab]");
        if (cardTarget) {
          const aba = cardTarget.getAttribute("data-goto-tab");
          const rawFilter = cardTarget.getAttribute("data-goto-filter");
          let parsedFilter = null;
          if (rawFilter) {
            try {
              parsedFilter = JSON.parse(decodeURIComponent(rawFilter));
            } catch {}
          }
          if (aba) {
            abrirDashboardEspecifico(aba, parsedFilter);
          }
        }
      });

      containerAba.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const cardTarget = e.target.closest(".radar-card[data-goto-tab]");
        if (cardTarget) {
          e.preventDefault();
          cardTarget.click();
        }
      });
    }
  }

  function initRadar() {
    bindEventosRadar();
    carregarRadar(true);
  }

  window.RezFireRadar = {
    init: initRadar,
    refresh: carregarRadar,
    setSortMode: (modo) => {
      state.modoOrdenacao = modo === "prioridade" ? "prioridade" : "fixa";
      pintarTelaRadar();
    },
  };
})();
