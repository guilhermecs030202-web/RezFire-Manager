/**
 * clientes.js
 * Controlador da Tela de Clientes — RezFire Manager
 * Centraliza clientes presenciais (balcão) e importados do Mercado Livre.
 * Atende aos padrões de contingência e persistência no MySQL do RezFire.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'rezfire.clientes';

  // ── Dados de Contingência / Demonstração (Fallback Local) ─────────────────
  const DEFAULT_CLIENTES = [
    {
      id: 1,
      name: 'Construtora Horizonte LTDA',
      document: '12.345.678/0001-90',
      email: 'compras@horizonteeng.com.br',
      phone: '(41) 3344-5566',
      city: 'Curitiba',
      state: 'PR',
      zipCode: '80010-000',
      notes: 'Cliente corporativo com recarga anual de extintores e manutenção predial.',
      source: 'PRESENCIAL',
      externalId: null,
      createdAt: '2026-11-10T10:00:00Z',
      updatedAt: '2026-11-10T10:00:00Z',
      orderCount: 3,
      lastOrderDate: '2026-11-16T14:30:00Z',
      pedidos: [
        {
          id_pedido: 101,
          codigo_pedido: 'DIR-2026-001',
          data_pedido: '2026-11-16T14:30:00Z',
          valor_total: 1250.0,
          status: 'Concluido',
          status_entrega: 'Entregue',
        },
        {
          id_pedido: 98,
          codigo_pedido: 'DIR-2026-002',
          data_pedido: '2026-10-05T09:15:00Z',
          valor_total: 820.0,
          status: 'Concluido',
          status_entrega: 'Entregue',
        },
      ],
    },
    {
      id: 2,
      name: 'Carlos Eduardo Silva',
      document: '284.912.839-44',
      email: 'carlos.silva@gmail.com',
      phone: '(43) 99887-1122',
      city: 'Londrina',
      state: 'PR',
      zipCode: '86010-100',
      notes: 'Compra balcão para restaurante e veículos leves.',
      source: 'PRESENCIAL',
      externalId: null,
      createdAt: '2026-11-12T14:00:00Z',
      updatedAt: '2026-11-12T14:00:00Z',
      orderCount: 1,
      lastOrderDate: '2026-11-14T11:20:00Z',
      pedidos: [
        {
          id_pedido: 105,
          codigo_pedido: 'DIR-2026-003',
          data_pedido: '2026-11-14T11:20:00Z',
          valor_total: 310.0,
          status: 'Concluido',
          status_entrega: 'Entregue',
        },
      ],
    },
    {
      id: 3,
      name: 'Marcos Vinicius Santos (COMPRADOR_ML_OFICIAL)',
      document: null,
      email: 'comprador.ml@mercadolivre.com',
      phone: '(11) 98765-4321',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
      notes: 'Cliente gerado automaticamente a partir de pedido no Mercado Livre.',
      source: 'MERCADO_LIVRE',
      externalId: '20000049281729',
      createdAt: '2026-11-15T08:30:00Z',
      updatedAt: '2026-11-15T08:30:00Z',
      orderCount: 1,
      lastOrderDate: '2026-11-15T08:30:00Z',
      pedidos: [
        {
          id_pedido: 110,
          codigo_pedido: 'MLB-20000049281729',
          data_pedido: '2026-11-15T08:30:00Z',
          valor_total: 188.8,
          status: 'Confirmado',
          status_entrega: 'A separar',
        },
      ],
    },
  ];

  // ── Estado da Tela ────────────────────────────────────────────────────────
  const state = {
    paginaAtual: 1,
    limite: 10,
    busca: '',
    origem: 'ALL',
    totalRegistros: 0,
    totalPaginas: 1,
    clientes: [],
    clienteSelecionado: null,
    debounceTimer: null,
  };

  function loadLocalClientes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CLIENTES));
    return DEFAULT_CLIENTES;
  }

  function saveLocalClientes(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  // ── Utilitários de Formatação & Máscaras ───────────────────────────────────
  function apenasDigitos(val) {
    return (val || '').replace(/\D/g, '');
  }

  function formatarDocumento(doc) {
    if (!doc) return '—';
    const d = apenasDigitos(doc);
    if (d.length === 11) {
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (d.length === 14) {
      return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  }

  function formatarTelefone(tel) {
    if (!tel) return '—';
    const d = apenasDigitos(tel);
    if (d.length === 11) {
      return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (d.length === 10) {
      return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return tel;
  }

  function formatarCep(cep) {
    if (!cep) return '—';
    const d = apenasDigitos(cep);
    if (d.length === 8) {
      return d.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    return cep;
  }

  function formatarData(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  function formatarMoeda(val) {
    const num = Number(val || 0);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // ── Validação de CPF e CNPJ ───────────────────────────────────────────────
  function validarCpf(cpfRaw) {
    const cpf = apenasDigitos(cpfRaw);
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpf.charAt(i), 10) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9), 10)) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpf.charAt(i), 10) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf.charAt(10), 10);
  }

  function validarCnpj(cnpjRaw) {
    const cnpj = apenasDigitos(cnpjRaw);
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    const b = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < 12; i++) {
      soma += parseInt(cnpj.charAt(i), 10) * b[i + 1];
    }
    let resto = soma % 11;
    const d1 = resto < 2 ? 0 : 11 - resto;
    if (parseInt(cnpj.charAt(12), 10) !== d1) return false;

    soma = 0;
    for (let i = 0; i < 13; i++) {
      soma += parseInt(cnpj.charAt(i), 10) * b[i];
    }
    resto = soma % 11;
    const d2 = resto < 2 ? 0 : 11 - resto;
    return parseInt(cnpj.charAt(13), 10) === d2;
  }

  function validarCpfOuCnpj(doc) {
    if (!doc || !doc.trim()) return true;
    const d = apenasDigitos(doc);
    if (d.length === 11) return validarCpf(d);
    if (d.length === 14) return validarCnpj(d);
    return false;
  }

  // ── Toasts de Feedback ────────────────────────────────────────────────────
  function showToast(msg, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        ${
          tipo === 'sucesso'
            ? '<path d="M20 6L9 17l-5-5"/>'
            : tipo === 'erro'
            ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
            : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
        }
      </svg>
      <span>${escapeHtml(msg)}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));

    setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 4000);
  }

  // ── Inicialização ─────────────────────────────────────────────────────────
  function init() {
    // 1. Renderiza a sidebar na aplicação
    try {
      if (typeof renderSidebar === 'function') {
        renderSidebar('clientes');
      } else if (window.RezFireLayout && typeof window.RezFireLayout.renderSidebar === 'function') {
        window.RezFireLayout.renderSidebar('clientes');
      }
    } catch (e) {
      console.warn('[Clientes] Falha ao renderizar sidebar:', e);
    }

    // 2. Conecta eventos
    bindEvents();

    // 3. Carrega os clientes
    carregarClientes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Eventos de Interface ──────────────────────────────────────────────────
  function bindEvents() {
    // Busca com debounce
    const inputBusca = document.getElementById('filtro-busca');
    const btnLimparBusca = document.getElementById('btn-limpar-busca');

    if (inputBusca) {
      inputBusca.addEventListener('input', (e) => {
        const val = e.target.value;
        if (btnLimparBusca) {
          btnLimparBusca.classList.toggle('hidden', !val);
        }
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(() => {
          state.busca = val.trim();
          state.paginaAtual = 1;
          carregarClientes();
        }, 300);
      });
    }

    if (btnLimparBusca) {
      btnLimparBusca.addEventListener('click', () => {
        if (inputBusca) {
          inputBusca.value = '';
          btnLimparBusca.classList.add('hidden');
          state.busca = '';
          state.paginaAtual = 1;
          carregarClientes();
        }
      });
    }

    // Filtro de Origem
    const selectOrigem = document.getElementById('filtro-origem');
    if (selectOrigem) {
      selectOrigem.addEventListener('change', (e) => {
        state.origem = e.target.value;
        state.paginaAtual = 1;
        carregarClientes();
      });
    }

    // Limpar todos os filtros
    const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener('click', () => {
        if (inputBusca) inputBusca.value = '';
        if (btnLimparBusca) btnLimparBusca.classList.add('hidden');
        if (selectOrigem) selectOrigem.value = 'ALL';
        state.busca = '';
        state.origem = 'ALL';
        state.paginaAtual = 1;
        carregarClientes();
      });
    }

    // Botão Atualizar
    const btnAtualizar = document.getElementById('btn-atualizar');
    if (btnAtualizar) {
      btnAtualizar.addEventListener('click', () => carregarClientes());
    }

    // Botão Tentar Novamente (Erro)
    const btnTentar = document.getElementById('btn-tentar-novamente');
    if (btnTentar) {
      btnTentar.addEventListener('click', () => carregarClientes());
    }

    // Seletor de Limite de Paginação
    const selectLimite = document.getElementById('paginacao-limite');
    if (selectLimite) {
      selectLimite.addEventListener('change', (e) => {
        state.limite = Number(e.target.value) || 10;
        state.paginaAtual = 1;
        carregarClientes();
      });
    }

    // Botões de Paginação Anterior / Próxima
    const btnAnt = document.getElementById('btn-pag-anterior');
    if (btnAnt) {
      btnAnt.addEventListener('click', () => {
        if (state.paginaAtual > 1) {
          state.paginaAtual--;
          carregarClientes();
        }
      });
    }

    const btnProx = document.getElementById('btn-pag-proxima');
    if (btnProx) {
      btnProx.addEventListener('click', () => {
        if (state.paginaAtual < state.totalPaginas) {
          state.paginaAtual++;
          carregarClientes();
        }
      });
    }

    // Modal Novo Cliente
    const btnNovo = document.getElementById('btn-novo-cliente');
    const btnVazioNovo = document.getElementById('btn-vazio-novo-cliente');
    const btnFecharModal = document.getElementById('btn-fechar-modal-novo');
    const btnCancelarModal = document.getElementById('btn-cancelar-modal-novo');

    if (btnNovo) btnNovo.addEventListener('click', abrirModalNovoCliente);
    if (btnVazioNovo) btnVazioNovo.addEventListener('click', abrirModalNovoCliente);
    if (btnFecharModal) btnFecharModal.addEventListener('click', fecharModalNovoCliente);
    if (btnCancelarModal) btnCancelarModal.addEventListener('click', fecharModalNovoCliente);

    // Form Novo Cliente
    const formNovo = document.getElementById('form-novo-cliente');
    if (formNovo) {
      formNovo.addEventListener('submit', salvarNovoCliente);
    }

    // Drawer de Detalhes
    const btnFecharDrawer = document.getElementById('btn-fechar-drawer');
    const overlayDrawer = document.getElementById('drawer-overlay');
    if (btnFecharDrawer) btnFecharDrawer.addEventListener('click', fecharDrawerDetalhes);
    if (overlayDrawer) overlayDrawer.addEventListener('click', fecharDrawerDetalhes);

    // Form Edição de Cliente
    const formEdicao = document.getElementById('form-editar-cliente');
    if (formEdicao) {
      formEdicao.addEventListener('submit', salvarEdicaoCliente);
    }

    // Tecla ESC para fechar modais/drawers
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        fecharModalNovoCliente();
        fecharDrawerDetalhes();
      }
    });

    // Máscaras de entrada em tempo real
    aplicarMascarasInputs();
  }

  function aplicarMascarasInputs() {
    const aplicarMascaraDoc = (input) => {
      if (!input) return;
      input.addEventListener('input', (e) => {
        let v = apenasDigitos(e.target.value);
        if (v.length <= 11) {
          v = v.replace(/(\d{3})(\d)/, '$1.$2');
          v = v.replace(/(\d{3})(\d)/, '$1.$2');
          v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        } else {
          v = v.substring(0, 14);
          v = v.replace(/^(\d{2})(\d)/, '$1.$2');
          v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
          v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
          v = v.replace(/(\d{4})(\d)/, '$1-$2');
        }
        e.target.value = v;

        const erroEl = document.getElementById('erro-documento');
        if (erroEl && input.id === 'campo-documento') {
          if (v && !validarCpfOuCnpj(v)) {
            erroEl.classList.remove('hidden');
          } else {
            erroEl.classList.add('hidden');
          }
        }
      });
    };

    const aplicarMascaraTel = (input) => {
      if (!input) return;
      input.addEventListener('input', (e) => {
        let v = apenasDigitos(e.target.value).substring(0, 11);
        if (v.length > 10) {
          v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        } else if (v.length > 5) {
          v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
        } else if (v.length > 2) {
          v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
        }
        e.target.value = v;
      });
    };

    const aplicarMascaraCep = (input) => {
      if (!input) return;
      input.addEventListener('input', (e) => {
        let v = apenasDigitos(e.target.value).substring(0, 8);
        if (v.length > 5) {
          v = v.replace(/^(\d{5})(\d{1,3})$/, '$1-$2');
        }
        e.target.value = v;
      });
    };

    aplicarMascaraDoc(document.getElementById('campo-documento'));
    aplicarMascaraTel(document.getElementById('campo-telefone'));
    aplicarMascaraCep(document.getElementById('campo-cep'));

    aplicarMascaraDoc(document.getElementById('drawer-campo-documento'));
    aplicarMascaraTel(document.getElementById('drawer-campo-telefone'));
    aplicarMascaraCep(document.getElementById('drawer-campo-cep'));
  }

  // ── Carregamento de Dados ─────────────────────────────────────────────────
  async function carregarClientes() {
    let carregados = null;
    let totalBanco = 0;
    let paginasBanco = 1;

    try {
      const params = {
        page: state.paginaAtual,
        limit: state.limite,
      };

      if (state.busca) params.search = state.busca;
      if (state.origem && state.origem !== 'ALL') params.source = state.origem;

      if (window.RezFireAPI && window.RezFireAPI.customers) {
        const res = await window.RezFireAPI.customers.listar(params);
        if (res && Array.isArray(res.data)) {
          carregados = res.data;
          totalBanco = Number(res.total) || res.data.length;
          paginasBanco = Number(res.totalPages) || 1;
        }
      }
    } catch (err) {
      console.warn('[Clientes] Backend não conectado ou offline, operando em contingência local:', err.message);
    }

    if (carregados !== null) {
      // Dados recebidos do MySQL com sucesso!
      state.clientes = carregados;
      state.totalRegistros = totalBanco;
      state.totalPaginas = paginasBanco;
    } else {
      // Fallback local robusto (filtra e pagina no array local do localStorage)
      const todosLocais = loadLocalClientes();
      let filtrados = todosLocais;

      if (state.origem && state.origem !== 'ALL') {
        filtrados = filtrados.filter((c) => c.source === state.origem);
      }

      if (state.busca) {
        const b = state.busca.toLowerCase();
        const bNum = apenasDigitos(state.busca);
        filtrados = filtrados.filter((c) => {
          const nomeMatch = (c.name || '').toLowerCase().includes(b);
          const emailMatch = (c.email || '').toLowerCase().includes(b);
          const telMatch = (c.phone || '').includes(b);
          const docMatch = (c.document || '').includes(b);
          const docNumMatch = bNum && apenasDigitos(c.document).includes(bNum);
          return nomeMatch || emailMatch || telMatch || docMatch || docNumMatch;
        });
      }

      state.totalRegistros = filtrados.length;
      state.totalPaginas = Math.ceil(filtrados.length / state.limite) || 1;
      const offset = (state.paginaAtual - 1) * state.limite;
      state.clientes = filtrados.slice(offset, offset + state.limite);
    }

    // Renderiza a interface
    renderizarTabela();
    renderizarPaginacao();
    atualizarKPIs();

    if (state.clientes.length === 0) {
      exibirEstado('vazio');
    } else {
      exibirEstado('tabela');
    }
  }

  // ── Renderização da Tabela ────────────────────────────────────────────────
  function renderizarTabela() {
    const tbody = document.getElementById('tabela-clientes-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    state.clientes.forEach((cliente) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-stone-50 transition-colors';

      const isML = cliente.source === 'MERCADO_LIVRE';
      const badgeClass = isML ? 'badge-ml' : 'badge-presencial';
      const badgeTexto = isML ? 'Mercado Livre' : 'Presencial';

      const docFormatado = formatarDocumento(cliente.document);
      const telFormatado = formatarTelefone(cliente.phone);
      const emailTexto = cliente.email ? cliente.email : '';
      const localizacao = cliente.city
        ? `${cliente.city}${cliente.state ? ' / ' + cliente.state : ''}`
        : '—';

      const dataCadastro = formatarData(cliente.createdAt);
      const ultimoPedido = formatarData(cliente.lastOrderDate);
      const qtdPedidos = Number(cliente.orderCount || 0);

      tr.innerHTML = `
        <td class="py-3 px-4 font-semibold text-stone-900">
          <div class="flex items-center gap-2">
            <span>${escapeHtml(cliente.name)}</span>
            ${
              isML && cliente.externalId
                ? `<span class="text-[10px] text-stone-400 font-mono" title="ID Comprador ML: ${cliente.externalId}">#${cliente.externalId.substring(0, 8)}...</span>`
                : ''
            }
          </div>
        </td>
        <td class="py-3 px-4">
          <span class="badge-origem ${badgeClass}">
            <span class="badge-origem-dot"></span>
            ${badgeTexto}
          </span>
        </td>
        <td class="py-3 px-4 text-stone-600 font-mono text-[11px]">
          ${docFormatado}
        </td>
        <td class="py-3 px-4 text-stone-600">
          <div>${telFormatado}</div>
          ${emailTexto ? `<div class="text-[11px] text-stone-400 truncate max-w-[180px]">${escapeHtml(emailTexto)}</div>` : ''}
        </td>
        <td class="py-3 px-4 text-stone-600">
          ${escapeHtml(localizacao)}
        </td>
        <td class="py-3 px-4 text-center">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${qtdPedidos > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-100 text-stone-500'}">
            ${qtdPedidos}
          </span>
        </td>
        <td class="py-3 px-4 text-stone-600 text-xs">
          ${ultimoPedido}
        </td>
        <td class="py-3 px-4 text-stone-500 text-xs">
          ${dataCadastro}
        </td>
        <td class="py-3 px-4 text-right">
          <button
            type="button"
            data-id="${cliente.id}"
            class="btn-detalhes btn-ghost text-xs px-2.5 py-1 border-stone-200 hover:border-accent hover:text-accent inline-flex items-center gap-1 shadow-2xs"
            title="Ver detalhes do cliente e histórico de pedidos"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Detalhes
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Vincula eventos nos botões de detalhes
    tbody.querySelectorAll('.btn-detalhes').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        if (id) abrirDrawerDetalhes(id);
      });
    });
  }

  // ── Renderização da Paginação ─────────────────────────────────────────────
  function renderizarPaginacao() {
    const elInfo = document.getElementById('paginacao-info');
    const btnAnt = document.getElementById('btn-pag-anterior');
    const btnProx = document.getElementById('btn-pag-proxima');
    const containerBotoes = document.getElementById('paginacao-botoes');

    const total = state.totalRegistros;
    const inicio = total === 0 ? 0 : (state.paginaAtual - 1) * state.limite + 1;
    const fim = Math.min(state.paginaAtual * state.limite, total);

    if (elInfo) {
      elInfo.textContent = `Mostrando ${inicio} a ${fim} de ${total} clientes`;
    }

    if (btnAnt) {
      btnAnt.disabled = state.paginaAtual <= 1;
    }
    if (btnProx) {
      btnProx.disabled = state.paginaAtual >= state.totalPaginas;
    }

    if (containerBotoes) {
      containerBotoes.innerHTML = '';
      const totalPags = state.totalPaginas;

      let startPage = Math.max(1, state.paginaAtual - 2);
      let endPage = Math.min(totalPags, startPage + 4);
      if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
      }

      for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isCurrent = p === state.paginaAtual;
        btn.className = `px-2.5 py-1 text-xs rounded border transition-colors ${
          isCurrent
            ? 'bg-accent text-white border-accent font-bold'
            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
        }`;
        btn.textContent = String(p);
        btn.addEventListener('click', () => {
          if (state.paginaAtual !== p) {
            state.paginaAtual = p;
            carregarClientes();
          }
        });
        containerBotoes.appendChild(btn);
      }
    }
  }

  // ── Atualização dos KPIs ──────────────────────────────────────────────────
  function atualizarKPIs() {
    const elTotal = document.getElementById('kpi-total-clientes');
    const elPresenciais = document.getElementById('kpi-clientes-presenciais');
    const elML = document.getElementById('kpi-clientes-ml');
    const elRecorrentes = document.getElementById('kpi-compras-recorrentes');

    const listaBase = loadLocalClientes();
    const totalGeral = state.totalRegistros > 0 ? state.totalRegistros : listaBase.length;
    const presenciais = listaBase.filter((c) => c.source === 'PRESENCIAL').length;
    const ml = listaBase.filter((c) => c.source === 'MERCADO_LIVRE').length;
    const recorrentes = listaBase.filter((c) => Number(c.orderCount || 0) >= 2).length;

    if (elTotal) elTotal.textContent = String(totalGeral);
    if (elPresenciais) elPresenciais.textContent = String(presenciais);
    if (elML) elML.textContent = String(ml);
    if (elRecorrentes) elRecorrentes.textContent = String(recorrentes);
  }

  // ── Controle de Estados da UI ─────────────────────────────────────────────
  function exibirEstado(estado) {
    const loading = document.getElementById('estado-loading');
    const vazio = document.getElementById('estado-vazio');
    const erro = document.getElementById('estado-erro');
    const tabelaContainer = document.querySelector('.overflow-x-auto');
    const paginacao = document.getElementById('paginacao-container');

    if (loading) loading.style.display = estado === 'loading' ? 'block' : 'none';
    if (vazio) vazio.style.display = estado === 'vazio' ? 'block' : 'none';
    if (erro) erro.style.display = estado === 'erro' ? 'block' : 'none';

    if (tabelaContainer) {
      tabelaContainer.style.display = estado === 'tabela' ? 'block' : 'none';
    }
    if (paginacao) {
      paginacao.style.display = estado === 'tabela' ? 'flex' : 'none';
    }
  }

  // ── Modal Novo Cliente Presencial ─────────────────────────────────────────
  function abrirModalNovoCliente() {
    const modal = document.getElementById('modal-novo-cliente');
    const form = document.getElementById('form-novo-cliente');
    const erroDoc = document.getElementById('erro-documento');

    if (form) form.reset();
    if (erroDoc) erroDoc.classList.add('hidden');
    if (modal) modal.classList.add('is-open');

    setTimeout(() => {
      const campoNome = document.getElementById('campo-nome');
      if (campoNome) campoNome.focus();
    }, 100);
  }

  function fecharModalNovoCliente() {
    const modal = document.getElementById('modal-novo-cliente');
    if (modal) modal.classList.remove('is-open');
  }

  async function salvarNovoCliente(e) {
    e.preventDefault();
    const btnSalvar = document.getElementById('btn-salvar-novo-cliente');
    const form = e.target;

    const nome = form.name.value.trim();
    const documento = form.document.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const city = form.city.value.trim();
    const stateVal = form.state.value.trim();
    const zipCode = form.zipCode.value.trim();
    const notes = form.notes.value.trim();

    if (!nome) {
      showToast('O nome completo ou razão social é obrigatório.', 'erro');
      return;
    }

    if (documento && !validarCpfOuCnpj(documento)) {
      showToast('O CPF ou CNPJ informado é inválido.', 'erro');
      const erroDoc = document.getElementById('erro-documento');
      if (erroDoc) erroDoc.classList.remove('hidden');
      return;
    }

    const payload = {
      name: nome,
      document: documento || null,
      email: email || null,
      phone: phone || null,
      city: city || null,
      state: stateVal || null,
      zipCode: zipCode || null,
      notes: notes || null,
      source: 'PRESENCIAL',
    };

    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.innerHTML = `<span>Gravando...</span>`;
    }

    let salvouNaApi = false;
    try {
      if (window.RezFireAPI && window.RezFireAPI.customers) {
        const res = await window.RezFireAPI.customers.criar(payload);
        if (res && res.sucesso) {
          salvouNaApi = true;
          showToast(res.mensagem || 'Cliente presencial cadastrado com sucesso!', 'sucesso');
        }
      }
    } catch (apiErr) {
      if (apiErr.message && apiErr.message.includes('Já existe')) {
        showToast(apiErr.message, 'erro');
        if (btnSalvar) {
          btnSalvar.disabled = false;
          btnSalvar.innerHTML = '<span>Salvar Cliente</span>';
        }
        return;
      }
      console.warn('[Clientes] Backend offline, salvando localmente:', apiErr);
    }

    if (!salvouNaApi) {
      // Salva localmente (contingência)
      const lista = loadLocalClientes();

      // Checa duplicidade local
      const docLimpo = apenasDigitos(documento);
      if (docLimpo && lista.some((c) => apenasDigitos(c.document) === docLimpo)) {
        showToast('Já existe um cliente cadastrado com este documento.', 'erro');
        if (btnSalvar) {
          btnSalvar.disabled = false;
          btnSalvar.innerHTML = '<span>Salvar Cliente</span>';
        }
        return;
      }

      const novoId = lista.length > 0 ? Math.max(...lista.map((c) => c.id || 0)) + 1 : 1;
      const novoCliente = {
        ...payload,
        id: novoId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        orderCount: 0,
        lastOrderDate: null,
        pedidos: [],
      };
      lista.unshift(novoCliente);
      saveLocalClientes(lista);
      showToast('Cliente cadastrado com sucesso!', 'sucesso');
    }

    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = '<span>Salvar Cliente</span>';
    }

    fecharModalNovoCliente();
    state.paginaAtual = 1;
    await carregarClientes();
  }

  // ── Drawer de Detalhes e Edição ───────────────────────────────────────────
  async function abrirDrawerDetalhes(id) {
    const drawer = document.getElementById('drawer-detalhes');
    const overlay = document.getElementById('drawer-overlay');
    if (!drawer) return;

    let cliente = null;

    try {
      if (window.RezFireAPI && window.RezFireAPI.customers) {
        const res = await window.RezFireAPI.customers.buscarPorId(id);
        if (res && res.cliente) {
          cliente = res.cliente;
        }
      }
    } catch (err) {
      console.warn('[Clientes] Falha ao buscar detalhes na API, buscando localmente:', err);
    }

    if (!cliente) {
      const lista = loadLocalClientes();
      cliente = lista.find((c) => c.id === id);
    }

    if (!cliente) {
      showToast('Cliente não encontrado.', 'erro');
      return;
    }

    state.clienteSelecionado = cliente;
    preencherDrawer(cliente);

    drawer.classList.add('is-open');
    if (overlay) overlay.classList.add('is-open');
  }

  function fecharDrawerDetalhes() {
    const drawer = document.getElementById('drawer-detalhes');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-open');
    state.clienteSelecionado = null;
  }

  function preencherDrawer(cliente) {
    const isML = cliente.source === 'MERCADO_LIVRE';

    const badge = document.getElementById('drawer-origem-badge');
    const subtitulo = document.getElementById('drawer-subtitulo');
    const alertaML = document.getElementById('alerta-ml-readonly');
    const externalIdEl = document.getElementById('drawer-external-id');

    if (badge) {
      badge.className = `badge-origem ${isML ? 'badge-ml' : 'badge-presencial'}`;
      badge.textContent = isML ? 'Mercado Livre' : 'Presencial';
    }
    if (subtitulo) {
      subtitulo.textContent = `Cadastrado em ${formatarData(cliente.createdAt)}`;
    }

    if (alertaML) {
      alertaML.classList.toggle('hidden', !isML);
      if (isML && externalIdEl) {
        externalIdEl.textContent = `ID Comprador no Mercado Livre: ${cliente.externalId || 'Sincronizado'}`;
      }
    }

    const inputId = document.getElementById('drawer-cliente-id');
    const inputNome = document.getElementById('drawer-campo-nome');
    const inputDoc = document.getElementById('drawer-campo-documento');
    const inputTel = document.getElementById('drawer-campo-telefone');
    const inputEmail = document.getElementById('drawer-campo-email');
    const inputCep = document.getElementById('drawer-campo-cep');
    const inputCidade = document.getElementById('drawer-campo-cidade');
    const inputUf = document.getElementById('drawer-campo-uf');
    const inputObs = document.getElementById('drawer-campo-observacoes');

    if (inputId) inputId.value = cliente.id;
    if (inputNome) {
      inputNome.value = cliente.name || '';
      inputNome.readOnly = isML;
      inputNome.classList.toggle('bg-stone-50', isML);
    }
    if (inputDoc) {
      inputDoc.value = formatarDocumento(cliente.document);
      inputDoc.readOnly = isML;
      inputDoc.classList.toggle('bg-stone-50', isML);
    }
    if (inputTel) {
      inputTel.value = formatarTelefone(cliente.phone);
      inputTel.readOnly = isML;
      inputTel.classList.toggle('bg-stone-50', isML);
    }
    if (inputEmail) {
      inputEmail.value = cliente.email || '';
      inputEmail.readOnly = isML;
      inputEmail.classList.toggle('bg-stone-50', isML);
    }
    if (inputCep) {
      inputCep.value = formatarCep(cliente.zipCode);
      inputCep.readOnly = isML;
      inputCep.classList.toggle('bg-stone-50', isML);
    }
    if (inputCidade) {
      inputCidade.value = cliente.city || '';
      inputCidade.readOnly = isML;
      inputCidade.classList.toggle('bg-stone-50', isML);
    }
    if (inputUf) {
      inputUf.value = cliente.state || '';
      inputUf.readOnly = isML;
      inputUf.classList.toggle('bg-stone-50', isML);
    }
    if (inputObs) {
      inputObs.value = cliente.notes || '';
    }

    renderizarHistoricoPedidos(cliente.pedidos || []);
  }

  function renderizarHistoricoPedidos(pedidos) {
    const elQtd = document.getElementById('drawer-qtd-pedidos');
    const lista = document.getElementById('drawer-pedidos-lista');

    if (elQtd) elQtd.textContent = String(pedidos.length);
    if (!lista) return;

    if (pedidos.length === 0) {
      lista.innerHTML = `
        <div class="text-xs text-stone-400 p-3 text-center bg-stone-50 rounded border border-stone-200">
          Nenhum pedido vinculado a este cliente no momento.
        </div>
      `;
      return;
    }

    lista.innerHTML = pedidos
      .map((p) => {
        const dataPed = formatarData(p.data_pedido);
        const valor = formatarMoeda(p.valor_total);
        const statusComercial = p.status || 'Confirmado';
        const statusEntrega = p.status_entrega || 'A separar';

        return `
          <div class="p-3 bg-stone-50 border border-stone-200 rounded-md text-xs hover:border-stone-300 transition-colors">
            <div class="flex items-center justify-between mb-1">
              <span class="font-bold text-stone-900">${escapeHtml(p.codigo_pedido)}</span>
              <span class="font-semibold text-stone-900">${valor}</span>
            </div>
            <div class="flex items-center justify-between text-stone-500 text-[11px]">
              <span>Data: ${dataPed}</span>
              <div class="flex items-center gap-1.5">
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  statusComercial === 'Concluido' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }">${statusComercial}</span>
                <span class="text-stone-400">•</span>
                <span>${statusEntrega}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  async function salvarEdicaoCliente(e) {
    e.preventDefault();
    if (!state.clienteSelecionado) return;

    const cliente = state.clienteSelecionado;
    const isML = cliente.source === 'MERCADO_LIVRE';
    const btnSalvar = document.getElementById('btn-salvar-edicao');

    const inputObs = document.getElementById('drawer-campo-observacoes');
    const notes = inputObs ? inputObs.value.trim() : null;

    let payload = { notes };

    if (!isML) {
      const inputNome = document.getElementById('drawer-campo-nome');
      const inputDoc = document.getElementById('drawer-campo-documento');
      const inputTel = document.getElementById('drawer-campo-telefone');
      const inputEmail = document.getElementById('drawer-campo-email');
      const inputCep = document.getElementById('drawer-campo-cep');
      const inputCidade = document.getElementById('drawer-campo-cidade');
      const inputUf = document.getElementById('drawer-campo-uf');

      const nome = inputNome ? inputNome.value.trim() : '';
      const doc = inputDoc ? inputDoc.value.trim() : null;

      if (!nome) {
        showToast('O nome é obrigatório.', 'erro');
        return;
      }
      if (doc && !validarCpfOuCnpj(doc)) {
        showToast('O CPF ou CNPJ informado é inválido.', 'erro');
        return;
      }

      payload = {
        name: nome,
        document: doc || null,
        phone: inputTel ? inputTel.value.trim() || null : null,
        email: inputEmail ? inputEmail.value.trim() || null : null,
        zipCode: inputCep ? inputCep.value.trim() || null : null,
        city: inputCidade ? inputCidade.value.trim() || null : null,
        state: inputUf ? inputUf.value.trim().toUpperCase() || null : null,
        notes,
      };
    }

    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando...';
    }

    let atualizouNaApi = false;
    try {
      if (window.RezFireAPI && window.RezFireAPI.customers) {
        const res = await window.RezFireAPI.customers.atualizar(cliente.id, payload);
        if (res && res.sucesso) {
          atualizouNaApi = true;
          showToast(res.mensagem || 'Cliente atualizado com sucesso!', 'sucesso');
        }
      }
    } catch (err) {
      console.warn('[Clientes] Backend indisponível, atualizando localmente:', err);
    }

    if (!atualizouNaApi) {
      const lista = loadLocalClientes();
      const idx = lista.findIndex((c) => c.id === cliente.id);
      if (idx !== -1) {
        lista[idx] = {
          ...lista[idx],
          ...payload,
          updatedAt: new Date().toISOString(),
        };
        saveLocalClientes(lista);
        showToast('Cliente atualizado com sucesso!', 'sucesso');
      }
    }

    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar Alterações';
    }

    fecharDrawerDetalhes();
    await carregarClientes();
  }

  // ── Utilitário de Escape HTML ─────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
