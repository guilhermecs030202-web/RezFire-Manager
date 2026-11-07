/**
 * usuarios.js
 * Controlador da Tela de Gerenciamento de Usuários e Permissões (RBAC) — RezFire Manager.
 * Atende à User Story SCRUM-5 (#20).
 */

(function () {
  const STORAGE_KEY = 'rezfire.usuarios';

  // Dados iniciais simulados para contingência local
  const DEFAULT_USUARIOS = [
    {
      id_usuario: 1,
      nome: 'Gestor RezFire',
      email: 'gestor@rezfire.com.br',
      perfil: 'GESTOR',
      ativo: true,
      created_at: '2026-09-01T10:00:00Z',
    },
    {
      id_usuario: 2,
      nome: 'Roberto Carlos (Operador)',
      email: 'roberto.operacao@rezfire.com.br',
      perfil: 'OPERADOR',
      ativo: true,
      created_at: '2026-10-10T14:30:00Z',
    },
    {
      id_usuario: 3,
      nome: 'Camila Fernandes (Expedição)',
      email: 'camila.expedicao@rezfire.com.br',
      perfil: 'OPERADOR',
      ativo: true,
      created_at: '2026-10-25T08:15:00Z',
    },
  ];

  let state = {
    usuarios: [],
    filtros: {
      busca: '',
      perfil: 'todos',
      status: 'todos',
    },
    usuarioEdicao: null,
  };

  function loadLocalUsuarios() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USUARIOS));
    return DEFAULT_USUARIOS;
  }

  function saveLocalUsuarios(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  const formatData = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  async function init() {
    window.RezFireLayout.renderSidebar('usuarios');
    bindEvents();
    await carregarUsuarios();
  }

  async function carregarUsuarios() {
    try {
      let carregados = null;
      if (window.RezFireAPI && window.RezFireAPI.usuarios) {
        try {
          const res = await window.RezFireAPI.usuarios.listar();
          if (res && res.sucesso && Array.isArray(res.usuarios)) {
            carregados = res.usuarios;
          }
        } catch (apiErr) {
          console.warn('[Usuários] Backend indisponível, usando armazenamento local:', apiErr);
        }
      }

      state.usuarios = carregados || loadLocalUsuarios();
      atualizarKPIs();
      renderizarTabela();
    } catch (err) {
      console.error('[Usuários] Erro ao carregar usuários:', err);
    }
  }

  function atualizarKPIs() {
    const total = state.usuarios.length;
    const gestores = state.usuarios.filter((u) => (u.perfil || '').toUpperCase() === 'GESTOR').length;
    const operadores = state.usuarios.filter((u) => (u.perfil || '').toUpperCase() === 'OPERADOR').length;
    const ativos = state.usuarios.filter((u) => Boolean(u.ativo)).length;

    const elTotal = document.getElementById('kpi-total-usuarios');
    const elGestores = document.getElementById('kpi-gestores');
    const elOperadores = document.getElementById('kpi-operadores');
    const elAtivos = document.getElementById('kpi-ativos');

    if (elTotal) elTotal.textContent = String(total);
    if (elGestores) elGestores.textContent = String(gestores);
    if (elOperadores) elOperadores.textContent = String(operadores);
    if (elAtivos) elAtivos.textContent = String(ativos);
  }

  function obterUsuariosFiltrados() {
    return state.usuarios.filter((u) => {
      const busca = state.filtros.busca.toLowerCase().trim();
      if (busca) {
        const nomeOk = (u.nome || '').toLowerCase().includes(busca);
        const emailOk = (u.email || '').toLowerCase().includes(busca);
        if (!nomeOk && !emailOk) return false;
      }

      if (state.filtros.perfil !== 'todos') {
        if ((u.perfil || '').toUpperCase() !== state.filtros.perfil.toUpperCase()) {
          return false;
        }
      }

      if (state.filtros.status !== 'todos') {
        const isAtivo = Boolean(u.ativo);
        if (state.filtros.status === 'ativo' && !isAtivo) return false;
        if (state.filtros.status === 'inativo' && isAtivo) return false;
      }

      return true;
    });
  }

  function renderizarTabela() {
    const tbody = document.getElementById('usuarios-tbody');
    if (!tbody) return;

    const lista = obterUsuariosFiltrados();

    if (lista.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-stone-400">
            Nenhum usuário encontrado com os filtros aplicados.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = lista.map((u) => {
      const isGestor = (u.perfil || '').toUpperCase() === 'GESTOR';
      const badgePerfil = isGestor
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold usuario-badge-gestor">🛡️ GESTOR (Admin)</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold usuario-badge-operador">📦 OPERADOR</span>`;

      const badgeStatus = u.ativo
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold usuario-badge-ativo">✓ Ativo</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold usuario-badge-inativo">✕ Inativo</span>`;

      const inicial = (u.nome || 'U').charAt(0).toUpperCase();

      return `
        <tr class="hover:bg-stone-50/80 transition-colors">
          <td class="p-3">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-full bg-stone-200 text-stone-700 font-bold flex items-center justify-center text-xs">
                ${inicial}
              </div>
              <div>
                <span class="font-bold text-stone-900 block">${u.nome}</span>
                <span class="text-[10px] text-stone-400 font-mono">ID #${u.id_usuario}</span>
              </div>
            </div>
          </td>
          <td class="p-3 text-stone-700 font-mono text-[11px]">${u.email}</td>
          <td class="p-3">${badgePerfil}</td>
          <td class="p-3">${badgeStatus}</td>
          <td class="p-3 text-stone-500 text-[11px]">${formatData(u.created_at)}</td>
          <td class="p-3 text-right">
            <div class="inline-flex items-center gap-1.5 justify-end">
              <button type="button" class="btn-ghost text-xs py-1 px-2 text-stone-700 border-stone-200 btn-editar-usuario" data-id="${u.id_usuario}">
                Editar
              </button>
              <button type="button" class="btn-ghost text-xs py-1 px-2 ${u.ativo ? 'text-amber-700 hover:bg-amber-50' : 'text-emerald-700 hover:bg-emerald-50'} border-stone-200 btn-toggle-status" data-id="${u.id_usuario}">
                ${u.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-editar-usuario').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const item = state.usuarios.find((x) => x.id_usuario === id);
        if (item) abrirModalUsuario(item);
      });
    });

    tbody.querySelectorAll('.btn-toggle-status').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        alternarStatusUsuario(id);
      });
    });
  }

  function abrirModalUsuario(usuario = null) {
    state.usuarioEdicao = usuario;
    const modal = document.getElementById('modal-usuario');
    const titulo = document.getElementById('modal-titulo-texto');
    const idInput = document.getElementById('usuario-id');
    const nomeInput = document.getElementById('usuario-nome');
    const emailInput = document.getElementById('usuario-email');
    const perfilSelect = document.getElementById('usuario-perfil');
    const senhaInput = document.getElementById('usuario-senha');
    const labelSenha = document.getElementById('label-usuario-senha');
    const ajudaSenha = document.getElementById('ajuda-senha');
    const ativoCheckbox = document.getElementById('usuario-ativo');

    if (!modal) return;

    if (usuario) {
      if (titulo) titulo.textContent = 'Editar Usuário';
      if (idInput) idInput.value = usuario.id_usuario;
      if (nomeInput) nomeInput.value = usuario.nome;
      if (emailInput) emailInput.value = usuario.email;
      if (perfilSelect) perfilSelect.value = (usuario.perfil || 'OPERADOR').toUpperCase();
      if (senhaInput) {
        senhaInput.value = '';
        senhaInput.required = false;
      }
      if (labelSenha) labelSenha.textContent = 'Nova Senha (Opcional)';
      if (ajudaSenha) ajudaSenha.style.display = 'block';
      if (ativoCheckbox) ativoCheckbox.checked = Boolean(usuario.ativo);
    } else {
      if (titulo) titulo.textContent = 'Novo Usuário';
      if (idInput) idInput.value = '';
      if (nomeInput) nomeInput.value = '';
      if (emailInput) emailInput.value = '';
      if (perfilSelect) perfilSelect.value = 'OPERADOR';
      if (senhaInput) {
        senhaInput.value = '';
        senhaInput.required = true;
      }
      if (labelSenha) labelSenha.textContent = 'Senha de Acesso *';
      if (ajudaSenha) ajudaSenha.style.display = 'none';
      if (ativoCheckbox) ativoCheckbox.checked = true;
    }

    modal.classList.add('is-open');
    modal.style.display = 'flex';
  }

  function fecharModalUsuario() {
    const modal = document.getElementById('modal-usuario');
    if (modal) {
      modal.classList.remove('is-open');
      modal.style.display = 'none';
    }
    state.usuarioEdicao = null;
  }

  async function salvarUsuario(e) {
    e.preventDefault();

    const id = document.getElementById('usuario-id')?.value;
    const nome = document.getElementById('usuario-nome')?.value.trim();
    const email = document.getElementById('usuario-email')?.value.trim();
    const perfil = document.getElementById('usuario-perfil')?.value;
    const senha = document.getElementById('usuario-senha')?.value;
    const ativo = document.getElementById('usuario-ativo')?.checked;

    if (!nome || !email) {
      alert('Por favor, preencha o nome e o e-mail do usuário.');
      return;
    }

    if (!id && (!senha || senha.length < 6)) {
      alert('A senha inicial é obrigatória e deve conter no mínimo 6 caracteres.');
      return;
    }

    const payload = {
      nome,
      email,
      perfil,
      ativo,
      ...(senha && senha.length >= 6 ? { senha } : {}),
    };

    try {
      if (id) {
        // Edição
        const idNum = Number(id);
        if (window.RezFireAPI && window.RezFireAPI.usuarios) {
          try {
            await window.RezFireAPI.usuarios.atualizar(idNum, payload);
          } catch (apiErr) {
            console.warn('[Usuários] Backend indisponível para atualização, usando mock:', apiErr);
          }
        }

        const idx = state.usuarios.findIndex((u) => u.id_usuario === idNum);
        if (idx >= 0) {
          state.usuarios[idx] = {
            ...state.usuarios[idx],
            ...payload,
          };
          saveLocalUsuarios(state.usuarios);
        }
        alert('Usuário atualizado com sucesso!');
      } else {
        // Criação
        let novo = null;
        if (window.RezFireAPI && window.RezFireAPI.usuarios) {
          try {
            const res = await window.RezFireAPI.usuarios.criar(payload);
            if (res && res.sucesso && res.usuario) novo = res.usuario;
          } catch (apiErr) {
            console.warn('[Usuários] Backend indisponível para criação, usando mock:', apiErr);
          }
        }

        if (!novo) {
          novo = {
            id_usuario: Date.now(),
            nome: payload.nome,
            email: payload.email,
            perfil: payload.perfil,
            ativo: payload.ativo,
            created_at: new Date().toISOString(),
          };
        }

        state.usuarios.push(novo);
        saveLocalUsuarios(state.usuarios);
        alert('Usuário cadastrado com sucesso!');
      }

      fecharModalUsuario();
      atualizarKPIs();
      renderizarTabela();
    } catch (err) {
      console.error('[Usuários] Erro ao salvar:', err);
      alert('Erro ao salvar usuário: ' + (err.message || err));
    }
  }

  async function alternarStatusUsuario(id) {
    const u = state.usuarios.find((x) => x.id_usuario === id);
    if (!u) return;

    const novoStatusTexto = u.ativo ? 'desativar' : 'reativar';
    if (!confirm(`Deseja realmente ${novoStatusTexto} o usuário "${u.nome}"?`)) {
      return;
    }

    try {
      if (window.RezFireAPI && window.RezFireAPI.usuarios) {
        try {
          await window.RezFireAPI.usuarios.alternarStatus(id);
        } catch (apiErr) {
          console.warn('[Usuários] Backend indisponível para alternar status, usando mock:', apiErr);
        }
      }

      u.ativo = !u.ativo;
      saveLocalUsuarios(state.usuarios);
      atualizarKPIs();
      renderizarTabela();
    } catch (err) {
      console.error('[Usuários] Erro ao alternar status:', err);
      alert('Erro ao alterar status: ' + (err.message || err));
    }
  }

  function bindEvents() {
    document.getElementById('btn-novo-usuario')?.addEventListener('click', () => abrirModalUsuario());
    document.getElementById('btn-fechar-modal-usuario')?.addEventListener('click', fecharModalUsuario);
    document.getElementById('btn-cancelar-usuario')?.addEventListener('click', fecharModalUsuario);
    document.getElementById('form-usuario')?.addEventListener('submit', salvarUsuario);
    document.getElementById('modal-usuario')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-usuario') fecharModalUsuario();
    });

    // Modal de Matriz de Permissões
    const modalMatriz = document.getElementById('modal-matriz');
    const abrirMatriz = () => {
      if (modalMatriz) {
        modalMatriz.classList.add('is-open');
        modalMatriz.style.display = 'flex';
      }
    };
    const fecharMatriz = () => {
      if (modalMatriz) {
        modalMatriz.classList.remove('is-open');
        modalMatriz.style.display = 'none';
      }
    };

    document.getElementById('btn-abrir-matriz')?.addEventListener('click', abrirMatriz);
    document.getElementById('btn-fechar-modal-matriz')?.addEventListener('click', fecharMatriz);
    document.getElementById('btn-fechar-matriz-inferior')?.addEventListener('click', fecharMatriz);
    modalMatriz?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-matriz') fecharMatriz();
    });

    // Filtros e busca
    document.getElementById('filtro-busca')?.addEventListener('input', (e) => {
      state.filtros.busca = e.target.value;
      renderizarTabela();
    });

    document.getElementById('filtro-perfil')?.addEventListener('change', (e) => {
      state.filtros.perfil = e.target.value;
      renderizarTabela();
    });

    document.getElementById('filtro-status')?.addEventListener('change', (e) => {
      state.filtros.status = e.target.value;
      renderizarTabela();
    });

    document.getElementById('btn-limpar-filtros')?.addEventListener('click', () => {
      const fb = document.getElementById('filtro-busca');
      const fp = document.getElementById('filtro-perfil');
      const fs = document.getElementById('filtro-status');
      if (fb) fb.value = '';
      if (fp) fp.value = 'todos';
      if (fs) fs.value = 'todos';
      state.filtros = { busca: '', perfil: 'todos', status: 'todos' };
      renderizarTabela();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        fecharModalUsuario();
        fecharMatriz();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

