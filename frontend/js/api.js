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
      return window.RezFireAPI.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
      });
    },
    async logout() {
      return window.RezFireAPI.request('/auth/logout', { method: 'POST' });
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
  },

  // Módulo de Pedidos
  pedidos: {
    async listar(params = {}) {
      const query = new URLSearchParams(params).toString();
      return window.RezFireAPI.request(`/pedidos${query ? '?' + query : ''}`);
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
    async atualizarStatus(id, status, status_entrega) {
      return window.RezFireAPI.request(`/pedidos/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, status_entrega }),
      });
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
  },
};

