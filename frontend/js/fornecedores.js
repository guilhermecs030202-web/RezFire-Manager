/**
 * fornecedores.js
 * Controlador da Tela de Fornecedores — RezFire Manager
 * Gerencia fornecedores, cotações, lead times e vínculo de produtos no MySQL.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'rezfire.fornecedores';

  // ── Dados de Contingência / Demonstração (Fallback Local) ─────────────────
  const DEFAULT_FORNECEDORES = [
    {
      id: 1,
      razaoSocial: 'Resil Indústria e Comércio LTDA',
      nomeFantasia: 'Resil Extintores',
      cnpj: '11.222.333/0001-44',
      inscricaoEstadual: '112.334.556.778',
      contatoNome: 'Roberto Santos',
      telefone: '(11) 4002-8922',
      email: 'comercial@resil.com.br',
      cep: '09015-000',
      logradouro: 'Av. Industrial',
      numero: '1200',
      bairro: 'Jardim',
      cidade: 'Santo André',
      estado: 'SP',
      prazoPadraoDias: 5,
      condicoesPagamento: '28 DDL faturado',
      observacoes: 'Principal parceiro de cilindros automotivos e extintores ABC novos.',
      ativo: true,
      prazoMedioReal: 4.8,
      totalGasto: 48500.0,
      totalPedidos: 6,
      createdAt: '2026-01-10T10:00:00Z',
      produtos: [
        {
          idProduto: 1,
          sku: 'EXT-ABC-01KG',
          nome: 'Extintor ABC 1kg Automotivo',
          custoCompra: 38.5,
          principal: true,
        },
        {
          idProduto: 2,
          sku: 'EXT-ABC-04KG',
          nome: 'Extintor ABC 4kg Predial',
          custoCompra: 68.0,
          principal: true,
        },
      ],
      ultimosPedidos: [
        {
          id: 1,
          codigo: 'OC-2026-001',
          dataEmissao: '2026-11-01',
          dataRecebimento: '2026-11-06',
          status: 'Recebido',
          valorTotal: 15400.0,
        },
      ],
    },
    {
      id: 2,
      razaoSocial: 'Bucka Spiero Indústria e Comércio LTDA',
      nomeFantasia: 'Bucka Incêndio',
      cnpj: '22.333.444/0001-55',
      inscricaoEstadual: '223.445.667.889',
      contatoNome: 'Fernanda Lima',
      telefone: '(11) 3214-5500',
      email: 'contato@bucka.com.br',
      cep: '01310-200',
      logradouro: 'Rua Bela Cintra',
      numero: '450',
      bairro: 'Consolação',
      cidade: 'São Paulo',
      estado: 'SP',
      prazoPadraoDias: 7,
      condicoesPagamento: '30/60 DDL',
      observacoes: 'Fornecedor de extintores industriais de CO2 e pó químico especial.',
      ativo: true,
      prazoMedioReal: 6.5,
      totalGasto: 27800.0,
      totalPedidos: 4,
      createdAt: '2026-01-15T10:00:00Z',
      produtos: [
        {
          idProduto: 3,
          sku: 'EXT-CO2-06KG',
          nome: 'Extintor CO2 6kg Industrial',
          custoCompra: 142.0,
          principal: true,
        },
      ],
      ultimosPedidos: [],
    },
    {
      id: 3,
      razaoSocial: 'Extinpel Componentes Contra Incêndio EIRELI',
      nomeFantasia: 'Extinpel Componentes',
      cnpj: '33.444.555/0001-66',
      inscricaoEstadual: 'ISENTO',
      contatoNome: 'Lucas Miranda',
      telefone: '(41) 3345-8899',
      email: 'pedidos@extinpel.com.br',
      cep: '80050-000',
      logradouro: 'Rua Marechal Deodoro',
      numero: '900',
      bairro: 'Centro',
      cidade: 'Curitiba',
      estado: 'PR',
      prazoPadraoDias: 3,
      condicoesPagamento: 'À vista via PIX (3% desc)',
      observacoes: 'Válvulas, bicos, mangueiras e manômetros homologados Inmetro.',
      ativo: true,
      prazoMedioReal: 3.0,
      totalGasto: 9200.0,
      totalPedidos: 3,
      createdAt: '2026-02-01T10:00:00Z',
      produtos: [],
      ultimosPedidos: [],
    },
    {
      id: 4,
      razaoSocial: 'Sinalize Placas e Acessórios LTDA',
      nomeFantasia: 'Sinalize Comunicação Visual',
      cnpj: '44.555.666/0001-77',
      inscricaoEstadual: '334.556.778.990',
      contatoNome: 'Mariana Duarte',
      telefone: '(11) 2955-1234',
      email: 'vendas@sinalize.com.br',
      cep: '02012-000',
      logradouro: 'Rua Voluntários da Pátria',
      numero: '310',
      bairro: 'Santana',
      cidade: 'São Paulo',
      estado: 'SP',
      prazoPadraoDias: 4,
      condicoesPagamento: '21 DDL',
      observacoes: 'Placas fotoluminescentes, suportes de solo e pedestais para extintores.',
      ativo: true,
      prazoMedioReal: 4.2,
      totalGasto: 14600.0,
      totalPedidos: 5,
      createdAt: '2026-02-15T10:00:00Z',
      produtos: [],
      ultimosPedidos: [],
    },
  ];

  // ── Estado da Tela ────────────────────────────────────────────────────────
  const state = {
    paginaAtual: 1,
    limite: 10,
    busca: '',
    status: 'ALL',
    ordenacao: 'nome',
    direcao: 'ASC',
    totalRegistros: 0,
    totalPaginas: 1,
    fornecedores: [],
    fornecedorSelecionado: null,
    catalogoProdutos: [],
    fornecedorParaInativar: null,
    debounceTimer: null,
  };

  function loadLocalFornecedores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FORNECEDORES));
    return DEFAULT_FORNECEDORES;
  }

  function saveLocalFornecedores(list) {
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

  function validarCpfOuCnpj(valor) {
    if (!valor) return true; // campo opcional ou tratado no submit
    const limpo = apenasDigitos(valor);
    if (limpo.length === 11) {
      if (/^(\d)\1{10}$/.test(limpo)) return false;
      let soma = 0, resto;
      for (let i = 1; i <= 9; i++) soma += parseInt(limpo.substring(i - 1, i)) * (11 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(limpo.substring(9, 10))) return false;
      soma = 0;
      for (let i = 1; i <= 10; i++) soma += parseInt(limpo.substring(i - 1, i)) * (12 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      return resto === parseInt(limpo.substring(10, 11));
    }
    if (limpo.length === 14) {
      if (/^(\d)\1{13}$/.test(limpo)) return false;
      let tamanho = limpo.length - 2;
      let numeros = limpo.substring(0, tamanho);
      const digitos = limpo.substring(tamanho);
      let soma = 0;
      let pos = tamanho - 7;
      for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
      }
      let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
      if (resultado !== parseInt(digitos.charAt(0))) return false;
      tamanho = tamanho + 1;
      numeros = limpo.substring(0, tamanho);
      soma = 0;
      pos = tamanho - 7;
      for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
      }
      resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
      return resultado === parseInt(digitos.charAt(1));
    }
    return false;
  }

  function aplicarMascaraDocumento(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 14) v = v.substring(0, 14);
    if (v.length <= 11) {
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      v = v.replace(/^(\d{2})(\d)/, '$1.$2');
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
      v = v.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    e.target.value = v;
  }

  function aplicarMascaraTelefone(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length > 10) {
      v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (v.length > 5) {
      v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    } else if (v.length > 2) {
      v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
    }
    e.target.value = v;
  }

  function aplicarMascaraCep(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);
    if (v.length > 5) {
      v = v.replace(/^(\d{5})(\d{1,3})$/, '$1-$2');
    }
    e.target.value = v;
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

    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // ── Atualização dos Cards de Resumo (KPIs) ────────────────────────────────
  function atualizarCardsResumo(kpis = {}) {
    const totalEl = document.getElementById('kpi-total-fornecedores');
    const ativosEl = document.getElementById('kpi-fornecedores-ativos');
    const inativosEl = document.getElementById('kpi-fornecedores-inativos');
    const leadTimeEl = document.getElementById('kpi-lead-time-medio');

    if (totalEl) totalEl.textContent = (kpis.total || 0).toLocaleString('pt-BR');
    if (ativosEl) ativosEl.textContent = (kpis.ativos || 0).toLocaleString('pt-BR');
    if (inativosEl) inativosEl.textContent = (kpis.inativos || 0).toLocaleString('pt-BR');
    if (leadTimeEl) {
      if (kpis.leadTimeMedio && !isNaN(Number(kpis.leadTimeMedio))) {
        leadTimeEl.textContent = `${Number(kpis.leadTimeMedio).toFixed(1)} dias`;
      } else {
        leadTimeEl.textContent = '—';
      }
    }
  }

  // ── Renderização da Tabela de Fornecedores ─────────────────────────────────
  function renderizarTabela() {
    const tbody = document.getElementById('tabela-fornecedores-body');
    const loading = document.getElementById('estado-loading');
    const vazio = document.getElementById('estado-vazio');
    const erro = document.getElementById('estado-erro');
    const paginacao = document.getElementById('paginacao-container');

    if (loading) loading.style.display = 'none';
    if (erro) erro.style.display = 'none';

    if (!state.fornecedores || state.fornecedores.length === 0) {
      if (tbody) tbody.innerHTML = '';
      if (vazio) vazio.style.display = 'block';
      if (paginacao) paginacao.style.display = 'none';
      return;
    }

    if (vazio) vazio.style.display = 'none';
    if (paginacao) paginacao.style.display = 'flex';

    if (tbody) {
      tbody.innerHTML = state.fornecedores
        .map((f) => {
          const nomePrincipal = f.razaoSocial || f.nome || 'Fornecedor Sem Nome';
          const nomeFantasia = f.nomeFantasia ? `<span class="text-[11px] text-stone-500 block">${f.nomeFantasia}</span>` : '';
          const docFormatado = formatarDocumento(f.cnpj);
          const contatoNome = f.contatoNome ? `<span class="font-medium text-stone-800 block">${f.contatoNome}</span>` : '';
          const telFormatado = f.telefone ? `<span class="text-stone-500 block">${formatarTelefone(f.telefone)}</span>` : '';
          const emailTexto = f.email ? `<span class="text-stone-400 text-[10px] block truncate max-w-[180px]">${f.email}</span>` : '';
          const contatoHtml = contatoNome || telFormatado || emailTexto ? `${contatoNome}${telFormatado}${emailTexto}` : '<span class="text-stone-400">—</span>';

          const cidadeUf = f.cidade || f.estado ? `${f.cidade || '—'}${f.estado ? ' / ' + f.estado : ''}` : '—';

          let leadTimeBadge = '—';
          if (f.prazoMedioReal !== null && f.prazoMedioReal !== undefined) {
            leadTimeBadge = `<span class="badge-leadtime">${Number(f.prazoMedioReal).toFixed(1)} dias</span>`;
          } else if (f.prazoPadraoDias) {
            leadTimeBadge = `<span class="badge-leadtime text-stone-600 bg-stone-100 border-stone-200">${f.prazoPadraoDias} dias (padrão)</span>`;
          }

          const statusBadge = f.ativo
            ? '<span class="badge-status badge-ativo"><span class="badge-status-dot"></span> Ativo</span>'
            : '<span class="badge-status badge-inativo"><span class="badge-status-dot"></span> Inativo</span>';

          const btnStatusTitle = f.ativo ? 'Inativar fornecedor' : 'Reativar fornecedor';
          const btnStatusIcon = f.ativo
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

          return `
            <tr class="hover:bg-stone-50/80 transition-colors text-xs text-stone-800" data-id="${f.id}">
              <td class="py-3 px-4 font-semibold text-stone-900">
                <div class="flex items-center gap-2">
                  <span class="w-7 h-7 rounded-md bg-stone-100 border border-stone-200 text-stone-700 font-bold flex items-center justify-center shrink-0">
                    ${(f.razaoSocial || 'F').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <span class="block">${nomePrincipal}</span>
                    ${nomeFantasia}
                  </div>
                </div>
              </td>
              <td class="py-3 px-4 font-mono text-[11px] text-stone-700 whitespace-nowrap">
                ${docFormatado}
              </td>
              <td class="py-3 px-4 text-xs">
                ${contatoHtml}
              </td>
              <td class="py-3 px-4 whitespace-nowrap text-stone-600">
                ${cidadeUf}
              </td>
              <td class="py-3 px-4 text-center whitespace-nowrap">
                ${leadTimeBadge}
              </td>
              <td class="py-3 px-4 text-center whitespace-nowrap">
                ${statusBadge}
              </td>
              <td class="py-3 px-4 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    class="btn-ver-detalhes p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded"
                    data-id="${f.id}"
                    title="Ver detalhes, produtos e compras"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button
                    type="button"
                    class="btn-toggle-status-tabela p-1.5 ${f.ativo ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50' : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'} rounded"
                    data-id="${f.id}"
                    data-ativo="${f.ativo}"
                    title="${btnStatusTitle}"
                  >
                    ${btnStatusIcon}
                  </button>
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

    if (info) {
      info.textContent = `Mostrando ${inicio}–${fim} de ${total} registros`;
    }

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
            carregarFornecedores();
          }
        });
        containerBotoes.appendChild(btn);
      }
    }
  }

  // ── Carregamento de Fornecedores (API + Fallback) ──────────────────────────
  async function carregarFornecedores() {
    const loading = document.getElementById('estado-loading');
    const vazio = document.getElementById('estado-vazio');
    const erro = document.getElementById('estado-erro');
    const tbody = document.getElementById('tabela-fornecedores-body');

    if (loading) loading.style.display = 'block';
    if (vazio) vazio.style.display = 'none';
    if (erro) erro.style.display = 'none';
    if (tbody) tbody.innerHTML = '';

    const params = {
      page: state.paginaAtual,
      limit: state.limite,
      busca: state.busca || undefined,
      status: state.status === 'ALL' ? undefined : state.status,
      ordenacao: state.ordenacao,
      direcao: state.direcao,
    };

    try {
      let resultado = null;
      if (window.RezFireAPI && window.RezFireAPI.suppliers && typeof window.RezFireAPI.suppliers.listar === 'function') {
        resultado = await window.RezFireAPI.suppliers.listar(params);
      }

      if (resultado && Array.isArray(resultado.data)) {
        state.fornecedores = resultado.data;
        state.totalRegistros = resultado.meta?.total || resultado.total || resultado.data.length;
        state.totalPaginas = resultado.meta?.totalPages || resultado.totalPages || 1;

        // Calcular KPIs reais
        const total = resultado.meta?.total || resultado.total || state.fornecedores.length;
        const ativos = resultado.meta?.ativos !== undefined ? resultado.meta.ativos : state.fornecedores.filter((f) => f.ativo).length;
        const inativos = resultado.meta?.inativos !== undefined ? resultado.meta.inativos : state.fornecedores.filter((f) => !f.ativo).length;

        const leadTimesValidos = state.fornecedores
          .filter((f) => f.prazoMedioReal !== null && f.prazoMedioReal !== undefined)
          .map((f) => Number(f.prazoMedioReal));
        const leadTimeMedio = resultado.meta?.leadTimeMedio !== undefined
          ? resultado.meta.leadTimeMedio
          : (leadTimesValidos.length > 0 ? leadTimesValidos.reduce((a, b) => a + b, 0) / leadTimesValidos.length : null);

        atualizarCardsResumo({ total, ativos, inativos, leadTimeMedio });
      } else {
        throw new Error('API indisponível ou formato inesperado');
      }
    } catch (err) {
      console.warn('[Fornecedores] Usando contingência local de fornecedores:', err);
      // Fallback local
      let lista = loadLocalFornecedores();

      if (state.busca) {
        const termo = state.busca.toLowerCase();
        lista = lista.filter(
          (f) =>
            (f.razaoSocial && f.razaoSocial.toLowerCase().includes(termo)) ||
            (f.nomeFantasia && f.nomeFantasia.toLowerCase().includes(termo)) ||
            (f.cnpj && f.cnpj.includes(termo)) ||
            (f.email && f.email.toLowerCase().includes(termo)) ||
            (f.contatoNome && f.contatoNome.toLowerCase().includes(termo))
        );
      }

      if (state.status === 'ATIVO') {
        lista = lista.filter((f) => f.ativo);
      } else if (state.status === 'INATIVO') {
        lista = lista.filter((f) => !f.ativo);
      }

      state.totalRegistros = lista.length;
      state.totalPaginas = Math.ceil(lista.length / state.limite) || 1;
      const offset = (state.paginaAtual - 1) * state.limite;
      state.fornecedores = lista.slice(offset, offset + state.limite);

      const todos = loadLocalFornecedores();
      const leadTimes = todos.filter((f) => f.prazoMedioReal !== null && f.prazoMedioReal !== undefined).map((f) => Number(f.prazoMedioReal));
      const leadTimeGeral = leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;

      atualizarCardsResumo({
        total: todos.length,
        ativos: todos.filter((f) => f.ativo).length,
        inativos: todos.filter((f) => !f.ativo).length,
        leadTimeMedio: leadTimeGeral,
      });
    } finally {
      renderizarTabela();
    }
  }

  // ── Carregar Catálogo de Produtos para o Dropdown ──────────────────────────
  async function carregarCatalogoProdutos() {
    if (state.catalogoProdutos.length > 0) return;
    try {
      if (window.RezFireAPI && window.RezFireAPI.produtos && typeof window.RezFireAPI.produtos.listar === 'function') {
        const res = await window.RezFireAPI.produtos.listar();
        if (Array.isArray(res)) {
          state.catalogoProdutos = res;
        } else if (res && Array.isArray(res.produtos)) {
          state.catalogoProdutos = res.produtos;
        } else if (res && Array.isArray(res.data)) {
          state.catalogoProdutos = res.data;
        }
      }
    } catch (e) {
      console.warn('[Fornecedores] Catálogo via API falhou, usando mock.', e);
    }

    if (state.catalogoProdutos.length === 0) {
      state.catalogoProdutos = [
        { id_produto: 1, sku: 'EXT-ABC-01KG', nome: 'Extintor ABC 1kg Automotivo' },
        { id_produto: 2, sku: 'EXT-ABC-04KG', nome: 'Extintor ABC 4kg Predial' },
        { id_produto: 3, sku: 'EXT-CO2-06KG', nome: 'Extintor CO2 6kg Industrial' },
        { id_produto: 4, sku: 'EXT-AP-10L', nome: 'Extintor Água Pressurizada 10L' },
        { id_produto: 5, sku: 'MAN-01', nome: 'Manômetro de Pressão Homologado' },
        { id_produto: 6, sku: 'VAL-01', nome: 'Válvula de Latão 1/2 Pol' },
        { id_produto: 7, sku: 'SUP-SOLO-01', nome: 'Suporte de Chão Triplo' },
      ];
    }
  }

  function popularSelectProdutos(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">Selecione um produto...</option>';
    state.catalogoProdutos.forEach((prod) => {
      const id = prod.id_produto || prod.id;
      const sku = prod.sku || 'SEM-SKU';
      const nome = prod.nome || 'Produto';
      const opt = document.createElement('option');
      opt.value = String(id);
      opt.textContent = `[${sku}] ${nome}`;
      selectEl.appendChild(opt);
    });
  }

  // ── Modal de Criação de Fornecedor ────────────────────────────────────────
  function abrirModalNovoFornecedor() {
    const modal = document.getElementById('modal-novo-fornecedor');
    const form = document.getElementById('form-novo-fornecedor');
    if (form) form.reset();
    const erroCnpj = document.getElementById('erro-cnpj');
    if (erroCnpj) erroCnpj.classList.add('hidden');
    if (modal) modal.classList.add('is-open');
  }

  function fecharModalNovoFornecedor() {
    const modal = document.getElementById('modal-novo-fornecedor');
    if (modal) modal.classList.remove('is-open');
  }

  async function handleSalvarNovoFornecedor(e) {
    e.preventDefault();
    const form = e.target;
    const btnSalvar = document.getElementById('btn-salvar-novo-fornecedor');

    const cnpjRaw = form.cnpj.value.trim();
    if (!validarCpfOuCnpj(cnpjRaw)) {
      const erroCnpj = document.getElementById('erro-cnpj');
      if (erroCnpj) erroCnpj.classList.remove('hidden');
      mostrarToast('CNPJ ou CPF informado é inválido.', 'erro');
      return;
    }

    const payload = {
      razaoSocial: form.razaoSocial.value.trim(),
      nomeFantasia: form.nomeFantasia.value.trim() || undefined,
      cnpj: apenasDigitos(cnpjRaw),
      inscricaoEstadual: form.inscricaoEstadual.value.trim() || undefined,
      contatoNome: form.contatoNome.value.trim() || undefined,
      telefone: form.telefone.value.trim() || undefined,
      email: form.email.value.trim() || undefined,
      cep: apenasDigitos(form.cep.value.trim()) || undefined,
      logradouro: form.logradouro.value.trim() || undefined,
      numero: form.numero.value.trim() || undefined,
      bairro: form.bairro.value.trim() || undefined,
      cidade: form.cidade.value.trim() || undefined,
      estado: form.estado.value.trim() || undefined,
      prazoPadraoDias: form.prazoPadraoDias.value ? parseInt(form.prazoPadraoDias.value, 10) : 7,
      condicoesPagamento: form.condicoesPagamento.value.trim() || undefined,
      observacoes: form.observacoes.value.trim() || undefined,
    };

    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando...';
    }

    try {
      if (window.RezFireAPI && window.RezFireAPI.suppliers && typeof window.RezFireAPI.suppliers.criar === 'function') {
        await window.RezFireAPI.suppliers.criar(payload);
        mostrarToast('Fornecedor cadastrado com sucesso!');
        fecharModalNovoFornecedor();
        carregarFornecedores();
      } else {
        // Fallback local
        const lista = loadLocalFornecedores();
        const existe = lista.some((f) => apenasDigitos(f.cnpj) === payload.cnpj);
        if (existe) {
          throw new Error('Já existe um fornecedor cadastrado com este CNPJ/CPF.');
        }
        const novo = {
          id: Date.now(),
          ...payload,
          cnpj: formatarDocumento(payload.cnpj),
          ativo: true,
          prazoMedioReal: null,
          totalGasto: 0,
          totalPedidos: 0,
          produtos: [],
          ultimosPedidos: [],
          createdAt: new Date().toISOString(),
        };
        lista.unshift(novo);
        saveLocalFornecedores(lista);
        mostrarToast('Fornecedor cadastrado com sucesso (modo contingência)!');
        fecharModalNovoFornecedor();
        carregarFornecedores();
      }
    } catch (err) {
      console.error('[Fornecedores] Erro ao cadastrar fornecedor:', err);
      const msg = err.response?.data?.message || err.message || 'Falha ao salvar fornecedor.';
      mostrarToast(msg, 'erro');
    } finally {
      if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Fornecedor';
      }
    }
  }

  // ── Drawer de Detalhes do Fornecedor ──────────────────────────────────────
  async function abrirDrawerDetalhes(id) {
    const drawer = document.getElementById('drawer-detalhes');
    const overlay = document.getElementById('drawer-overlay');
    if (!drawer || !overlay) return;

    // Reset tabs
    ativarAbaDrawer('tab-cadastral');

    // Carregar dados completos
    let fornecedor = null;
    try {
      if (window.RezFireAPI && window.RezFireAPI.suppliers && typeof window.RezFireAPI.suppliers.buscarPorId === 'function') {
        const res = await window.RezFireAPI.suppliers.buscarPorId(id);
        fornecedor = res && (res.fornecedor || res.data || res);
      }
    } catch (e) {
      console.warn('[Fornecedores] Erro ao buscar fornecedor na API, buscando na lista local.', e);
    }

    if (!fornecedor) {
      fornecedor = state.fornecedores.find((f) => f.id === Number(id)) || loadLocalFornecedores().find((f) => f.id === Number(id));
    }

    if (!fornecedor) {
      mostrarToast('Fornecedor não encontrado.', 'erro');
      return;
    }

    state.fornecedorSelecionado = fornecedor;
    preencherDrawer(fornecedor);

    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
  }

  function fecharDrawerDetalhes() {
    const drawer = document.getElementById('drawer-detalhes');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-open');
    state.fornecedorSelecionado = null;
  }

  function preencherDrawer(f) {
    const titulo = document.getElementById('drawer-titulo');
    const subtitulo = document.getElementById('drawer-subtitulo');
    const badgeStatus = document.getElementById('drawer-status-badge');
    const btnToggleStatus = document.getElementById('btn-toggle-status-fornecedor');

    if (titulo) titulo.textContent = f.razaoSocial || f.nome || 'Fornecedor';
    if (subtitulo) subtitulo.textContent = `Cadastrado em ${formatarData(f.createdAt)}`;

    if (badgeStatus) {
      badgeStatus.className = `badge-status ${f.ativo ? 'badge-ativo' : 'badge-inativo'}`;
      badgeStatus.innerHTML = `<span class="badge-status-dot"></span> ${f.ativo ? 'Ativo' : 'Inativo'}`;
    }

    if (btnToggleStatus) {
      btnToggleStatus.textContent = f.ativo ? 'Inativar Fornecedor' : 'Reativar Fornecedor';
      btnToggleStatus.className = `btn-ghost text-xs px-3 py-2 border-stone-300 ${f.ativo ? 'text-amber-700 hover:bg-amber-50' : 'text-emerald-700 hover:bg-emerald-50'}`;
    }

    // Preencher campos cadastrais
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('drawer-fornecedor-id', f.id);
    setVal('drawer-campo-razao-social', f.razaoSocial || f.nome || '');
    setVal('drawer-campo-nome-fantasia', f.nomeFantasia || '');
    setVal('drawer-campo-cnpj', formatarDocumento(f.cnpj));
    setVal('drawer-campo-ie', f.inscricaoEstadual || '');
    setVal('drawer-campo-contato-nome', f.contatoNome || '');
    setVal('drawer-campo-telefone', formatarTelefone(f.telefone));
    setVal('drawer-campo-email', f.email || '');
    setVal('drawer-campo-cep', formatarCep(f.cep));
    setVal('drawer-campo-logradouro', f.logradouro || '');
    setVal('drawer-campo-numero', f.numero || '');
    setVal('drawer-campo-bairro', f.bairro || '');
    setVal('drawer-campo-cidade', f.cidade || '');
    setVal('drawer-campo-estado', f.estado || '');
    setVal('drawer-campo-prazo', f.prazoPadraoDias !== undefined ? f.prazoPadraoDias : 7);
    setVal('drawer-campo-condicoes', f.condicoesPagamento || '');
    setVal('drawer-campo-observacoes', f.observacoes || '');

    // Renderizar produtos vinculados
    renderizarProdutosVinculados(f.produtos || []);

    // Renderizar resumo de compras
    renderizarResumoCompras(f);
  }

  function ativarAbaDrawer(tabId) {
    document.querySelectorAll('.drawer-tab').forEach((t) => {
      t.classList.toggle('is-active', t.dataset.tab === tabId);
    });

    const panes = {
      'tab-cadastral': document.getElementById('pane-tab-cadastral'),
      'tab-produtos': document.getElementById('pane-tab-produtos'),
      'tab-compras': document.getElementById('pane-tab-compras'),
    };

    Object.keys(panes).forEach((key) => {
      if (panes[key]) {
        panes[key].classList.toggle('hidden', key !== tabId);
      }
    });
  }

  // ── Sub-Aba: Produtos Fornecidos ──────────────────────────────────────────
  function renderizarProdutosVinculados(produtos = []) {
    const qtdEl = document.getElementById('drawer-tab-qtd-produtos');
    const tbody = document.getElementById('drawer-produtos-tbody');

    if (qtdEl) qtdEl.textContent = String(produtos.length);
    if (!tbody) return;

    if (produtos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="py-6 text-center text-stone-400 italic">
            Nenhum produto vinculado a este fornecedor ainda.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = produtos
      .map((p) => {
        const idProd = p.idProduto || p.id_produto || p.id;
        const sku = p.sku || 'SEM-SKU';
        const nome = p.nome || p.nomeProduto || 'Produto';
        const custo = formatarMoeda(p.custoCompra !== undefined ? p.custoCompra : p.custo_compra);
        const principalBadge = p.principal
          ? '<span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">Sim</span>'
          : '<span class="text-stone-400 text-[10px]">Não</span>';

        return `
          <tr class="hover:bg-stone-50">
            <td class="py-2 px-3">
              <span class="font-bold text-stone-900 block">[${sku}]</span>
              <span class="text-stone-500 text-[11px] block">${nome}</span>
            </td>
            <td class="py-2 px-3 text-right font-semibold text-stone-800">
              ${custo}
            </td>
            <td class="py-2 px-3 text-center">
              ${principalBadge}
            </td>
            <td class="py-2 px-3 text-right">
              <button
                type="button"
                class="btn-desvincular-produto text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                data-id-produto="${idProd}"
                title="Desvincular produto deste fornecedor"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  // ── Sub-Aba: Resumo de Compras ────────────────────────────────────────────
  function renderizarResumoCompras(f) {
    const totalGastoEl = document.getElementById('drawer-compras-total-gasto');
    const qtdPedidosEl = document.getElementById('drawer-compras-qtd-pedidos');
    const leadTimeEl = document.getElementById('drawer-compras-leadtime-real');
    const listaPedidosEl = document.getElementById('drawer-compras-lista-pedidos');

    if (totalGastoEl) totalGastoEl.textContent = formatarMoeda(f.totalGasto || 0);
    if (qtdPedidosEl) qtdPedidosEl.textContent = String(f.totalPedidos || (f.ultimosPedidos ? f.ultimosPedidos.length : 0));
    if (leadTimeEl) {
      if (f.prazoMedioReal !== null && f.prazoMedioReal !== undefined) {
        leadTimeEl.textContent = `${Number(f.prazoMedioReal).toFixed(1)} dias`;
      } else {
        leadTimeEl.textContent = f.prazoPadraoDias ? `${f.prazoPadraoDias} dias (previsto)` : '—';
      }
    }

    if (!listaPedidosEl) return;
    const pedidos = f.ultimosPedidos || [];
    if (pedidos.length === 0) {
      listaPedidosEl.innerHTML = `
        <div class="py-6 text-center text-stone-400 text-xs italic bg-stone-50 rounded-lg border border-dashed border-stone-200">
          Nenhum pedido de compra registrado para este fornecedor.
        </div>
      `;
      return;
    }

    listaPedidosEl.innerHTML = pedidos
      .map((po) => {
        const codigo = po.codigo || po.numero || `PO #${po.id}`;
        const data = formatarData(po.dataEmissao || po.data);
        const valor = formatarMoeda(po.valorTotal || po.total);
        const status = po.status || 'Recebido';

        return `
          <div class="p-3 bg-white border border-stone-200 rounded-lg flex items-center justify-between shadow-xs">
            <div>
              <span class="font-bold text-stone-900 text-xs block">${codigo}</span>
              <span class="text-[11px] text-stone-500">Emitido em ${data}</span>
            </div>
            <div class="text-right">
              <span class="font-extrabold text-stone-900 text-xs block">${valor}</span>
              <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700">${status}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // ── Salvar Edição do Fornecedor ───────────────────────────────────────────
  async function handleSalvarEdicaoFornecedor(e) {
    e.preventDefault();
    if (!state.fornecedorSelecionado) return;

    const id = state.fornecedorSelecionado.id;
    const btnSalvar = document.getElementById('btn-salvar-edicao');

    const cnpjRaw = document.getElementById('drawer-campo-cnpj').value.trim();
    if (!validarCpfOuCnpj(cnpjRaw)) {
      mostrarToast('CNPJ ou CPF informado é inválido.', 'erro');
      return;
    }

    const payload = {
      razaoSocial: document.getElementById('drawer-campo-razao-social').value.trim(),
      nomeFantasia: document.getElementById('drawer-campo-nome-fantasia').value.trim() || undefined,
      cnpj: apenasDigitos(cnpjRaw),
      inscricaoEstadual: document.getElementById('drawer-campo-ie').value.trim() || undefined,
      contatoNome: document.getElementById('drawer-campo-contato-nome').value.trim() || undefined,
      telefone: document.getElementById('drawer-campo-telefone').value.trim() || undefined,
      email: document.getElementById('drawer-campo-email').value.trim() || undefined,
      cep: apenasDigitos(document.getElementById('drawer-campo-cep').value.trim()) || undefined,
      logradouro: document.getElementById('drawer-campo-logradouro').value.trim() || undefined,
      numero: document.getElementById('drawer-campo-numero').value.trim() || undefined,
      bairro: document.getElementById('drawer-campo-bairro').value.trim() || undefined,
      cidade: document.getElementById('drawer-campo-cidade').value.trim() || undefined,
      estado: document.getElementById('drawer-campo-estado').value.trim() || undefined,
      prazoPadraoDias: document.getElementById('drawer-campo-prazo').value ? parseInt(document.getElementById('drawer-campo-prazo').value, 10) : 7,
      condicoesPagamento: document.getElementById('drawer-campo-condicoes').value.trim() || undefined,
      observacoes: document.getElementById('drawer-campo-observacoes').value.trim() || undefined,
    };

    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando...';
    }

    try {
      if (window.RezFireAPI && window.RezFireAPI.suppliers && typeof window.RezFireAPI.suppliers.atualizar === 'function') {
        const res = await window.RezFireAPI.suppliers.atualizar(id, payload);
        const atualizado = res && (res.fornecedor || res.data || res);
        state.fornecedorSelecionado = { ...state.fornecedorSelecionado, ...atualizado };
        mostrarToast('Fornecedor atualizado com sucesso!');
        preencherDrawer(state.fornecedorSelecionado);
        carregarFornecedores();
      } else {
        // Fallback local
        const lista = loadLocalFornecedores();
        const idx = lista.findIndex((f) => f.id === id);
        if (idx !== -1) {
          lista[idx] = { ...lista[idx], ...payload, cnpj: formatarDocumento(payload.cnpj) };
          saveLocalFornecedores(lista);
          state.fornecedorSelecionado = lista[idx];
          preencherDrawer(state.fornecedorSelecionado);
          carregarFornecedores();
          mostrarToast('Fornecedor atualizado com sucesso (modo contingência)!');
        }
      }
    } catch (err) {
      console.error('[Fornecedores] Erro ao atualizar fornecedor:', err);
      const msg = err.response?.data?.message || err.message || 'Falha ao salvar alterações.';
      mostrarToast(msg, 'erro');
    } finally {
      if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Alterações';
      }
    }
  }

  // ── Vincular Produto ao Fornecedor ────────────────────────────────────────
  async function abrirModalVincularProduto() {
    await carregarCatalogoProdutos();
    const select = document.getElementById('campo-vincular-produto-select');
    popularSelectProdutos(select);

    const custoInput = document.getElementById('campo-vincular-custo');
    if (custoInput) custoInput.value = '';

    const principalCheck = document.getElementById('campo-vincular-principal');
    if (principalCheck) principalCheck.checked = false;

    const modal = document.getElementById('modal-vincular-produto');
    if (modal) modal.classList.add('is-open');
  }

  function fecharModalVincularProduto() {
    const modal = document.getElementById('modal-vincular-produto');
    if (modal) modal.classList.remove('is-open');
  }

  async function handleSalvarVincularProduto(e) {
    e.preventDefault();
    if (!state.fornecedorSelecionado) return;

    const select = document.getElementById('campo-vincular-produto-select');
    const custoInput = document.getElementById('campo-vincular-custo');
    const principalCheck = document.getElementById('campo-vincular-principal');
    const btnSalvar = document.getElementById('btn-salvar-vincular-produto');

    const idProduto = parseInt(select.value, 10);
    const custoCompra = parseFloat(custoInput.value) || 0;
    const principal = principalCheck.checked;

    if (!idProduto) {
      mostrarToast('Selecione um produto para vincular.', 'erro');
      return;
    }

    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Vinculando...';
    }

    try {
      const idFornecedor = state.fornecedorSelecionado.id;
      if (window.RezFireAPI && window.RezFireAPI.suppliers && typeof window.RezFireAPI.suppliers.vincularProduto === 'function') {
        await window.RezFireAPI.suppliers.vincularProduto(idFornecedor, { idProduto, custoCompra, principal });
        // Recarregar produtos do fornecedor
        const res = await window.RezFireAPI.suppliers.listarProdutos(idFornecedor);
        const produtosAtualizados = (res && (res.produtos || res.data || res)) || [];
        state.fornecedorSelecionado.produtos = produtosAtualizados;
        renderizarProdutosVinculados(produtosAtualizados);
        mostrarToast('Produto vinculado com sucesso!');
      } else {
        // Fallback local
        const prodObj = state.catalogoProdutos.find((p) => (p.id_produto || p.id) === idProduto);
        const listaProdutos = state.fornecedorSelecionado.produtos || [];
        const indexExistente = listaProdutos.findIndex((p) => (p.idProduto || p.id_produto) === idProduto);

        const item = {
          idProduto,
          sku: prodObj?.sku || 'SKU',
          nome: prodObj?.nome || 'Produto',
          custoCompra,
          principal,
        };

        if (indexExistente >= 0) {
          listaProdutos[indexExistente] = item;
        } else {
          listaProdutos.push(item);
        }

        state.fornecedorSelecionado.produtos = listaProdutos;
        renderizarProdutosVinculados(listaProdutos);

        // Salvar no storage
        const lista = loadLocalFornecedores();
        const fIdx = lista.findIndex((f) => f.id === idFornecedor);
        if (fIdx !== -1) {
          lista[fIdx].produtos = listaProdutos;
          saveLocalFornecedores(lista);
        }
        mostrarToast('Produto vinculado com sucesso (modo contingência)!');
      }

      fecharModalVincularProduto();
    } catch (err) {
      console.error('[Fornecedores] Erro ao vincular produto:', err);
      const msg = err.response?.data?.message || err.message || 'Falha ao vincular produto.';
      mostrarToast(msg, 'erro');
    } finally {
      if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Vínculo';
      }
    }
  }

  async function handleDesvincularProduto(idProduto) {
    if (!state.fornecedorSelecionado) return;
    if (!confirm('Deseja realmente desvincular este produto deste fornecedor?')) return;

    const idFornecedor = state.fornecedorSelecionado.id;
    try {
      if (window.RezFireAPI && window.RezFireAPI.suppliers && typeof window.RezFireAPI.suppliers.desvincularProduto === 'function') {
        await window.RezFireAPI.suppliers.desvincularProduto(idFornecedor, idProduto);
        const res = await window.RezFireAPI.suppliers.listarProdutos(idFornecedor);
        const produtosAtualizados = (res && (res.produtos || res.data || res)) || [];
        state.fornecedorSelecionado.produtos = produtosAtualizados;
        renderizarProdutosVinculados(produtosAtualizados);
        mostrarToast('Produto desvinculado com sucesso!');
      } else {
        // Fallback local
        state.fornecedorSelecionado.produtos = (state.fornecedorSelecionado.produtos || []).filter(
          (p) => (p.idProduto || p.id_produto) !== Number(idProduto)
        );
        renderizarProdutosVinculados(state.fornecedorSelecionado.produtos);

        const lista = loadLocalFornecedores();
        const fIdx = lista.findIndex((f) => f.id === idFornecedor);
        if (fIdx !== -1) {
          lista[fIdx].produtos = state.fornecedorSelecionado.produtos;
          saveLocalFornecedores(lista);
        }
        mostrarToast('Produto desvinculado!');
      }
    } catch (err) {
      console.error('[Fornecedores] Erro ao desvincular produto:', err);
      const msg = err.response?.data?.message || err.message || 'Falha ao desvincular.';
      mostrarToast(msg, 'erro');
    }
  }

  // ── Alternância de Status / Inativação (Soft Delete) ──────────────────────
  function solicitarInativacao(fornecedor) {
    state.fornecedorParaInativar = fornecedor;
    const modal = document.getElementById('modal-confirmar-inativacao');
    const titulo = document.getElementById('modal-inativacao-titulo');
    const desc = document.getElementById('modal-inativacao-desc');
    const btnConfirmar = document.getElementById('btn-confirmar-inativacao');

    const nome = fornecedor.razaoSocial || fornecedor.nome || 'Fornecedor';

    if (fornecedor.ativo) {
      if (titulo) titulo.textContent = `Inativar ${nome}?`;
      if (desc) desc.textContent = 'Este fornecedor não poderá ser selecionado para novos pedidos de compra, mas seu histórico de compras e vínculos de produtos serão preservados.';
      if (btnConfirmar) {
        btnConfirmar.textContent = 'Sim, Inativar';
        btnConfirmar.className = 'btn-primary text-xs px-4 py-2 bg-red-600 hover:bg-red-700 border-red-700 text-white shadow-sm';
      }
    } else {
      if (titulo) titulo.textContent = `Reativar ${nome}?`;
      if (desc) desc.textContent = 'O fornecedor voltará a ficar disponível para novos pedidos de compra e cotações.';
      if (btnConfirmar) {
        btnConfirmar.textContent = 'Sim, Reativar';
        btnConfirmar.className = 'btn-primary text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white shadow-sm';
      }
    }

    if (modal) modal.classList.add('is-open');
  }

  function fecharModalInativacao() {
    const modal = document.getElementById('modal-confirmar-inativacao');
    if (modal) modal.classList.remove('is-open');
    state.fornecedorParaInativar = null;
  }

  async function confirmarInativacao() {
    if (!state.fornecedorParaInativar) return;
    const f = state.fornecedorParaInativar;
    const novoStatus = !f.ativo;

    try {
      if (window.RezFireAPI && window.RezFireAPI.suppliers && typeof window.RezFireAPI.suppliers.alternarStatus === 'function') {
        await window.RezFireAPI.suppliers.alternarStatus(f.id, novoStatus);
      } else {
        // Fallback local
        const lista = loadLocalFornecedores();
        const idx = lista.findIndex((item) => item.id === f.id);
        if (idx !== -1) {
          lista[idx].ativo = novoStatus;
          saveLocalFornecedores(lista);
        }
      }

      mostrarToast(`Fornecedor ${novoStatus ? 'reativado' : 'inativado'} com sucesso!`);
      fecharModalInativacao();

      if (state.fornecedorSelecionado && state.fornecedorSelecionado.id === f.id) {
        state.fornecedorSelecionado.ativo = novoStatus;
        preencherDrawer(state.fornecedorSelecionado);
      }

      carregarFornecedores();
    } catch (err) {
      console.error('[Fornecedores] Erro ao alternar status:', err);
      const msg = err.response?.data?.message || err.message || 'Falha ao alterar status.';
      mostrarToast(msg, 'erro');
    }
  }

  // ── Inicialização de Listeners e Eventos da Página ────────────────────────
  function initEventos() {
    // Layout global (sidebar, cabeçalho)
    if (typeof renderSidebar === 'function') {
      renderSidebar('fornecedores');
    }

    // Botões de abertura de modal
    const btnNovo = document.getElementById('btn-novo-fornecedor');
    if (btnNovo) btnNovo.addEventListener('click', abrirModalNovoFornecedor);

    const btnVazioNovo = document.getElementById('btn-vazio-novo-fornecedor');
    if (btnVazioNovo) btnVazioNovo.addEventListener('click', abrirModalNovoFornecedor);

    const btnAtualizar = document.getElementById('btn-atualizar');
    if (btnAtualizar) btnAtualizar.addEventListener('click', carregarFornecedores);

    const btnTentar = document.getElementById('btn-tentar-novamente');
    if (btnTentar) btnTentar.addEventListener('click', carregarFornecedores);

    // Fechamento de modal novo fornecedor
    const btnFecharModal = document.getElementById('btn-fechar-modal-novo');
    if (btnFecharModal) btnFecharModal.addEventListener('click', fecharModalNovoFornecedor);

    const btnCancModal = document.getElementById('btn-cancelar-modal-novo');
    if (btnCancModal) btnCancModal.addEventListener('click', fecharModalNovoFornecedor);

    // Form novo fornecedor
    const formNovo = document.getElementById('form-novo-fornecedor');
    if (formNovo) formNovo.addEventListener('submit', handleSalvarNovoFornecedor);

    // Máscaras dos inputs
    const campoCnpj = document.getElementById('campo-cnpj');
    if (campoCnpj) campoCnpj.addEventListener('input', aplicarMascaraDocumento);

    const campoTel = document.getElementById('campo-telefone');
    if (campoTel) campoTel.addEventListener('input', aplicarMascaraTelefone);

    const campoCep = document.getElementById('campo-cep');
    if (campoCep) campoCep.addEventListener('input', aplicarMascaraCep);

    const drawerCnpj = document.getElementById('drawer-campo-cnpj');
    if (drawerCnpj) drawerCnpj.addEventListener('input', aplicarMascaraDocumento);

    const drawerTel = document.getElementById('drawer-campo-telefone');
    if (drawerTel) drawerTel.addEventListener('input', aplicarMascaraTelefone);

    const drawerCep = document.getElementById('drawer-campo-cep');
    if (drawerCep) drawerCep.addEventListener('input', aplicarMascaraCep);

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
          carregarFornecedores();
        }, 300);
      });
    }

    if (btnLimparBusca) {
      btnLimparBusca.addEventListener('click', () => {
        if (filtroBusca) filtroBusca.value = '';
        btnLimparBusca.classList.add('hidden');
        state.busca = '';
        state.paginaAtual = 1;
        carregarFornecedores();
      });
    }

    // Filtro de Status
    const filtroStatus = document.getElementById('filtro-status');
    if (filtroStatus) {
      filtroStatus.addEventListener('change', (e) => {
        state.status = e.target.value;
        state.paginaAtual = 1;
        carregarFornecedores();
      });
    }

    // Limpar Filtros
    const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener('click', () => {
        if (filtroBusca) filtroBusca.value = '';
        if (btnLimparBusca) btnLimparBusca.classList.add('hidden');
        if (filtroStatus) filtroStatus.value = 'ALL';
        state.busca = '';
        state.status = 'ALL';
        state.paginaAtual = 1;
        carregarFornecedores();
      });
    }

    // Limite por página
    const selectLimite = document.getElementById('paginacao-limite');
    if (selectLimite) {
      selectLimite.addEventListener('change', (e) => {
        state.limite = parseInt(e.target.value, 10);
        state.paginaAtual = 1;
        carregarFornecedores();
      });
    }

    // Paginação Anterior / Próxima
    const btnAnt = document.getElementById('btn-pag-anterior');
    if (btnAnt) {
      btnAnt.addEventListener('click', () => {
        if (state.paginaAtual > 1) {
          state.paginaAtual--;
          carregarFornecedores();
        }
      });
    }

    const btnProx = document.getElementById('btn-pag-proxima');
    if (btnProx) {
      btnProx.addEventListener('click', () => {
        if (state.paginaAtual < state.totalPaginas) {
          state.paginaAtual++;
          carregarFornecedores();
        }
      });
    }

    // Drawer Lateral
    const btnFecharDrawer = document.getElementById('btn-fechar-drawer');
    if (btnFecharDrawer) btnFecharDrawer.addEventListener('click', fecharDrawerDetalhes);

    const drawerOverlay = document.getElementById('drawer-overlay');
    if (drawerOverlay) drawerOverlay.addEventListener('click', fecharDrawerDetalhes);

    // Abas do Drawer
    document.querySelectorAll('.drawer-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        ativarAbaDrawer(tab.dataset.tab);
      });
    });

    // Form Edição Fornecedor
    const formEdicao = document.getElementById('form-editar-fornecedor');
    if (formEdicao) formEdicao.addEventListener('submit', handleSalvarEdicaoFornecedor);

    // Botão Inativar / Reativar dentro do Drawer
    const btnToggleStatusDrawer = document.getElementById('btn-toggle-status-fornecedor');
    if (btnToggleStatusDrawer) {
      btnToggleStatusDrawer.addEventListener('click', () => {
        if (state.fornecedorSelecionado) {
          solicitarInativacao(state.fornecedorSelecionado);
        }
      });
    }

    // Modal Vincular Produto
    const btnAbrirVincular = document.getElementById('btn-abrir-vincular-produto');
    if (btnAbrirVincular) btnAbrirVincular.addEventListener('click', abrirModalVincularProduto);

    const btnFecharVincular = document.getElementById('btn-fechar-modal-vincular');
    if (btnFecharVincular) btnFecharVincular.addEventListener('click', fecharModalVincularProduto);

    const btnCancVincular = document.getElementById('btn-cancelar-modal-vincular');
    if (btnCancVincular) btnCancVincular.addEventListener('click', fecharModalVincularProduto);

    const formVincular = document.getElementById('form-vincular-produto');
    if (formVincular) formVincular.addEventListener('submit', handleSalvarVincularProduto);

    // Modal Confirmação de Inativação
    const btnCancInativacao = document.getElementById('btn-cancelar-inativacao');
    if (btnCancInativacao) btnCancInativacao.addEventListener('click', fecharModalInativacao);

    const btnConfInativacao = document.getElementById('btn-confirmar-inativacao');
    if (btnConfInativacao) btnConfInativacao.addEventListener('click', confirmarInativacao);

    // Delegação de eventos na tabela
    const tbody = document.getElementById('tabela-fornecedores-body');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const btnVer = e.target.closest('.btn-ver-detalhes');
        if (btnVer) {
          const id = btnVer.dataset.id;
          abrirDrawerDetalhes(id);
          return;
        }

        const btnStatus = e.target.closest('.btn-toggle-status-tabela');
        if (btnStatus) {
          const id = Number(btnStatus.dataset.id);
          const f = state.fornecedores.find((item) => item.id === id);
          if (f) solicitarInativacao(f);
          return;
        }
      });
    }

    // Delegação de eventos de produtos no drawer
    const tbodyProdutos = document.getElementById('drawer-produtos-tbody');
    if (tbodyProdutos) {
      tbodyProdutos.addEventListener('click', (e) => {
        const btnDesvinc = e.target.closest('.btn-desvincular-produto');
        if (btnDesvinc) {
          const idProd = btnDesvinc.dataset.idProduto;
          handleDesvincularProduto(idProd);
        }
      });
    }

    // Fechar modais com tecla Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        fecharModalNovoFornecedor();
        fecharModalVincularProduto();
        fecharModalInativacao();
        fecharDrawerDetalhes();
      }
    });

    // Carga inicial
    carregarFornecedores();
  }

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEventos);
  } else {
    initEventos();
  }
})();
