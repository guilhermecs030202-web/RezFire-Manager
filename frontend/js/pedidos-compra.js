/**
 * pedidos-compra.js
 * Controlador da Tela de Pedidos de Compra — RezFire Manager
 * Centraliza cotações, pedidos, recebimento de mercadorias e entrada no estoque.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'rezfire.pedidos_compra';

  // ── Dados de Contingência / Demonstração (Fallback Local) ─────────────────
  const DEFAULT_PEDIDOS_COMPRA = [
    {
      id: 1,
      numeroPedido: 'PC-2026-0001',
      idFornecedor: 1,
      fornecedor: {
        id: 1,
        razaoSocial: 'Resil Indústria e Comércio LTDA',
        nomeFantasia: 'Resil Extintores',
        cnpj: '11.222.333/0001-44',
        telefone: '(11) 4002-8922',
        email: 'comercial@resil.com.br',
      },
      dataEmissao: '2026-11-05T09:00:00Z',
      dataPrevisaoEntrega: '2026-11-10T00:00:00Z',
      dataRecebimento: '2026-11-10T14:30:00Z',
      condicoesPagamento: '28 DDL faturado',
      status: 'RECEBIDO',
      atrasado: false,
      valorTotal: 4850.0,
      valorFrete: 150.0,
      valorDesconto: 0.0,
      observacoes: 'Remessa de cilindros automotivos para reposição de fim de ano.',
      motivoCancelamento: null,
      itens: [
        {
          id: 1,
          idProduto: 1,
          produto: { id: 1, sku: 'EXT-ABC-01KG', nome: 'Extintor ABC 1kg Automotivo' },
          quantidadePedida: 100,
          quantidadeEntregue: 100,
          quantidadePendente: 0,
          precoUnitario: 38.5,
          subtotal: 3850.0,
        },
        {
          id: 2,
          idProduto: 2,
          produto: { id: 2, sku: 'EXT-ABC-04KG', nome: 'Extintor ABC 4kg Predial' },
          quantidadePedida: 12,
          quantidadeEntregue: 12,
          quantidadePendente: 0,
          precoUnitario: 70.83,
          subtotal: 850.0,
        },
      ],
      createdAt: '2026-11-05T09:00:00Z',
      updatedAt: '2026-11-10T14:30:00Z',
    },
    {
      id: 2,
      numeroPedido: 'PC-2026-0002',
      idFornecedor: 2,
      fornecedor: {
        id: 2,
        razaoSocial: 'Bucka Spiero Indústria e Comércio LTDA',
        nomeFantasia: 'Bucka Incêndio',
        cnpj: '22.333.444/0001-55',
        telefone: '(11) 3214-5500',
        email: 'contato@bucka.com.br',
      },
      dataEmissao: '2026-11-12T10:30:00Z',
      dataPrevisaoEntrega: '2026-11-19T00:00:00Z',
      dataRecebimento: '2026-11-18T16:00:00Z',
      condicoesPagamento: '30/60 DDL',
      status: 'PARCIAL',
      atrasado: false,
      valorTotal: 5680.0,
      valorFrete: 0.0,
      valorDesconto: 0.0,
      observacoes: 'Extintores industriais de CO2 para clientes corporativos.',
      motivoCancelamento: null,
      itens: [
        {
          id: 3,
          idProduto: 3,
          produto: { id: 3, sku: 'EXT-CO2-06KG', nome: 'Extintor CO2 6kg Industrial' },
          quantidadePedida: 40,
          quantidadeEntregue: 25,
          quantidadePendente: 15,
          precoUnitario: 142.0,
          subtotal: 5680.0,
        },
      ],
      createdAt: '2026-11-12T10:30:00Z',
      updatedAt: '2026-11-18T16:00:00Z',
    },
    {
      id: 3,
      numeroPedido: 'PC-2026-0003',
      idFornecedor: 3,
      fornecedor: {
        id: 3,
        razaoSocial: 'Extinpel Componentes Contra Incêndio EIRELI',
        nomeFantasia: 'Extinpel Brasil',
        cnpj: '33.444.555/0001-66',
        telefone: '(41) 3345-8899',
        email: 'pedidos@extinpel.com.br',
      },
      dataEmissao: '2026-11-16T11:00:00Z',
      dataPrevisaoEntrega: '2026-11-20T00:00:00Z',
      dataRecebimento: null,
      condicoesPagamento: 'À vista via PIX (3% desc)',
      status: 'ABERTO',
      atrasado: true,
      valorTotal: 1850.0,
      valorFrete: 50.0,
      valorDesconto: 0.0,
      observacoes: 'Válvulas e manômetros de reposição para recarga interna.',
      motivoCancelamento: null,
      itens: [
        {
          id: 4,
          idProduto: 5,
          produto: { id: 5, sku: 'MAN-01', nome: 'Manômetro de Pressão Homologado' },
          quantidadePedida: 50,
          quantidadeEntregue: 0,
          quantidadePendente: 50,
          precoUnitario: 18.0,
          subtotal: 900.0,
        },
        {
          id: 5,
          idProduto: 6,
          produto: { id: 6, sku: 'VAL-01', nome: 'Válvula de Latão 1/2 Pol' },
          quantidadePedida: 30,
          quantidadeEntregue: 0,
          quantidadePendente: 30,
          precoUnitario: 30.0,
          subtotal: 900.0,
        },
      ],
      createdAt: '2026-11-16T11:00:00Z',
      updatedAt: '2026-11-16T11:00:00Z',
    },
    {
      id: 4,
      numeroPedido: 'PC-2026-0004',
      idFornecedor: 4,
      fornecedor: {
        id: 4,
        razaoSocial: 'Sinalize Placas e Acessórios LTDA',
        nomeFantasia: 'Sinalize Placas',
        cnpj: '44.555.666/0001-77',
        telefone: '(11) 2955-1234',
        email: 'vendas@sinalize.com.br',
      },
      dataEmissao: '2026-11-20T14:00:00Z',
      dataPrevisaoEntrega: '2026-11-27T00:00:00Z',
      dataRecebimento: null,
      condicoesPagamento: '21 DDL',
      status: 'RASCUNHO',
      atrasado: false,
      valorTotal: 1200.0,
      valorFrete: 80.0,
      valorDesconto: 30.0,
      observacoes: 'Cotação de suportes de solo e placas fotoluminescentes.',
      motivoCancelamento: null,
      itens: [
        {
          id: 6,
          idProduto: 7,
          produto: { id: 7, sku: 'SUP-SOLO-01', nome: 'Suporte de Chão Triplo' },
          quantidadePedida: 25,
          quantidadeEntregue: 0,
          quantidadePendente: 25,
          precoUnitario: 46.0,
          subtotal: 1150.0,
        },
      ],
      createdAt: '2026-11-20T14:00:00Z',
      updatedAt: '2026-11-20T14:00:00Z',
    },
  ];

  // ── Estado da Tela ────────────────────────────────────────────────────────
  const state = {
    paginaAtual: 1,
    limite: 10,
    busca: '',
    status: 'ALL',
    supplierId: '',
    from: '',
    to: '',
    sortBy: 'dataEmissao',
    sortOrder: 'DESC',
    totalRegistros: 0,
    totalPaginas: 1,
    pedidos: [],
    pedidoSelecionado: null,
    pedidoParaReceber: null,
    pedidoParaCancelar: null,
    fornecedoresAtivos: [],
    catalogoProdutos: [],
    custosFornecedorMap: {}, // idProduto -> custoCompra
    linhasItensModal: [], // itens no modal de criação
    debounceTimer: null,
  };

  function loadLocalPedidos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PEDIDOS_COMPRA));
    return DEFAULT_PEDIDOS_COMPRA;
  }

  function saveLocalPedidos(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  // ── Utilitários de Formatação ─────────────────────────────────────────────
  function formatarMoeda(val) {
    const num = Number(val || 0);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarData(dt) {
    if (!dt) return '—';
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR');
    } catch (e) {
      return '—';
    }
  }

  function formatarDocumento(doc) {
    if (!doc) return '—';
    const d = String(doc).replace(/\D/g, '');
    if (d.length === 14) {
      return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    if (d.length === 11) {
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return doc;
  }

  // ── Toasts de Notificação ─────────────────────────────────────────────────
  function mostrarToast(mensagem, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;

    let icone = '✓';
    if (tipo === 'erro') icone = '✕';
    if (tipo === 'info') icone = 'ℹ';

    toast.innerHTML = `<span style="font-size:1.1rem; line-height:1;">${icone}</span><span>${mensagem}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast-show'));

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // ── Atualização dos Cards de Resumo (KPIs) ────────────────────────────────
  function atualizarCardsResumo(pedidos = []) {
    const totalEl = document.getElementById('kpi-total-pedidos');
    const abertosEl = document.getElementById('kpi-pedidos-abertos');
    const recebidosEl = document.getElementById('kpi-pedidos-recebidos');
    const atrasadosEl = document.getElementById('kpi-pedidos-atrasados');

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let total = state.totalRegistros;
    let abertos = 0;
    let recebidos = 0;
    let atrasados = 0;

    pedidos.forEach((p) => {
      const st = String(p.status).toUpperCase();
      if (st === 'ABERTO' || st === 'PARCIAL') {
        abertos++;
      }
      if (st === 'RECEBIDO') {
        recebidos++;
      }
      if (p.atrasado) {
        atrasados++;
      }
    });

    if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR');
    if (abertosEl) abertosEl.textContent = abertos.toLocaleString('pt-BR');
    if (recebidosEl) recebidosEl.textContent = recebidos.toLocaleString('pt-BR');
    if (atrasadosEl) atrasadosEl.textContent = atrasados.toLocaleString('pt-BR');
  }

  // ── Renderização da Tabela de Pedidos de Compra ───────────────────────────
  function renderizarTabela() {
    const tbody = document.getElementById('tabela-pedidos-body');
    const loading = document.getElementById('estado-loading');
    const vazio = document.getElementById('estado-vazio');
    const erro = document.getElementById('estado-erro');
    const paginacao = document.getElementById('paginacao-container');

    if (loading) loading.style.display = 'none';
    if (erro) erro.style.display = 'none';

    if (!state.pedidos || state.pedidos.length === 0) {
      if (tbody) tbody.innerHTML = '';
      if (vazio) vazio.style.display = 'block';
      if (paginacao) paginacao.style.display = 'none';
      return;
    }

    if (vazio) vazio.style.display = 'none';
    if (paginacao) paginacao.style.display = 'flex';

    if (tbody) {
      tbody.innerHTML = state.pedidos
        .map((p) => {
          const st = String(p.status).toUpperCase();
          let badgeStatus = '';

          switch (st) {
            case 'RASCUNHO':
              badgeStatus = '<span class="badge-status badge-rascunho"><span class="badge-status-dot"></span> Rascunho</span>';
              break;
            case 'ABERTO':
              badgeStatus = '<span class="badge-status badge-aberto"><span class="badge-status-dot"></span> Aberto</span>';
              break;
            case 'PARCIAL':
              badgeStatus = '<span class="badge-status badge-parcial"><span class="badge-status-dot"></span> Parcial</span>';
              break;
            case 'RECEBIDO':
              badgeStatus = '<span class="badge-status badge-recebido"><span class="badge-status-dot"></span> Recebido</span>';
              break;
            case 'CANCELADO':
              badgeStatus = '<span class="badge-status badge-cancelado"><span class="badge-status-dot"></span> Cancelado</span>';
              break;
            default:
              badgeStatus = `<span class="badge-status badge-rascunho">${st}</span>`;
          }

          const tagAtrasado = p.atrasado ? '<span class="tag-atrasado ml-1.5">Atrasado</span>' : '';

          const fornecedorNome = p.fornecedor?.razaoSocial || p.fornecedor?.nomeFantasia || 'Fornecedor';
          const fornecedorCnpj = formatarDocumento(p.fornecedor?.cnpj);

          // Botões de Ação
          const podeReceber = st === 'ABERTO' || st === 'PARCIAL';
          const podeEditar = st === 'RASCUNHO' || st === 'ABERTO';
          const podeCancelar = st === 'RASCUNHO' || st === 'ABERTO';

          const btnVer = `
            <button type="button" class="btn-ver-detalhes p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded" data-id="${p.id}" title="Ver detalhes do pedido">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          `;

          const btnReceber = podeReceber
            ? `
            <button type="button" class="btn-abrir-recebimento p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded" data-id="${p.id}" title="Registrar recebimento de mercadorias">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </button>
          `
            : '';

          const btnEditar = podeEditar
            ? `
            <button type="button" class="btn-editar-pedido p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded" data-id="${p.id}" title="Editar pedido de compra">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
          `
            : '';

          const btnCancelar = podeCancelar
            ? `
            <button type="button" class="btn-abrir-cancelamento p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" data-id="${p.id}" title="Cancelar pedido">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </button>
          `
            : '';

          return `
            <tr class="hover:bg-stone-50/80 transition-colors text-xs text-stone-800" data-id="${p.id}">
              <td class="py-3 px-4 font-bold text-stone-900 whitespace-nowrap">
                <span class="hover:underline cursor-pointer btn-ver-detalhes" data-id="${p.id}">${p.numeroPedido}</span>
              </td>
              <td class="py-3 px-4">
                <span class="font-semibold text-stone-900 block">${fornecedorNome}</span>
                <span class="text-[11px] text-stone-500 font-mono block">${fornecedorCnpj}</span>
              </td>
              <td class="py-3 px-4 whitespace-nowrap text-stone-600">
                ${formatarData(p.dataEmissao)}
              </td>
              <td class="py-3 px-4 whitespace-nowrap">
                <span class="font-medium text-stone-800">${formatarData(p.dataPrevisaoEntrega)}</span>
                ${tagAtrasado}
              </td>
              <td class="py-3 px-4 text-right font-extrabold text-stone-900 whitespace-nowrap">
                ${formatarMoeda(p.valorTotal)}
              </td>
              <td class="py-3 px-4 text-center whitespace-nowrap">
                ${badgeStatus}
              </td>
              <td class="py-3 px-4 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1">
                  ${btnVer}
                  ${btnReceber}
                  ${btnEditar}
                  ${btnCancelar}
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    }

    renderizarPaginacao();
  }

  // ── Paginação ─────────────────────────────────────────────────────────────
  function renderizarPaginacao() {
    const info = document.getElementById('paginacao-info');
    const btnAnt = document.getElementById('btn-pag-anterior');
    const btnProx = document.getElementById('btn-pag-proxima');
    const containerBotoes = document.getElementById('paginacao-botoes');

    const total = state.totalRegistros;
    const inicio = total === 0 ? 0 : (state.paginaAtual - 1) * state.limite + 1;
    const fim = Math.min(state.paginaAtual * state.limite, total);

    if (info) info.textContent = `Mostrando ${inicio}–${fim} de ${total} registros`;

    if (btnAnt) btnAnt.disabled = state.paginaAtual <= 1;
    if (btnProx) btnProx.disabled = state.paginaAtual >= state.totalPaginas;

    if (containerBotoes) {
      containerBotoes.innerHTML = '';
      const maxBotoes = 5;
      let startPage = Math.max(1, state.paginaAtual - Math.floor(maxBotoes / 2));
      let endPage = Math.min(state.totalPaginas, startPage + maxBotoes - 1);

      if (endPage - startPage + 1 < maxBotoes) {
        startPage = Math.max(1, endPage - maxBotoes + 1);
      }

      for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `px-2.5 py-1 text-xs rounded border ${p === state.paginaAtual ? 'bg-stone-900 text-white border-stone-900 font-bold' : 'border-stone-300 text-stone-700 hover:bg-stone-100'}`;
        btn.textContent = String(p);
        btn.addEventListener('click', () => {
          if (state.paginaAtual !== p) {
            state.paginaAtual = p;
            carregarPedidos();
          }
        });
        containerBotoes.appendChild(btn);
      }
    }
  }

  // ── Carregamento de Dados da API (com Contingência) ───────────────────────
  async function carregarPedidos() {
    const loading = document.getElementById('estado-loading');
    const vazio = document.getElementById('estado-vazio');
    const erro = document.getElementById('estado-erro');
    const tbody = document.getElementById('tabela-pedidos-body');

    if (loading) loading.style.display = 'block';
    if (vazio) vazio.style.display = 'none';
    if (erro) erro.style.display = 'none';
    if (tbody) tbody.innerHTML = '';

    const params = {
      page: state.paginaAtual,
      limit: state.limite,
      search: state.busca || undefined,
      status: state.status === 'ALL' ? undefined : state.status,
      supplierId: state.supplierId || undefined,
      from: state.from || undefined,
      to: state.to || undefined,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
    };

    try {
      let resultado = null;
      if (window.RezFireAPI && window.RezFireAPI.purchaseOrders && typeof window.RezFireAPI.purchaseOrders.listar === 'function') {
        resultado = await window.RezFireAPI.purchaseOrders.listar(params);
      }

      if (resultado && Array.isArray(resultado.data)) {
        state.pedidos = resultado.data;
        state.totalRegistros = resultado.total !== undefined ? resultado.total : resultado.data.length;
        state.totalPaginas = resultado.totalPages || 1;
        atualizarCardsResumo(state.pedidos);
      } else {
        throw new Error('API offline ou formato inesperado');
      }
    } catch (err) {
      console.warn('[Pedidos de Compra] Usando contingência local de compras:', err);

      let lista = loadLocalPedidos();

      if (state.busca) {
        const termo = state.busca.toLowerCase();
        lista = lista.filter(
          (p) =>
            (p.numeroPedido && p.numeroPedido.toLowerCase().includes(termo)) ||
            (p.fornecedor?.razaoSocial && p.fornecedor.razaoSocial.toLowerCase().includes(termo)) ||
            (p.fornecedor?.nomeFantasia && p.fornecedor.nomeFantasia.toLowerCase().includes(termo))
        );
      }

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      if (state.status === 'ATRASADO') {
        lista = lista.filter((p) => {
          const st = String(p.status).toUpperCase();
          const prev = new Date(p.dataPrevisaoEntrega);
          prev.setHours(0, 0, 0, 0);
          return (st === 'ABERTO' || st === 'PARCIAL') && prev < hoje;
        });
      } else if (state.status && state.status !== 'ALL') {
        lista = lista.filter((p) => String(p.status).toUpperCase() === state.status);
      }

      if (state.supplierId) {
        lista = lista.filter((p) => String(p.idFornecedor) === String(state.supplierId));
      }

      state.totalRegistros = lista.length;
      state.totalPaginas = Math.ceil(lista.length / state.limite) || 1;
      const offset = (state.paginaAtual - 1) * state.limite;
      state.pedidos = lista.slice(offset, offset + state.limite);

      atualizarCardsResumo(loadLocalPedidos());
    } finally {
      renderizarTabela();
    }
  }

  // ── Carregamento de Fornecedores e Produtos para os Modais ─────────────────
  async function carregarFornecedoresAtivos() {
    try {
      if (window.RezFireAPI && window.RezFireAPI.suppliers && typeof window.RezFireAPI.suppliers.listar === 'function') {
        const res = await window.RezFireAPI.suppliers.listar({ status: 'ATIVO', limit: 100 });
        if (res && Array.isArray(res.data)) {
          state.fornecedoresAtivos = res.data;
        }
      }
    } catch (e) {
      console.warn('[Pedidos de Compra] Falha ao carregar fornecedores da API, usando mock local.', e);
    }

    if (state.fornecedoresAtivos.length === 0) {
      state.fornecedoresAtivos = [
        { id: 1, razaoSocial: 'Resil Indústria e Comércio LTDA', condicoesPagamento: '28 DDL faturado', prazoPadraoDias: 5 },
        { id: 2, razaoSocial: 'Bucka Spiero Indústria e Comércio LTDA', condicoesPagamento: '30/60 DDL', prazoPadraoDias: 7 },
        { id: 3, razaoSocial: 'Extinpel Componentes Contra Incêndio EIRELI', condicoesPagamento: 'À vista via PIX (3% desc)', prazoPadraoDias: 3 },
        { id: 4, razaoSocial: 'Sinalize Placas e Acessórios LTDA', condicoesPagamento: '21 DDL', prazoPadraoDias: 4 },
      ];
    }

    // Preenche selects de fornecedor
    popularSelectFornecedores();
  }

  function popularSelectFornecedores() {
    const selectFiltro = document.getElementById('filtro-fornecedor');
    const selectModal = document.getElementById('campo-fornecedor');

    if (selectFiltro) {
      selectFiltro.innerHTML = '<option value="">Todos os fornecedores</option>';
      state.fornecedoresAtivos.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = String(f.id);
        opt.textContent = f.razaoSocial || f.nomeFantasia || `Fornecedor #${f.id}`;
        selectFiltro.appendChild(opt);
      });
    }

    if (selectModal) {
      selectModal.innerHTML = '<option value="">Selecione um fornecedor...</option>';
      state.fornecedoresAtivos.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = String(f.id);
        opt.textContent = f.razaoSocial || f.nomeFantasia || `Fornecedor #${f.id}`;
        selectModal.appendChild(opt);
      });
    }
  }

  async function carregarCatalogoProdutos() {
    if (state.catalogoProdutos.length > 0) return;
    try {
      if (window.RezFireAPI && window.RezFireAPI.produtos && typeof window.RezFireAPI.produtos.listar === 'function') {
        const res = await window.RezFireAPI.produtos.listar();
        if (Array.isArray(res)) state.catalogoProdutos = res;
        else if (res && Array.isArray(res.produtos)) state.catalogoProdutos = res.produtos;
        else if (res && Array.isArray(res.data)) state.catalogoProdutos = res.data;
      }
    } catch (e) {}

    if (state.catalogoProdutos.length === 0) {
      state.catalogoProdutos = [
        { id_produto: 1, sku: 'EXT-ABC-01KG', nome: 'Extintor ABC 1kg Automotivo', preco: 45.0 },
        { id_produto: 2, sku: 'EXT-ABC-04KG', nome: 'Extintor ABC 4kg Predial', preco: 85.0 },
        { id_produto: 3, sku: 'EXT-CO2-06KG', nome: 'Extintor CO2 6kg Industrial', preco: 175.0 },
        { id_produto: 4, sku: 'EXT-AP-10L', nome: 'Extintor Água Pressurizada 10L', preco: 98.0 },
        { id_produto: 5, sku: 'MAN-01', nome: 'Manômetro de Pressão Homologado', preco: 22.0 },
        { id_produto: 6, sku: 'VAL-01', nome: 'Válvula de Latão 1/2 Pol', preco: 35.0 },
        { id_produto: 7, sku: 'SUP-SOLO-01', nome: 'Suporte de Chão Triplo', preco: 52.0 },
      ];
    }
  }

  // ── Modal de Criação / Edição do Pedido de Compra ─────────────────────────
  async function abrirModalNovoPedido() {
    await carregarFornecedoresAtivos();
    await carregarCatalogoProdutos();

    const modal = document.getElementById('modal-pedido-compra');
    const form = document.getElementById('form-pedido-compra');
    const titulo = document.getElementById('modal-pedido-titulo');
    const subtitulo = document.getElementById('modal-pedido-subtitulo');

    if (form) form.reset();
    document.getElementById('campo-pedido-id').value = '';
    document.getElementById('btn-salvar-rascunho').style.display = 'inline-block';

    if (titulo) titulo.textContent = 'Novo Pedido de Compra';
    if (subtitulo) subtitulo.textContent = 'Selecione o parceiro, informe as condições e monte a lista de insumos/produtos.';

    // Datas padrão
    const hojeStr = new Date().toISOString().substring(0, 10);
    document.getElementById('campo-data-emissao').value = hojeStr;

    // Sugere previsão padrão de 7 dias
    const prev = new Date();
    prev.setDate(prev.getDate() + 7);
    document.getElementById('campo-data-previsao').value = prev.toISOString().substring(0, 10);

    // Inicializa tabela de itens com 1 linha vazia
    state.linhasItensModal = [{ idProduto: '', quantidadePedida: 1, precoUnitario: 0, subtotal: 0 }];
    renderizarLinhasItensModal();
    recalcularTotaisModal();

    if (modal) modal.classList.add('is-open');
  }

  async function abrirModalEditarPedido(id) {
    await carregarFornecedoresAtivos();
    await carregarCatalogoProdutos();

    let p = null;
    try {
      if (window.RezFireAPI && window.RezFireAPI.purchaseOrders && typeof window.RezFireAPI.purchaseOrders.buscarPorId === 'function') {
        const res = await window.RezFireAPI.purchaseOrders.buscarPorId(id);
        p = res && (res.pedido || res.data || res);
      }
    } catch (e) {}

    if (!p) {
      p = state.pedidos.find((item) => item.id === Number(id)) || loadLocalPedidos().find((item) => item.id === Number(id));
    }

    if (!p) {
      mostrarToast('Pedido não encontrado.', 'erro');
      return;
    }

    const st = String(p.status).toUpperCase();
    if (st === 'RECEBIDO' || st === 'CANCELADO' || st === 'PARCIAL') {
      mostrarToast(`Pedidos com status "${st}" não podem ser editados.`, 'erro');
      return;
    }

    const modal = document.getElementById('modal-pedido-compra');
    const titulo = document.getElementById('modal-pedido-titulo');
    const subtitulo = document.getElementById('modal-pedido-subtitulo');

    document.getElementById('campo-pedido-id').value = p.id;
    if (titulo) titulo.textContent = `Editar Pedido ${p.numeroPedido}`;
    if (subtitulo) subtitulo.textContent = `Status atual: ${st}. Você pode alterar condições, previsão e itens.`;

    document.getElementById('campo-fornecedor').value = String(p.idFornecedor || p.fornecedor?.id || '');
    document.getElementById('campo-condicoes-pagamento').value = p.condicoesPagamento || '';
    document.getElementById('campo-data-emissao').value = p.dataEmissao ? new Date(p.dataEmissao).toISOString().substring(0, 10) : '';
    document.getElementById('campo-data-previsao').value = p.dataPrevisaoEntrega ? new Date(p.dataPrevisaoEntrega).toISOString().substring(0, 10) : '';
    document.getElementById('campo-valor-frete').value = (Number(p.valorFrete) || 0).toFixed(2);
    document.getElementById('campo-valor-desconto').value = (Number(p.valorDesconto) || 0).toFixed(2);
    document.getElementById('campo-observacoes-pedido').value = p.observacoes || '';

    // Se estiver ABERTO, oculta botão de salvar como rascunho
    const btnRascunho = document.getElementById('btn-salvar-rascunho');
    if (btnRascunho) {
      btnRascunho.style.display = st === 'RASCUNHO' ? 'inline-block' : 'none';
    }

    // Carrega itens
    state.linhasItensModal = (p.itens || []).map((i) => ({
      idProduto: i.idProduto || i.produto?.id,
      quantidadePedida: Number(i.quantidadePedida) || 1,
      precoUnitario: Number(i.precoUnitario) || 0,
      subtotal: Number(i.subtotal) || 0,
    }));

    if (state.linhasItensModal.length === 0) {
      state.linhasItensModal = [{ idProduto: '', quantidadePedida: 1, precoUnitario: 0, subtotal: 0 }];
    }

    renderizarLinhasItensModal();
    recalcularTotaisModal();

    if (modal) modal.classList.add('is-open');
  }

  function fecharModalPedido() {
    const modal = document.getElementById('modal-pedido-compra');
    if (modal) modal.classList.remove('is-open');
    state.linhasItensModal = [];
  }

  function renderizarLinhasItensModal() {
    const tbody = document.getElementById('corpo-tabela-itens');
    if (!tbody) return;

    tbody.innerHTML = state.linhasItensModal
      .map((item, index) => {
        const optionsHtml = state.catalogoProdutos
          .map((prod) => {
            const id = prod.id_produto || prod.id;
            const selected = String(id) === String(item.idProduto) ? 'selected' : '';
            return `<option value="${id}" ${selected}>[${prod.sku || 'SKU'}] ${prod.nome}</option>`;
          })
          .join('');

        return `
          <tr data-index="${index}">
            <td class="py-2 px-3">
              <select class="item-select-produto w-full text-xs px-2 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-accent bg-white" data-index="${index}">
                <option value="">Selecione um produto...</option>
                ${optionsHtml}
              </select>
            </td>
            <td class="py-2 px-3 text-right">
              <input type="number" min="1" step="1" value="${item.quantidadePedida || 1}" class="item-input-qtd w-20 text-xs px-2 py-1.5 border border-stone-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-accent" data-index="${index}" />
            </td>
            <td class="py-2 px-3 text-right">
              <input type="number" min="0.01" step="0.01" value="${(item.precoUnitario || 0).toFixed(2)}" class="item-input-custo w-24 text-xs px-2 py-1.5 border border-stone-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-accent" data-index="${index}" />
            </td>
            <td class="py-2 px-3 text-right font-bold text-stone-900 item-subtotal-texto">
              ${formatarMoeda(item.subtotal)}
            </td>
            <td class="py-2 px-2 text-center">
              <button type="button" class="btn-remover-item-linha text-stone-400 hover:text-red-600 p-1" data-index="${index}" title="Remover item">
                ✕
              </button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function recalcularTotaisModal() {
    let soma = 0;
    state.linhasItensModal.forEach((item) => {
      const qtd = Number(item.quantidadePedida) || 0;
      const custo = Number(item.precoUnitario) || 0;
      item.subtotal = Number((qtd * custo).toFixed(2));
      soma += item.subtotal;
    });

    const frete = parseFloat(document.getElementById('campo-valor-frete')?.value) || 0;
    const desconto = parseFloat(document.getElementById('campo-valor-desconto')?.value) || 0;
    const totalGeral = Math.max(0, soma + frete - desconto);

    const totalEl = document.getElementById('label-valor-total-calculado');
    if (totalEl) totalEl.textContent = formatarMoeda(totalGeral);
  }

  async function handleFornecedorAlterado(idFornecedor) {
    const f = state.fornecedoresAtivos.find((item) => String(item.id) === String(idFornecedor));
    if (!f) return;

    // Sugere condição de pagamento
    const campoCond = document.getElementById('campo-condicoes-pagamento');
    if (campoCond && f.condicoesPagamento) {
      campoCond.value = f.condicoesPagamento;
    }

    // Sugere prazo de entrega
    const campoPrev = document.getElementById('campo-data-previsao');
    const avisoPrazo = document.getElementById('aviso-prazo-fornecedor');
    const dias = f.prazoPadraoDias || 7;
    const dtEmissaoVal = document.getElementById('campo-data-emissao')?.value;
    const baseDate = dtEmissaoVal ? new Date(dtEmissaoVal) : new Date();

    baseDate.setDate(baseDate.getDate() + dias);
    if (campoPrev) campoPrev.value = baseDate.toISOString().substring(0, 10);
    if (avisoPrazo) avisoPrazo.textContent = `Sugerido pelo prazo padrão do parceiro (${dias} dias úteis).`;

    // Carrega vínculos de preços deste fornecedor
    try {
      if (window.RezFireAPI && window.RezFireAPI.suppliers && typeof window.RezFireAPI.suppliers.listarProdutos === 'function') {
        const res = await window.RezFireAPI.suppliers.listarProdutos(f.id);
        const prods = (res && (res.produtos || res.data || res)) || [];
        state.custosFornecedorMap = {};
        prods.forEach((p) => {
          const idProd = p.idProduto || p.id_produto;
          const custo = Number(p.custoCompra || p.custo_compra) || 0;
          if (idProd && custo > 0) state.custosFornecedorMap[idProd] = custo;
        });
      }
    } catch (e) {}
  }

  async function handleSalvarPedido(statusDesejado = 'RASCUNHO') {
    const id = document.getElementById('campo-pedido-id').value;
    const idFornecedor = parseInt(document.getElementById('campo-fornecedor').value, 10);
    const dataEmissao = document.getElementById('campo-data-emissao').value;
    const dataPrevisaoEntrega = document.getElementById('campo-data-previsao').value;
    const condicoesPagamento = document.getElementById('campo-condicoes-pagamento').value.trim() || undefined;
    const valorFrete = parseFloat(document.getElementById('campo-valor-frete').value) || 0;
    const valorDesconto = parseFloat(document.getElementById('campo-valor-desconto').value) || 0;
    const observacoes = document.getElementById('campo-observacoes-pedido').value.trim() || undefined;

    if (!idFornecedor) {
      mostrarToast('Selecione um fornecedor para o pedido de compra.', 'erro');
      return;
    }
    if (!dataPrevisaoEntrega) {
      mostrarToast('A data de previsão de entrega é obrigatória.', 'erro');
      return;
    }

    // Valida itens
    const itensValidos = [];
    const idsProdutos = new Set();

    for (const item of state.linhasItensModal) {
      if (!item.idProduto) continue;
      const idProd = parseInt(item.idProduto, 10);
      if (idsProdutos.has(idProd)) {
        mostrarToast('Não repita o mesmo produto em linhas separadas do pedido.', 'erro');
        return;
      }
      idsProdutos.add(idProd);

      const qtd = parseInt(item.quantidadePedida, 10);
      const custo = parseFloat(item.precoUnitario);

      if (isNaN(qtd) || qtd <= 0) {
        mostrarToast('Informe uma quantidade válida para todos os itens.', 'erro');
        return;
      }
      if (isNaN(custo) || custo <= 0) {
        mostrarToast('O custo unitário de todos os itens deve ser maior que zero.', 'erro');
        return;
      }

      itensValidos.push({
        idProduto: idProd,
        quantidadePedida: qtd,
        precoUnitario: custo,
      });
    }

    if (itensValidos.length === 0) {
      mostrarToast('Adicione ao menos um produto no pedido de compra.', 'erro');
      return;
    }

    const payload = {
      idFornecedor,
      dataEmissao: dataEmissao ? `${dataEmissao} 12:00:00` : undefined,
      dataPrevisaoEntrega,
      condicoesPagamento,
      valorFrete,
      valorDesconto,
      observacoes,
      status: statusDesejado,
      itens: itensValidos,
    };

    try {
      if (id) {
        // Atualização
        if (window.RezFireAPI && window.RezFireAPI.purchaseOrders && typeof window.RezFireAPI.purchaseOrders.atualizar === 'function') {
          await window.RezFireAPI.purchaseOrders.atualizar(id, payload);
        } else {
          // Fallback local
          const lista = loadLocalPedidos();
          const idx = lista.findIndex((p) => String(p.id) === String(id));
          if (idx !== -1) {
            lista[idx] = { ...lista[idx], ...payload, status: statusDesejado };
            saveLocalPedidos(lista);
          }
        }
        mostrarToast(`Pedido de compra atualizado com sucesso (${statusDesejado})!`);
      } else {
        // Criação
        if (window.RezFireAPI && window.RezFireAPI.purchaseOrders && typeof window.RezFireAPI.purchaseOrders.criar === 'function') {
          await window.RezFireAPI.purchaseOrders.criar(payload);
        } else {
          // Fallback local
          const lista = loadLocalPedidos();
          const ano = new Date().getFullYear();
          const novoNum = `PC-${ano}-${String(lista.length + 1).padStart(4, '0')}`;
          const forn = state.fornecedoresAtivos.find((f) => f.id === idFornecedor);
          const novo = {
            id: Date.now(),
            numeroPedido: novoNum,
            idFornecedor,
            fornecedor: forn || { id: idFornecedor, razaoSocial: 'Fornecedor' },
            dataEmissao: payload.dataEmissao || new Date().toISOString(),
            dataPrevisaoEntrega: payload.dataPrevisaoEntrega,
            dataRecebimento: null,
            condicoesPagamento: payload.condicoesPagamento,
            status: statusDesejado,
            atrasado: false,
            valorTotal: 1000,
            valorFrete,
            valorDesconto,
            observacoes,
            motivoCancelamento: null,
            itens: itensValidos.map((i, idx) => ({
              id: idx + 1,
              idProduto: i.idProduto,
              produto: state.catalogoProdutos.find((cp) => (cp.id_produto || cp.id) === i.idProduto) || { nome: 'Produto' },
              quantidadePedida: i.quantidadePedida,
              quantidadeEntregue: 0,
              quantidadePendente: i.quantidadePedida,
              precoUnitario: i.precoUnitario,
              subtotal: i.quantidadePedida * i.precoUnitario,
            })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          lista.unshift(novo);
          saveLocalPedidos(lista);
        }
        mostrarToast(
          statusDesejado === 'ABERTO'
            ? 'Pedido de compra confirmado e enviado para aguardo de entrega!'
            : 'Rascunho de pedido de compra salvo com sucesso!'
        );
      }

      fecharModalPedido();
      carregarPedidos();
    } catch (err) {
      console.error('[Pedidos de Compra] Erro ao salvar pedido:', err);
      const msg = err.response?.data?.message || err.message || 'Falha ao salvar pedido de compra.';
      mostrarToast(msg, 'erro');
    }
  }

  // ── Modal de Recebimento de Mercadorias ────────────────────────────────────
  function abrirModalRecebimento(id) {
    const p = state.pedidos.find((item) => item.id === Number(id)) || loadLocalPedidos().find((item) => item.id === Number(id));
    if (!p) {
      mostrarToast('Pedido não encontrado.', 'erro');
      return;
    }

    const st = String(p.status).toUpperCase();
    if (st === 'RECEBIDO') {
      mostrarToast('Este pedido já foi totalmente recebido.', 'erro');
      return;
    }
    if (st === 'CANCELADO') {
      mostrarToast('Não é possível receber produtos de pedido cancelado.', 'erro');
      return;
    }
    if (st === 'RASCUNHO') {
      mostrarToast('Confirme o pedido antes de registrar recebimentos.', 'erro');
      return;
    }

    state.pedidoParaReceber = p;

    document.getElementById('rec-pedido-id').value = p.id;
    document.getElementById('rec-info-pedido').textContent = `${p.numeroPedido} — ${p.fornecedor?.razaoSocial || 'Fornecedor'}`;
    document.getElementById('rec-campo-data').value = new Date().toISOString().substring(0, 10);

    const tbody = document.getElementById('rec-tabela-itens-body');
    if (tbody) {
      tbody.innerHTML = (p.itens || [])
        .map((item) => {
          const nomeProd = item.produto?.nome || `Produto #${item.idProduto}`;
          const skuProd = item.produto?.sku || 'SKU';
          const qtdPed = Number(item.quantidadePedida) || 0;
          const qtdEnt = Number(item.quantidadeEntregue) || 0;
          const pendente = Math.max(0, qtdPed - qtdEnt);

          return `
            <tr data-id-item="${item.id}">
              <td class="py-2.5 px-3">
                <span class="font-bold text-stone-900 block">[${skuProd}]</span>
                <span class="text-stone-500 text-[11px] block">${nomeProd}</span>
              </td>
              <td class="py-2.5 px-2 text-center text-stone-600 font-semibold">${qtdPed}</td>
              <td class="py-2.5 px-2 text-center text-emerald-700 font-semibold">${qtdEnt}</td>
              <td class="py-2.5 px-2 text-center font-bold text-amber-700">${pendente}</td>
              <td class="py-2.5 px-3 text-right">
                <input
                  type="number"
                  min="0"
                  max="${pendente}"
                  step="1"
                  value="${pendente}"
                  class="rec-input-qtd w-24 text-xs px-2 py-1 border border-stone-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-accent"
                  data-id-item="${item.id}"
                  data-pendente="${pendente}"
                />
              </td>
            </tr>
          `;
        })
        .join('');
    }

    const modal = document.getElementById('modal-recebimento');
    if (modal) modal.classList.add('is-open');
  }

  function fecharModalRecebimento() {
    const modal = document.getElementById('modal-recebimento');
    if (modal) modal.classList.remove('is-open');
    state.pedidoParaReceber = null;
  }

  async function handleConfirmarRecebimento(e) {
    e.preventDefault();
    if (!state.pedidoParaReceber) return;

    const id = state.pedidoParaReceber.id;
    const dataRecebimento = document.getElementById('rec-campo-data').value;
    const loteNumero = document.getElementById('rec-lote-numero').value.trim();
    const loteLacre = document.getElementById('rec-lote-lacre').value.trim();
    const loteValidade = document.getElementById('rec-lote-validade').value;

    const inputs = document.querySelectorAll('.rec-input-qtd');
    const itensReceber = [];
    let totalUnidadesRemessa = 0;

    for (const inp of inputs) {
      const idItemCompra = parseInt(inp.dataset.idItem, 10);
      const pendente = parseInt(inp.dataset.pendente, 10);
      const qtd = parseInt(inp.value, 10) || 0;

      if (qtd > pendente) {
        mostrarToast(`A quantidade a receber (${qtd}) excede o saldo pendente (${pendente}).`, 'erro');
        return;
      }

      if (qtd > 0) {
        totalUnidadesRemessa += qtd;
        const itemObj = {
          idItemCompra,
          quantidadeRecebida: qtd,
        };

        if (loteNumero && loteValidade) {
          itemObj.novoLote = {
            numero_lote: loteNumero,
            numero_lacre_inmetro: loteLacre || undefined,
            data_validade: loteValidade,
          };
        }

        itensReceber.push(itemObj);
      }
    }

    if (itensReceber.length === 0 || totalUnidadesRemessa === 0) {
      mostrarToast('Informe ao menos 1 unidade para registrar o recebimento.', 'erro');
      return;
    }

    const payload = {
      dataRecebimento: dataRecebimento ? `${dataRecebimento} 12:00:00` : undefined,
      itens: itensReceber,
    };

    const btn = document.getElementById('btn-confirmar-recebimento');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creditando no Estoque...';
    }

    try {
      if (window.RezFireAPI && window.RezFireAPI.purchaseOrders && typeof window.RezFireAPI.purchaseOrders.registrarRecebimento === 'function') {
        await window.RezFireAPI.purchaseOrders.registrarRecebimento(id, payload);
      } else {
        // Fallback local
        const lista = loadLocalPedidos();
        const pIdx = lista.findIndex((p) => p.id === id);
        if (pIdx !== -1) {
          const po = lista[pIdx];
          itensReceber.forEach((rec) => {
            const it = po.itens.find((i) => i.id === rec.idItemCompra);
            if (it) {
              it.quantidadeEntregue += rec.quantidadeRecebida;
              it.quantidadePendente = Math.max(0, it.quantidadePedida - it.quantidadeEntregue);
            }
          });
          const allDone = po.itens.every((i) => i.quantidadeEntregue >= i.quantidadePedida);
          po.status = allDone ? 'RECEBIDO' : 'PARCIAL';
          po.dataRecebimento = payload.dataRecebimento;
          saveLocalPedidos(lista);
        }
      }

      mostrarToast('Mercadorias recebidas! O estoque foi atualizado com sucesso.');
      fecharModalRecebimento();
      fecharDrawerDetalhes();
      carregarPedidos();
    } catch (err) {
      console.error('[Pedidos de Compra] Erro ao registrar recebimento:', err);
      const msg = err.response?.data?.message || err.message || 'Falha ao registrar recebimento.';
      mostrarToast(msg, 'erro');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Dar Entrada no Estoque';
      }
    }
  }

  // ── Modal de Cancelamento de Pedido de Compra ─────────────────────────────
  function abrirModalCancelamento(id) {
    const p = state.pedidos.find((item) => item.id === Number(id)) || loadLocalPedidos().find((item) => item.id === Number(id));
    if (!p) {
      mostrarToast('Pedido não encontrado.', 'erro');
      return;
    }

    const st = String(p.status).toUpperCase();
    if (st === 'RECEBIDO' || st === 'PARCIAL') {
      mostrarToast('Pedidos já recebidos total ou parcialmente não podem ser cancelados.', 'erro');
      return;
    }
    if (st === 'CANCELADO') {
      mostrarToast('Este pedido já está cancelado.', 'erro');
      return;
    }

    state.pedidoParaCancelar = p;
    document.getElementById('cancelar-pedido-id').value = p.id;
    document.getElementById('cancelar-motivo').value = '';

    const modal = document.getElementById('modal-cancelamento');
    if (modal) modal.classList.add('is-open');
  }

  function fecharModalCancelamento() {
    const modal = document.getElementById('modal-cancelamento');
    if (modal) modal.classList.remove('is-open');
    state.pedidoParaCancelar = null;
  }

  async function handleConfirmarCancelamento(e) {
    e.preventDefault();
    if (!state.pedidoParaCancelar) return;

    const id = state.pedidoParaCancelar.id;
    const motivo = document.getElementById('cancelar-motivo').value.trim();

    if (!motivo) {
      mostrarToast('O motivo do cancelamento é obrigatório.', 'erro');
      return;
    }

    const btn = document.getElementById('btn-confirmar-cancelamento');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Cancelando...';
    }

    try {
      if (window.RezFireAPI && window.RezFireAPI.purchaseOrders && typeof window.RezFireAPI.purchaseOrders.cancelar === 'function') {
        await window.RezFireAPI.purchaseOrders.cancelar(id, motivo);
      } else {
        // Fallback local
        const lista = loadLocalPedidos();
        const pIdx = lista.findIndex((p) => p.id === id);
        if (pIdx !== -1) {
          lista[pIdx].status = 'CANCELADO';
          lista[pIdx].motivoCancelamento = motivo;
          saveLocalPedidos(lista);
        }
      }

      mostrarToast('Pedido de compra cancelado com sucesso.');
      fecharModalCancelamento();
      fecharDrawerDetalhes();
      carregarPedidos();
    } catch (err) {
      console.error('[Pedidos de Compra] Erro ao cancelar pedido:', err);
      const msg = err.response?.data?.message || err.message || 'Falha ao cancelar pedido.';
      mostrarToast(msg, 'erro');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sim, Cancelar Pedido';
      }
    }
  }

  // ── Slideover Drawer de Detalhes ──────────────────────────────────────────
  async function abrirDrawerDetalhes(id) {
    const drawer = document.getElementById('drawer-detalhes');
    const overlay = document.getElementById('drawer-overlay');
    if (!drawer || !overlay) return;

    let p = null;
    try {
      if (window.RezFireAPI && window.RezFireAPI.purchaseOrders && typeof window.RezFireAPI.purchaseOrders.buscarPorId === 'function') {
        const res = await window.RezFireAPI.purchaseOrders.buscarPorId(id);
        p = res && (res.pedido || res.data || res);
      }
    } catch (e) {}

    if (!p) {
      p = state.pedidos.find((item) => item.id === Number(id)) || loadLocalPedidos().find((item) => item.id === Number(id));
    }

    if (!p) {
      mostrarToast('Pedido não encontrado.', 'erro');
      return;
    }

    state.pedidoSelecionado = p;

    // Cabeçalho do Drawer
    const st = String(p.status).toUpperCase();
    document.getElementById('drawer-titulo').textContent = `Pedido de Compra ${p.numeroPedido}`;
    document.getElementById('drawer-subtitulo').textContent = `Emitido em ${formatarData(p.dataEmissao)}`;

    const badgeStatus = document.getElementById('drawer-status-badge');
    if (badgeStatus) {
      badgeStatus.className = `badge-status badge-${st.toLowerCase()}`;
      badgeStatus.textContent = st;
    }

    const tagAtrasado = document.getElementById('drawer-tag-atrasado');
    if (tagAtrasado) tagAtrasado.classList.toggle('hidden', !p.atrasado);

    // Progresso de entrega
    let totalPed = 0;
    let totalEnt = 0;
    (p.itens || []).forEach((i) => {
      totalPed += Number(i.quantidadePedida) || 0;
      totalEnt += Number(i.quantidadeEntregue) || 0;
    });
    const perc = totalPed > 0 ? Math.round((totalEnt / totalPed) * 100) : 0;

    document.getElementById('drawer-progresso-percentual').textContent = `${perc}%`;
    document.getElementById('drawer-progresso-barra').style.width = `${perc}%`;
    document.getElementById('drawer-qtd-total-itens').textContent = `${totalPed} un`;
    document.getElementById('drawer-qtd-recebida-itens').textContent = `${totalEnt} un`;
    document.getElementById('drawer-qtd-pendente-itens').textContent = `${Math.max(0, totalPed - totalEnt)} un`;

    // Dados do parceiro e datas
    document.getElementById('drawer-fornecedor-nome').textContent = p.fornecedor?.razaoSocial || p.fornecedor?.nomeFantasia || 'Fornecedor';
    document.getElementById('drawer-fornecedor-cnpj').textContent = formatarDocumento(p.fornecedor?.cnpj);
    document.getElementById('drawer-fornecedor-contato').textContent = p.fornecedor?.telefone || p.fornecedor?.email || '—';

    document.getElementById('drawer-data-emissao').textContent = formatarData(p.dataEmissao);
    document.getElementById('drawer-data-previsao').textContent = formatarData(p.dataPrevisaoEntrega);
    document.getElementById('drawer-data-recebimento').textContent = formatarData(p.dataRecebimento);

    document.getElementById('drawer-condicoes-pagamento').textContent = p.condicoesPagamento || 'Padrão do fornecedor';
    document.getElementById('drawer-observacoes').textContent = p.observacoes || 'Nenhuma observação registrada.';

    const blocoCancel = document.getElementById('drawer-bloco-cancelamento');
    const motivoCancel = document.getElementById('drawer-motivo-cancelamento');
    if (st === 'CANCELADO' && p.motivoCancelamento) {
      blocoCancel.classList.remove('hidden');
      motivoCancel.textContent = p.motivoCancelamento;
    } else {
      blocoCancel.classList.add('hidden');
    }

    // Tabela de Itens
    const tbodyItens = document.getElementById('drawer-tabela-itens-body');
    let subtotalGeral = 0;

    if (tbodyItens) {
      tbodyItens.innerHTML = (p.itens || [])
        .map((i) => {
          const nomeProd = i.produto?.nome || `Produto #${i.idProduto}`;
          const skuProd = i.produto?.sku || 'SKU';
          const qtdP = Number(i.quantidadePedida) || 0;
          const qtdE = Number(i.quantidadeEntregue) || 0;
          const custo = Number(i.precoUnitario) || 0;
          const subt = Number(i.subtotal) || qtdP * custo;
          subtotalGeral += subt;

          return `
            <tr class="hover:bg-stone-50">
              <td class="py-2.5 px-3">
                <span class="font-bold text-stone-900 block">[${skuProd}]</span>
                <span class="text-stone-500 text-[11px] block">${nomeProd}</span>
              </td>
              <td class="py-2.5 px-2 text-center text-stone-700">${qtdP}</td>
              <td class="py-2.5 px-2 text-center font-bold ${qtdE >= qtdP ? 'text-emerald-700' : 'text-amber-700'}">${qtdE}</td>
              <td class="py-2.5 px-3 text-right text-stone-700">${formatarMoeda(custo)}</td>
              <td class="py-2.5 px-3 text-right font-bold text-stone-900">${formatarMoeda(subt)}</td>
            </tr>
          `;
        })
        .join('');
    }

    // Totais financeiros
    const frete = Number(p.valorFrete) || 0;
    const desc = Number(p.valorDesconto) || 0;
    const totalCalc = Number(p.valorTotal) || subtotalGeral + frete - desc;

    document.getElementById('drawer-financeiro-subtotal').textContent = formatarMoeda(subtotalGeral);
    document.getElementById('drawer-financeiro-frete').textContent = formatarMoeda(frete);
    document.getElementById('drawer-financeiro-desconto').textContent = formatarMoeda(desc);
    document.getElementById('drawer-financeiro-total').textContent = formatarMoeda(totalCalc);

    // Botão de Recebimento no Drawer
    const btnReceberDrawer = document.getElementById('drawer-btn-receber');
    if (btnReceberDrawer) {
      btnReceberDrawer.style.display = st === 'ABERTO' || st === 'PARCIAL' ? 'inline-flex' : 'none';
      btnReceberDrawer.onclick = () => {
        abrirModalRecebimento(p.id);
      };
    }

    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
  }

  function fecharDrawerDetalhes() {
    const drawer = document.getElementById('drawer-detalhes');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-open');
    state.pedidoSelecionado = null;
  }

  // ── Inicialização de Listeners e Eventos ──────────────────────────────────
  function initEventos() {
    // Renderiza layout e sidebar
    if (typeof renderSidebar === 'function') {
      renderSidebar('pedidos-compra');
    }

    // Botões principais
    const btnNovo = document.getElementById('btn-novo-pedido-compra');
    if (btnNovo) btnNovo.addEventListener('click', abrirModalNovoPedido);

    const btnVazioNovo = document.getElementById('btn-vazio-novo-pedido');
    if (btnVazioNovo) btnVazioNovo.addEventListener('click', abrirModalNovoPedido);

    const btnAtualizar = document.getElementById('btn-atualizar');
    if (btnAtualizar) btnAtualizar.addEventListener('click', carregarPedidos);

    const btnTentar = document.getElementById('btn-tentar-novamente');
    if (btnTentar) btnTentar.addEventListener('click', carregarPedidos);

    // Fechamento modal pedido
    const btnFecharModal = document.getElementById('btn-fechar-modal-pedido');
    if (btnFecharModal) btnFecharModal.addEventListener('click', fecharModalPedido);

    const btnCancModal = document.getElementById('btn-cancelar-modal-pedido');
    if (btnCancModal) btnCancModal.addEventListener('click', fecharModalPedido);

    // Seleção de fornecedor no modal
    const campoForn = document.getElementById('campo-fornecedor');
    if (campoForn) {
      campoForn.addEventListener('change', (e) => {
        handleFornecedorAlterado(e.target.value);
      });
    }

    // Adicionar linha de item
    const btnAddLinha = document.getElementById('btn-adicionar-linha-item');
    if (btnAddLinha) {
      btnAddLinha.addEventListener('click', () => {
        state.linhasItensModal.push({ idProduto: '', quantidadePedida: 1, precoUnitario: 0, subtotal: 0 });
        renderizarLinhasItensModal();
      });
    }

    // Delegação de alterações na tabela de itens do modal
    const tbodyItensModal = document.getElementById('corpo-tabela-itens');
    if (tbodyItensModal) {
      tbodyItensModal.addEventListener('change', (e) => {
        const selectProd = e.target.closest('.item-select-produto');
        if (selectProd) {
          const idx = parseInt(selectProd.dataset.index, 10);
          const idProd = parseInt(selectProd.value, 10);
          state.linhasItensModal[idx].idProduto = idProd || '';

          // Busca custo sugerido do fornecedor ou preço base do produto
          if (idProd && state.custosFornecedorMap[idProd]) {
            state.linhasItensModal[idx].precoUnitario = state.custosFornecedorMap[idProd];
          } else if (idProd) {
            const p = state.catalogoProdutos.find((item) => (item.id_produto || item.id) === idProd);
            state.linhasItensModal[idx].precoUnitario = Number(p?.preco) || 0;
          }

          renderizarLinhasItensModal();
          recalcularTotaisModal();
          return;
        }

        const inputQtd = e.target.closest('.item-input-qtd');
        if (inputQtd) {
          const idx = parseInt(inputQtd.dataset.index, 10);
          state.linhasItensModal[idx].quantidadePedida = parseInt(inputQtd.value, 10) || 1;
          recalcularTotaisModal();
          renderizarLinhasItensModal();
          return;
        }

        const inputCusto = e.target.closest('.item-input-custo');
        if (inputCusto) {
          const idx = parseInt(inputCusto.dataset.index, 10);
          state.linhasItensModal[idx].precoUnitario = parseFloat(inputCusto.value) || 0;
          recalcularTotaisModal();
          renderizarLinhasItensModal();
          return;
        }
      });

      tbodyItensModal.addEventListener('click', (e) => {
        const btnRemover = e.target.closest('.btn-remover-item-linha');
        if (btnRemover) {
          const idx = parseInt(btnRemover.dataset.index, 10);
          if (state.linhasItensModal.length > 1) {
            state.linhasItensModal.splice(idx, 1);
            renderizarLinhasItensModal();
            recalcularTotaisModal();
          } else {
            mostrarToast('O pedido deve conter ao menos uma linha de produto.', 'erro');
          }
        }
      });
    }

    // Alteração de frete e desconto
    const campoFrete = document.getElementById('campo-valor-frete');
    if (campoFrete) campoFrete.addEventListener('input', recalcularTotaisModal);

    const campoDesc = document.getElementById('campo-valor-desconto');
    if (campoDesc) campoDesc.addEventListener('input', recalcularTotaisModal);

    // Botões de salvar pedido
    const btnSalvarRascunho = document.getElementById('btn-salvar-rascunho');
    if (btnSalvarRascunho) {
      btnSalvarRascunho.addEventListener('click', () => handleSalvarPedido('RASCUNHO'));
    }

    const btnConfirmarAberto = document.getElementById('btn-confirmar-pedido-aberto');
    if (btnConfirmarAberto) {
      btnConfirmarAberto.addEventListener('click', () => handleSalvarPedido('ABERTO'));
    }

    // Modal de Recebimento
    const btnFecharRecebimento = document.getElementById('btn-fechar-modal-recebimento');
    if (btnFecharRecebimento) btnFecharRecebimento.addEventListener('click', fecharModalRecebimento);

    const btnCancRecebimento = document.getElementById('btn-cancelar-modal-recebimento');
    if (btnCancRecebimento) btnCancRecebimento.addEventListener('click', fecharModalRecebimento);

    const formRecebimento = document.getElementById('form-recebimento-mercadoria');
    if (formRecebimento) formRecebimento.addEventListener('submit', handleConfirmarRecebimento);

    // Modal de Cancelamento
    const btnFecharCanc = document.getElementById('btn-fechar-modal-cancelar');
    if (btnFecharCanc) btnFecharCanc.addEventListener('click', fecharModalCancelamento);

    const formCancelamento = document.getElementById('form-cancelamento-pedido');
    if (formCancelamento) formCancelamento.addEventListener('submit', handleConfirmarCancelamento);

    // Drawer lateral
    const btnFecharDrawer = document.getElementById('btn-fechar-drawer');
    if (btnFecharDrawer) btnFecharDrawer.addEventListener('click', fecharDrawerDetalhes);

    const overlay = document.getElementById('drawer-overlay');
    if (overlay) overlay.addEventListener('click', fecharDrawerDetalhes);

    // Busca com debounce
    const filtroBusca = document.getElementById('filtro-busca');
    const btnLimparBusca = document.getElementById('btn-limpar-busca');
    if (filtroBusca) {
      filtroBusca.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (btnLimparBusca) btnLimparBusca.classList.toggle('hidden', val.length === 0);

        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(() => {
          state.busca = val;
          state.paginaAtual = 1;
          carregarPedidos();
        }, 300);
      });
    }

    if (btnLimparBusca) {
      btnLimparBusca.addEventListener('click', () => {
        if (filtroBusca) filtroBusca.value = '';
        btnLimparBusca.classList.add('hidden');
        state.busca = '';
        state.paginaAtual = 1;
        carregarPedidos();
      });
    }

    // Filtros de status, fornecedor e datas
    const filtroStatus = document.getElementById('filtro-status');
    if (filtroStatus) {
      filtroStatus.addEventListener('change', (e) => {
        state.status = e.target.value;
        state.paginaAtual = 1;
        carregarPedidos();
      });
    }

    const filtroFornecedor = document.getElementById('filtro-fornecedor');
    if (filtroFornecedor) {
      filtroFornecedor.addEventListener('change', (e) => {
        state.supplierId = e.target.value;
        state.paginaAtual = 1;
        carregarPedidos();
      });
    }

    const filtroDtIni = document.getElementById('filtro-data-inicio');
    if (filtroDtIni) {
      filtroDtIni.addEventListener('change', (e) => {
        state.from = e.target.value;
        state.paginaAtual = 1;
        carregarPedidos();
      });
    }

    const filtroDtFim = document.getElementById('filtro-data-fim');
    if (filtroDtFim) {
      filtroDtFim.addEventListener('change', (e) => {
        state.to = e.target.value;
        state.paginaAtual = 1;
        carregarPedidos();
      });
    }

    const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener('click', () => {
        if (filtroBusca) filtroBusca.value = '';
        if (btnLimparBusca) btnLimparBusca.classList.add('hidden');
        if (filtroStatus) filtroStatus.value = 'ALL';
        if (filtroFornecedor) filtroFornecedor.value = '';
        if (filtroDtIni) filtroDtIni.value = '';
        if (filtroDtFim) filtroDtFim.value = '';

        state.busca = '';
        state.status = 'ALL';
        state.supplierId = '';
        state.from = '';
        state.to = '';
        state.paginaAtual = 1;
        carregarPedidos();
      });
    }

    // Paginação
    const selectLimite = document.getElementById('paginacao-limite');
    if (selectLimite) {
      selectLimite.addEventListener('change', (e) => {
        state.limite = parseInt(e.target.value, 10);
        state.paginaAtual = 1;
        carregarPedidos();
      });
    }

    const btnAnt = document.getElementById('btn-pag-anterior');
    if (btnAnt) {
      btnAnt.addEventListener('click', () => {
        if (state.paginaAtual > 1) {
          state.paginaAtual--;
          carregarPedidos();
        }
      });
    }

    const btnProx = document.getElementById('btn-pag-proxima');
    if (btnProx) {
      btnProx.addEventListener('click', () => {
        if (state.paginaAtual < state.totalPaginas) {
          state.paginaAtual++;
          carregarPedidos();
        }
      });
    }

    // Delegação de cliques na tabela de pedidos
    const tbodyPedidos = document.getElementById('tabela-pedidos-body');
    if (tbodyPedidos) {
      tbodyPedidos.addEventListener('click', (e) => {
        const btnVer = e.target.closest('.btn-ver-detalhes');
        if (btnVer) {
          const id = btnVer.dataset.id;
          abrirDrawerDetalhes(id);
          return;
        }

        const btnRec = e.target.closest('.btn-abrir-recebimento');
        if (btnRec) {
          const id = btnRec.dataset.id;
          abrirModalRecebimento(id);
          return;
        }

        const btnEdit = e.target.closest('.btn-editar-pedido');
        if (btnEdit) {
          const id = btnEdit.dataset.id;
          abrirModalEditarPedido(id);
          return;
        }

        const btnCanc = e.target.closest('.btn-abrir-cancelamento');
        if (btnCanc) {
          const id = btnCanc.dataset.id;
          abrirModalCancelamento(id);
          return;
        }
      });
    }

    // Fechar modais ao teclar Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        fecharModalPedido();
        fecharModalRecebimento();
        fecharModalCancelamento();
        fecharDrawerDetalhes();
      }
    });

    // Carga inicial
    carregarFornecedoresAtivos();
    carregarCatalogoProdutos();
    carregarPedidos();
  }

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEventos);
  } else {
    initEventos();
  }
})();
