/**
 * RezFire Manager - Cliente Oficial da API Backend
 * Comunicação direta com o servidor Node.js/Express e banco MySQL.
 */
const API_BASE_URL = 'http://localhost:3001/api';

window.RezFireAPI = {
  baseUrl: API_BASE_URL,

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultHeaders = {
      'Accept': 'application/json',
    };

    // Não adiciona Content-Type se for FormData (o browser define boundary automaticamente)
    if (!(options.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    // Token JWT salvo como contingência ou para requests entre origens
    const token = localStorage.getItem('rezfire_auth_token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      credentials: 'include', // Envia cookies HttpOnly da sessão
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('rezfire_auth_token');
        localStorage.removeItem('rezfire_user');
        if (!window.location.pathname.endsWith('login.html')) {
          window.location.href = 'login.html';
        }
        throw new Error('Sessão expirada ou não autenticada. Redirecionando...');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensagem || `Erro HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.warn(`[RezFire API Error] ${endpoint}:`, error.message);
      throw error;
    }
  },

  // Módulo de Autenticação
  auth: {
    async login(email, senha) {
      const data = await window.RezFireAPI.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
      });
      if (data && data.sucesso && data.token) {
        localStorage.setItem('rezfire_auth_token', data.token);
        if (data.usuario) {
          localStorage.setItem('rezfire_user', JSON.stringify(data.usuario));
        }
      }
      return data;
    },
    async logout() {
      try {
        await window.RezFireAPI.request('/auth/logout', { method: 'POST' });
      } finally {
        localStorage.removeItem('rezfire_auth_token');
        localStorage.removeItem('rezfire_user');
        window.location.href = 'login.html';
      }
    },
    async me() {
      return window.RezFireAPI.request('/auth/me');
    },
  },

  // Módulo de Produtos
  produtos: {
    async listar(params = {}) {
      const query = new URLSearchParams(params).toString();
      return window.RezFireAPI.request(`/produtos${query ? '?' + query : ''}`);
    },
    async buscarPorId(id) {
      return window.RezFireAPI.request(`/produtos/${id}`);
    },
    async criar(dados) {
      return window.RezFireAPI.request('/produtos', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
    async atualizar(id, dados) {
      return window.RezFireAPI.request(`/produtos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dados),
      });
    },
    async inativar(id) {
      return window.RezFireAPI.request(`/produtos/${id}`, { method: 'DELETE' });
    },
  },

  // Módulo de Estoque
  estoque: {
    async listar() {
      return window.RezFireAPI.request('/estoque');
    },
    async alertas() {
      return window.RezFireAPI.request('/estoque/alertas');
    },
  },

  // Módulo de Movimentações
  movimentacoes: {
    async listar(params = {}) {
      const query = new URLSearchParams(params).toString();
      return window.RezFireAPI.request(`/movimentacoes${query ? '?' + query : ''}`);
    },
    async registrar(dados) {
      return window.RezFireAPI.request('/movimentacoes', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
    async ajustarInventario(id_produto, quantidade_contada) {
      return window.RezFireAPI.request('/movimentacoes/ajuste-inventario', {
        method: 'POST',
        body: JSON.stringify({ id_produto, quantidade_contada }),
      });
    },
    async baixaRapida(id_produto, quantidade, codigo_ml) {
      return window.RezFireAPI.request('/movimentacoes/baixa-rapida', {
        method: 'POST',
        body: JSON.stringify({ id_produto, quantidade, codigo_ml }),
      });
    },
  },

  // Módulo de Pedidos
  pedidos: {
    async listar(params = {}) {
      const query = new URLSearchParams(params).toString();
      return window.RezFireAPI.request(`/pedidos${query ? '?' + query : ''}`);
    },
    async alertasPostagem() {
      return window.RezFireAPI.request('/pedidos/alertas-postagem');
    },
    async buscarPorId(id) {
      return window.RezFireAPI.request(`/pedidos/${id}`);
    },
    async criar(dados) {
      return window.RezFireAPI.request('/pedidos', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
    async atualizarStatus(id, status, status_entrega, dadosDevolucao = null) {
      const payload = { status, status_entrega };
      if (dadosDevolucao) {
        Object.assign(payload, dadosDevolucao);
      }
      return window.RezFireAPI.request(`/pedidos/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    async registrarDevolucao(id, dados) {
      return window.RezFireAPI.request(`/pedidos/${id}/devolucao`, {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
    async obterEstatisticasDevolucoes() {
      return window.RezFireAPI.request('/pedidos/estatisticas/devolucoes');
    },
  },

  // Módulo de Dashboard & KPIs (Cálculos Diretos no MySQL)
  dashboard: {
    async obterKpis(dias = 30) {
      return window.RezFireAPI.request(`/dashboard/kpis?dias=${dias}`);
    },
    async obterGraficos(dias = 30) {
      return window.RezFireAPI.request(`/dashboard/graficos?dias=${dias}`);
    },
  },

  // Módulo de Certificados Inmetro
  certificados: {
    async listar(tipo_entidade, entidade_id) {
      return window.RezFireAPI.request(
        `/certificados?tipo_entidade=${tipo_entidade}&entidade_id=${entidade_id}`
      );
    },
    async upload(tipo_entidade, entidade_id, arquivo) {
      const formData = new FormData();
      formData.append('tipo_entidade', tipo_entidade);
      formData.append('entidade_id', String(entidade_id));
      formData.append('arquivo', arquivo);

      return window.RezFireAPI.request('/certificados/upload', {
        method: 'POST',
        body: formData,
      });
    },
    async remover(id_documento) {
      return window.RezFireAPI.request(`/certificados/${id_documento}`, {
        method: 'DELETE',
      });
    },
    urlDownload(id_documento) {
      const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : '/api';
      return `${baseUrl}/certificados/${id_documento}/download`;
    },
  },

  // Módulo de Integração com o Mercado Livre
  mercadolivre: {
    async getAuthUrl(state) {
      return window.RezFireAPI.request(`/ml/auth${state ? '?state=' + state : ''}`);
    },
    async getStatus() {
      return window.RezFireAPI.request('/ml/status');
    },
    async listarAnuncios() {
      return window.RezFireAPI.request('/ml/anuncios');
    },
    async vincular(id_anuncio, id_produto, quantidade_anunciada = 1) {
      return window.RezFireAPI.request('/ml/anuncios/vincular', {
        method: 'POST',
        body: JSON.stringify({ id_anuncio, id_produto, quantidade_anunciada }),
      });
    },
    async sincronizar() {
      return window.RezFireAPI.request('/ml/sincronizar', { method: 'POST' });
    },
    async consultarAnuncios(options = {}) {
      const page = options.page || 1;
      const limit = options.limit || 50;
      return window.RezFireAPI.request(`/ml/anuncios/consultar?page=${page}&limit=${limit}`, {
        method: 'POST',
      });
    },
    async sincronizarStatus(dados = {}) {
      return window.RezFireAPI.request('/ml/anuncios/sincronizar-status', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
    async getStatusSincronizacao() {
      return window.RezFireAPI.request('/ml/anuncios/sincronizar-status');
    },
    async sincronizarPedidos(dados = {}) {
      return window.RezFireAPI.request('/ml/pedidos/sincronizar', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
    async getStatusSincronizacaoPedidos() {
      return window.RezFireAPI.request('/ml/pedidos/sincronizacao-status');
    },
    async desconectar() {
      return window.RezFireAPI.request('/ml/desconectar', { method: 'POST' });
    },
    async processarCallback(code) {
      return window.RezFireAPI.request(`/ml/callback?code=${encodeURIComponent(code)}`);
    },
  },

  // Módulo de Inspeção de Qualidade (SCRUM-11 / #6)
  inspecoes: {
    async listar(params = {}) {
      const query = new URLSearchParams(params).toString();
      return window.RezFireAPI.request(`/inspecoes${query ? '?' + query : ''}`);
    },
    async buscarPorId(id) {
      return window.RezFireAPI.request(`/inspecoes/${id}`);
    },
    async buscarPorPedido(idPedido) {
      return window.RezFireAPI.request(`/inspecoes/pedido/${idPedido}`);
    },
    async obterResumo() {
      return window.RezFireAPI.request('/inspecoes/resumo');
    },
    async registrar(dados) {
      return window.RezFireAPI.request('/inspecoes', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
  },

  // Central Unificada de Alertas (SCRUM-24 / #19)
  alertas: {
    async obterCentral() {
      return window.RezFireAPI.request('/alertas/central');
    },
  },

  // Módulo de Anúncios, Histórico e Recriação (SCRUM-19 / #14 e SCRUM-20 / #15)
  anuncios: {
    async listar(params = {}) {
      const query = new URLSearchParams(params).toString();
      return window.RezFireAPI.request(`/anuncios${query ? '?' + query : ''}`);
    },
    async buscarPorId(id) {
      return window.RezFireAPI.request(`/anuncios/${id}`);
    },
    async listarHistorico(id) {
      return window.RezFireAPI.request(`/anuncios/${id}/historico`);
    },
    async adicionarOcorrencia(id, dados) {
      return window.RezFireAPI.request(`/anuncios/${id}/historico`, {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
    async marcarRecriado(id, dados) {
      return window.RezFireAPI.request(`/anuncios/${id}/marcar-recriado`, {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
    async listarRecriados() {
      return window.RezFireAPI.request('/anuncios/relatorios/recriados');
    },
    async listarMidias(id) {
      return window.RezFireAPI.request(`/anuncios/${id}/midias`);
    },
    async adicionarMidia(id, dados) {
      return window.RezFireAPI.request(`/anuncios/${id}/midias`, {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
    async removerMidia(id, id_midia) {
      return window.RezFireAPI.request(`/anuncios/${id}/midias/${id_midia}`, {
        method: 'DELETE',
      });
    },
  },

  usuarios: {
    async listar() {
      return window.RezFireAPI.request('/usuarios');
    },
    async obter(id) {
      return window.RezFireAPI.request(`/usuarios/${id}`);
    },
    async criar(dados) {
      return window.RezFireAPI.request('/usuarios', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
    async atualizar(id, dados) {
      return window.RezFireAPI.request(`/usuarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dados),
      });
    },
    async alternarStatus(id) {
      return window.RezFireAPI.request(`/usuarios/${id}/status`, {
        method: 'PATCH',
      });
    },
  },

  // Módulo de Notificações ao Gestor (User Story #32)
  notificacoes: {
    async listar(limite = 30) {
      return window.RezFireAPI.request(`/notificacoes?limite=${limite}`);
    },
    async marcarComoLida(id) {
      return window.RezFireAPI.request(`/notificacoes/${id}/lida`, {
        method: 'PUT',
      });
    },
    async marcarTodasComoLidas() {
      return window.RezFireAPI.request('/notificacoes/marcar-todas', {
        method: 'PUT',
      });
    },
  },
};

