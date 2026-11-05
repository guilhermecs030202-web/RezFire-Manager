/**
 * dashboard-entregas.js
 * Aba "Entregas" do Painel Executivo — RezFire Manager.
 *
 * Objetivo: mostrar ao gestor a saúde da operação logística, o que precisa
 * de ação imediata e onde estão os riscos (prazos, ocorrências, lotes).
 *
 * Fonte de dados: window.RezFireEntregas (mesma base da tela entregas.html).
 * Data de referência: RezFireEntregas.ENTREGAS_REF_DATE (dados de demonstração).
 *
 * Divisão dos indicadores:
 *  - OPERACIONAIS (estado atual): pedidos em aberto, agenda de despacho, fila.
 *    Ignoram o filtro de período para que nenhum pedido antigo travado suma.
 *  - DESEMPENHO (histórico): prazos, lead time, ocorrências, modalidade, UF.
 *    Respeitam o filtro de período (pela data da venda).
 *  O filtro de canal vale para tudo.
 */
(function () {
  // SUGESTÃO: metas visuais de referência. Devem ser confirmadas pelo gestor.
  const METAS = {
    despachoNoPrazo: 95, // % de pedidos despachados dentro do prazo
    entregaNoPrazo: 90,  // % de pedidos entregues até a previsão
  };

  const DAY_MS = 24 * 60 * 60 * 1000;
  const RISCO_LABEL = ["Crítico", "Alto", "Atenção", "No prazo"];
  const RISCO_CLASS = ["critico", "alto", "atencao", "ok"];

  let charts = {};

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const E = () => window.RezFireEntregas;
  const REF = () => E().ENTREGAS_REF_DATE;

  function kpiCard(label, value, hint) {
    if (typeof window.kpiCard === "function") {
      return window.kpiCard(label, value, hint);
    }
    return `
      <article class="card kpi-card">
        <p class="kpi-label">${label}</p>
        <p class="kpi-value">${value}</p>
        ${hint ? `<p class="kpi-hint">${hint}</p>` : ""}
      </article>
    `;
  }

  function startOfDay(value) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Diferença em dias de calendário entre a data informada e a data de referência. */
  function dayDiff(iso) {
    return Math.round((startOfDay(iso) - startOfDay(REF())) / DAY_MS);
  }

  function avg(values) {
    if (!values.length) return null;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  function pct(part, total) {
    return total > 0 ? Math.round((part / total) * 100) : null;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function codigoPedido(e) {
    return e.codigo_pedido_ml || e.codigo_pedido_direto || e.id_entrega;
  }

  function modalidadeCurta(m) {
    return String(m || "Não informada").replace("Mercado Envios ", "ML ").replace("Transportadora Parceira", "Transportadora");
  }

  // ─── Classificações ────────────────────────────────────────────────────────
  function isCancelado(e) {
    return e.status_interno === E().STATUS_INTERNO.CANCELADO;
  }

  function isEntregue(e) {
    return e.status_logistico === E().STATUS_LOGISTICO.ENTREGUE;
  }

  function isSeparado(e) {
    return e.status_interno === E().STATUS_INTERNO.PRONTO_DESPACHO;
  }

  function temOcorrenciaLogistica(e) {
    const SL = E().STATUS_LOGISTICO;
    if (e.status_logistico === SL.OCORRENCIA || e.status_logistico === SL.ATRASADO) return true;
    return (e.ocorrencias || []).some((o) => o.tipo === "ocorrencia_logistica");
  }

  /**
   * Lotes separados que violam a regra de validade (≤ 180 dias ou vencido).
   * Só importa para pedidos ainda não despachados.
   */
  function lotesBloqueados(e) {
    if (e.data_despacho || !e.separacao || !window.RezFireData?.computeLoteStatus) return [];
    const bloqueados = [];
    (e.separacao.itens || []).forEach((item) => {
      (item.lotes || []).forEach((l) => {
        if (!l.validade) return;
        const st = window.RezFireData.computeLoteStatus(l.validade);
        if (!st.podeDespachar) bloqueados.push({ ...l, sku: item.sku, status: st.label });
      });
    });
    return bloqueados;
  }

  /** Etapa do pipeline (cada pedido em aberto cai em exatamente uma). */
  function etapaPipeline(e) {
    const SI = E().STATUS_INTERNO;
    if (e.data_despacho) return temOcorrenciaLogistica(e) ? "ocorrencia" : "transito";
    if (e.status_interno === SI.PRONTO_DESPACHO) return "pronto";
    if (e.status_interno === SI.EM_SEPARACAO) return "separacao";
    return "separar";
  }

  function etapaLabel(e) {
    return e.data_despacho ? e.status_logistico : e.status_interno;
  }

  /** Avalia risco e motivos de um pedido em aberto (0 = crítico … 3 = no prazo). */
  function avaliarRisco(e) {
    const motivos = [];
    const add = (nivel, texto) => motivos.push({ nivel, texto });
    const despachado = Boolean(e.data_despacho);

    if (E().isAtrasadoDespacho(e)) {
      const dias = Math.abs(dayDiff(e.prazo_despacho));
      add(0, `Despacho atrasado há ${dias} dia(s)`);
    }

    lotesBloqueados(e).forEach((l) => add(0, `Lote ${l.id_lote} (${l.sku}) ${l.status.toLowerCase()} — trocar lote`));

    if (temOcorrenciaLogistica(e)) {
      const oc = (e.ocorrencias || []).find((o) => o.tipo === "ocorrencia_logistica");
      add(0, oc ? `Ocorrência: ${oc.descricao}` : "Ocorrência logística registrada");
    }

    if (E().isAtrasadoEntrega(e)) {
      const dias = Math.abs(dayDiff(e.previsao_entrega));
      add(0, `Entrega atrasada há ${dias} dia(s)`);
    }

    if (!despachado && e.prazo_despacho) {
      const dd = dayDiff(e.prazo_despacho);
      if (dd === 0) add(isSeparado(e) ? 1 : 0, isSeparado(e) ? "Despacho vence hoje" : "Despacho vence hoje e ainda não foi separado");
      if (dd === 1 && !isSeparado(e)) add(1, "Despacho amanhã — separação pendente");
    }

    if (despachado && e.previsao_entrega && dayDiff(e.previsao_entrega) === 0) {
      add(2, "Previsão de entrega hoje — acompanhar");
    }

    const nivel = motivos.length ? Math.min(...motivos.map((m) => m.nivel)) : 3;
    motivos.sort((a, b) => a.nivel - b.nivel);
    return { nivel, motivos };
  }

  // ─── Cálculo dos indicadores ───────────────────────────────────────────────
  function computeMetrics(entregas, periodoDias, canal) {
    const SL = E().STATUS_LOGISTICO;
    const refTime = REF().getTime();

    const todos = canal === "todos" ? entregas : entregas.filter((e) => e.canal === canal);
    const ativos = todos.filter((e) => !isCancelado(e));
    const abertos = ativos.filter((e) => !isEntregue(e));
    const pendentesDespacho = ativos.filter((e) => !e.data_despacho);

    // Operacional (estado atual)
    const atrasadosDespacho = todos.filter((e) => E().isAtrasadoDespacho(e));
    const vencemHoje = pendentesDespacho.filter((e) => e.prazo_despacho && dayDiff(e.prazo_despacho) === 0);
    const hojeNaoSeparados = vencemHoje.filter((e) => !isSeparado(e));
    const comLoteBloqueado = pendentesDespacho.filter((e) => lotesBloqueados(e).length > 0);
    const comOcorrencia = abertos.filter(temOcorrenciaLogistica);
    const entregaAtrasada = todos.filter((e) => E().isAtrasadoEntrega(e));
    const valorEmAberto = abertos.reduce((s, e) => s + Number(e.valor_total || 0), 0);

    const pipeline = { separar: 0, separacao: 0, pronto: 0, transito: 0, ocorrencia: 0 };
    abertos.forEach((e) => { pipeline[etapaPipeline(e)] += 1; });

    const agendaBuckets = ["Atrasados", "Hoje", "Amanhã", "Em 2 dias", "3+ dias"];
    const agenda = { naoSeparado: [0, 0, 0, 0, 0], pronto: [0, 0, 0, 0, 0] };
    pendentesDespacho.forEach((e) => {
      if (!e.prazo_despacho) return;
      const dd = dayDiff(e.prazo_despacho);
      const idx = dd < 0 ? 0 : Math.min(dd + 1, 4);
      agenda[isSeparado(e) ? "pronto" : "naoSeparado"][idx] += 1;
    });

    const fila = abertos
      .map((e) => ({ e, ...avaliarRisco(e) }))
      .sort((a, b) => {
        if (a.nivel !== b.nivel) return a.nivel - b.nivel;
        const pa = new Date(a.e.data_despacho ? a.e.previsao_entrega : a.e.prazo_despacho || 0).getTime();
        const pb = new Date(b.e.data_despacho ? b.e.previsao_entrega : b.e.prazo_despacho || 0).getTime();
        return pa - pb;
      });

    // Desempenho (período pela data da venda)
    const periodo = periodoDias > 0
      ? todos.filter((e) => refTime - new Date(e.data_venda).getTime() <= periodoDias * DAY_MS)
      : todos;
    const periodoAtivos = periodo.filter((e) => !isCancelado(e));
    const cancelados = periodo.filter(isCancelado);

    // Despacho no prazo = despachados até o prazo ÷ (despachados + pendentes já vencidos)
    const despachados = periodoAtivos.filter((e) => e.data_despacho && e.prazo_despacho);
    const despachadosNoPrazo = despachados.filter((e) => new Date(e.data_despacho) <= new Date(e.prazo_despacho));
    const pendentesVencidos = periodoAtivos.filter((e) => E().isAtrasadoDespacho(e));
    const baseDespacho = despachados.length + pendentesVencidos.length;

    // Entrega no prazo = entregues até a previsão ÷ (entregues + em aberto com previsão vencida)
    const entregues = periodoAtivos.filter((e) => e.data_entrega && e.previsao_entrega);
    const entreguesNoPrazo = entregues.filter((e) => new Date(e.data_entrega) <= new Date(e.previsao_entrega));
    const emAbertoVencidos = periodoAtivos.filter((e) => E().isAtrasadoEntrega(e));
    const baseEntrega = entregues.length + emAbertoVencidos.length;

    const tempoDespachoHoras = avg(
      despachados.map((e) => (new Date(e.data_despacho) - new Date(e.data_venda)) / (60 * 60 * 1000))
    );
    const leadTimeDias = avg(
      entregues.map((e) => (new Date(e.data_entrega) - new Date(e.data_venda)) / DAY_MS)
    );

    const comProblemaPeriodo = periodoAtivos.filter((e) => E().temProblema(e));

    // Por modalidade de envio
    const modalidades = {};
    periodoAtivos.forEach((e) => {
      const key = modalidadeCurta(e.modalidade_envio);
      if (!modalidades[key]) modalidades[key] = { pedidos: 0, problemas: 0, leadTimes: [] };
      const m = modalidades[key];
      m.pedidos += 1;
      if (E().temProblema(e)) m.problemas += 1;
      if (e.data_entrega) m.leadTimes.push((new Date(e.data_entrega) - new Date(e.data_venda)) / DAY_MS);
    });
    const porModalidade = Object.entries(modalidades)
      .map(([nome, m]) => ({ nome, pedidos: m.pedidos, problemas: m.problemas, leadTime: avg(m.leadTimes) }))
      .sort((a, b) => b.pedidos - a.pedidos);

    // Por UF de destino
    const ufs = {};
    periodoAtivos.forEach((e) => {
      if (!ufs[e.uf]) ufs[e.uf] = { entregue: 0, andamento: 0, problema: 0 };
      if (E().temProblema(e)) ufs[e.uf].problema += 1;
      else if (isEntregue(e)) ufs[e.uf].entregue += 1;
      else ufs[e.uf].andamento += 1;
    });
    const porUf = Object.entries(ufs)
      .map(([uf, v]) => ({ uf, ...v, total: v.entregue + v.andamento + v.problema }))
      .sort((a, b) => b.problema - a.problema || b.total - a.total);

    return {
      abertos, valorEmAberto, atrasadosDespacho, vencemHoje, hojeNaoSeparados,
      comLoteBloqueado, comOcorrencia, entregaAtrasada, pipeline, agendaBuckets, agenda, fila,
      totalPeriodo: periodo.length,
      despachoNoPrazo: { pct: pct(despachadosNoPrazo.length, baseDespacho), ok: despachadosNoPrazo.length, base: baseDespacho },
      entregaNoPrazo: { pct: pct(entreguesNoPrazo.length, baseEntrega), ok: entreguesNoPrazo.length, base: baseEntrega },
      tempoDespachoHoras, leadTimeDias,
      taxaProblema: pct(comProblemaPeriodo.length, periodoAtivos.length),
      qtdProblema: comProblemaPeriodo.length,
      taxaCancelamento: pct(cancelados.length, periodo.length),
      porModalidade, porUf,
    };
  }

  // ─── Renderização ──────────────────────────────────────────────────────────
  function renderBanner(m) {
    const el = document.getElementById("alerta-entregas-banner");
    if (!el) return;

    const criticos = [
      [m.atrasadosDespacho.length, "pedido(s) com <strong>despacho atrasado</strong>"],
      [m.hojeNaoSeparados.length, "pedido(s) vencem <strong>hoje</strong> e ainda não foram separados"],
      [m.comLoteBloqueado.length, "pedido(s) separados com <strong>lote bloqueado/vencido</strong> — trocar lote antes de despachar"],
      [m.comOcorrencia.length, "entrega(s) com <strong>ocorrência logística</strong> em aberto"],
      [m.entregaAtrasada.length, "entrega(s) <strong>além da previsão</strong>"],
    ].filter(([n]) => n > 0);

    const prontosHoje = m.vencemHoje.length - m.hojeNaoSeparados.length;
    const avisos = prontosHoje > 0 ? [[prontosHoje, "pedido(s) pronto(s) aguardando despacho <strong>hoje</strong>"]] : [];

    const lista = (itens) => itens.map(([n, txt]) => `<li><strong>${n}</strong> ${txt}</li>`).join("");
    const botoes = `
      <div class="flex items-center gap-2 flex-wrap">
        <button class="replenish-btn" type="button" data-acao="ver-fila">Ver fila de prioridades</button>
        <a class="btn-ghost" href="entregas.html" style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none;">Abrir Entregas</a>
      </div>`;

    if (criticos.length) {
      el.className = "stock-alert-banner";
      el.innerHTML = `
        <div class="flex items-start justify-between flex-wrap gap-3">
          <div class="flex items-start gap-3">
            <span style="font-size: 1.5rem; line-height: 1;">🚨</span>
            <div>
              <h3 style="margin: 0; font-size: 0.96rem; font-weight: 800; color: #991b1b;">AÇÃO IMEDIATA: ${criticos.length} SITUAÇÃO(ÕES) CRÍTICA(S) NAS ENTREGAS</h3>
              <ul class="delivery-alert-list" style="color: #7f1d1d;">${lista(criticos)}${lista(avisos)}</ul>
            </div>
          </div>
          ${botoes}
        </div>`;
    } else if (avisos.length) {
      el.className = "stock-alert-banner warning-only";
      el.innerHTML = `
        <div class="flex items-start justify-between flex-wrap gap-3">
          <div class="flex items-start gap-3">
            <span style="font-size: 1.5rem; line-height: 1;">⚠️</span>
            <div>
              <h3 style="margin: 0; font-size: 0.96rem; font-weight: 800; color: #9a3412;">ATENÇÃO AO DESPACHO DO DIA</h3>
              <ul class="delivery-alert-list" style="color: #7c2d12;">${lista(avisos)}</ul>
            </div>
          </div>
          ${botoes}
        </div>`;
    } else {
      el.className = "stock-alert-banner all-ok";
      el.innerHTML = `
        <div class="flex items-center gap-3">
          <span style="font-size: 1.4rem; line-height: 1;">✅</span>
          <div>
            <h3 style="margin: 0; font-size: 0.94rem; font-weight: 700; color: #166534;">OPERAÇÃO LOGÍSTICA EM DIA</h3>
            <p style="margin: 2px 0 0; font-size: 0.82rem; color: #14532d;">Nenhum atraso, ocorrência ou lote bloqueado nos pedidos em aberto.</p>
          </div>
        </div>`;
    }

    el.querySelector('[data-acao="ver-fila"]')?.addEventListener("click", () => {
      document.getElementById("tabela-entregas-fila")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function metaHint(info, meta) {
    if (info.pct === null) return "sem pedidos avaliáveis no período";
    const cls = info.pct >= meta ? "kpi-delta up" : "kpi-delta down";
    return `<span class="${cls}">meta ≥ ${meta}%</span> · ${info.ok} de ${info.base} pedidos`;
  }

  function renderKPIs(m) {
    const el = document.getElementById("kpis-tab-entregas");
    if (!el) return;
    const money = RezFireData.formatMoney;
    const prontosHoje = m.vencemHoje.length - m.hojeNaoSeparados.length;
    const atrasoCls = m.atrasadosDespacho.length > 0 ? "kpi-delta down" : "kpi-delta up";
    const fmtPct = (v) => (v === null ? "—" : `${v}%`);

    el.innerHTML = [
      kpiCard("PEDIDOS EM ABERTO", String(m.abertos.length), `${money(m.valorEmAberto)} aguardando entrega`),
      kpiCard("DESPACHAR HOJE", String(m.vencemHoje.length), `${prontosHoje} pronto(s) · ${m.hojeNaoSeparados.length} sem separação`),
      kpiCard(
        "DESPACHOS ATRASADOS",
        String(m.atrasadosDespacho.length),
        `<span class="${atrasoCls}">${m.atrasadosDespacho.length > 0 ? "prazo vencido" : "nenhum atraso"}</span> sem despacho`
      ),
      kpiCard("DESPACHO NO PRAZO", fmtPct(m.despachoNoPrazo.pct), metaHint(m.despachoNoPrazo, METAS.despachoNoPrazo)),
      kpiCard("ENTREGA NO PRAZO", fmtPct(m.entregaNoPrazo.pct), metaHint(m.entregaNoPrazo, METAS.entregaNoPrazo)),
      kpiCard(
        "TEMPO MÉDIO DE DESPACHO",
        m.tempoDespachoHoras === null ? "—" : `${Math.round(m.tempoDespachoHoras)} h`,
        "da venda até o despacho"
      ),
      kpiCard(
        "LEAD TIME DE ENTREGA",
        m.leadTimeDias === null ? "—" : `${m.leadTimeDias.toFixed(1).replace(".", ",")} dias`,
        "da venda até a entrega"
      ),
      kpiCard(
        "PEDIDOS COM PROBLEMA",
        fmtPct(m.taxaProblema),
        `${m.qtdProblema} c/ atraso ou ocorrência · ${fmtPct(m.taxaCancelamento)} cancelados`
      ),
    ].join("");
  }

  function destroyCharts() {
    Object.values(charts).forEach((c) => { try { c.destroy(); } catch (e) { /* já destruído */ } });
    charts = {};
  }

  function baseChart(type, extra = {}) {
    return { type, height: 280, toolbar: { show: false }, fontFamily: "Inter, sans-serif", ...extra };
  }

  function renderCharts(m) {
    destroyCharts();
    const un = (v) => `${v} pedido(s)`;

    // 1. Pipeline atual
    const elPipe = document.querySelector("#chart-entregas-pipeline");
    if (elPipe) {
      const p = m.pipeline;
      charts.pipeline = new ApexCharts(elPipe, {
        chart: baseChart("bar"),
        series: [{ name: "Pedidos", data: [p.separar, p.separacao, p.pronto, p.transito, p.ocorrencia] }],
        xaxis: {
          categories: ["A separar", "Em separação", "Pronto p/ despacho", "Em trânsito", "Com ocorrência"],
          tickAmount: Math.max(1, p.separar, p.separacao, p.pronto, p.transito, p.ocorrencia),
          labels: { formatter: (v) => Math.round(v) },
        },
        plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 4, barHeight: "58%" } },
        colors: ["#f59e0b", "#e85c2a", "#1f9d5c", "#1d68bd", "#d13c3c"],
        legend: { show: false },
        dataLabels: { enabled: true, style: { fontSize: "12px", fontWeight: "bold" } },
        grid: { borderColor: "#eee8e0" },
        tooltip: { y: { formatter: un } },
      });
      charts.pipeline.render();
    }

    // 2. Agenda de despacho
    const elAgenda = document.querySelector("#chart-entregas-agenda");
    if (elAgenda) {
      charts.agenda = new ApexCharts(elAgenda, {
        chart: baseChart("bar", { stacked: true }),
        series: [
          { name: "Aguardando separação", data: m.agenda.naoSeparado },
          { name: "Pronto p/ despacho", data: m.agenda.pronto },
        ],
        xaxis: { categories: m.agendaBuckets },
        yaxis: { min: 0, forceNiceScale: true, labels: { formatter: (v) => Math.round(v) } },
        plotOptions: { bar: { columnWidth: "45%", borderRadius: 3 } },
        colors: ["#e85c2a", "#1f9d5c"],
        dataLabels: { enabled: true, formatter: (v) => (v > 0 ? v : "") },
        legend: { position: "bottom" },
        grid: { borderColor: "#eee8e0" },
        tooltip: { y: { formatter: un } },
      });
      charts.agenda.render();
    }

    // 3. Cumprimento de prazos (radial)
    const elPrazo = document.querySelector("#chart-entregas-prazos");
    if (elPrazo) {
      const d = m.despachoNoPrazo.pct ?? 0;
      const e = m.entregaNoPrazo.pct ?? 0;
      const cor = (v, meta) => (v >= meta ? "#1f9d5c" : v >= meta - 15 ? "#f59e0b" : "#d13c3c");
      charts.prazos = new ApexCharts(elPrazo, {
        chart: baseChart("radialBar"),
        series: [d, e],
        labels: ["Despacho no prazo", "Entrega no prazo"],
        colors: [cor(d, METAS.despachoNoPrazo), cor(e, METAS.entregaNoPrazo)],
        plotOptions: {
          radialBar: {
            hollow: { size: "38%" },
            track: { background: "#f1ece6" },
            dataLabels: {
              name: { fontSize: "12px" },
              value: { fontSize: "20px", fontWeight: 800, formatter: (v) => `${Math.round(v)}%` },
              total: {
                show: true,
                label: "Despacho",
                formatter: () => (m.despachoNoPrazo.pct === null ? "—" : `${m.despachoNoPrazo.pct}%`),
              },
            },
          },
        },
        legend: {
          show: true,
          position: "bottom",
          formatter: (name, opts) => `${name}: ${opts.w.globals.series[opts.seriesIndex]}%`,
        },
        stroke: { lineCap: "round" },
      });
      charts.prazos.render();
    }

    // 4. Desempenho por modalidade
    const elMod = document.querySelector("#chart-entregas-modalidade");
    if (elMod) {
      const mods = m.porModalidade;
      charts.modalidade = new ApexCharts(elMod, {
        chart: baseChart("line"),
        series: [
          { name: "Pedidos", type: "column", data: mods.map((x) => x.pedidos) },
          { name: "Com problema", type: "column", data: mods.map((x) => x.problemas) },
          { name: "Lead time (dias)", type: "line", data: mods.map((x) => (x.leadTime === null ? null : Number(x.leadTime.toFixed(1)))) },
        ],
        xaxis: { categories: mods.map((x) => x.nome), labels: { rotate: 0, hideOverlappingLabels: false } },
        yaxis: [
          { seriesName: "Pedidos", min: 0, forceNiceScale: true, labels: { formatter: (v) => Math.round(v) } },
          { seriesName: "Pedidos", show: false },
          { seriesName: "Lead time (dias)", opposite: true, min: 0, labels: { formatter: (v) => (v == null ? "" : `${Math.round(v)}d`) } },
        ],
        colors: ["#1a1412", "#d13c3c", "#e85c2a"],
        stroke: { width: [0, 0, 3], curve: "smooth" },
        markers: { size: [0, 0, 5] },
        plotOptions: { bar: { columnWidth: "50%", borderRadius: 3 } },
        dataLabels: { enabled: false },
        legend: { position: "bottom" },
        grid: { borderColor: "#eee8e0" },
        tooltip: {
          shared: true,
          y: [{ formatter: un }, { formatter: un }, { formatter: (v) => (v == null ? "sem entregas" : `${v} dias`) }],
        },
        noData: { text: "Sem pedidos no período" },
      });
      charts.modalidade.render();
    }

    // 5. Situação por UF
    const elUf = document.querySelector("#chart-entregas-uf");
    if (elUf) {
      const ufs = m.porUf;
      charts.uf = new ApexCharts(elUf, {
        chart: baseChart("bar", { stacked: true }),
        series: [
          { name: "Com problema", data: ufs.map((u) => u.problema) },
          { name: "Em andamento", data: ufs.map((u) => u.andamento) },
          { name: "Entregue", data: ufs.map((u) => u.entregue) },
        ],
        xaxis: { categories: ufs.map((u) => u.uf), labels: { formatter: (v) => Math.round(v) } },
        plotOptions: { bar: { horizontal: true, barHeight: "60%", borderRadius: 2 } },
        colors: ["#d13c3c", "#1d68bd", "#1f9d5c"],
        dataLabels: { enabled: true, formatter: (v) => (v > 0 ? v : "") },
        legend: { position: "bottom" },
        grid: { borderColor: "#eee8e0" },
        tooltip: { y: { formatter: un } },
        noData: { text: "Sem pedidos no período" },
      });
      charts.uf.render();
    }
  }

  /** hojeCritico: prazo de despacho vencendo hoje é crítico; previsão de entrega hoje é apenas atenção. */
  function prazoPill(iso, concluido, hojeCritico = true) {
    if (!iso) return `<span class="text-xs text-stone-400">-</span>`;
    if (concluido) return `<span class="text-xs text-stone-500">${fmtDate(concluido)} ✓</span>`;
    const dd = dayDiff(iso);
    let cls = "safe";
    let txt = `em ${dd} dias`;
    if (dd < 0) { cls = "danger"; txt = `${Math.abs(dd)}d atrasado`; }
    else if (dd === 0) { cls = hojeCritico ? "danger" : "warning"; txt = "hoje"; }
    else if (dd === 1) { cls = "warning"; txt = "amanhã"; }
    return `<div class="text-xs text-stone-700 font-medium">${fmtDate(iso)}</div><span class="coverage-pill ${cls}">${txt}</span>`;
  }

  function renderFila(m) {
    const tbody = document.getElementById("lista-entregas-fila");
    const label = document.getElementById("label-total-entregas-fila");
    const modo = document.getElementById("filtro-entregas-fila")?.value || "risco";
    if (!tbody) return;

    const linhas = modo === "risco" ? m.fila.filter((f) => f.nivel <= 2) : m.fila;
    if (label) label.textContent = `${linhas.length} de ${m.fila.length} pedidos em aberto`;

    if (!linhas.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="8">${
        modo === "risco" ? "Nenhum pedido em risco. Operação em dia. ✅" : "Nenhum pedido em aberto para o canal selecionado."
      }</td></tr>`;
      return;
    }

    tbody.innerHTML = linhas.map(({ e, nivel, motivos }) => {
      const canal = e.canal === "Mercado Livre"
        ? `<span class="badge-channel ml">Mercado Livre</span>`
        : `<span class="badge-channel direto">Venda Direta</span>`;
      const motivosHtml = motivos.length
        ? motivos.map((mo) => `<div class="risk-reason">• ${esc(mo.texto)}</div>`).join("")
        : `<div class="risk-reason">Dentro do prazo</div>`;

      return `
        <tr>
          <td>
            <span class="sku-main">${esc(codigoPedido(e))}</span>
            <span class="sku-sub">${esc(e.id_entrega)} · ${RezFireData.formatMoney(e.valor_total)}</span>
          </td>
          <td>
            <div class="prod-name text-xs">${esc(e.cliente)}</div>
            <div class="text-xs text-stone-400 font-medium">${esc(e.uf)}</div>
          </td>
          <td>${canal}<div class="text-xs text-stone-500 mt-1">${esc(e.modalidade_envio)}</div></td>
          <td><span class="text-xs font-semibold text-stone-700">${esc(etapaLabel(e))}</span></td>
          <td>${prazoPill(e.prazo_despacho, e.data_despacho)}</td>
          <td>${e.data_despacho ? prazoPill(e.previsao_entrega, null, false) : `<span class="text-xs text-stone-500">${fmtDate(e.previsao_entrega)}</span>`}</td>
          <td style="max-width: 280px;">
            <span class="badge-risk ${RISCO_CLASS[nivel]}">${RISCO_LABEL[nivel]}</span>
            ${motivosHtml}
          </td>
          <td style="text-align: right;">
            <a href="entregas.html?id=${encodeURIComponent(e.id_entrega)}" class="btn-ghost" style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" title="Abrir este pedido na tela de Entregas">
              <span>Resolver</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
          </td>
        </tr>`;
    }).join("");
  }

  // ─── Ponto de entrada ──────────────────────────────────────────────────────
  function renderTabEntregas() {
    if (!window.RezFireEntregas || !document.getElementById("tab-entregas")) return;

    const periodo = Number(document.getElementById("filtro-entregas-periodo")?.value ?? 30);
    const canal = document.getElementById("filtro-entregas-canal")?.value || "todos";
    const metrics = computeMetrics(E().loadEntregas(), periodo, canal);

    const ref = document.getElementById("label-entregas-referencia");
    if (ref) ref.textContent = `Referência operacional: ${REF().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} (dados de demonstração)`;

    renderBanner(metrics);
    renderKPIs(metrics);
    renderCharts(metrics);
    renderFila(metrics);
  }

  function setupDeliveryFilters() {
    ["filtro-entregas-periodo", "filtro-entregas-canal", "filtro-entregas-fila"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.dataset.bound) {
        el.dataset.bound = "true";
        el.addEventListener("change", renderTabEntregas);
      }
    });

    // Atualiza quando a tela de Entregas (outra aba do navegador) altera os dados
    window.addEventListener("storage", (e) => {
      if (e.key === "rezfire.entregas") renderTabEntregas();
    });
  }

  window.renderTabEntregas = renderTabEntregas;
  window.setupDeliveryFilters = setupDeliveryFilters;
  window.RezFireEntregasDashboard = { computeMetrics, avaliarRisco, METAS };
})();
