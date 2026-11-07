/**
 * anuncios.js
 * Controlador da Tela de Anúncios do Mercado Livre — RezFire Manager.
 *
 * Responsável por:
 *  - Suporte a Anúncios Unitários e ANÚNCIOS MULTI-ITEM (Kits, Combos, Packs)
 *  - Rastreio de estoque dinâmico e identificação do componente gargalo
 *  - Listagem com badges distintivos (Unitário vs Kit/Multi-item)
 *  - Painel Drawer com editor de composição de múltiplos itens
 *  - Filtros cruzados, paginação, loading (skeleton) e empty states
 *  - Sincronização manual com o Mercado Livre
 */

(function () {
  let state = {
    anuncios: [],
    produtos: [],
    syncMeta: {},
    filtros: {
      busca: "",
      produto: "todos",
      status: "todos",
      tipo: "todos", // todos | unitario | kit
      divergencia: "todos",
      categoria: "todos",
      certificados: "todos", // todos | com_cert | sem_cert
      ordenacao: "vendas_desc"
    },
    paginacao: {
      paginaAtual: 1,
      itensPorPagina: 8
    },
    anuncioSelecionado: null,
    itensEdicaoComposicao: [], // Itens em edição temporária no Drawer
    carregando: false,
    sincronizando: false
  };

  const money = (val) =>
    Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatData = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  async function init() {
    window.RezFireLayout.renderSidebar("anuncios");
    bindEvents();
    await carregarDados();
  }

  async function carregarDados() {
    state.carregando = true;
    renderSkeleton();

    try {
      let produtosCarregados = null;
      let anunciosCarregados = null;
      let statusConexaoCarregado = null;

      // 1. Tenta carregar dados em tempo real da API do Backend
      if (window.RezFireAPI) {
        try {
          const [resAnuncios, resProdutos, resStatus] = await Promise.all([
            window.RezFireAPI.request("/ml/anuncios").catch(() => null),
            window.RezFireAPI.produtos ? window.RezFireAPI.produtos.listar().catch(() => null) : null,
            window.RezFireAPI.request("/ml/status").catch(() => null),
          ]);

          if (resProdutos && resProdutos.sucesso && Array.isArray(resProdutos.produtos) && resProdutos.produtos.length > 0) {
            produtosCarregados = resProdutos.produtos;
          }
          if (resAnuncios && resAnuncios.sucesso && Array.isArray(resAnuncios.anuncios) && resAnuncios.anuncios.length > 0) {
            // Adapta anúncios do backend MySQL mantendo compatibilidade de campos
            anunciosCarregados = resAnuncios.anuncios.map((a) => ({
              id_anuncio: a.id_anuncio,
              ml_item_id: a.ml_item_id,
              titulo: a.titulo,
              preco: Number(a.preco || 0),
              status: a.status || "Ativo",
              quantidade_disponivel: Number(a.quantidade_disponivel || 0),
              quantidade_vendida: Number(a.quantidade_vendida || 0),
              url: a.url || `https://produto.mercadolivre.com.br/${a.ml_item_id}`,
              thumbnail: a.thumbnail || "https://http2.mlstatic.com/D_NQ_NP_2X_708305-MLB54929812_042023-F.webp",
              categoria_ml: a.categoria_ml || "Segurança Contra Incêndio",
              data_criacao: a.created_at || a.data_criacao || new Date().toISOString(),
              ultima_sincronizacao: a.ultima_sincronizacao || a.updated_at || new Date().toISOString(),
              visitas_ultimos_60d: Number(a.visitas_ultimos_60d || (a.quantidade_vendida * 15 + 40)),
              taxa_conversao: a.taxa_conversao || "5.2%",
              produtos_vinculados: a.produto_anuncios && a.produto_anuncios.length > 0
                ? a.produto_anuncios.map((pa) => ({
                    id_produto: pa.id_produto,
                    sku: pa.produto?.sku || "EXT",
                    nome: pa.produto?.nome || "Produto",
                    quantidade_anunciada: pa.quantidade_anunciada || 1,
                  }))
                : a.id_produto_vinculado
                ? [{ id_produto: a.id_produto_vinculado, sku: a.produto_vinculado_sku, nome: a.produto_vinculado_nome, quantidade_anunciada: 1 }]
                : [],
            }));
          }
          if (resStatus && resStatus.sucesso) {
            statusConexaoCarregado = resStatus;
          }
        } catch (apiErr) {
          console.warn("Backend ML indisponível, usando fallback local de anúncios:", apiErr);
        }
      }

      state.produtos = (produtosCarregados && produtosCarregados.length > 0)
        ? produtosCarregados
        : (window.RezFireData ? window.RezFireData.loadProducts() : []);

      if (anunciosCarregados && anunciosCarregados.length > 0) {
        state.anuncios = anunciosCarregados;
      } else {
        state.anuncios = window.RezFireAnuncios ? window.RezFireAnuncios.loadAnuncios() : [];
      }

      if (statusConexaoCarregado) {
        state.syncMeta = {
          status_conexao: statusConexaoCarregado.status || "Conectado",
          ml_user_id: statusConexaoCarregado.ml_user_id || "789102450",
          ultima_sincronizacao: statusConexaoCarregado.ultima_atualizacao || new Date().toISOString(),
          seller_nickname: "REZFIRE_EXTINTORES",
        };
      } else {
        state.syncMeta = window.RezFireAnuncios ? window.RezFireAnuncios.loadSyncMeta() : {};
      }

      preencherSelectsFiltro();
      renderSyncHeader();
      renderKPIs();
      renderAlertaAnuncios();
      renderTabela();
    } catch (err) {
      console.error("Erro ao carregar anúncios:", err);
      renderErroTabela("Falha ao carregar os dados de anúncios do Mercado Livre.");
    } finally {
      state.carregando = false;
    }
  }

  function renderSyncHeader() {
    const meta = state.syncMeta;
    const syncTimeEl = document.getElementById("sync-last-time");
    if (syncTimeEl) {
      syncTimeEl.textContent = `Última sincronização: ${formatData(meta.ultima_sincronizacao || new Date().toISOString())}`;
    }

    const ind = document.getElementById("sync-status-indicator");
    const txt = document.getElementById("sync-status-text");
    if (ind && txt) {
      if (state.sincronizando) {
        ind.className = "sync-badge syncing";
        txt.textContent = "Sincronizando com API ML...";
      } else {
        ind.className = "sync-badge";
        txt.textContent = `${meta.status_conexao || "Conectado"} (${meta.seller_nickname || "REZFIRE"})`;
      }
    }
  }

  function renderKPIs() {
    const kpisEl = document.getElementById("kpis-anuncios");
    if (!kpisEl || !window.RezFireAnuncios) return;

    const k = window.RezFireAnuncios.computeAnunciosKPIs(state.anuncios, state.produtos);

    // Helpers com ícones SVG nítidos e estrutura aprimorada
    const iconSvg = {
      layers: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
      checkCircle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      pauseCircle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>`,
      archive: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
      alertTriangle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      shoppingBag: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    };

    const card = ({ accent, iconColor, icon, label, val, sublabel, tag, filtroStatus, filtroDiv, title }) => `
      <article class="kpi-card-modern ${accent} ${filtroStatus || filtroDiv ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}"
        ${filtroStatus ? `data-filtro-status="${filtroStatus}"` : ''}
        ${filtroDiv ? `data-filtro-div="${filtroDiv}"` : ''}
        title="${title || 'Clique para filtrar'}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-bold text-stone-500 uppercase tracking-wider">${label}</span>
          <div class="kpi-icon-badge ${iconColor}">${icon}</div>
        </div>

        <div class="my-1.5">
          <div class="text-2xl font-extrabold text-stone-900 tracking-tight leading-none">${val}</div>
        </div>

        <div class="flex items-center justify-between text-xs text-stone-500 pt-1 border-t border-stone-100">
          <span class="truncate">${sublabel}</span>
          ${tag ? `<span class="ml-1 flex-shrink-0">${tag}</span>` : ""}
        </div>
      </article>
    `;

    const pctAtivos = Math.round((k.ativos / (k.total || 1)) * 100);
    const divTag = k.comDivergencias > 0
      ? `<span class="kpi-mini-tag red">Atenção</span>`
      : `<span class="kpi-mini-tag emerald">100% OK</span>`;

    kpisEl.innerHTML = [
      card({
        accent: "accent-total",
        iconColor: "gray",
        icon: iconSvg.layers,
        label: "Total Anúncios",
        val: String(k.total),
        sublabel: `${k.totalKits} kits/combos`,
        tag: `<span class="kpi-mini-tag slate">Catálogo</span>`,
        filtroStatus: "todos",
        title: "Clique para ver todos os anúncios"
      }),
      card({
        accent: "accent-active",
        iconColor: "emerald",
        icon: iconSvg.checkCircle,
        label: "Anúncios Ativos",
        val: String(k.ativos),
        sublabel: "No ar no ML",
        tag: `<span class="kpi-mini-tag emerald">${pctAtivos}%</span>`,
        filtroStatus: "Ativo",
        title: "Clique para filtrar anúncios ativos"
      }),
      card({
        accent: "accent-paused",
        iconColor: "amber",
        icon: iconSvg.pauseCircle,
        label: "Pausados",
        val: String(k.pausados),
        sublabel: "Pausados no ML",
        tag: k.pausados > 0 ? `<span class="kpi-mini-tag amber">Standby</span>` : "",
        filtroStatus: "Pausado",
        title: "Clique para filtrar anúncios pausados"
      }),
      card({
        accent: "accent-closed",
        iconColor: "slate",
        icon: iconSvg.archive,
        label: "Encerrados",
        val: String(k.encerrados),
        sublabel: "Finalizados",
        tag: `<span class="kpi-mini-tag slate">Histórico</span>`,
        filtroStatus: "Encerrado",
        title: "Clique para filtrar anúncios encerrados"
      }),
      card({
        accent: "accent-divergence",
        iconColor: k.comDivergencias > 0 ? "red" : "emerald",
        icon: iconSvg.alertTriangle,
        label: "Divergências",
        val: String(k.comDivergencias),
        sublabel: k.comDivergencias > 0 ? "Exigem atenção" : "Tudo alinhado",
        tag: divTag,
        filtroDiv: "com_divergencia",
        title: "Clique para filtrar anúncios com divergência de estoque"
      }),
      card({
        accent: "accent-sales",
        iconColor: "orange",
        icon: iconSvg.shoppingBag,
        label: "Vendas Totais",
        val: `${k.totalVendas.toLocaleString("pt-BR")}`,
        sublabel: `${k.totalVisualizacoes.toLocaleString("pt-BR")} visitas`,
        tag: `<span class="kpi-mini-tag emerald">un.</span>`,
        title: "Volume acumulado de vendas"
      }),
    ].join("");

    // Habilita filtragem rápida ao clicar nos cards de KPI
    kpisEl.querySelectorAll(".kpi-card-modern").forEach((cardEl) => {
      cardEl.addEventListener("click", () => {
        const st = cardEl.dataset.filtroStatus;
        const div = cardEl.dataset.filtroDiv;
        if (st) {
          filtrarPorStatusRapido(st);
        } else if (div) {
          filtrarPorDivergenciaRapido(div);
        }
      });
    });
  }

  /**
   * Alerta Operacional: Anúncios Pausados ou Rebaixados por Estoque (SCRUM-15 / #13)
   */
  function renderAlertaAnuncios() {
    const bannerEl = document.getElementById("alerta-anuncios-pausados-banner");
    if (!bannerEl) return;

    const pausados = state.anuncios.filter((a) => a.status === "Pausado");
    let comDivergencia = [];
    if (window.RezFireAnuncios) {
      comDivergencia = state.anuncios.filter((a) => {
        const divs = window.RezFireAnuncios.analisarDivergencias(a, state.produtos);
        return divs.length > 0;
      });
    }

    const qtdPausados = pausados.length;
    const qtdDivergencias = comDivergencia.length;

    if (qtdPausados === 0 && qtdDivergencias === 0) {
      bannerEl.style.display = "none";
      bannerEl.innerHTML = "";
      return;
    }

    bannerEl.style.display = "block";
    bannerEl.innerHTML = `
      <div class="p-3.5 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-stone-800">
        <div class="flex items-start sm:items-center gap-3">
          <span class="text-2xl flex-shrink-0" aria-hidden="true">⚠️</span>
          <div>
            <div class="font-bold text-sm text-amber-900 flex flex-wrap items-center gap-2">
              <span>Alerta Operacional: Anúncios Pausados ou com Risco de Estoque</span>
              ${qtdPausados > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-amber-200 text-amber-900 rounded-full">${qtdPausados} pausado${qtdPausados > 1 ? 's' : ''}</span>` : ''}
              ${qtdDivergencias > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded-full">${qtdDivergencias} divergência${qtdDivergencias > 1 ? 's' : ''}</span>` : ''}
            </div>
            <div class="text-xs text-amber-800 mt-0.5">
              ${qtdPausados > 0 ? `Existem <strong>${qtdPausados} anúncio(s) pausado(s)</strong> no Mercado Livre que exigem reposição física ou revisão cadastral.` : ''}
              ${qtdDivergencias > 0 ? ` <strong>${qtdDivergencias} anúncio(s)</strong> possuem saldo no armazém divergente da quantidade disponível anunciada.` : ''}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
          ${qtdPausados > 0 ? `
            <button type="button" id="btn-alerta-filtrar-pausados" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-md shadow-sm transition">
              Ver Pausados (${qtdPausados})
            </button>
          ` : ''}
          ${qtdDivergencias > 0 ? `
            <button type="button" id="btn-alerta-filtrar-divergencias" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md shadow-sm transition">
              Ver Divergências (${qtdDivergencias})
            </button>
          ` : ''}
        </div>
      </div>
    `;

    document.getElementById("btn-alerta-filtrar-pausados")?.addEventListener("click", () => {
      filtrarPorStatusRapido("Pausado");
    });

    document.getElementById("btn-alerta-filtrar-divergencias")?.addEventListener("click", () => {
      filtrarPorDivergenciaRapido("com_divergencia");
    });
  }

  function filtrarPorStatusRapido(status) {
    state.filtros.status = status;
    const selStatus = document.getElementById("filtro-status");
    if (selStatus) selStatus.value = status;
    state.paginacao.paginaAtual = 1;
    renderTabela();
  }

  function filtrarPorDivergenciaRapido(divergencia) {
    state.filtros.divergencia = divergencia;
    const selDiv = document.getElementById("filtro-divergencia");
    if (selDiv) selDiv.value = divergencia;
    state.paginacao.paginaAtual = 1;
    renderTabela();
  }

  function preencherSelectsFiltro() {
    const selProd = document.getElementById("filtro-produto");
    if (selProd) {
      const valorAtual = selProd.value;
      selProd.innerHTML = `
        <option value="todos">Todos os Produtos</option>
        <option value="sem_vinculo">⚠️ Sem produto vinculado</option>
        ${state.produtos.map(p => `<option value="${p.id_produto}">${p.sku} - ${p.nome}</option>`).join("")}
      `;
      selProd.value = valorAtual || "todos";
    }

    const selCat = document.getElementById("filtro-categoria");
    if (selCat) {
      const categorias = Array.from(new Set(state.anuncios.map(a => a.categoria_ml).filter(Boolean)));
      selCat.innerHTML = `
        <option value="todos">Todas as Categorias</option>
        ${categorias.map(c => `<option value="${c}">${c}</option>`).join("")}
      `;
    }
  }

  function getAnunciosFiltrados() {
    const f = state.filtros;
    const prods = state.produtos;

    return state.anuncios.filter((a) => {
      const itens = window.RezFireAnuncios.extrairItensAnuncio(a);
      const isKit = itens.length > 1 || (itens.length === 1 && itens[0].quantidade_anunciada > 1);

      // 1. Busca por Título ou MLB
      if (f.busca) {
        const termo = f.busca.toLowerCase();
        const matchTitulo = (a.titulo || "").toLowerCase().includes(termo);
        const matchMlb = (a.ml_item_id || "").toLowerCase().includes(termo);
        if (!matchTitulo && !matchMlb) return false;
      }

      // 2. Filtro por Produto Vinculado
      if (f.produto === "sem_vinculo") {
        if (itens.length > 0) return false;
      } else if (f.produto !== "todos") {
        const prodId = Number(f.produto);
        const contemProduto = itens.some((it) => it.id_produto === prodId);
        if (!contemProduto) return false;
      }

      // 3. Filtro por Tipo (Unitário vs Kit/Multi-item)
      if (f.tipo !== "todos") {
        if (f.tipo === "kit" && !isKit) return false;
        if (f.tipo === "unitario" && isKit) return false;
      }

      // 4. Filtro por Status / Recriados (SCRUM-20)
      if (f.status !== "todos") {
        if (f.status === "Excluído" || f.status === "recriados") {
          if (!a.foi_recriado && a.status !== "Excluído") return false;
        } else if (a.status !== f.status) {
          return false;
        }
      }

      // 5. Filtro por Categoria
      if (f.categoria !== "todos" && a.categoria_ml !== f.categoria) {
        return false;
      }

      // 6. Filtro de Divergências
      if (f.divergencia !== "todos" && window.RezFireAnuncios) {
        const divs = window.RezFireAnuncios.analisarDivergencias(a, prods);
        const temDivergencia = divs.length > 0;
        if (f.divergencia === "com_divergencia" && !temDivergencia) return false;
        if (f.divergencia === "sem_divergencia" && temDivergencia) return false;
      }

      // 7. Filtro de Certificados Inmetro do Anúncio
      if (f.certificados && f.certificados !== "todos" && window.RezFireCertificados) {
        const temCert = window.RezFireCertificados.temCertificado("anuncio", a.id_anuncio);
        if (f.certificados === "com_cert" && !temCert) return false;
        if (f.certificados === "sem_cert" && temCert) return false;
      }

      return true;
    }).sort((a, b) => {
      switch (f.ordenacao) {
        case "preco_desc":
          return Number(b.preco || 0) - Number(a.preco || 0);
        case "preco_asc":
          return Number(a.preco || 0) - Number(b.preco || 0);
        case "vendas_desc":
          return Number(b.quantidade_vendida || 0) - Number(a.quantidade_vendida || 0);
        case "vendas_asc":
          return Number(a.quantidade_vendida || 0) - Number(b.quantidade_vendida || 0);
        case "visitas_desc":
          return Number(b.visualizacoes || 0) - Number(a.visualizacoes || 0);
        case "atualizacao_desc":
        default:
          return new Date(b.ultima_sincronizacao || 0) - new Date(a.ultima_sincronizacao || 0);
      }
    });
  }

  function renderTabela() {
    const tbody = document.getElementById("anuncios-body");
    const labelTotal = document.getElementById("label-total-filtrado");
    if (!tbody) return;

    const filtrados = getAnunciosFiltrados();
    const total = filtrados.length;

    if (labelTotal) {
      labelTotal.textContent = `${total} anúncio(s) encontrado(s) de ${state.anuncios.length}`;
    }

    if (total === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="10" style="padding: 40px 20px; text-align: center;">
            <div style="max-width: 400px; margin: 0 auto;">
              <p style="font-size: 1.1rem; font-weight: 700; color: #1a1412; margin-bottom: 6px;">Nenhum anúncio encontrado</p>
              <p style="font-size: 0.82rem; color: #6b6560; margin-bottom: 14px;">Tente ajustar os termos de busca ou limpar os filtros aplicados.</p>
              <button type="button" class="btn-primary" onclick="window.limparFiltrosAnuncios()" style="padding: 6px 14px; font-size: 0.78rem;">Limpar Filtros</button>
            </div>
          </td>
        </tr>
      `;
      renderPaginacao(0, 0);
      return;
    }

    const p = state.paginacao;
    const totalPaginas = Math.ceil(total / p.itensPorPagina);
    if (p.paginaAtual > totalPaginas) p.paginaAtual = totalPaginas || 1;

    const inicio = (p.paginaAtual - 1) * p.itensPorPagina;
    const paginaItens = filtrados.slice(inicio, inicio + p.itensPorPagina);

    tbody.innerHTML = paginaItens.map((a) => {
      const calculo = window.RezFireAnuncios.calcularEstoqueDinamicoAnuncio(a, state.produtos);
      const divs = window.RezFireAnuncios.analisarDivergencias(a, state.produtos);
      const itens = window.RezFireAnuncios.extrairItensAnuncio(a);
      const isMultiItem = itens.length > 1 || (itens.length === 1 && itens[0].quantidade_anunciada > 1);

      // Status Badge & Recriação (SCRUM-20 / #15)
      let statusCls = "encerrado";
      if (a.status === "Ativo") statusCls = "ativo";
      else if (a.status === "Pausado") statusCls = "pausado";
      else if (a.status === "Excluído") statusCls = "encerrado";
      let statusBadge = `<span class="badge-anuncio-status ${statusCls}">${a.status}</span>`;
      if (a.foi_recriado) {
        statusBadge += `<span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 ml-1 bg-red-100 text-red-800 rounded border border-red-200" title="Anúncio excluído pelo ML e substituído por ${a.ml_item_id_substituto || 'novo'}">Recriado</span>`;
      } else if (a.ml_item_id_origem) {
        statusBadge += `<span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 ml-1 bg-blue-100 text-blue-800 rounded border border-blue-200" title="Herdeiro do anúncio excluído ${a.ml_item_id_origem}">Herdeiro</span>`;
      }

      // Divergência Badge
      let divBadge = `<span class="badge-divergencia ok" title="Anúncio alinhado com o armazém">✓ Alinhado</span>`;
      if (divs.length > 0) {
        const piorGravidade = divs.some(d => d.gravidade === "critica")
          ? "critica"
          : (divs.some(d => d.gravidade === "alta") ? "alta" : "media");

        const icone = piorGravidade === "critica" ? "🚨" : "⚠️";
        divBadge = `
          <button type="button" class="badge-divergencia ${piorGravidade} btn-ver-detalhe" data-id="${a.id_anuncio}" title="${divs[0].titulo}">
            ${icone} ${divs.length} ${divs.length > 1 ? "divergências" : "divergência"}
          </button>
        `;
      }

      // Coluna de Produtos Relacionados (Multi-item / Kit ou Unitário)
      let prodHtml = "";
      if (itens.length === 0) {
        prodHtml = `
          <span class="text-xs text-stone-400 italic">Não vinculado</span>
          <button type="button" class="btn-ghost text-xs py-0.5 px-1.5 ml-1 btn-ver-detalhe" data-id="${a.id_anuncio}">+ Compor</button>
        `;
      } else if (isMultiItem) {
        const totalPecas = itens.reduce((s, it) => s + it.quantidade_anunciada, 0);
        const resumoItens = calculo.componentes.slice(0, 2).map(c => `<strong>${c.quantidade_anunciada}x</strong> ${c.sku}`).join(" + ");
        const maisItens = calculo.componentes.length > 2 ? ` <span class="text-stone-400 font-normal">(+${calculo.componentes.length - 2})</span>` : "";

        prodHtml = `
          <div>
            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded">
                KIT (${totalPecas} un.)
              </span>
              <span class="text-xs text-stone-600 font-medium">${resumoItens}${maisItens}</span>
            </div>
            <div class="text-[11px] text-stone-500">
              Gargalo: <strong class="${calculo.estoqueDisponivel === 0 ? 'text-red-600' : 'text-stone-700'}">${calculo.gargalo?.sku || '—'}</strong> (${calculo.gargalo?.saldoFisico || 0} un.)
            </div>
          </div>
        `;
      } else {
        const c = calculo.componentes[0];
        prodHtml = `
          <div>
            <span class="sku-main">${c.sku}</span>
            <span class="sku-sub truncate max-w-[180px] block" title="${c.nome}">${c.nome}</span>
          </div>
        `;
      }

      // Estoque Disponível (com indicação se é baseado em gargalo de kit)
      let estoqueBadge = `<span class="font-semibold text-stone-700">${a.quantidade_disponivel} un.</span>`;
      if (isMultiItem) {
        estoqueBadge = `
          <div>
            <span class="font-semibold text-stone-700">${a.quantidade_disponivel} un. no ML</span>
            <div class="text-[11px] text-stone-500">Real: <strong class="${calculo.estoqueDisponivel < a.quantidade_disponivel ? 'text-amber-600' : 'text-emerald-700'}">${calculo.estoqueDisponivel} kits</strong></div>
          </div>
        `;
      }

      // Status de Certificação Inmetro do Anúncio
      const certStatus = window.RezFireCertificados
        ? window.RezFireCertificados.obterStatus("anuncio", a.id_anuncio)
        : { possuiCertificado: false, quantidade: 0 };

      const certBadge = certStatus.possuiCertificado
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200" title="${certStatus.quantidade} documento(s) anexado(s) a este anúncio">🛡️ ${certStatus.quantidade} doc${certStatus.quantidade > 1 ? "s" : ""}</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200" title="Nenhum certificado vinculado diretamente ao anúncio">⚠️ Sem doc</span>`;

      return `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <img src="${a.thumbnail || 'https://via.placeholder.com/44'}" alt="Foto" class="thumb-preview" onerror="this.src='https://placehold.co/44x44/f4efe8/1a1412?text=ML'"/>
              <div>
                <a href="#" class="btn-ver-detalhe font-bold text-xs text-stone-900 hover:text-orange-600 block line-clamp-2 max-w-[280px]" data-id="${a.id_anuncio}">
                  ${a.titulo}
                </a>
                <span class="text-[11px] text-stone-400">${a.tipo_anuncio || "Clássico"} · ${a.condicao || "Novo"}</span>
              </div>
            </div>
          </td>
          <td>
            <span class="font-mono text-xs font-semibold text-stone-700">${a.ml_item_id}</span>
          </td>
          <td>${prodHtml}</td>
          <td>
            <span class="font-bold text-stone-900">${money(a.preco)}</span>
          </td>
          <td>${estoqueBadge}</td>
          <td>
            <span class="text-xs text-stone-600">${Number(a.visualizacoes || 0).toLocaleString("pt-BR")}</span>
          </td>
          <td>
            <span class="text-xs font-bold text-stone-800">${Number(a.quantidade_vendida || 0).toLocaleString("pt-BR")}</span>
          </td>
          <td style="white-space: nowrap;">
            <div class="flex flex-col gap-1 items-start">
              ${statusBadge}
              ${certBadge}
            </div>
          </td>
          <td>${divBadge}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn-ghost text-xs px-2.5 py-1 btn-ver-detalhe" data-id="${a.id_anuncio}">
              Ver Detalhes
            </button>
          </td>
        </tr>
      `;
    }).join("");

    renderPaginacao(total, totalPaginas);
    bindBotoesDetalhes();
  }

  function renderPaginacao(total, totalPaginas) {
    const info = document.getElementById("paginacao-info");
    const container = document.getElementById("paginacao-botoes");
    if (!info || !container) return;

    if (total === 0) {
      info.textContent = "Nenhum anúncio";
      container.innerHTML = "";
      return;
    }

    const p = state.paginacao;
    const inicio = (p.paginaAtual - 1) * p.itensPorPagina + 1;
    const fim = Math.min(p.paginaAtual * p.itensPorPagina, total);

    info.textContent = `Exibindo ${inicio}–${fim} de ${total} anúncios`;

    let botoes = `
      <button type="button" class="btn-ghost text-xs px-2 py-1" id="btn-pag-prev" ${p.paginaAtual === 1 ? "disabled" : ""}>
        ◀ Anterior
      </button>
    `;

    for (let i = 1; i <= totalPaginas; i++) {
      const active = i === p.paginaAtual ? "bg-stone-900 text-white font-bold" : "btn-ghost";
      botoes += `
        <button type="button" class="text-xs px-2.5 py-1 rounded ${active} btn-pag-num" data-page="${i}">
          ${i}
        </button>
      `;
    }

    botoes += `
      <button type="button" class="btn-ghost text-xs px-2 py-1" id="btn-pag-next" ${p.paginaAtual === totalPaginas ? "disabled" : ""}>
        Próxima ▶
      </button>
    `;

    container.innerHTML = botoes;

    document.getElementById("btn-pag-prev")?.addEventListener("click", () => {
      if (p.paginaAtual > 1) {
        p.paginaAtual--;
        renderTabela();
      }
    });

    document.getElementById("btn-pag-next")?.addEventListener("click", () => {
      if (p.paginaAtual < totalPaginas) {
        p.paginaAtual++;
        renderTabela();
      }
    });

    container.querySelectorAll(".btn-pag-num").forEach((btn) => {
      btn.addEventListener("click", () => {
        p.paginaAtual = Number(btn.dataset.page);
        renderTabela();
      });
    });
  }

  function renderSkeleton() {
    const tbody = document.getElementById("anuncios-body");
    if (!tbody) return;

    tbody.innerHTML = Array.from({ length: 5 }).map(() => `
      <tr class="skeleton-row">
        <td><div class="skeleton-box w-48"></div></td>
        <td><div class="skeleton-box w-24"></div></td>
        <td><div class="skeleton-box w-32"></div></td>
        <td><div class="skeleton-box w-16"></div></td>
        <td><div class="skeleton-box w-16"></div></td>
        <td><div class="skeleton-box w-12"></div></td>
        <td><div class="skeleton-box w-12"></div></td>
        <td><div class="skeleton-box w-16"></div></td>
        <td><div class="skeleton-box w-20"></div></td>
        <td><div class="skeleton-box w-16 ml-auto"></div></td>
      </tr>
    `).join("");
  }

  function renderErroTabela(msg) {
    const tbody = document.getElementById("anuncios-body");
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="padding: 30px; text-align: center; color: #dc2626;">
          <strong>Erro:</strong> ${msg}
          <div class="mt-2">
            <button type="button" class="btn-primary" onclick="location.reload()" style="padding: 4px 12px; font-size: 0.75rem;">
              Tentar Novamente
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function bindBotoesDetalhes() {
    document.querySelectorAll(".btn-ver-detalhe").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const id = Number(el.dataset.id);
        const item = state.anuncios.find((a) => a.id_anuncio === id);
        if (item) abrirDrawer(item);
      });
    });
  }

  /**
   * Abre o Drawer Lateral e inicializa o editor de composição multi-item
   */
  function abrirDrawer(anuncio) {
    state.anuncioSelecionado = anuncio;
    // Clona os itens do anúncio para a sessão de edição local no drawer
    state.itensEdicaoComposicao = window.RezFireAnuncios.extrairItensAnuncio(anuncio);

    const drawer = document.getElementById("anuncio-drawer");
    const overlay = document.getElementById("anuncio-drawer-overlay");
    if (!drawer || !overlay) return;

    // Header
    document.getElementById("drawer-thumb").src = anuncio.thumbnail || "https://placehold.co/44x44/f4efe8/1a1412?text=ML";
    document.getElementById("drawer-titulo").textContent = anuncio.titulo;
    document.getElementById("drawer-mlb").textContent = anuncio.ml_item_id;
    document.getElementById("drawer-listing-type").textContent = anuncio.tipo_anuncio || "Clássico";

    const linkMl = document.getElementById("drawer-ml-link");
    if (linkMl) {
      linkMl.href = anuncio.permalink || `https://produto.mercadolivre.com.br/${anuncio.ml_item_id}`;
    }

    let statusCls = "encerrado";
    if (anuncio.status === "Ativo") statusCls = "ativo";
    else if (anuncio.status === "Pausado") statusCls = "pausado";
    document.getElementById("drawer-status-badge").innerHTML = `<span class="badge-anuncio-status ${statusCls}">${anuncio.status}</span>`;

    // Informações Comerciais
    document.getElementById("drawer-preco").textContent = money(anuncio.preco);
    document.getElementById("drawer-estoque-ml").textContent = `${anuncio.quantidade_disponivel} un.`;
    document.getElementById("drawer-condicao").textContent = anuncio.condicao || "Novo";
    document.getElementById("drawer-vendas").textContent = `${anuncio.quantidade_vendida || 0} un.`;
    document.getElementById("drawer-visitas").textContent = (anuncio.visualizacoes || 0).toLocaleString("pt-BR");

    const visitas = Number(anuncio.visualizacoes || 0);
    const vendas = Number(anuncio.quantidade_vendida || 0);
    const taxaConv = visitas > 0 ? ((vendas / visitas) * 100).toFixed(1) + "%" : "0.0%";
    document.getElementById("drawer-conversao").textContent = taxaConv;

    // Metadados
    document.getElementById("drawer-categoria").textContent = anuncio.categoria_ml || "Geral";
    document.getElementById("drawer-criacao").textContent = formatData(anuncio.data_criacao);
    document.getElementById("drawer-sync").textContent = formatData(anuncio.ultima_sincronizacao);

    // Renderiza o Editor de Composição Multi-Item no Drawer
    renderEditorComposicaoDrawer();

    // Renderiza a Seção de Certificados Inmetro do Anúncio e Componentes
    renderizarCertificadosDrawer(anuncio);

    // Diagnóstico de Divergências
    const divergencias = window.RezFireAnuncios.analisarDivergencias(anuncio, state.produtos);
    const divLista = document.getElementById("drawer-divergencias-lista");
    if (divLista) {
      if (divergencias.length === 0) {
        divLista.innerHTML = `
          <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <span style="font-size: 1.2rem;">✅</span>
            <div>
              <strong>Nenhuma divergência detectada!</strong>
              <div class="text-emerald-700 mt-0.5">O anúncio está com preço, estoque montável e composição alinhados com o RezFire.</div>
            </div>
          </div>
        `;
      } else {
        divLista.innerHTML = divergencias.map(d => `
          <div class="divergencia-card ${d.gravidade}">
            <div class="flex items-start justify-between">
              <strong class="text-xs text-stone-900 flex items-center gap-1.5">
                ${d.gravidade === "critica" ? "🚨" : "⚠️"} ${d.titulo}
              </strong>
              <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white text-stone-700 border border-stone-200">
                ${d.gravidade}
              </span>
            </div>
            <p class="text-xs text-stone-700 mt-1.5 leading-relaxed">${d.descricao}</p>
            <div class="text-[11px] font-mono text-stone-500 mt-1 bg-white p-1.5 rounded border border-stone-200">${d.detalhe}</div>
            <div class="mt-2 text-xs font-semibold text-orange-950 bg-orange-50 p-2 rounded border border-orange-200">
              💡 <strong>Ação recomendada:</strong> ${d.acaoRecomendada}
            </div>
          </div>
        `).join("");
      }
    }

    // Banner de Substituição / Herança de Anúncio Excluído (SCRUM-20 / #15)
    renderDrawerBannerRecriado(anuncio);

    // Fotos e Vídeos de Demonstração (SCRUM-26 / #23)
    renderizarMidiasDrawer(anuncio);

    // Histórico cronológico de ocorrências (SCRUM-19 / #14)
    renderDrawerHistorico(anuncio);

    overlay.classList.add("is-open");
    drawer.classList.add("is-open");
    drawer.focus();
  }

  /**
   * Renderiza o banner de reposicionamento/herança no Drawer Lateral (SCRUM-20 / #15)
   */
  function renderDrawerBannerRecriado(anuncio) {
    const el = document.getElementById("drawer-banner-recriado");
    if (!el) return;

    if (anuncio.foi_recriado) {
      el.style.display = "block";
      el.innerHTML = `
        <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900">
          <div class="flex items-center gap-2 font-bold mb-1">
            <span>🚨</span> Anúncio Excluído no ML → Substituído por <code>${anuncio.ml_item_id_substituto || 'Novo'}</code>
          </div>
          <div class="text-[11px] text-red-800 space-y-0.5">
            <div><strong>Tempo de Reposicionamento:</strong> ${anuncio.tempo_reposicionamento_dias ?? 0} dia(s)</div>
            <div><strong>Motivo:</strong> ${anuncio.motivo_exclusao || 'Exclusão pelo Mercado Livre.'}</div>
          </div>
        </div>
      `;
    } else if (anuncio.ml_item_id_origem) {
      el.style.display = "block";
      el.innerHTML = `
        <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
          <div class="flex items-center gap-2 font-bold mb-1">
            <span>🛡️</span> Anúncio Herdeiro ← Recriado do Anúncio <code>${anuncio.ml_item_id_origem}</code>
          </div>
          <div class="text-[11px] text-blue-800">
            Tempo de reposicionamento registrado: <strong>${anuncio.tempo_reposicionamento_dias ?? 0} dia(s)</strong>.
          </div>
        </div>
      `;
    } else {
      el.style.display = "none";
      el.innerHTML = "";
    }
  }

  /**
   * Renderiza a timeline cronológica de ocorrências do anúncio (SCRUM-19 / #14)
   */
  function renderDrawerHistorico(anuncio) {
    const histEl = document.getElementById("drawer-historico-lista");
    if (!histEl) return;

    const hist = anuncio.historico || [];
    if (hist.length === 0) {
      histEl.innerHTML = `<div class="text-stone-400 italic p-3 text-center bg-stone-50 rounded border border-stone-200">Nenhum evento registrado ainda.</div>`;
      return;
    }

    histEl.innerHTML = hist.map((h) => {
      let badgeCls = "bg-stone-100 text-stone-700 border-stone-200";
      const ev = (h.evento || "").toLowerCase();

      if (ev.includes("estoque") || ev.includes("pausa")) {
        badgeCls = "bg-red-100 text-red-800 border-red-200";
      } else if (ev.includes("preço") || ev.includes("preco")) {
        badgeCls = "bg-blue-100 text-blue-800 border-blue-200";
      } else if (ev.includes("recria") || ev.includes("exclus")) {
        badgeCls = "bg-purple-100 text-purple-800 border-purple-200";
      } else if (ev.includes("herdeiro") || ev.includes("sucessor") || ev.includes("reativa")) {
        badgeCls = "bg-emerald-100 text-emerald-800 border-emerald-200";
      } else if (ev.includes("advert") || ev.includes("modera") || ev.includes("aviso")) {
        badgeCls = "bg-amber-100 text-amber-800 border-amber-200";
      }

      return `
        <div class="p-2.5 bg-white border border-stone-200 rounded-lg shadow-sm">
          <div class="flex justify-between items-center text-[11px] mb-1">
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeCls}">
              ${h.evento || "Ocorrência"}
            </span>
            <span class="text-stone-400">${formatData(h.data)}</span>
          </div>
          ${h.titulo && h.titulo !== h.evento ? `
            <div class="text-xs font-bold text-stone-900 mt-1">${h.titulo}</div>
          ` : ""}
          <div class="text-xs text-stone-700 mt-0.5 leading-relaxed">${h.detalhe}</div>
          ${h.autor ? `
            <div class="text-[10px] text-stone-400 mt-1.5 flex items-center gap-1">
              <span>👤</span> ${h.autor}
            </div>
          ` : ""}
        </div>
      `;
    }).join("");
  }

  // ─── Modais de Ocorrência, Recriação e Relatórios (SCRUM-19 e SCRUM-20) ──────

  function openModalOcorrencia() {
    if (!state.anuncioSelecionado) return;
    const modal = document.getElementById("modal-nova-ocorrencia");
    const mlbEl = document.getElementById("modal-ocorrencia-mlb");
    const titEl = document.getElementById("oc-titulo");
    const detEl = document.getElementById("oc-detalhe");
    if (!modal) return;

    if (mlbEl) mlbEl.textContent = state.anuncioSelecionado.ml_item_id;
    if (titEl) titEl.value = "";
    if (detEl) detEl.value = "";

    modal.classList.add("is-open");
  }

  function closeModalOcorrencia() {
    const modal = document.getElementById("modal-nova-ocorrencia");
    if (modal) modal.classList.remove("is-open");
  }

  async function salvarModalOcorrencia(e) {
    e.preventDefault();
    if (!state.anuncioSelecionado) return;

    const tipo_evento = document.getElementById("oc-tipo-evento")?.value;
    const titulo = document.getElementById("oc-titulo")?.value.trim();
    const detalhe = document.getElementById("oc-detalhe")?.value.trim();

    if (!tipo_evento || !titulo || !detalhe) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const payload = {
      tipo_evento,
      titulo,
      detalhe,
      autor: "Gestor RezFire",
      data_ocorrencia: new Date().toISOString(),
    };

    try {
      if (window.RezFireAPI && state.anuncioSelecionado.id_anuncio) {
        await window.RezFireAPI.anuncios.adicionarOcorrencia(state.anuncioSelecionado.id_anuncio, payload);
      }

      if (window.RezFireAnuncios) {
        window.RezFireAnuncios.adicionarOcorrencia(state.anuncioSelecionado.id_anuncio, payload);
      }

      state.anuncioSelecionado.historico = state.anuncioSelecionado.historico || [];
      state.anuncioSelecionado.historico.unshift(payload);

      renderDrawerHistorico(state.anuncioSelecionado);
      closeModalOcorrencia();
      showToast("Ocorrência registrada no histórico do anúncio!");
    } catch (err) {
      console.error("[Anúncios] Erro ao salvar ocorrência:", err);
      alert("Erro ao salvar ocorrência: " + (err.message || err));
    }
  }

  function openModalRecriar() {
    if (!state.anuncioSelecionado) return;
    const modal = document.getElementById("modal-marcar-recriado");
    const mlbAntigo = document.getElementById("modal-recriado-mlb-antigo");
    const titAntigo = document.getElementById("modal-recriado-titulo-antigo");
    const mlbNovo = document.getElementById("rec-mlb-novo");
    const dExc = document.getElementById("rec-data-exclusao");
    const dRec = document.getElementById("rec-data-recriacao");
    const mot = document.getElementById("rec-motivo");
    if (!modal) return;

    if (mlbAntigo) mlbAntigo.textContent = state.anuncioSelecionado.ml_item_id;
    if (titAntigo) titAntigo.textContent = state.anuncioSelecionado.titulo;
    if (mlbNovo) mlbNovo.value = "";
    if (mot) mot.value = "";

    const hoje = new Date().toISOString().split("T")[0];
    if (dExc) dExc.value = hoje;
    if (dRec) dRec.value = hoje;

    modal.classList.add("is-open");
  }

  function closeModalRecriar() {
    const modal = document.getElementById("modal-marcar-recriado");
    if (modal) modal.classList.remove("is-open");
  }

  async function salvarModalRecriar(e) {
    e.preventDefault();
    if (!state.anuncioSelecionado) return;

    const mlbNovo = document.getElementById("rec-mlb-novo")?.value.trim();
    const dataExclusao = document.getElementById("rec-data-exclusao")?.value;
    const dataRecriacao = document.getElementById("rec-data-recriacao")?.value;
    const motivo = document.getElementById("rec-motivo")?.value.trim();

    if (!mlbNovo || !dataExclusao || !dataRecriacao || !motivo) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const payload = {
      ml_item_id_novo: mlbNovo,
      data_exclusao: dataExclusao,
      data_recriacao: dataRecriacao,
      motivo_exclusao: motivo,
    };

    try {
      if (window.RezFireAPI && state.anuncioSelecionado.id_anuncio) {
        await window.RezFireAPI.anuncios.marcarRecriado(state.anuncioSelecionado.id_anuncio, payload);
      }

      if (window.RezFireAnuncios) {
        window.RezFireAnuncios.marcarRecriado(state.anuncioSelecionado.id_anuncio, payload);
      }

      const diffMs = Math.max(0, new Date(dataRecriacao).getTime() - new Date(dataExclusao).getTime());
      const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));

      state.anuncioSelecionado.foi_recriado = true;
      state.anuncioSelecionado.status = "Excluído";
      state.anuncioSelecionado.motivo_exclusao = motivo;
      state.anuncioSelecionado.data_exclusao = dataExclusao;
      state.anuncioSelecionado.data_recriacao = dataRecriacao;
      state.anuncioSelecionado.tempo_reposicionamento_dias = dias;
      state.anuncioSelecionado.ml_item_id_substituto = mlbNovo;

      renderDrawerBannerRecriado(state.anuncioSelecionado);
      renderDrawerHistorico(state.anuncioSelecionado);
      renderTabela();
      closeModalRecriar();
      showToast(`Anúncio marcado como substituído! Tempo de reposicionamento: ${dias} dia(s).`);
    } catch (err) {
      console.error("[Anúncios] Erro ao registrar recriação:", err);
      alert("Erro ao registrar recriação: " + (err.message || err));
    }
  }

  async function openModalRelatorioRecriados() {
    const modal = document.getElementById("modal-relatorio-recriados");
    const totalEl = document.getElementById("stat-total-recriados");
    const mediaEl = document.getElementById("stat-media-reposicionamento");
    const tbody = document.getElementById("tbody-relatorio-recriados");
    if (!modal) return;

    let dados = null;
    if (window.RezFireAPI && typeof window.RezFireAPI.anuncios.listarRecriados === "function") {
      try {
        dados = await window.RezFireAPI.anuncios.listarRecriados();
      } catch (e) {
        console.warn("[Anúncios] Erro ao carregar relatório da API:", e);
      }
    }

    if (!dados && window.RezFireAnuncios) {
      dados = window.RezFireAnuncios.listarRecriados();
    }

    const total = dados?.total_recriados || 0;
    const media = dados?.media_tempo_reposicionamento_dias || 0;
    const lista = dados?.anuncios || [];

    if (totalEl) totalEl.textContent = String(total);
    if (mediaEl) mediaEl.textContent = `${media} dias`;

    if (tbody) {
      if (lista.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center p-4 text-stone-400">
              Nenhum anúncio excluído/recriado registrado no sistema.
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = lista.map((a) => `
          <tr class="border-b border-stone-100">
            <td class="p-2 font-mono font-bold text-red-700">${a.ml_item_id || a.ml_item_id_antigo}</td>
            <td class="p-2 font-mono font-bold text-emerald-700">${a.ml_item_id_substituto || a.ml_item_id_novo || '—'}</td>
            <td class="p-2 font-semibold text-stone-800">${a.tempo_reposicionamento_dias ?? 0} dia(s)</td>
            <td class="p-2 text-stone-600">${a.motivo_exclusao || '—'}</td>
            <td class="p-2 text-stone-400">${formatData(a.data_exclusao)}</td>
          </tr>
        `).join("");
      }
    }

    modal.classList.add("is-open");
  }

  function closeModalRelatorioRecriados() {
    const modal = document.getElementById("modal-relatorio-recriados");
    if (modal) modal.classList.remove("is-open");
  }

  // ─── Fotos e Vídeos de Demonstração (SCRUM-26 / #23) ────────────────────────

  /**
   * Converte URLs comuns de vídeo (YouTube, Vimeo) para embed ou retorna a URL direta.
   */
  function converterParaEmbedVideo(url) {
    if (!url) return "";
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
    }
    const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/i);
    if (vimeoMatch && vimeoMatch[3]) {
      return `https://player.vimeo.com/video/${vimeoMatch[3]}?autoplay=1`;
    }
    return url;
  }

  /**
   * Renderiza a galeria de fotos e vídeos no Drawer Lateral
   */
  function renderizarMidiasDrawer(anuncio) {
    const container = document.getElementById("drawer-midias-lista");
    if (!container) return;

    const midias = (anuncio && Array.isArray(anuncio.midias)) ? anuncio.midias : [];
    if (midias.length === 0) {
      container.innerHTML = `
        <div class="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-500 text-center">
          Nenhuma foto ou vídeo cadastrado. Adicione para enriquecer a apresentação visual do extintor.
        </div>
      `;
      return;
    }

    const midiasOrdenadas = [...midias].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    container.innerHTML = `
      <div class="grid grid-cols-2 gap-2">
        ${midiasOrdenadas.map((m) => {
          const isVideo = (m.tipo || "").toUpperCase() === "VIDEO";
          const iconBadge = isVideo
            ? `<span class="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">▶ VÍDEO</span>`
            : `<span class="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">📷 FOTO</span>`;

          const thumbSrc = isVideo
            ? "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=300&auto=format&fit=crop&q=60"
            : m.url;

          return `
            <div class="card p-2 bg-stone-50 border border-stone-200 rounded flex flex-col justify-between hover:border-amber-400 transition-colors">
              <div class="relative w-full h-24 bg-stone-900 rounded overflow-hidden flex items-center justify-center mb-1.5 cursor-pointer btn-ver-midia" data-id="${m.id_midia}">
                <img src="${thumbSrc}" alt="${m.rotulo}" class="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" onerror="this.src='https://placehold.co/120x80/292524/fafaf9?text=Midia'" />
                <div class="absolute top-1 left-1">${iconBadge}</div>
                ${isVideo ? `<div class="absolute inset-0 flex items-center justify-center bg-black/40"><span class="text-white text-xl">▶</span></div>` : ""}
              </div>
              <div>
                <div class="text-[11px] font-bold text-stone-800 line-clamp-1" title="${m.rotulo}">${m.rotulo}</div>
                <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-stone-200">
                  <button type="button" class="btn-ghost text-[10px] py-0.5 px-1.5 text-stone-700 btn-ver-midia" data-id="${m.id_midia}">
                    ${isVideo ? "Assistir ▶" : "Ampliar 🔍"}
                  </button>
                  <button type="button" class="btn-ghost text-[10px] py-0.5 px-1.5 text-red-600 hover:bg-red-50 btn-remover-midia" data-id="${m.id_midia}" title="Excluir mídia">
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    container.querySelectorAll(".btn-ver-midia").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idMidia = Number(btn.dataset.id);
        const midia = midias.find((m) => m.id_midia === idMidia);
        if (midia) openModalVisualizadorMidia(midia);
      });
    });

    container.querySelectorAll(".btn-remover-midia").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idMidia = Number(btn.dataset.id);
        removerMidiaAnuncio(idMidia);
      });
    });
  }

  function openModalAdicionarMidia() {
    if (!state.anuncioSelecionado) return;
    const modal = document.getElementById("modal-adicionar-midia");
    const tipo = document.getElementById("midia-form-tipo");
    const rotulo = document.getElementById("midia-form-rotulo");
    const url = document.getElementById("midia-form-url");
    const ordem = document.getElementById("midia-form-ordem");
    if (!modal) return;

    if (tipo) tipo.value = "FOTO";
    if (rotulo) rotulo.value = "";
    if (url) url.value = "";
    if (ordem) ordem.value = ((state.anuncioSelecionado.midias || []).length + 1).toString();

    modal.classList.add("is-open");
    modal.style.display = "flex";
  }

  function closeModalAdicionarMidia() {
    const modal = document.getElementById("modal-adicionar-midia");
    if (modal) {
      modal.classList.remove("is-open");
      modal.style.display = "none";
    }
  }

  async function salvarModalAdicionarMidia(e) {
    e.preventDefault();
    if (!state.anuncioSelecionado) return;

    const tipo = document.getElementById("midia-form-tipo")?.value || "FOTO";
    const rotulo = document.getElementById("midia-form-rotulo")?.value.trim();
    const url = document.getElementById("midia-form-url")?.value.trim();
    const ordem = Number(document.getElementById("midia-form-ordem")?.value || 0);

    if (!rotulo || !url) {
      alert("Por favor, preencha o rótulo e a URL da mídia.");
      return;
    }

    const payload = {
      tipo,
      rotulo,
      url,
      ordem
    };

    try {
      let novaMidia = null;
      if (window.RezFireAPI && typeof window.RezFireAPI.anuncios?.adicionarMidia === "function") {
        try {
          const res = await window.RezFireAPI.anuncios.adicionarMidia(state.anuncioSelecionado.id_anuncio, payload);
          if (res && res.sucesso && res.midia) novaMidia = res.midia;
        } catch (apiErr) {
          console.warn("[Anúncios] Backend indisponível para salvar mídia, usando fallback local:", apiErr);
        }
      }

      if (!novaMidia && window.RezFireAnuncios) {
        novaMidia = window.RezFireAnuncios.adicionarMidia(state.anuncioSelecionado.id_anuncio, payload);
      }

      if (novaMidia) {
        state.anuncioSelecionado.midias = state.anuncioSelecionado.midias || [];
        state.anuncioSelecionado.midias.push(novaMidia);
      }

      renderizarMidiasDrawer(state.anuncioSelecionado);
      closeModalAdicionarMidia();
      showToast(`${tipo === "VIDEO" ? "Vídeo demonstrativo" : "Foto"} anexada com sucesso!`);
    } catch (err) {
      console.error("[Anúncios] Erro ao anexar mídia:", err);
      alert("Erro ao anexar mídia: " + (err.message || err));
    }
  }

  async function removerMidiaAnuncio(idMidia) {
    if (!state.anuncioSelecionado) return;
    if (!confirm("Deseja realmente remover esta mídia do anúncio?")) return;

    try {
      if (window.RezFireAPI && typeof window.RezFireAPI.anuncios?.removerMidia === "function") {
        try {
          await window.RezFireAPI.anuncios.removerMidia(state.anuncioSelecionado.id_anuncio, idMidia);
        } catch (apiErr) {
          console.warn("[Anúncios] Backend indisponível para remover mídia, usando fallback local:", apiErr);
        }
      }

      if (window.RezFireAnuncios) {
        window.RezFireAnuncios.removerMidia(state.anuncioSelecionado.id_anuncio, idMidia);
      }

      state.anuncioSelecionado.midias = (state.anuncioSelecionado.midias || []).filter(
        (m) => m.id_midia !== Number(idMidia)
      );

      renderizarMidiasDrawer(state.anuncioSelecionado);
      showToast("Mídia removida com sucesso!");
    } catch (err) {
      console.error("[Anúncios] Erro ao remover mídia:", err);
      alert("Erro ao remover mídia: " + (err.message || err));
    }
  }

  function openModalVisualizadorMidia(midia) {
    const modal = document.getElementById("modal-visualizador-midia");
    const container = document.getElementById("visualizador-conteudo");
    const legendaEl = document.getElementById("visualizador-legenda");
    const linkEl = document.getElementById("visualizador-link-externo");
    const titleEl = document.getElementById("modal-player-title");
    if (!modal || !container) return;

    const isVideo = (midia.tipo || "").toUpperCase() === "VIDEO";
    if (titleEl) {
      titleEl.innerHTML = isVideo ? "▶ Vídeo Demonstrativo do Produto" : "📷 Visualização em Alta Resolução";
    }

    if (legendaEl) legendaEl.textContent = midia.rotulo || "Sem descrição";
    if (linkEl) {
      linkEl.href = midia.url;
      linkEl.style.display = midia.url ? "inline-flex" : "none";
    }

    if (isVideo) {
      const embedUrl = converterParaEmbedVideo(midia.url);
      if (embedUrl.includes("youtube.com/embed") || embedUrl.includes("player.vimeo.com")) {
        container.innerHTML = `
          <iframe src="${embedUrl}" class="w-full aspect-video border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="min-height:380px;width:100%"></iframe>
        `;
      } else {
        container.innerHTML = `
          <video controls autoplay class="w-full max-h-[460px] bg-black">
            <source src="${midia.url}" type="video/mp4">
            Seu navegador não suporta a reprodução deste vídeo.
          </video>
        `;
      }
    } else {
      container.innerHTML = `
        <img src="${midia.url}" alt="${midia.rotulo}" class="max-h-[500px] max-w-full object-contain p-2" onerror="this.src='https://placehold.co/600x400/292524/fafaf9?text=Imagem+N%C3%A3o+Dispon%C3%ADvel'" />
      `;
    }

    modal.classList.add("is-open");
    modal.style.display = "flex";
  }

  function closeModalVisualizadorMidia() {
    const modal = document.getElementById("modal-visualizador-midia");
    const container = document.getElementById("visualizador-conteudo");
    if (container) container.innerHTML = "";
    if (modal) {
      modal.classList.remove("is-open");
      modal.style.display = "none";
    }
  }

  /**
   * Renderiza a seção de Certificados Inmetro específicos do Anúncio
   * e a referência cruzada dos certificados dos produtos físicos componentes.
   */
  function renderizarCertificadosDrawer(anuncio) {
    if (!anuncio) return;
    const certContainer = document.getElementById("drawer-certificados-container");
    const compContainer = document.getElementById("drawer-certificados-produtos-componentes");

    // 1. Gerenciador de Certificados vinculados DIRETAMENTE ao anúncio
    if (certContainer && window.RezFireCertificados) {
      window.RezFireCertificados.renderizarGerenciadorCertificados(certContainer, {
        tipoEntidade: "anuncio",
        entidadeId: anuncio.id_anuncio,
        titulo: "Documentos de Certificação do Anúncio (ML)",
        subtitulo: "Centralize os certificados e selos Inmetro específicos para comprovação deste anúncio no Mercado Livre.",
        registroInmetroPadrao: "",
        modo: "completo",
      });
    }

    // 2. Referência Cruzada: Certificados dos Produtos Físicos Componentes
    if (compContainer && window.RezFireCertificados) {
      const itens = window.RezFireAnuncios.extrairItensAnuncio(anuncio);
      if (itens.length === 0) {
        compContainer.innerHTML = "";
        return;
      }

      const itensComStatus = itens.map((it) => {
        const prod = state.produtos.find((p) => p.id_produto === it.id_produto);
        const status = window.RezFireCertificados.obterStatus("produto", it.id_produto);
        return { it, prod, status };
      });

      compContainer.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-top: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.9rem;">📦</span>
              <strong style="font-size: 0.76rem; text-transform: uppercase; color: #475569; letter-spacing: 0.04em;">
                Certificação dos Produtos Componentes (${itensComStatus.length})
              </strong>
            </div>
            <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 500;">Catálogo RezFire</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${itensComStatus.map(({ it, prod, status }) => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.78rem;">
                <div style="min-width: 0; padding-right: 8px;">
                  <strong style="color: #0f172a;">${prod ? prod.sku : "Produto #" + it.id_produto}</strong>
                  <span style="color: #64748b; margin-left: 6px;">${prod ? prod.nome : "Desconhecido"}</span>
                  ${prod && prod.detalhes_extintor && prod.detalhes_extintor.registro_inmetro ? `
                    <span style="font-family: monospace; font-size: 0.7rem; color: #1e40af; background: #eff6ff; padding: 1px 5px; border-radius: 4px; margin-left: 6px;">
                      Reg: ${prod.detalhes_extintor.registro_inmetro}
                    </span>
                  ` : ""}
                </div>
                <div style="flex-shrink: 0;">
                  ${status.possuiCertificado ? `
                    <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200" title="Possui ${status.quantidade} documento(s) no cadastro do produto">
                      ✓ ${status.quantidade} doc${status.quantidade > 1 ? "s" : ""} no produto
                    </span>
                  ` : `
                    <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title="O produto físico componente não possui documentos anexados no catálogo">
                      ⚠️ Sem cert. no produto
                    </span>
                  `}
                </div>
              </div>
            `).join("")}
          </div>
          <div style="margin-top: 8px; font-size: 0.71rem; color: #64748b; line-height: 1.35;">
            ℹ️ <strong>Isolamento operacional:</strong> Documentos vinculados ao anúncio comprovam o conjunto publicado no Mercado Livre. A remoção de documentos do anúncio não altera a documentação dos produtos no catálogo.
          </div>
        </div>
      `;
    }
  }

  /**
   * Renderiza a seção de Composição Multi-Item (tabela produto_anuncio) no Drawer
   */
  function renderEditorComposicaoDrawer() {
    const container = document.getElementById("drawer-produto-info");
    const vinculoStatus = document.getElementById("drawer-vinculo-status");
    const selectAdd = document.getElementById("drawer-select-produto");
    if (!container) return;

    // Preenche select para adicionar novos itens à composição
    if (selectAdd) {
      selectAdd.innerHTML = `
        <option value="">+ Selecionar produto para adicionar ao kit...</option>
        ${state.produtos.map(p => `
          <option value="${p.id_produto}">${p.sku} — ${p.nome} (Saldo: ${p.quantidade_atual} un.)</option>
        `).join("")}
      `;
    }

    const anuncioTemp = {
      ...state.anuncioSelecionado,
      itens_anuncio: state.itensEdicaoComposicao
    };

    const calculo = window.RezFireAnuncios.calcularEstoqueDinamicoAnuncio(anuncioTemp, state.produtos);

    if (state.itensEdicaoComposicao.length === 0) {
      vinculoStatus.innerHTML = `<span class="text-amber-700 font-bold">⚠️ Sem Produtos Vinculados</span>`;
      container.innerHTML = `
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 mb-3">
          Este anúncio não possui itens cadastrados. Adicione um ou mais produtos abaixo para que o RezFire calcule automaticamente a disponibilidade e as baixas de estoque.
        </div>
      `;
      return;
    }

    const isMultiItem = state.itensEdicaoComposicao.length > 1 || (state.itensEdicaoComposicao.length === 1 && state.itensEdicaoComposicao[0].quantidade_anunciada > 1);

    vinculoStatus.innerHTML = `
      <span class="text-emerald-700 font-bold">
        ✓ ${isMultiItem ? `Kit Multi-Item (${calculo.componentes.length} itens)` : "Produto Unitário Vinculado"}
      </span>
    `;

    // Renderiza lista interativa de componentes do anúncio
    let tabelaItens = `
      <div class="border border-stone-200 rounded-lg overflow-hidden bg-white mb-3">
        <table class="w-full text-xs text-left">
          <thead class="bg-stone-100 text-stone-600 font-bold border-b border-stone-200">
            <tr>
              <th class="p-2">PRODUTO / COMPONENTE</th>
              <th class="p-2 w-20">QTD / KIT</th>
              <th class="p-2">SALDO FÍSICO</th>
              <th class="p-2">MÁX KITS</th>
              <th class="p-2 text-right">REMOVER</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-200">
            ${calculo.componentes.map((c, idx) => `
              <tr class="${c.ehGargalo ? 'bg-red-50/50' : ''}">
                <td class="p-2">
                  <div class="font-bold text-stone-900 flex items-center gap-1.5">
                    ${c.sku}
                    ${c.ehGargalo ? '<span class="text-[10px] font-bold px-1.5 py-0.2 bg-red-100 text-red-700 rounded" title="Componente limitante do estoque deste anúncio">GARGALO</span>' : ''}
                  </div>
                  <div class="text-[11px] text-stone-500 truncate max-w-[200px]">${c.nome}</div>
                </td>
                <td class="p-2">
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value="${c.quantidade_anunciada}"
                    class="search-input p-1 text-center font-bold w-14 input-qtd-item"
                    data-index="${idx}"
                  />
                </td>
                <td class="p-2">
                  <span class="font-semibold ${c.saldoFisico === 0 ? 'text-red-600 font-bold' : 'text-stone-700'}">
                    ${c.saldoFisico} un.
                  </span>
                </td>
                <td class="p-2">
                  <span class="font-bold ${c.ehGargalo ? 'text-red-700' : 'text-stone-700'}">
                    ${c.maxKitsPossiveis} un.
                  </span>
                </td>
                <td class="p-2 text-right">
                  <button type="button" class="text-stone-400 hover:text-red-600 font-bold p-1 btn-remover-item" data-index="${idx}" title="Remover item da composição">
                    ✕
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <!-- Resumo do Cálculo Dinâmico de Estoque e Preço -->
      <div class="p-2.5 bg-stone-100 rounded-lg text-xs space-y-1 mb-2">
        <div class="flex justify-between items-center">
          <span class="text-stone-600">Estoque Máximo Montável (Gargalo: <strong>${calculo.gargalo?.sku || '—'}</strong>):</span>
          <strong class="text-sm ${calculo.estoqueDisponivel === 0 ? 'text-red-600' : 'text-stone-900'}">${calculo.estoqueDisponivel} kits disponíveis</strong>
        </div>
        <div class="flex justify-between items-center text-[11px] text-stone-500">
          <span>Soma dos Preços de Tabela dos Itens:</span>
          <strong>${money(calculo.precoTotalReferencia)}</strong>
        </div>
      </div>
    `;

    container.innerHTML = tabelaItens;

    // Listeners do editor de composição
    container.querySelectorAll(".input-qtd-item").forEach((input) => {
      input.addEventListener("change", (e) => {
        const idx = Number(e.target.dataset.index);
        const novaQtd = Math.max(1, Number(e.target.value || 1));
        state.itensEdicaoComposicao[idx].quantidade_anunciada = novaQtd;
        renderEditorComposicaoDrawer();
      });
    });

    container.querySelectorAll(".btn-remover-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        state.itensEdicaoComposicao.splice(idx, 1);
        renderEditorComposicaoDrawer();
      });
    });
  }

  function fecharDrawer() {
    state.anuncioSelecionado = null;
    state.itensEdicaoComposicao = [];
    document.getElementById("anuncio-drawer")?.classList.remove("is-open");
    document.getElementById("anuncio-drawer-overlay")?.classList.remove("is-open");
  }

  /**
   * Adiciona um produto à lista de edição do anúncio aberto
   */
  function adicionarProdutoComposicao() {
    const select = document.getElementById("drawer-select-produto");
    const idProd = select ? Number(select.value) : null;
    if (!idProd) return;

    // Se já estiver na composição, apenas incrementa a quantidade
    const existente = state.itensEdicaoComposicao.find((it) => it.id_produto === idProd);
    if (existente) {
      existente.quantidade_anunciada += 1;
    } else {
      state.itensEdicaoComposicao.push({
        id_produto: idProd,
        quantidade_anunciada: 1
      });
    }

    select.value = "";
    renderEditorComposicaoDrawer();
  }

  /**
   * Salva a composição completa (Multi-Item) do anúncio no armazenamento local e backend
   */
  async function salvarComposicaoAnuncio() {
    if (!state.anuncioSelecionado) return;

    try {
      // 1. Tenta persistir no backend via API se disponível
      if (window.RezFireAPI && window.RezFireAPI.mercadolivre && state.itensEdicaoComposicao.length > 0) {
        const primeiro = state.itensEdicaoComposicao[0];
        await window.RezFireAPI.mercadolivre.vincular(
          state.anuncioSelecionado.id_anuncio,
          primeiro.id_produto,
          primeiro.quantidade_anunciada || 1
        ).catch((err) => console.warn("Aviso ao vincular no backend:", err));
      }

      // 2. Atualiza localmente no módulo mock/cache
      if (window.RezFireAnuncios) {
        const atualizado = window.RezFireAnuncios.atualizarComposicaoAnuncio(
          state.anuncioSelecionado.id_anuncio,
          state.itensEdicaoComposicao
        );

        if (atualizado) {
          const idx = state.anuncios.findIndex((a) => a.id_anuncio === atualizado.id_anuncio);
          if (idx !== -1) {
            state.anuncios[idx] = { ...state.anuncios[idx], ...atualizado };
          }
          renderKPIs();
          renderAlertaAnuncios();
          renderTabela();
          abrirDrawer(atualizado); // re-renderiza drawer com novas divergências e estoque dinâmico
          showToast("Composição do anúncio atualizada com sucesso!");
        }
      }
    } catch (err) {
      console.error("Erro ao salvar composição do anúncio:", err);
      showFeedbackBanner("error", "Erro ao salvar composição do anúncio.");
    }
  }

  async function executarSincronizacaoManual() {
    if (state.sincronizando) return;
    state.sincronizando = true;

    const btn = document.getElementById("btn-sync-manual");
    const label = document.getElementById("sync-btn-label");
    const icon = document.getElementById("sync-btn-icon");

    if (btn) btn.disabled = true;
    if (label) label.textContent = "Sincronizando...";
    if (icon) icon.classList.add("animate-spin");
    renderSyncHeader();

    try {
      // 1. Aciona endpoint real do backend (POST /api/ml/sincronizar)
      if (window.RezFireAPI && window.RezFireAPI.mercadolivre) {
        try {
          await window.RezFireAPI.mercadolivre.sincronizar();
        } catch (apiErr) {
          console.warn("Backend ML sincronizar falhou, usando sincronização local:", apiErr);
        }
      }

      // 2. Aciona sincronização local / mock
      let resLocal = null;
      if (window.RezFireAnuncios) {
        resLocal = await window.RezFireAnuncios.syncAnuncios();
      }

      // 3. Recarrega dados completos (backend + local)
      await carregarDados();

      const timestamp = resLocal?.timestamp || new Date().toISOString();
      showFeedbackBanner("success", `Sincronização concluída com sucesso às ${formatData(timestamp)}. Anúncios e estoques atualizados.`);
    } catch (err) {
      showFeedbackBanner("error", "Erro ao comunicar com a API do Mercado Livre.");
    } finally {
      state.sincronizando = false;
      if (btn) btn.disabled = false;
      if (label) label.textContent = "Sincronizar Anúncios";
      if (icon) icon.classList.remove("animate-spin");
      renderSyncHeader();
    }
  }

  function showFeedbackBanner(tipo, msg) {
    const el = document.getElementById("sync-feedback-banner");
    if (!el) return;

    const isSuccess = tipo === "success";
    el.className = isSuccess ? "p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs flex justify-between items-center" : "p-3 bg-red-50 border border-red-300 text-red-800 rounded-lg text-xs flex justify-between items-center";
    el.innerHTML = `
      <div>${isSuccess ? "✅" : "❌"} ${msg}</div>
      <button type="button" class="text-stone-500 font-bold ml-3" onclick="this.parentElement.style.display='none'">✕</button>
    `;
    el.style.display = "flex";

    setTimeout(() => {
      if (el) el.style.display = "none";
    }, 6000);
  }

  function showToast(msg) {
    showFeedbackBanner("success", msg);
  }

  function limparFiltros() {
    state.filtros = {
      busca: "",
      produto: "todos",
      status: "todos",
      tipo: "todos",
      divergencia: "todos",
      categoria: "todos",
      certificados: "todos",
      ordenacao: "vendas_desc"
    };
    state.paginacao.paginaAtual = 1;

    document.getElementById("filtro-busca").value = "";
    document.getElementById("filtro-produto").value = "todos";
    document.getElementById("filtro-status").value = "todos";
    document.getElementById("filtro-tipo").value = "todos";
    document.getElementById("filtro-divergencia").value = "todos";
    document.getElementById("filtro-categoria").value = "todos";
    const filtroCert = document.getElementById("filtro-certificados-anuncio");
    if (filtroCert) filtroCert.value = "todos";
    document.getElementById("filtro-ordenacao").value = "vendas_desc";

    renderTabela();
  }
  window.limparFiltrosAnuncios = limparFiltros;

  function bindEvents() {
    document.getElementById("filtro-busca")?.addEventListener("input", (e) => {
      state.filtros.busca = e.target.value.trim();
      state.paginacao.paginaAtual = 1;
      renderTabela();
    });

    document.getElementById("filtro-produto")?.addEventListener("change", (e) => {
      state.filtros.produto = e.target.value;
      state.paginacao.paginaAtual = 1;
      renderTabela();
    });

    document.getElementById("filtro-tipo")?.addEventListener("change", (e) => {
      state.filtros.tipo = e.target.value;
      state.paginacao.paginaAtual = 1;
      renderTabela();
    });

    document.getElementById("filtro-status")?.addEventListener("change", (e) => {
      state.filtros.status = e.target.value;
      state.paginacao.paginaAtual = 1;
      renderTabela();
    });

    document.getElementById("filtro-certificados-anuncio")?.addEventListener("change", (e) => {
      state.filtros.certificados = e.target.value;
      state.paginacao.paginaAtual = 1;
      renderTabela();
    });

    document.getElementById("filtro-divergencia")?.addEventListener("change", (e) => {
      state.filtros.divergencia = e.target.value;
      state.paginacao.paginaAtual = 1;
      renderTabela();
    });

    document.getElementById("filtro-categoria")?.addEventListener("change", (e) => {
      state.filtros.categoria = e.target.value;
      state.paginacao.paginaAtual = 1;
      renderTabela();
    });

    document.getElementById("filtro-ordenacao")?.addEventListener("change", (e) => {
      state.filtros.ordenacao = e.target.value;
      renderTabela();
    });

    // Reatividade imediata quando certificados forem anexados ou desvinculados
    window.addEventListener("rezfire:certificados-mudaram", (e) => {
      renderTabela();
      if (state.anuncioSelecionado) {
        renderizarCertificadosDrawer(state.anuncioSelecionado);
      }
    });

    document.getElementById("filtro-categoria")?.addEventListener("change", (e) => {
      state.filtros.categoria = e.target.value;
      state.paginacao.paginaAtual = 1;
      renderTabela();
    });

    document.getElementById("filtro-ordenacao")?.addEventListener("change", (e) => {
      state.filtros.ordenacao = e.target.value;
      renderTabela();
    });

    document.getElementById("btn-limpar-filtros")?.addEventListener("click", limparFiltros);
    document.getElementById("btn-sync-manual")?.addEventListener("click", executarSincronizacaoManual);

    // Drawer events
    document.getElementById("btn-fechar-drawer")?.addEventListener("click", fecharDrawer);
    document.getElementById("anuncio-drawer-overlay")?.addEventListener("click", fecharDrawer);

    // Botões de Composição Multi-Item no Drawer
    document.getElementById("btn-add-item-composicao")?.addEventListener("click", adicionarProdutoComposicao);
    document.getElementById("btn-salvar-composicao")?.addEventListener("click", salvarComposicaoAnuncio);

    // Modal Nova Ocorrência (SCRUM-19 / #14)
    document.getElementById("btn-abrir-modal-ocorrencia")?.addEventListener("click", openModalOcorrencia);
    document.getElementById("btn-cancelar-modal-ocorrencia")?.addEventListener("click", closeModalOcorrencia);
    document.getElementById("form-nova-ocorrencia")?.addEventListener("submit", salvarModalOcorrencia);
    document.getElementById("modal-nova-ocorrencia")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-nova-ocorrencia") closeModalOcorrencia();
    });

    // Modal Marcar Recriado (SCRUM-20 / #15)
    document.getElementById("btn-abrir-modal-recriar")?.addEventListener("click", openModalRecriar);
    document.getElementById("btn-cancelar-modal-recriar")?.addEventListener("click", closeModalRecriar);
    document.getElementById("form-marcar-recriado")?.addEventListener("submit", salvarModalRecriar);
    document.getElementById("modal-marcar-recriado")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-marcar-recriado") closeModalRecriar();
    });

    // Modal Relatório de Anúncios Recriados (SCRUM-20 / #15)
    document.getElementById("btn-ver-recriados")?.addEventListener("click", openModalRelatorioRecriados);
    document.getElementById("btn-fechar-relatorio-recriados")?.addEventListener("click", closeModalRelatorioRecriados);
    document.getElementById("modal-relatorio-recriados")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-relatorio-recriados") closeModalRelatorioRecriados();
    });

    // Modais de Mídia: Adicionar Mídia & Visualizador / Player (SCRUM-26 / #23)
    document.getElementById("btn-abrir-modal-midia")?.addEventListener("click", openModalAdicionarMidia);
    document.getElementById("btn-fechar-modal-midia")?.addEventListener("click", closeModalAdicionarMidia);
    document.getElementById("btn-cancelar-midia")?.addEventListener("click", closeModalAdicionarMidia);
    document.getElementById("form-adicionar-midia")?.addEventListener("submit", salvarModalAdicionarMidia);
    document.getElementById("modal-adicionar-midia")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-adicionar-midia") closeModalAdicionarMidia();
    });

    document.getElementById("btn-fechar-visualizador-midia")?.addEventListener("click", closeModalVisualizadorMidia);
    document.getElementById("modal-visualizador-midia")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-visualizador-midia") closeModalVisualizadorMidia();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModalVisualizadorMidia();
        closeModalAdicionarMidia();
        if (state.anuncioSelecionado) {
          fecharDrawer();
        }
      }
    });

    window.addEventListener("storage", (e) => {
      if (e.key === "rezfire.anuncios" || e.key === "rezfire.produtos") {
        carregarDados();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
