/**
 * respostas-padrao.js
 * Módulo de Gestão e Consulta Rápida de Respostas Padrão de Pré-Venda — RezFire Manager (SCRUM-28 / #22).
 *
 * Responsável por:
 *  - Listar e filtrar respostas técnicas de pré-venda (Validade, Capacidade Extintora, INMETRO/Bombeiros, etc.)
 *  - Pesquisa rápida por palavra-chave durante o atendimento no Mercado Livre ou canais diretos
 *  - Cópia instantânea da resposta formatada para a área de transferência com 1 clique e incremento de métrica de uso
 *  - Cadastro e edição de novas respostas pelo gestor
 */

(function () {
  const state = {
    respostas: [],
    categorias: [],
    filtroCategoria: 'todas',
    filtroBusca: '',
    carregando: false,
    editandoId: null,
  };

  // Inicialização ao carregar o DOM
  document.addEventListener('DOMContentLoaded', () => {
    injetarModalRespostas();
    vincularGatilhos();
  });

  /**
   * Injeta o HTML dos modais de consulta e formulário de respostas padrão
   */
  function injetarModalRespostas() {
    if (document.getElementById('modal-respostas-padrao')) return;

    const container = document.createElement('div');
    container.innerHTML = `
      <!-- Modal Principal de Consulta e Atendimento (SCRUM-28 / #22) -->
      <div class="modal-backdrop" id="modal-respostas-padrao" role="dialog" aria-modal="true" style="display:none;z-index:9999">
        <div class="modal" style="width:min(860px, 96vw);max-height:92vh;display:flex;flex-direction:column;padding:0;overflow:hidden;border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,0.25)">
          
          <!-- Header do Modal -->
          <div style="background:#1c1917;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:1.4rem">💬</span>
              <div>
                <h2 style="margin:0;font-size:1.1rem;font-weight:800;color:#fafaf9;letter-spacing:0.02em">
                  Base de Respostas Padrão de Pré-Venda (#22)
                </h2>
                <p style="margin:0;font-size:0.75rem;color:#a8a29e">
                  Respostas técnicas prontas sobre validade, AVCB, capacidade extintora e selo INMETRO.
                </p>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <button type="button" id="btn-nova-resposta-padrao" class="btn-primary" style="background:#e85c2a;border:none;padding:6px 12px;font-size:0.78rem;font-weight:700;border-radius:6px;display:inline-flex;align-items:center;gap:4px">
                + Nova Resposta
              </button>
              <button type="button" id="btn-fechar-modal-respostas" style="background:transparent;border:none;color:#d6d3d1;font-size:1.2rem;cursor:pointer;padding:4px 8px;border-radius:4px">
                ✕
              </button>
            </div>
          </div>

          <!-- Barra de Busca e Filtros de Categoria -->
          <div style="background:#f5f5f4;padding:12px 20px;border-bottom:1px solid #e7e5e4;display:flex;flex-direction:column;gap:10px">
            <div style="position:relative">
              <input
                type="text"
                id="input-busca-respostas"
                placeholder="Pesquisar por dúvida, palavra-chave, norma (ex: validade, AVCB, 2A-20BC, bombeiros)..."
                style="width:100%;padding:9px 12px 9px 36px;border:1px solid #d6d3d1;border-radius:8px;font-size:0.84rem;outline:none;background:#fff"
              />
              <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#78716c">🔍</span>
            </div>

            <!-- Pílulas de Categoria -->
            <div id="container-categorias-respostas" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px">
              <button type="button" class="btn-cat-resposta is-active" data-categoria="todas">Todas</button>
              <button type="button" class="btn-cat-resposta" data-categoria="Validade">Validade</button>
              <button type="button" class="btn-cat-resposta" data-categoria="Capacidade Extintora">Capacidade Extintora</button>
              <button type="button" class="btn-cat-resposta" data-categoria="INMETRO & Normas">INMETRO & Normas</button>
              <button type="button" class="btn-cat-resposta" data-categoria="Instalação & Suporte">Instalação & Suporte</button>
            </div>
          </div>

          <!-- Lista de Respostas (Scrollável) -->
          <div id="lista-respostas-container" style="padding:16px 20px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:12px;background:#fafaf9">
            <div style="text-align:center;padding:30px;color:#78716c;font-size:0.85rem">
              Carregando respostas padrão...
            </div>
          </div>

          <!-- Rodapé informativo -->
          <div style="background:#f5f5f4;padding:10px 20px;border-top:1px solid #e7e5e4;display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;color:#78716c">
            <span id="contador-respostas-total">0 respostas encontradas</span>
            <span>💡 Dica: Clique em "Copiar Resposta" para transferir e colar diretamente no Mercado Livre.</span>
          </div>
        </div>
      </div>

      <!-- Modal de Cadastro / Edição de Resposta Padrão -->
      <div class="modal-backdrop" id="modal-form-resposta" role="dialog" aria-modal="true" style="display:none;z-index:10000">
        <div class="modal" style="width:min(600px, 96vw);border-radius:12px;padding:20px;box-shadow:0 20px 40px rgba(0,0,0,0.3)">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e7e5e4;padding-bottom:10px;margin-bottom:14px">
            <h3 id="form-resposta-title" style="margin:0;font-size:1.05rem;font-weight:800;color:#1c1917">
              Nova Resposta Padrão de Pré-Venda
            </h3>
            <button type="button" id="btn-fechar-form-resposta" style="background:transparent;border:none;font-size:1.1rem;cursor:pointer;color:#78716c">✕</button>
          </div>

          <form id="form-cadastro-resposta" style="display:flex;flex-direction:column;gap:10px;font-size:0.82rem">
            <div>
              <label style="display:block;font-weight:700;margin-bottom:3px;color:#292524">Título Identificador *</label>
              <input type="text" id="campo-resposta-titulo" required placeholder="Ex: Validade do Extintor para Vistoria do AVCB" style="width:100%;padding:7px 10px;border:1px solid #d6d3d1;border-radius:6px;font-size:0.82rem" />
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div>
                <label style="display:block;font-weight:700;margin-bottom:3px;color:#292524">Categoria Técnica *</label>
                <select id="campo-resposta-categoria" style="width:100%;padding:7px 10px;border:1px solid #d6d3d1;border-radius:6px;font-size:0.82rem;background:#fff">
                  <option value="Validade">Validade</option>
                  <option value="Capacidade Extintora">Capacidade Extintora</option>
                  <option value="INMETRO & Normas">INMETRO & Normas</option>
                  <option value="Instalação & Suporte">Instalação & Suporte</option>
                  <option value="Geral">Geral</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-weight:700;margin-bottom:3px;color:#292524">Tags para Busca</label>
                <input type="text" id="campo-resposta-tags" placeholder="Ex: avcb, bombeiros, recarga, predial" style="width:100%;padding:7px 10px;border:1px solid #d6d3d1;border-radius:6px;font-size:0.82rem" />
              </div>
            </div>

            <div>
              <label style="display:block;font-weight:700;margin-bottom:3px;color:#292524">Pergunta Exemplo do Cliente</label>
              <input type="text" id="campo-resposta-pergunta" placeholder="Ex: Qual a validade da carga? Serve para bombeiros?" style="width:100%;padding:7px 10px;border:1px solid #d6d3d1;border-radius:6px;font-size:0.82rem" />
            </div>

            <div>
              <label style="display:block;font-weight:700;margin-bottom:3px;color:#292524">Texto Completo da Resposta *</label>
              <textarea id="campo-resposta-texto" required rows="5" placeholder="Escreva a resposta técnica e cordial pronta para o cliente..." style="width:100%;padding:8px 10px;border:1px solid #d6d3d1;border-radius:6px;font-size:0.82rem;line-height:1.4"></textarea>
            </div>

            <div style="margin-top:10px;display:flex;justify-content:flex-end;gap:8px">
              <button type="button" id="btn-cancelar-form-resposta" class="btn-ghost" style="padding:6px 12px;font-size:0.8rem">Cancelar</button>
              <button type="submit" class="btn-primary" style="background:#e85c2a;border:none;padding:6px 16px;font-size:0.8rem;font-weight:700;border-radius:6px">Salvar Resposta</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Injeta CSS das pílulas e cards
    const style = document.createElement('style');
    style.textContent = `
      .btn-cat-resposta {
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        border: 1px solid #d6d3d1;
        background: #fff;
        color: #44403c;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s ease;
      }
      .btn-cat-resposta:hover {
        background: #f5f5f4;
        border-color: #a8a29e;
      }
      .btn-cat-resposta.is-active {
        background: #1c1917;
        color: #fff;
        border-color: #1c1917;
      }
      .card-resposta-item {
        background: #ffffff;
        border: 1px solid #e7e5e4;
        border-radius: 8px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .card-resposta-item:hover {
        border-color: #cbd5e1;
        box-shadow: 0 4px 12px rgba(0,0,0,0.04);
      }
    `;
    document.head.appendChild(style);

    // Eventos internos do modal
    document.getElementById('btn-fechar-modal-respostas')?.addEventListener('click', fecharModalRespostas);
    document.getElementById('modal-respostas-padrao')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-respostas-padrao') fecharModalRespostas();
    });

    document.getElementById('input-busca-respostas')?.addEventListener('input', (e) => {
      state.filtroBusca = e.target.value;
      renderizarListaRespostas();
    });

    document.getElementById('container-categorias-respostas')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-cat-resposta');
      if (btn) {
        document.querySelectorAll('.btn-cat-resposta').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.filtroCategoria = btn.getAttribute('data-categoria') || 'todas';
        renderizarListaRespostas();
      }
    });

    document.getElementById('btn-nova-resposta-padrao')?.addEventListener('click', () => abrirFormResposta());
    document.getElementById('btn-fechar-form-resposta')?.addEventListener('click', fecharFormResposta);
    document.getElementById('btn-cancelar-form-resposta')?.addEventListener('click', fecharFormResposta);

    document.getElementById('form-cadastro-resposta')?.addEventListener('submit', salvarFormResposta);
  }

  /**
   * Vincula gatilhos existentes ou adiciona o botão flutuante se não houver na tela
   */
  function vincularGatilhos() {
    // Procura botões com classe ou id específico na tela
    const botoes = document.querySelectorAll('#btn-abrir-respostas-padrao, .btn-gatilho-respostas');
    botoes.forEach((btn) => {
      btn.addEventListener('click', abrirModalRespostas);
    });

    // Se a página for anuncios.html ou pedidos.html, adiciona botão na toolbar se ainda não existir
    const toolbarAnuncios = document.querySelector('.page-toolbar .flex.items-center.gap-3');
    if (toolbarAnuncios && !document.getElementById('btn-toolbar-respostas')) {
      const btn = document.createElement('button');
      btn.id = 'btn-toolbar-respostas';
      btn.className = 'btn-ghost';
      btn.type = 'button';
      btn.style.cssText = 'padding: 8px 12px; font-size: 0.84rem; display: inline-flex; align-items: center; gap: 6px; border-color: #cbd5e1; color: var(--ink);';
      btn.innerHTML = `<span>💬</span> <span>Respostas Pré-Venda</span>`;
      btn.title = 'Consultar base de respostas rápidas técnicas de extintores';
      btn.addEventListener('click', abrirModalRespostas);
      toolbarAnuncios.appendChild(btn);
    }
  }

  /**
   * Abre o modal de respostas padrão e carrega os dados
   */
  async function abrirModalRespostas() {
    const modal = document.getElementById('modal-respostas-padrao');
    if (!modal) return;
    modal.style.display = 'flex';
    await carregarRespostas();
  }

  function fecharModalRespostas() {
    const modal = document.getElementById('modal-respostas-padrao');
    if (modal) modal.style.display = 'none';
  }

  /**
   * Carrega respostas padrão da API
   */
  async function carregarRespostas() {
    state.carregando = true;
    try {
      if (window.RezFireAPI?.respostasPadrao) {
        const res = await window.RezFireAPI.respostasPadrao.listar();
        if (res && res.sucesso && Array.isArray(res.respostas)) {
          state.respostas = res.respostas;
          state.categorias = res.categorias || [];
        }
      }
    } catch (err) {
      console.warn('[Respostas Padrão] Erro ao carregar da API:', err);
    } finally {
      state.carregando = false;
      renderizarListaRespostas();
    }
  }

  /**
   * Renderiza a lista filtrada de respostas
   */
  function renderizarListaRespostas() {
    const container = document.getElementById('lista-respostas-container');
    const contador = document.getElementById('contador-respostas-total');
    if (!container) return;

    let filtradas = [...state.respostas];

    // Filtro por categoria
    if (state.filtroCategoria && state.filtroCategoria !== 'todas') {
      filtradas = filtradas.filter((r) => r.categoria === state.filtroCategoria);
    }

    // Filtro por busca textual
    if (state.filtroBusca.trim()) {
      const termo = state.filtroBusca.trim().toLowerCase();
      filtradas = filtradas.filter((r) =>
        (r.titulo && r.titulo.toLowerCase().includes(termo)) ||
        (r.pergunta_exemplo && r.pergunta_exemplo.toLowerCase().includes(termo)) ||
        (r.resposta && r.resposta.toLowerCase().includes(termo)) ||
        (r.tags && r.tags.toLowerCase().includes(termo))
      );
    }

    if (contador) {
      contador.textContent = `${filtradas.length} resposta(s) disponível(is)`;
    }

    if (filtradas.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:#78716c">
          <div style="font-size:2rem;margin-bottom:8px">🔍</div>
          <strong style="color:#292524">Nenhuma resposta encontrada para os filtros atuais.</strong>
          <p style="font-size:0.8rem;margin-top:4px">Tente buscar por outro termo ou clique em "+ Nova Resposta" para cadastrar.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtradas.map((r) => `
      <div class="card-resposta-item" data-id="${r.id_resposta}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:4px;background:#fef3c7;color:#92400e;border:1px solid #fde68a">
                ${r.categoria || 'Geral'}
              </span>
              <strong style="font-size:0.92rem;color:#1c1917">${r.titulo}</strong>
            </div>
            ${r.pergunta_exemplo ? `
              <div style="font-size:0.75rem;color:#78716c;margin-top:3px;font-style:italic">
                Pergunta frequente: "${r.pergunta_exemplo}"
              </div>
            ` : ''}
          </div>

          <div style="display:flex;align-items:center;gap:6px">
            <button type="button" class="btn-copiar-resposta" data-id="${r.id_resposta}" style="background:#15803d;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:0.78rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
              📋 Copiar
            </button>
            <button type="button" class="btn-editar-resposta" data-id="${r.id_resposta}" style="background:transparent;border:1px solid #d6d3d1;color:#44403c;padding:5px 8px;border-radius:6px;font-size:0.78rem;cursor:pointer" title="Editar">
              ✏️
            </button>
            <button type="button" class="btn-excluir-resposta" data-id="${r.id_resposta}" style="background:transparent;border:1px solid #fca5a5;color:#dc2626;padding:5px 8px;border-radius:6px;font-size:0.78rem;cursor:pointer" title="Excluir">
              🗑️
            </button>
          </div>
        </div>

        <!-- Conteúdo da Resposta -->
        <div style="background:#f5f5f4;border:1px solid #e7e5e4;border-radius:6px;padding:10px;font-size:0.82rem;color:#1c1917;white-space:pre-wrap;line-height:1.45;user-select:text">
${r.resposta}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.72rem;color:#a8a29e;margin-top:2px">
          <span>${r.tags ? `🏷️ Tags: ${r.tags}` : ''}</span>
          <span>Utilizada ${r.vezes_utilizada || 0}x</span>
        </div>
      </div>
    `).join('');

    // Eventos de clique nos cards
    container.querySelectorAll('.btn-copiar-resposta').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.currentTarget.getAttribute('data-id'));
        await copiarTextoResposta(id, e.currentTarget);
      });
    });

    container.querySelectorAll('.btn-editar-resposta').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-id'));
        const item = state.respostas.find((x) => x.id_resposta === id);
        if (item) abrirFormResposta(item);
      });
    });

    container.querySelectorAll('.btn-excluir-resposta').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.currentTarget.getAttribute('data-id'));
        if (confirm('Deseja realmente excluir esta resposta padrão?')) {
          await excluirResposta(id);
        }
      });
    });
  }

  /**
   * Copia o texto para a área de transferência e incrementa uso
   */
  async function copiarTextoResposta(id, btnElement) {
    const item = state.respostas.find((x) => x.id_resposta === id);
    if (!item) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(item.resposta);
      } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = item.resposta;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      // Feedback no botão
      if (btnElement) {
        const textoOriginal = btnElement.innerHTML;
        btnElement.innerHTML = `✓ Copiado!`;
        btnElement.style.background = '#047857';
        setTimeout(() => {
          btnElement.innerHTML = textoOriginal;
          btnElement.style.background = '#15803d';
        }, 1500);
      }

      // Notifica backend para incrementar contador
      if (window.RezFireAPI?.respostasPadrao) {
        await window.RezFireAPI.respostasPadrao.copiar(id);
        item.vezes_utilizada = (item.vezes_utilizada || 0) + 1;
        renderizarListaRespostas();
      }

      if (typeof window.showToast === 'function') {
        window.showToast('Resposta copiada para a área de transferência!', 'sucesso');
      }
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
    }
  }

  /**
   * Abre formulário de cadastro/edição
   */
  function abrirFormResposta(respostaParaEditar = null) {
    const modal = document.getElementById('modal-form-resposta');
    const title = document.getElementById('form-resposta-title');
    if (!modal) return;

    state.editandoId = respostaParaEditar ? respostaParaEditar.id_resposta : null;
    if (title) {
      title.textContent = respostaParaEditar ? 'Editar Resposta Padrão' : 'Nova Resposta Padrão de Pré-Venda';
    }

    document.getElementById('campo-resposta-titulo').value = respostaParaEditar?.titulo || '';
    document.getElementById('campo-resposta-categoria').value = respostaParaEditar?.categoria || 'Validade';
    document.getElementById('campo-resposta-tags').value = respostaParaEditar?.tags || '';
    document.getElementById('campo-resposta-pergunta').value = respostaParaEditar?.pergunta_exemplo || '';
    document.getElementById('campo-resposta-texto').value = respostaParaEditar?.resposta || '';

    modal.style.display = 'flex';
  }

  function fecharFormResposta() {
    const modal = document.getElementById('modal-form-resposta');
    if (modal) modal.style.display = 'none';
    state.editandoId = null;
  }

  /**
   * Salva o formulário de resposta padrão
   */
  async function salvarFormResposta(e) {
    e.preventDefault();
    const titulo = document.getElementById('campo-resposta-titulo').value.trim();
    const categoria = document.getElementById('campo-resposta-categoria').value;
    const tags = document.getElementById('campo-resposta-tags').value.trim();
    const pergunta_exemplo = document.getElementById('campo-resposta-pergunta').value.trim();
    const resposta = document.getElementById('campo-resposta-texto').value.trim();

    const dados = { titulo, categoria, tags, pergunta_exemplo, resposta };

    try {
      if (state.editandoId) {
        await window.RezFireAPI.respostasPadrao.atualizar(state.editandoId, dados);
      } else {
        await window.RezFireAPI.respostasPadrao.criar(dados);
      }

      fecharFormResposta();
      await carregarRespostas();
      if (typeof window.showToast === 'function') {
        window.showToast(state.editandoId ? 'Resposta atualizada com sucesso!' : 'Nova resposta padrão cadastrada!', 'sucesso');
      }
    } catch (err) {
      alert('Erro ao salvar resposta padrão: ' + (err.message || err));
    }
  }

  /**
   * Exclui resposta padrão
   */
  async function excluirResposta(id) {
    try {
      if (window.RezFireAPI?.respostasPadrao) {
        await window.RezFireAPI.respostasPadrao.excluir(id);
        await carregarRespostas();
        if (typeof window.showToast === 'function') {
          window.showToast('Resposta padrão removida.', 'info');
        }
      }
    } catch (err) {
      alert('Erro ao excluir resposta padrão: ' + (err.message || err));
    }
  }

  // Exporta no escopo global
  window.RezFireRespostasPadrao = {
    abrir: abrirModalRespostas,
    fechar: fecharModalRespostas,
    carregar: carregarRespostas,
  };
})();

