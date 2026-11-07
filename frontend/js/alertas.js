/**
 * alertas.js
 * Controlador da Central Unificada de Alertas — RezFire Manager (SCRUM-24 / #19).
 *
 * Responsável por:
 *  - Agregar em tela única alertas de:
 *      * Prazos de Postagem (#10)
 *      * Estoque Mínimo e Ruptura (#4)
 *      * Validade FEFO dos Extintores (#8)
 *      * Anúncios Pausados e Divergências no Mercado Livre (#13)
 *  - Priorizar e classificar por criticidade (Crítico vs Atenção)
 *  - Oferecer atalhos de ação direta e filtros rápidos
 *  - Atualizar badge de alertas no menu lateral
 */

(function () {
  let state = {
    alertas: [],
    resumo: {
      total: 0,
      criticos: 0,
      atencao: 0,
      por_categoria: {
        postagem: 0,
        estoque: 0,
        validade: 0,
        anuncio: 0,
      },
    },
    filtros: {
      busca: "",
      criticidade: "todos", // todos | critico | atencao
      categoria: "todos", // todos | postagem | estoque | validade | anuncio
    },
    carregando: false,
  };

  async function init() {
    window.RezFireLayout.renderSidebar("alertas");
    bindEvents();
    await carregarAlertas();
  }

  /**
   * Carrega os alertas via API do backend com fallback gracioso para os dados locais
   */
  async function carregarAlertas() {
    state.carregando = true;
    const btnSync = document.getElementById("btn-atualizar-alertas");
    const iconSync = document.getElementById("icon-sync");
    if (btnSync) btnSync.disabled = true;
    if (iconSync) iconSync.classList.add("animate-spin");

    try {
      let carregadoBackend = false;

      // 1. Tenta carregar do backend (GET /api/alertas/central)
      if (window.RezFireAPI && window.RezFireAPI.alertas) {
        try {
          const res = await window.RezFireAPI.alertas.obterCentral();
          if (res && res.sucesso && Array.isArray(res.alertas)) {
            state.alertas = res.alertas;
            state.resumo = res.resumo;
            carregadoBackend = true;
          }
        } catch (apiErr) {
          console.warn("Backend /api/alertas/central indisponível, gerando via dados locais:", apiErr);
        }
      }

      // 2. Fallback: computa a agregação a partir dos dados locais de estoque, entregas e anúncios
      if (!carregadoBackend) {
        state.alertas = gerarAlertasLocais();
        state.resumo = calcularResumo(state.alertas);
      }

      // 3. Atualiza UI e Badges
      atualizarBadgeSidebar(state.resumo.total);
      renderKPIs();
      renderStatusBanner();
      renderLista();
    } catch (err) {
      console.error("Erro ao carregar central de alertas:", err);
      renderErro("Ocorreu um erro ao carregar os alertas operacionais.");
    } finally {
      state.carregando = false;
      if (btnSync) btnSync.disabled = false;
      if (iconSync) iconSync.classList.remove("animate-spin");
    }
  }

  /**
   * Computa a agregação local caso o backend não esteja respondendo
   */
  function gerarAlertasLocais() {
    const alertas = [];
    const agora = new Date();

    // 1. Prazos de Postagem (#10)
    if (window.RezFireEntregas) {
      const entregas = window.RezFireEntregas.loadEntregas();
      const abertos = entregas.filter(
        (e) => !e.data_despacho && e.status_interno !== window.RezFireEntregas.STATUS_INTERNO.CANCELADO
      );

      for (const e of abertos) {
        if (!e.prazo_despacho) continue;
        const prazo = new Date(e.prazo_despacho);
        const diffMs = prazo.getTime() - agora.getTime();
        const diffHoras = Math.round(diffMs / (1000 * 60 * 60));

        if (diffMs < 0) {
          alertas.push({
            id: `postagem-${e.id_entrega}`,
            categoria: "postagem",
            criticidade: "critico",
            titulo: `Pedido ${e.codigo_pedido_direto || e.codigo_pedido_ml || e.id_entrega} com postagem ATRASADA`,
            descricao: `Prazo venceu há ${Math.abs(diffHoras)}h. Cliente: ${e.cliente || 'Consumidor'}. Itens: ${(e.itens || []).map(i => `${i.quantidade}x ${i.sku}`).join(', ')}.`,
            impacto: "Risco de penalidade imediata de reputação no Mercado Livre e cancelamento.",
            acao_label: "Despachar no Galpão",
            acao_url: "entregas.html",
            criado_em: e.prazo_despacho,
          });
        } else if (diffHoras <= 24) {
          alertas.push({
            id: `postagem-${e.id_entrega}`,
            categoria: "postagem",
            criticidade: "atencao",
            titulo: `Pedido ${e.codigo_pedido_direto || e.codigo_pedido_ml || e.id_entrega} deve ser postado HOJE`,
            descricao: `Restam aproximadamente ${diffHoras}h para o despacho. Cliente: ${e.cliente || 'Consumidor'}.`,
            impacto: "Exige prioridade na separação física para não gerar atraso operacional.",
            acao_label: "Ver na Expedição",
            acao_url: "entregas.html",
            criado_em: e.prazo_despacho,
          });
        }
      }
    }

    // 2. Estoque e Ruptura (#4)
    if (window.RezFireData) {
      const produtos = window.RezFireData.loadProducts();
      for (const p of produtos) {
        if (p.ativo === false) continue;
        const saldo = Number(p.quantidade_atual || 0);
        const minimo = Number(p.estoque_minimo || 0);

        if (saldo === 0) {
          alertas.push({
            id: `estoque-ruptura-${p.id_produto}`,
            categoria: "estoque",
            criticidade: "critico",
            titulo: `RUPTURA TOTAL: ${p.sku} - ${p.nome}`,
            descricao: `Estoque físico esgotado (0 un.). Estoque mínimo de segurança: ${minimo} un.`,
            impacto: "Vendas travadas ou risco de cancelamento imediato por falta de mercadoria.",
            acao_label: "Dar Entrada / Repor",
            acao_url: "movimentacoes.html",
            criado_em: agora.toISOString(),
          });
        } else if (saldo <= minimo) {
          alertas.push({
            id: `estoque-baixo-${p.id_produto}`,
            categoria: "estoque",
            criticidade: "atencao",
            titulo: `Estoque Baixo: ${p.sku} (${saldo}/${minimo} un.)`,
            descricao: `O saldo atual de ${saldo} un. atingiu ou está abaixo do estoque mínimo (${minimo} un.).`,
            impacto: "Risco de ruptura a curto prazo caso ocorra venda no Mercado Livre.",
            acao_label: "Consultar Estoque",
            acao_url: "estoque.html",
            criado_em: agora.toISOString(),
          });
        }
      }
    }

    // 3. Validade FEFO dos Extintores (#8)
    if (window.RezFireData && window.RezFireData.loadLotes) {
      const lotes = window.RezFireData.loadLotes();
      for (const l of lotes) {
        if (!l.validade && !l.data_validade) continue;
        const validade = new Date(l.validade || l.data_validade);
        const diffDias = Math.floor((validade - agora) / (1000 * 60 * 60 * 24));
        const saldo = Number(l.quantidade_disponivel || 0);

        if (saldo <= 0) continue;

        if (diffDias <= 0) {
          alertas.push({
            id: `validade-vencido-${l.id_lote}`,
            categoria: "validade",
            criticidade: "critico",
            titulo: `Extintor VENCIDO: Lote ${l.numero_lote || l.id_lote} (${l.sku})`,
            descricao: `Lote vencido há ${Math.abs(diffDias)} dias (${saldo} un. no galpão). Lacre: ${l.lacre || l.numero_lacre_inmetro || 'N/A'}.`,
            impacto: "Proibida comercialização perante INMETRO. Exige descarte ou recarga imediata.",
            acao_label: "Segregar Lote",
            acao_url: "movimentacoes.html",
            criado_em: validade.toISOString(),
          });
        } else if (diffDias <= 180) {
          alertas.push({
            id: `validade-bloqueado-${l.id_lote}`,
            categoria: "validade",
            criticidade: "critico",
            titulo: `Bloqueio de Expedição (< 6 meses): Lote ${l.numero_lote || l.id_lote}`,
            descricao: `Restam ${diffDias} dias de validade para ${l.sku} (${saldo} un.).`,
            impacto: "Bloqueado para venda para garantir tempo útil mínimo de 6 meses para o comprador.",
            acao_label: "Ver no Estoque",
            acao_url: "estoque.html",
            criado_em: validade.toISOString(),
          });
        } else if (diffDias <= 365) {
          alertas.push({
            id: `validade-alerta-${l.id_lote}`,
            categoria: "validade",
            criticidade: "atencao",
            titulo: `Prioridade FEFO (Vence em ${diffDias} dias): Lote ${l.numero_lote || l.id_lote}`,
            descricao: `Lote com ${saldo} un. de ${l.sku} possui validade inferior a 1 ano.`,
            impacto: "Priorizar expedição deste lote pelo método FEFO antes de lotes mais novos.",
            acao_label: "Priorizar na Expedição",
            acao_url: "entregas.html",
            criado_em: validade.toISOString(),
          });
        }
      }
    }

    // 4. Anúncios ML Pausados e Divergências (#13)
    if (window.RezFireAnuncios && window.RezFireData) {
      const anuncios = window.RezFireAnuncios.loadAnuncios();
      const produtos = window.RezFireData.loadProducts();

      for (const a of anuncios) {
        if (a.status === "Pausado") {
          alertas.push({
            id: `anuncio-pausado-${a.id_anuncio}`,
            categoria: "anuncio",
            criticidade: "critico",
            titulo: `Anúncio PAUSADO no Mercado Livre: ${a.ml_item_id}`,
            descricao: `"${a.titulo}". Estoque informado no anúncio: ${a.quantidade_disponivel || 0} un.`,
            impacto: "Perda imediata de vendas e penalização no ranking de busca do Mercado Livre.",
            acao_label: "Ver Anúncio",
            acao_url: "anuncios.html",
            criado_em: a.ultima_sincronizacao || agora.toISOString(),
          });
        } else {
          const divs = window.RezFireAnuncios.analisarDivergencias(a, produtos);
          if (divs.length > 0) {
            alertas.push({
              id: `anuncio-divergencia-${a.id_anuncio}`,
              categoria: "anuncio",
              criticidade: "atencao",
              titulo: `Divergência de Estoque ML: ${a.ml_item_id}`,
              descricao: divs[0].descricao || `Divergência entre estoque físico e quantidade anunciada no anúncio "${a.titulo}".`,
              impacto: "Risco de vender mercadoria sem saldo real disponível no armazém.",
              acao_label: "Ajustar Anúncio",
              acao_url: "anuncios.html",
              criado_em: a.ultima_sincronizacao || agora.toISOString(),
            });
          }
        }
      }
    }

    // Ordenação estrita por Criticidade (Crítico primeiro) e depois por Data
    alertas.sort((a, b) => {
      if (a.criticidade === "critico" && b.criticidade !== "critico") return -1;
      if (a.criticidade !== "critico" && b.criticidade === "critico") return 1;
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
    });

    return alertas;
  }

  function calcularResumo(alertas) {
    return {
      total: alertas.length,
      criticos: alertas.filter((a) => a.criticidade === "critico").length,
      atencao: alertas.filter((a) => a.criticidade === "atencao").length,
      por_categoria: {
        postagem: alertas.filter((a) => a.categoria === "postagem").length,
        estoque: alertas.filter((a) => a.categoria === "estoque").length,
        validade: alertas.filter((a) => a.categoria === "validade").length,
        anuncio: alertas.filter((a) => a.categoria === "anuncio").length,
      },
    };
  }

  function atualizarBadgeSidebar(total) {
    const badge = document.getElementById("sidebar-alertas-badge");
    if (badge) {
      badge.textContent = String(total);
      badge.style.display = total > 0 ? "inline-flex" : "none";
    }
    const badgeTopo = document.getElementById("badge-total-topo");
    if (badgeTopo) {
      badgeTopo.textContent = `${total} alerta${total !== 1 ? 's' : ''}`;
      badgeTopo.className = total > 0 ? "px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800" : "px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800";
    }
  }

  function renderStatusBanner() {
    const el = document.getElementById("alerta-status-banner");
    if (!el) return;

    const r = state.resumo;
    if (r.total === 0) {
      el.className = "mb-5 p-3.5 rounded-lg text-xs font-medium border bg-emerald-50 border-emerald-200 text-emerald-800 flex items-center justify-between";
      el.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-base">✅</span>
          <span><strong>Operação 100% Regular:</strong> Não há pedidos atrasados, rupturas de estoque, lotes vencidos ou anúncios pausados no momento.</span>
        </div>
      `;
      el.style.display = "flex";
      return;
    }

    if (r.criticos > 0) {
      el.className = "mb-5 p-3.5 rounded-lg text-xs font-medium border bg-red-50 border-red-300 text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm";
      el.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-xl">🚨</span>
          <div>
            <strong class="font-bold text-red-900">Atenção Crítica:</strong> Existem <strong>${r.criticos} alerta(s) de ação imediata</strong> (prazos estourados, rupturas ou anúncios pausados).
          </div>
        </div>
        <button type="button" class="btn-filtrar-criticos self-end sm:self-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold transition">
          Ver Críticos (${r.criticos})
        </button>
      `;
      el.style.display = "flex";

      el.querySelector(".btn-filtrar-criticos")?.addEventListener("click", () => {
        aplicarFiltroCriticidade("critico");
      });
      return;
    }

    el.className = "mb-5 p-3.5 rounded-lg text-xs font-medium border bg-amber-50 border-amber-300 text-amber-800 flex items-center justify-between";
    el.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-base">⚠️</span>
        <span>Existem <strong>${r.atencao} alerta(s) preventivo(s)</strong> para acompanhamento no dia.</span>
      </div>
    `;
    el.style.display = "flex";
  }

  function renderKPIs() {
    const container = document.getElementById("kpis-alertas-container");
    if (!container) return;

    const r = state.resumo;

    const card = ({ id, label, val, sublabel, icon, color, critFiltro, catFiltro }) => `
      <article class="alerta-kpi-card" data-crit="${critFiltro || ''}" data-cat="${catFiltro || ''}" title="Clique para filtrar">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span class="text-[11px] font-bold text-stone-500 uppercase tracking-wider">${label}</span>
          <div class="kpi-badge-icon ${color}">${icon}</div>
        </div>
        <div class="text-2xl font-black text-stone-900 leading-none mb-1">${val}</div>
        <div class="text-[11px] text-stone-500 truncate border-t border-stone-100 pt-1">${sublabel}</div>
      </article>
    `;

    container.innerHTML = [
      card({
        label: "Total Alertas",
        val: String(r.total),
        sublabel: `${r.criticos} urgentes`,
        icon: "🔔",
        color: "bg-stone-100 text-stone-800",
        critFiltro: "todos",
      }),
      card({
        label: "🚨 Críticos",
        val: String(r.criticos),
        sublabel: "Ação imediata",
        icon: "⚠️",
        color: "bg-red-100 text-red-800",
        critFiltro: "critico",
      }),
      card({
        label: "⚠️ Atenção",
        val: String(r.atencao),
        sublabel: "No decorrer do dia",
        icon: "⏱️",
        color: "bg-amber-100 text-amber-800",
        critFiltro: "atencao",
      }),
      card({
        label: "Postagem (#10)",
        val: String(r.por_categoria.postagem),
        sublabel: "Atrasos e envios hoje",
        icon: "🚚",
        color: "bg-blue-100 text-blue-800",
        catFiltro: "postagem",
      }),
      card({
        label: "Estoque (#4 & #8)",
        val: String(r.por_categoria.estoque + r.por_categoria.validade),
        sublabel: "Ruptura & FEFO",
        icon: "📦",
        color: "bg-purple-100 text-purple-800",
        catFiltro: "estoque",
      }),
      card({
        label: "Mercado Livre",
        val: String(r.por_categoria.anuncio),
        sublabel: "Pausados & estoque",
        icon: "📢",
        color: "bg-yellow-100 text-yellow-800",
        catFiltro: "anuncio",
      }),
    ].join("");

    container.querySelectorAll(".alerta-kpi-card").forEach((cardEl) => {
      cardEl.addEventListener("click", () => {
        const crit = cardEl.dataset.crit;
        const cat = cardEl.dataset.cat;
        if (crit) {
          aplicarFiltroCriticidade(crit);
        } else if (cat) {
          aplicarFiltroCategoria(cat);
        }
      });
    });
  }

  function getAlertasFiltrados() {
    const f = state.filtros;
    return state.alertas.filter((a) => {
      // 1. Busca Textual
      if (f.busca) {
        const termo = f.busca.toLowerCase();
        const textoCompleto = `${a.titulo} ${a.descricao} ${a.impacto}`.toLowerCase();
        if (!textoCompleto.includes(termo)) return false;
      }

      // 2. Criticidade
      if (f.criticidade !== "todos" && a.criticidade !== f.criticidade) {
        return false;
      }

      // 3. Categoria
      if (f.categoria !== "todos" && a.categoria !== f.categoria) {
        return false;
      }

      return true;
    });
  }

  function renderLista() {
    const container = document.getElementById("lista-alertas-container");
    const labelTotal = document.getElementById("label-total-filtrado");
    if (!container) return;

    const filtrados = getAlertasFiltrados();

    if (labelTotal) {
      labelTotal.textContent = `Mostrando ${filtrados.length} de ${state.alertas.length} alertas`;
    }

    if (filtrados.length === 0) {
      container.innerHTML = `
        <div class="bg-white border border-stone-200 rounded-xl p-12 text-center shadow-sm">
          <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 text-2xl">
            ✓
          </div>
          <h3 class="text-base font-bold text-stone-900 mb-1">Nenhum alerta pendente com os filtros atuais</h3>
          <p class="text-xs text-stone-500 mb-4 max-w-md mx-auto">
            Sua operação está saudável e alinhada com os parâmetros de estoque, prazo e integridade no Mercado Livre.
          </p>
          <button type="button" class="btn-primary text-xs px-3.5 py-1.5" onclick="window.limparFiltrosAlertas()">
            Limpar Filtros
          </button>
        </div>
      `;
      return;
    }

    const catBadge = (cat) => {
      switch (cat) {
        case "postagem": return `<span class="badge-categoria-tag cat-postagem">⏱️ Prazo de Postagem (#10)</span>`;
        case "estoque":  return `<span class="badge-categoria-tag cat-estoque">📦 Estoque & Ruptura (#4)</span>`;
        case "validade": return `<span class="badge-categoria-tag cat-validade">🛡️ Validade FEFO (#8)</span>`;
        case "anuncio":  return `<span class="badge-categoria-tag cat-anuncio">📢 Mercado Livre (#13)</span>`;
        default:         return `<span class="badge-categoria-tag cat-postagem">Geral</span>`;
      }
    };

    container.innerHTML = filtrados.map((a) => {
      const isCritico = a.criticidade === "critico";
      const badgeCrit = isCritico
        ? `<span class="badge-criticidade-critico">🚨 AÇÃO IMEDIATA</span>`
        : `<span class="badge-criticidade-atencao">⚠️ ATENÇÃO NO DIA</span>`;

      return `
        <article class="alerta-row-card ${isCritico ? 'critico' : 'atencao'}">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2">
            <div class="flex items-center gap-2 flex-wrap">
              ${badgeCrit}
              ${catBadge(a.categoria)}
            </div>
            <span class="text-[11px] text-stone-400 font-medium">Prioridade máxima</span>
          </div>

          <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div class="flex-1 space-y-1.5">
              <h3 class="text-sm font-extrabold text-stone-900 leading-snug">${escapeHtml(a.titulo)}</h3>
              <p class="text-xs text-stone-600 leading-relaxed">${escapeHtml(a.descricao)}</p>
              <div class="text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded px-2.5 py-1 inline-block">
                <strong>Impacto Operacional:</strong> ${escapeHtml(a.impacto)}
              </div>
            </div>

            <div class="flex-shrink-0 self-start md:self-center">
              <a
                href="${a.acao_url}"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 ${isCritico ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'} rounded-lg text-xs font-bold shadow-sm transition"
              >
                <span>${escapeHtml(a.acao_label || 'Resolver')}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14"/>
                  <path d="m12 5 7 7-7 7"/>
                </svg>
              </a>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function aplicarFiltroCriticidade(crit) {
    state.filtros.criticidade = crit;
    document.querySelectorAll(".btn-filtro-criticidade").forEach((btn) => {
      const match = btn.dataset.crit === crit;
      btn.className = match
        ? "btn-filtro-criticidade px-2.5 py-1.5 rounded-lg text-xs font-bold border transition bg-stone-900 text-white border-stone-900"
        : "btn-filtro-criticidade px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition bg-white text-stone-700 border-stone-300 hover:bg-stone-50";
    });
    renderLista();
  }

  function aplicarFiltroCategoria(cat) {
    state.filtros.categoria = cat;
    const sel = document.getElementById("filtro-categoria-alertas");
    if (sel) sel.value = cat;
    renderLista();
  }

  function limparFiltros() {
    state.filtros = {
      busca: "",
      criticidade: "todos",
      categoria: "todos",
    };
    document.getElementById("filtro-busca-alertas").value = "";
    document.getElementById("filtro-categoria-alertas").value = "todos";
    aplicarFiltroCriticidade("todos");
  }
  window.limparFiltrosAlertas = limparFiltros;

  function bindEvents() {
    document.getElementById("filtro-busca-alertas")?.addEventListener("input", (e) => {
      state.filtros.busca = e.target.value.trim();
      renderLista();
    });

    document.querySelectorAll(".btn-filtro-criticidade").forEach((btn) => {
      btn.addEventListener("click", () => {
        aplicarFiltroCriticidade(btn.dataset.crit);
      });
    });

    document.getElementById("filtro-categoria-alertas")?.addEventListener("change", (e) => {
      state.filtros.categoria = e.target.value;
      renderLista();
    });

    document.getElementById("btn-limpar-filtros-alertas")?.addEventListener("click", limparFiltros);
    document.getElementById("btn-atualizar-alertas")?.addEventListener("click", carregarAlertas);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderErro(msg) {
    const container = document.getElementById("lista-alertas-container");
    if (container) {
      container.innerHTML = `
        <div class="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs">
          ❌ ${escapeHtml(msg)}
        </div>
      `;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

