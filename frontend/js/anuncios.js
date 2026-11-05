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
      state.produtos = window.RezFireData ? window.RezFireData.loadProducts() : [];
      state.anuncios = window.RezFireAnuncios ? window.RezFireAnuncios.loadAnuncios() : [];
      state.syncMeta = window.RezFireAnuncios ? window.RezFireAnuncios.loadSyncMeta() : {};

      preencherSelectsFiltro();
      renderSyncHeader();
      renderKPIs();
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

    const card = ({ accent, iconColor, icon, label, val, sublabel, tag }) => `
      <article class="kpi-card-modern ${accent}">
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
        tag: `<span class="kpi-mini-tag slate">Catálogo</span>`
      }),
      card({
        accent: "accent-active",
        iconColor: "emerald",
        icon: iconSvg.checkCircle,
        label: "Anúncios Ativos",
        val: String(k.ativos),
        sublabel: "No ar no ML",
        tag: `<span class="kpi-mini-tag emerald">${pctAtivos}%</span>`
      }),
      card({
        accent: "accent-paused",
        iconColor: "amber",
        icon: iconSvg.pauseCircle,
        label: "Pausados",
        val: String(k.pausados),
        sublabel: "Pausados no ML",
        tag: k.pausados > 0 ? `<span class="kpi-mini-tag amber">Standby</span>` : ""
      }),
      card({
        accent: "accent-closed",
        iconColor: "slate",
        icon: iconSvg.archive,
        label: "Encerrados",
        val: String(k.encerrados),
        sublabel: "Finalizados",
        tag: `<span class="kpi-mini-tag slate">Histórico</span>`
      }),
      card({
        accent: "accent-divergence",
        iconColor: k.comDivergencias > 0 ? "red" : "emerald",
        icon: iconSvg.alertTriangle,
        label: "Divergências",
        val: String(k.comDivergencias),
        sublabel: k.comDivergencias > 0 ? "Exigem atenção" : "Tudo alinhado",
        tag: divTag
      }),
      card({
        accent: "accent-sales",
        iconColor: "orange",
        icon: iconSvg.shoppingBag,
        label: "Vendas Totais",
        val: `${k.totalVendas.toLocaleString("pt-BR")}`,
        sublabel: `${k.totalVisualizacoes.toLocaleString("pt-BR")} visitas`,
        tag: `<span class="kpi-mini-tag emerald">un.</span>`
      }),
    ].join("");
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

      // 4. Filtro por Status
      if (f.status !== "todos" && a.status !== f.status) {
        return false;
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

      // Status Badge
      let statusCls = "encerrado";
      if (a.status === "Ativo") statusCls = "ativo";
      else if (a.status === "Pausado") statusCls = "pausado";
      const statusBadge = `<span class="badge-anuncio-status ${statusCls}">${a.status}</span>`;

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

    // Histórico de alterações
    const histEl = document.getElementById("drawer-historico-lista");
    if (histEl) {
      const hist = anuncio.historico || [];
      if (hist.length === 0) {
        histEl.innerHTML = `<div class="text-stone-400 italic">Nenhum evento registrado ainda.</div>`;
      } else {
        histEl.innerHTML = hist.map(h => `
          <div class="p-2 bg-white border border-stone-200 rounded">
            <div class="flex justify-between items-center text-[11px] text-stone-400">
              <strong class="text-stone-700">${h.evento}</strong>
              <span>${formatData(h.data)}</span>
            </div>
            <div class="text-xs text-stone-600 mt-0.5">${h.detalhe}</div>
          </div>
        `).join("");
      }
    }

    overlay.classList.add("is-open");
    drawer.classList.add("is-open");
    drawer.focus();
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
   * Salva a composição completa (Multi-Item) do anúncio no armazenamento local
   */
  function salvarComposicaoAnuncio() {
    if (!state.anuncioSelecionado) return;

    if (window.RezFireAnuncios) {
      const atualizado = window.RezFireAnuncios.atualizarComposicaoAnuncio(
        state.anuncioSelecionado.id_anuncio,
        state.itensEdicaoComposicao
      );

      if (atualizado) {
        state.anuncios = window.RezFireAnuncios.loadAnuncios();
        renderKPIs();
        renderTabela();
        abrirDrawer(atualizado); // re-renderiza drawer com novas divergências e estoque dinâmico
        showToast("Composição do anúncio atualizada com sucesso!");
      }
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
      const res = await window.RezFireAnuncios.syncAnuncios();
      state.anuncios = window.RezFireAnuncios.loadAnuncios();
      state.syncMeta = window.RezFireAnuncios.loadSyncMeta();

      renderSyncHeader();
      renderKPIs();
      renderTabela();

      showFeedbackBanner("success", `Sincronização manual concluída às ${formatData(res.timestamp)}. Anúncios e estoques atualizados.`);
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

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.anuncioSelecionado) {
        fecharDrawer();
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
