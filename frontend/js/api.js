/**
 * RezFire API Client
 * Funções para comunicação com o backend RezFire Manager.
 * Utiliza API_BASE_URL definida em mock-data.js.
 */

const RezFireAPI = {
  /**
   * Retorna os headers padrão para requisições JSON.
   */
  _headers() {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  },

  /**
   * Trata a resposta da API e lança um erro descritivo em caso de falha.
   * @param {Response} response
   * @returns {Promise<any>}
   */
  async _handleResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        (isJson && body && body.error) ? body.error : `Erro ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }

    return body;
  },

  /**
   * Lista todos os produtos (com dados de estoque mesclados).
   * @returns {Promise<Array>}
   */
  async getProdutos() {
    const response = await fetch(`${API_BASE_URL}/produtos`, {
      method: 'GET',
      headers: this._headers(),
    });
    return this._handleResponse(response);
  },

  /**
   * Busca um produto pelo ID.
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async getProduto(id) {
    const response = await fetch(`${API_BASE_URL}/produtos/${id}`, {
      method: 'GET',
      headers: this._headers(),
    });
    return this._handleResponse(response);
  },

  /**
   * Cria um novo produto. O backend cria automaticamente o registro de estoque zerado.
   * @param {Object} data - Dados do produto
   * @returns {Promise<Object>}
   */
  async createProduto(data) {
    const response = await fetch(`${API_BASE_URL}/produtos`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(data),
    });
    return this._handleResponse(response);
  },

  /**
   * Atualiza um produto existente.
   * @param {number} id
   * @param {Object} data - Campos a atualizar
   * @returns {Promise<Object>}
   */
  async updateProduto(id, data) {
    const response = await fetch(`${API_BASE_URL}/produtos/${id}`, {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify(data),
    });
    return this._handleResponse(response);
  },

  /**
   * Exclui (desativa via soft delete) um produto.
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async deleteProduto(id) {
    const response = await fetch(`${API_BASE_URL}/produtos/${id}`, {
      method: 'DELETE',
      headers: this._headers(),
    });
    return this._handleResponse(response);
  },

  /**
   * Lista movimentações de estoque (com filtros opcionais).
   * @param {Object} [filters] - { id_produto, tipo, limite }
   * @returns {Promise<Array>}
   */
  async getMovimentacoes(filters = {}) {
    const params = new URLSearchParams();
    if (filters.id_produto) params.append('id_produto', filters.id_produto);
    if (filters.tipo) params.append('tipo', filters.tipo);
    if (filters.limite) params.append('limite', filters.limite);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/movimentacoes${qs}`, {
      method: 'GET',
      headers: this._headers(),
    });
    return this._handleResponse(response);
  },

  /**
   * Consulta histórico de movimentações de um produto específico.
   * @param {number} id_produto
   * @returns {Promise<Array>}
   */
  async getMovimentacoesPorProduto(id_produto) {
    const response = await fetch(`${API_BASE_URL}/movimentacoes/produto/${id_produto}`, {
      method: 'GET',
      headers: this._headers(),
    });
    return this._handleResponse(response);
  },

  /**
   * Registra uma nova movimentação de estoque (entrada ou saída).
   * Recalcula automaticamente o saldo no backend.
   * @param {Object} data - Dados da movimentação
   * @returns {Promise<Object>}
   */
  async createMovimentacao(data) {
    const response = await fetch(`${API_BASE_URL}/movimentacoes`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(data),
    });
    return this._handleResponse(response);
  },
};
