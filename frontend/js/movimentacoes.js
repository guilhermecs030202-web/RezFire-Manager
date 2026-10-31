let movements = [];
let products = [];
let query = "";
let filterCanal = "todos";
let filterPeriodo = "30";

let _backendDisponivel = null;
async function _testarBackend() {
  if (_backendDisponivel !== null) return _backendDisponivel;
  try {
    const resp = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
    _backendDisponivel = resp.ok;
  } catch {
    _backendDisponivel = false;
  }
  return _backendDisponivel;
}

function formatDate(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function isExtintorProduct(product) {
  if (!product) return false;
  return (
    product.categoria === "Extintores" ||
    (product.sku && product.sku.startsWith("EXT")) ||
    Boolean(product.detalhes_extintor)
  );
}

function getPeriodLabel(period) {
  if (period === "7") return "últimos 7 dias";
  if (period === "30") return "últimos 30 dias";
  if (period === "90") return "últimos 90 dias";
  return "todo o histórico";
}

function getMovementsForPeriod(period) {
  if (period === "todos") return [...movements];
  const days = Number(period);
  const refTime = new Date("2024-10-15T18:00:00Z").getTime();
  const dayMs = 86400000;
  const startTime = refTime - days * dayMs;
  return movements.filter((m) => {
    const t = new Date(m.data).getTime();
    return t >= startTime && t <= refTime + dayMs;
  });
}

function renderKPIs() {
  const container = document.getElementById("kpis-movimentacoes-topo");
  if (!container) return;

  const periodMovements = getMovementsForPeriod(filterPeriodo);
  const metrics = RezFireData.computeMovementsMetrics(periodMovements);
  const money = RezFireData.formatMoney;
  const periodLabel = getPeriodLabel(filterPeriodo);

  container.innerHTML = `
    <article class="card kpi-card">
      <p class="kpi-label">SAÍDAS · MERCADO LIVRE</p>
      <p class="kpi-value">${metrics.qtdSaidasML.toLocaleString("pt-BR")} <span style="font-size:0.95rem;font-weight:600;color:#6b6560;">unidades</span></p>
      <p class="kpi-hint">Faturamento: <strong style="color:#1a1412;">${money(metrics.valorSaidasML)}</strong> (${periodLabel})</p>
    </article>
    <article class="card kpi-card">
      <p class="kpi-label">SAÍDAS · VENDA DIRETA</p>
      <p class="kpi-value">${metrics.qtdSaidasDiretas.toLocaleString("pt-BR")} <span style="font-size:0.95rem;font-weight:600;color:#6b6560;">unidades</span></p>
      <p class="kpi-hint">Faturamento: <strong style="color:#1a1412;">${money(metrics.valorSaidasDiretas)}</strong> (${periodLabel})</p>
    </article>
    <article class="card kpi-card">
      <p class="kpi-label">ENTRADAS DE REPOSIÇÃO</p>
      <p class="kpi-value">${metrics.qtdEntradas.toLocaleString("pt-BR")} <span style="font-size:0.95rem;font-weight:600;color:#1f9d5c;">unidades</span></p>
      <p class="kpi-hint">Abastecimento de estoque (${periodLabel})</p>
    </article>
    <article class="card kpi-card">
      <p class="kpi-label">TOTAL DE OPERAÇÕES</p>
      <p class="kpi-value">${periodMovements.length} <span style="font-size:0.95rem;font-weight:600;color:#6b6560;">registros</span></p>
      <p class="kpi-hint">Movimentações (${periodLabel})</p>
    </article>
  `;
}

function updateModalFieldsVisibility() {
  const tipo = document.getElementById("tipo").value;
  const motivo = document.getElementById("motivo").value;
  const idProduto = Number(document.getElementById("id_produto").value);
  const product = products.find((p) => p.id_produto === idProduto);

  const secaoVenda = document.getElementById("secao-dados-venda");
  const secaoExtintor = document.getElementById("extintor-lote-section");
  const campoPreco = document.getElementById("campo-preco-venda");

  const isVenda = motivo === "Venda Mercado Livre" || motivo === "Venda Direta";

  if (secaoVenda) {
    secaoVenda.style.display = isVenda ? "block" : "none";
  }

  if (campoPreco) {
    campoPreco.style.display = tipo === "Saída" || isVenda ? "block" : "none";
    if (product && isVenda && !document.getElementById("preco_unitario").value) {
      document.getElementById("preco_unitario").value = product.preco || 0;
    }
  }

  if (secaoExtintor) {
    if (tipo === "Entrada" && isExtintorProduct(product)) {
      secaoExtintor.style.display = "block";
      const inmetroInput = document.getElementById("lote_inmetro");
      const d = product.detalhes_extintor || {};
      if (inmetroInput && !inmetroInput.value && d.registro_inmetro) {
        inmetroInput.value = d.registro_inmetro;
      }
    } else {
      secaoExtintor.style.display = "none";
    }
  }
  atualizarIndicadorSaldo();
}

function atualizarIndicadorSaldo() {
  const tipo = document.getElementById("tipo") ? document.getElementById("tipo").value : "";
  const idProduto = Number(document.getElementById("id_produto") ? document.getElementById("id_produto").value : 0);
  const qtdInput = document.getElementById("quantidade");
  const qtd = qtdInput ? Number(qtdInput.value) || 0 : 0;
  const product = products.find((p) => p.id_produto === idProduto);

  const badgeEl = document.getElementById("saldo-disponivel-badge");
  const avisoEl = document.getElementById("saldo-aviso-bloqueio");
  const errorEl = document.getElementById("form-error");

  if (!badgeEl || !avisoEl || !qtdInput) return;

  if (tipo === "Saída" && product) {
    const saldoAtual = Number(product.quantidade_atual !== undefined ? product.quantidade_atual : 0);
    badgeEl.style.display = "inline";
    badgeEl.textContent = `Saldo disponível: ${saldoAtual} un.`;
    badgeEl.style.color = saldoAtual > 0 ? "#1f9d5c" : "#dc2626";

    if (qtd > saldoAtual) {
      qtdInput.style.borderColor = "#dc2626";
      avisoEl.style.display = "block";
      avisoEl.textContent = `Bloqueado: quantidade maior que o saldo atual (${saldoAtual} un.)`;
    } else {
      qtdInput.style.borderColor = "";
      avisoEl.style.display = "none";
      if (errorEl && errorEl.textContent.includes("Estoque insuficiente")) {
        errorEl.textContent = "";
      }
    }
  } else {
    badgeEl.style.display = "none";
    avisoEl.style.display = "none";
    qtdInput.style.borderColor = "";
  }
}

function updateMotivosOptions() {
  const tipo = document.getElementById("tipo").value;
  const motivoSelect = document.getElementById("motivo");

  if (tipo === "Entrada") {
    motivoSelect.innerHTML = `
      <option value="Nota Fiscal (Abastecimento)">Nota Fiscal (Abastecimento)</option>
      <option value="Devolução">Devolução de Cliente</option>
      <option value="Ajuste Manual">Ajuste Manual (Entrada)</option>
    `;
  } else {
    motivoSelect.innerHTML = `
      <option value="Venda Mercado Livre" selected>Venda Mercado Livre</option>
      <option value="Venda Direta">Venda Direta / B2B</option>
      <option value="Avaria / Perda">Avaria / Perda</option>
      <option value="Ajuste Manual">Ajuste Manual (Saída)</option>
    `;
  }

  updateModalFieldsVisibility();
}

function renderTable() {
  const body = document.getElementById("movimentacoes-body");
  const countEl = document.getElementById("movimentacoes-count");
  const money = RezFireData.formatMoney;

  // 1. Filtro por Período
  let filtered = getMovementsForPeriod(filterPeriodo);

  // 2. Filtro por Canal / Tipo
  if (filterCanal === "Mercado Livre") {
    filtered = filtered.filter((m) => m.canal === "Mercado Livre" || m.motivo.includes("Mercado Livre"));
  } else if (filterCanal === "Venda Direta") {
    filtered = filtered.filter((m) => m.canal === "Venda Direta" || m.motivo.includes("Venda Direta"));
  } else if (filterCanal === "Entrada") {
    filtered = filtered.filter((m) => m.tipo === "Entrada");
  }

  // 3. Busca Textual
  if (query) {
    const term = query.toLowerCase();
    filtered = filtered.filter((m) => {
      const prod = products.find((p) => p.id_produto === m.id_produto);
      const prodStr = prod ? `${prod.sku} ${prod.nome}`.toLowerCase() : (m.sku ? `${m.sku} ${m.nome_produto}`.toLowerCase() : "");
      const codPedido = (m.codigo_pedido || "").toLowerCase();
      const clienteStr = (m.cliente || "").toLowerCase();
      const motivoStr = (m.motivo || "").toLowerCase();
      const r = m.detalhes_remessa;
      const remessaStr = r ? `${r.lote || ""} ${r.lacre || ""} ${r.inmetro || ""}`.toLowerCase() : "";

      return (
        prodStr.includes(term) ||
        codPedido.includes(term) ||
        clienteStr.includes(term) ||
        motivoStr.includes(term) ||
        remessaStr.includes(term)
      );
    });
  }

  // Ordena por data decrescente
  filtered.sort((a, b) => new Date(b.data) - new Date(a.data));

  if (countEl) {
    countEl.textContent = `${filtered.length} movimentações no período selecionado`;
  }

  if (!filtered.length) {
    body.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">Nenhuma movimentação encontrada para os filtros selecionados.</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = filtered
    .map((m) => {
      const prod = products.find((p) => p.id_produto === m.id_produto);
      const sku = prod ? prod.sku : (m.sku || "PROD");
      const nome = prod ? prod.nome : (m.nome_produto || "Produto");
      const isEntrada = m.tipo === "Entrada";
      const isML = m.canal === "Mercado Livre" || m.motivo.includes("Mercado Livre");
      const isDireto = m.canal === "Venda Direta" || m.motivo.includes("Venda Direta");

      // Badges de Canal/Tipo
      let canalBadge = `<span class="badge-channel" style="background:#e8f8ee;color:#1f9d5c;border:1px solid #bbf7d0;">Entrada / NF</span>`;
      if (isML) {
        canalBadge = `<span class="badge-channel ml">Venda Mercado Livre</span>`;
      } else if (isDireto) {
        canalBadge = `<span class="badge-channel direto">Venda Direta / B2B</span>`;
      } else if (!isEntrada) {
        canalBadge = `<span class="badge-channel" style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca;">${m.motivo}</span>`;
      }

      // Detalhes de Remessa / Lote de Extintores
      const r = m.detalhes_remessa;
      const temRemessa = r && (r.lote || r.validade || r.lacre || r.inmetro);

      // Status do Pedido
      let statusBadge = "";
      if (m.status_pedido) {
        let stClass = "entregue";
        if (m.status_pedido === "Em trânsito") stClass = "transito";
        else if (m.status_pedido === "Aprovado") stClass = "aprovado";
        else if (m.status_pedido === "Cancelado") stClass = "cancelado";
        statusBadge = `<span class="badge-order-status ${stClass}">${m.status_pedido}</span>`;
      } else {
        statusBadge = `<span class="badge-order-status entregue">Concluído</span>`;
      }

      const valorUnit = m.preco_unitario ? money(m.preco_unitario) : "-";
      const valorTotal = m.valor_total ? money(m.valor_total) : (m.preco_unitario ? money(m.preco_unitario * m.quantidade) : "-");

      return `
        <tr>
          <td>
            <span class="text-xs text-stone-700 font-semibold whitespace-nowrap">${formatDate(m.data)}</span>
          </td>
          <td>
            <div class="flex flex-col">
              <span class="sku-main">${sku}</span>
              <span class="sku-sub">${nome}</span>
              ${temRemessa ? `
                <div class="flex flex-wrap gap-1 mt-1 text-xs">
                  ${r.lote ? `<span class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">Lote: ${r.lote}</span>` : ""}
                  ${r.validade ? `<span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Validade: ${formatDateOnly(r.validade)}</span>` : ""}
                  ${r.lacre ? `<span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">Lacre: ${r.lacre}</span>` : ""}
                  ${r.inmetro ? `<span class="px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200">Selo: ${r.inmetro}</span>` : ""}
                </div>
              ` : ""}
            </div>
          </td>
          <td>${canalBadge}</td>
          <td>
            <div class="flex flex-col">
              ${m.codigo_pedido ? `
                <button type="button" class="btn-ver-detalhes-venda text-left bg-transparent border-0 p-0 cursor-pointer group" data-codigo="${m.codigo_pedido}" title="Clique para ver detalhes do pedido e produtos">
                  <strong class="text-xs text-stone-900 group-hover:text-amber-600 underline decoration-stone-300 underline-offset-2">${m.codigo_pedido}</strong>
                </button>
              ` : `<span class="text-xs text-stone-400">Sem código</span>`}
              <span class="text-xs text-stone-600">${m.cliente || "RezFire Operação"} ${m.uf ? `(${m.uf})` : ""}</span>
              ${m.tipo_envio ? `<span class="text-[11px] text-stone-400">${m.tipo_envio}</span>` : ""}
            </div>
          </td>
          <td>
            <span class="font-bold text-sm ${isEntrada ? "text-emerald-600" : "text-rose-600"}">
              ${isEntrada ? "+" : "-"}${m.quantidade} un.
            </span>
          </td>
          <td>
            <div class="flex flex-col">
              <span class="font-bold text-xs text-stone-900">${valorTotal}</span>
              <span class="text-[11px] text-stone-500">${valorUnit} / un.</span>
            </div>
          </td>
          <td>
            <div class="flex flex-col items-start gap-1">
              ${statusBadge}
              <span class="text-[11px] text-stone-400">${m.responsavel || "Gestor RezFire"}</span>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Vincula botões de detalhes do pedido
  body.querySelectorAll(".btn-ver-detalhes-venda").forEach((btn) => {
    btn.addEventListener("click", () => {
      const codigo = btn.dataset.codigo;
      openSaleDetailsModal(codigo);
    });
  });
}

function openSaleDetailsModal(codigoPedido) {
  const modal = document.getElementById("modal-detalhes-venda");
  const titulo = document.getElementById("modal-venda-titulo");
  const conteudo = document.getElementById("modal-venda-conteudo");
  const money = RezFireData.formatMoney;

  if (!modal || !conteudo) return;

  // Busca o pedido correspondente ou agrupa movimentações com este código
  const orders = RezFireData.loadOrders();
  const order = orders.find((o) => o.codigo_pedido === codigoPedido);
  const movsDoPedido = movements.filter((m) => m.codigo_pedido === codigoPedido);

  titulo.textContent = `Operação / Pedido: ${codigoPedido}`;

  const canal = order ? order.canal : (movsDoPedido[0] ? movsDoPedido[0].canal : "Mercado Livre");
  const cliente = order ? order.cliente : (movsDoPedido[0] ? movsDoPedido[0].cliente : "Cliente");
  const uf = order ? order.uf : (movsDoPedido[0] ? movsDoPedido[0].uf : "SP");
  const status = order ? order.status : (movsDoPedido[0] ? movsDoPedido[0].status_pedido || "Entregue" : "Entregue");
  const data = order ? order.data_pedido : (movsDoPedido[0] ? movsDoPedido[0].data : new Date().toISOString());
  const tipoEnvio = order ? order.tipo_envio : (movsDoPedido[0] ? movsDoPedido[0].tipo_envio : "Padrão");

  const isML = canal === "Mercado Livre";
  const canalBadge = isML
    ? `<span class="badge-channel ml">Mercado Livre (${tipoEnvio || "Full"})</span>`
    : `<span class="badge-channel direto">Venda Direta / B2B</span>`;

  let statusClass = "entregue";
  if (status === "Em trânsito") statusClass = "transito";
  else if (status === "Aprovado") statusClass = "aprovado";
  else if (status === "Cancelado") statusClass = "cancelado";

  // Itens: usa itens do pedido ou as próprias movimentações vinculadas
  let itensHtml = "";
  let totalValor = 0;

  if (order && order.itens && order.itens.length > 0) {
    totalValor = order.valor_total;
    itensHtml = order.itens.map((it) => `
      <tr>
        <td>
          <strong>${it.sku}</strong>
          <div style="font-size:0.75rem; color:#6b6560;">${it.nome}</div>
        </td>
        <td><span class="text-xs text-stone-500">${it.categoria || "Extintores"}</span></td>
        <td><strong class="text-rose-600">-${it.quantidade} un.</strong></td>
        <td>${money(it.preco_unitario)}</td>
        <td><strong>${money(it.subtotal)}</strong></td>
      </tr>
    `).join("");
  } else {
    totalValor = movsDoPedido.reduce((sum, m) => sum + Number(m.valor_total || 0), 0);
    itensHtml = movsDoPedido.map((m) => `
      <tr>
        <td>
          <strong>${m.sku}</strong>
          <div style="font-size:0.75rem; color:#6b6560;">${m.nome_produto}</div>
        </td>
        <td><span class="text-xs text-stone-500">${m.motivo}</span></td>
        <td><strong class="${m.tipo === 'Entrada' ? 'text-emerald-600' : 'text-rose-600'}">${m.tipo === 'Entrada' ? '+' : '-'}${m.quantidade} un.</strong></td>
        <td>${money(m.preco_unitario)}</td>
        <td><strong>${money(m.valor_total)}</strong></td>
      </tr>
    `).join("");
  }

  conteudo.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="background:#faf7f3; border:1px solid #ebe4db; border-radius:12px; padding:14px 16px; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
        <div>
          <span style="font-size:0.7rem; font-weight:700; color:#6b6560; text-transform:uppercase;">Canal de Venda</span>
          <div style="margin-top:4px;">${canalBadge}</div>
        </div>
        <div>
          <span style="font-size:0.7rem; font-weight:700; color:#6b6560; text-transform:uppercase;">Cliente / Destinatário</span>
          <div style="font-size:0.85rem; font-weight:700; color:#1a1412; margin-top:2px;">${cliente}</div>
          <div style="font-size:0.75rem; color:#6b6560;">Estado: ${uf}</div>
        </div>
        <div>
          <span style="font-size:0.7rem; font-weight:700; color:#6b6560; text-transform:uppercase;">Data do Registro</span>
          <div style="font-size:0.85rem; font-weight:600; color:#1a1412; margin-top:2px;">${formatDate(data)}</div>
        </div>
        <div>
          <span style="font-size:0.7rem; font-weight:700; color:#6b6560; text-transform:uppercase;">Status da Venda</span>
          <div style="margin-top:4px;"><span class="badge-order-status ${statusClass}">${status}</span></div>
        </div>
      </div>

      <div>
        <h4 style="margin:0 0 8px; font-size:0.85rem; font-weight:700; color:#1a1412;">Itens e Extintores Baixados no Estoque</h4>
        <div class="table-wrap" style="border:1px solid #ebe4db; border-radius:10px;">
          <table class="products-table" style="font-size:0.82rem;">
            <thead>
              <tr style="background:#fcfbf9;">
                <th>ITEM / PRODUTO</th>
                <th>CATEGORIA / MOTIVO</th>
                <th>BAIXA ESTOQUE</th>
                <th>VALOR UNIT.</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itensHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; border-top:1px solid #ebe4db; padding-top:14px; flex-wrap:wrap; gap:12px;">
        <div style="font-size:0.85rem;">
          <span style="color:#6b6560;">Valor Transacionado:</span> <strong style="font-size:1.15rem; color:#1a1412;">${money(totalValor)}</strong>
          <span style="font-size:0.75rem; color:#6b6560; margin-left:8px;">(${movsDoPedido.length} item(ns) movimentado(s))</span>
        </div>
        <div style="display:flex; gap:8px;">
          <a href="dashboard.html" class="btn-primary" style="text-decoration:none; font-size:0.82rem; padding:8px 14px; display:inline-flex; align-items:center; gap:6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Ver no Painel de Vendas
          </a>
        </div>
      </div>
    </div>
  `;

  modal.classList.add("is-open");
}

function openModal() {
  document.getElementById("form-error").textContent = "";

  const select = document.getElementById("id_produto");
  select.innerHTML =
    `<option value="">Selecione o produto...</option>` +
    products.map((p) => `<option value="${p.id_produto}">${p.sku} - ${p.nome}</option>`).join("");

  document.getElementById("tipo").value = "Saída";
  updateMotivosOptions();
  document.getElementById("quantidade").value = 1;
  document.getElementById("preco_unitario").value = "";

  // Campos de Venda
  document.getElementById("codigo_pedido").value = `MLB-28${Math.floor(100000 + Math.random() * 900000)}`;
  document.getElementById("cliente_nome").value = "";
  document.getElementById("cliente_uf").value = "SP";

  // Campos de Remessa
  document.getElementById("lote_serie").value = "";
  document.getElementById("lote_inmetro").value = "";
  document.getElementById("lote_fabricacao").value = "";
  document.getElementById("lote_validade").value = "";
  document.getElementById("lote_lacre").value = "";
  const chk = document.getElementById("atualizar_produto_extintor");
  if (chk) chk.checked = true;

  updateModalFieldsVisibility();
  document.getElementById("modal").classList.add("is-open");
}

function closeModal() {
  document.getElementById("modal").classList.remove("is-open");
}

function bindEvents() {
  document.getElementById("busca").addEventListener("input", (event) => {
    query = event.target.value;
    renderTable();
  });

  const selectCanal = document.getElementById("filtro-mov-canal");
  if (selectCanal) {
    selectCanal.addEventListener("change", (e) => {
      filterCanal = e.target.value;
      renderTable();
    });
  }

  const selectPeriodo = document.getElementById("filtro-mov-periodo");
  if (selectPeriodo) {
    selectPeriodo.addEventListener("change", (e) => {
      filterPeriodo = e.target.value;
      renderKPIs();
      renderTable();
    });
  }

  document.getElementById("btn-nova-movimentacao").addEventListener("click", openModal);
  document.getElementById("btn-cancelar").addEventListener("click", closeModal);
  document.getElementById("modal").addEventListener("click", (event) => {
    if (event.target.id === "modal") closeModal();
  });

  const modalVenda = document.getElementById("modal-detalhes-venda");
  const btnFecharVenda = document.getElementById("btn-fechar-modal-venda");
  if (btnFecharVenda && modalVenda) {
    btnFecharVenda.addEventListener("click", () => modalVenda.classList.remove("is-open"));
    modalVenda.addEventListener("click", (event) => {
      if (event.target.id === "modal-detalhes-venda") modalVenda.classList.remove("is-open");
    });
  }

  document.getElementById("tipo").addEventListener("change", updateMotivosOptions);
  document.getElementById("motivo").addEventListener("change", updateModalFieldsVisibility);
  document.getElementById("id_produto").addEventListener("change", () => {
    const idProduto = Number(document.getElementById("id_produto").value);
    const product = products.find((p) => p.id_produto === idProduto);
    if (product && product.preco) {
      document.getElementById("preco_unitario").value = product.preco;
    }
    updateModalFieldsVisibility();
    atualizarIndicadorSaldo();
  });
  document.getElementById("quantidade")?.addEventListener("input", atualizarIndicadorSaldo);

  document.getElementById("form-movimentacao").addEventListener("submit", async (event) => {
    event.preventDefault();
    const idProduto = Number(document.getElementById("id_produto").value);
    const tipo = document.getElementById("tipo").value;
    const motivo = document.getElementById("motivo").value;
    const qtd = Number(document.getElementById("quantidade").value);
    const precoUnit = Number(document.getElementById("preco_unitario").value) || 0;

    if (!idProduto) {
      document.getElementById("form-error").textContent = "Selecione um produto.";
      return;
    }
    if (!Number.isInteger(qtd) || qtd < 1) {
      document.getElementById("form-error").textContent = "Quantidade deve ser um número inteiro maior que zero.";
      return;
    }

    const product = products.find((p) => p.id_produto === idProduto);
    if (!product) {
      document.getElementById("form-error").textContent = "Produto não encontrado.";
      return;
    }

    if (tipo === "Saída" && product.quantidade_atual < qtd) {
      document.getElementById("form-error").textContent = `Estoque insuficiente. Quantidade atual disponível: ${product.quantidade_atual} un.`;
      return;
    }

    // Dados de Venda
    const isVenda = motivo === "Venda Mercado Livre" || motivo === "Venda Direta";
    let canal = "Operação";
    let codigoPedido = "";
    let cliente = "RezFire Interno";
    let uf = "SP";
    let tipoEnvio = "Envio Padrão";

    if (isVenda) {
      canal = motivo === "Venda Mercado Livre" ? "Mercado Livre" : "Venda Direta";
      codigoPedido = document.getElementById("codigo_pedido").value.trim() || (canal === "Mercado Livre" ? `MLB-28${Date.now().toString().slice(-6)}` : `DIR-${Date.now().toString().slice(-4)}`);
      cliente = document.getElementById("cliente_nome").value.trim() || (canal === "Mercado Livre" ? "Cliente Mercado Livre" : "Cliente Venda Direta");
      uf = document.getElementById("cliente_uf").value || "SP";
      tipoEnvio = document.getElementById("tipo_envio").value || "Mercado Envios Full";
    }

    // Coleta detalhes da remessa caso seja extintor e entrada
    let detalhes_remessa = null;
    if (tipo === "Entrada" && isExtintorProduct(product)) {
      const lote = document.getElementById("lote_serie").value.trim();
      const inmetro = document.getElementById("lote_inmetro").value.trim();
      const fabricacao = document.getElementById("lote_fabricacao").value;
      const validade = document.getElementById("lote_validade").value;
      const lacre = document.getElementById("lote_lacre").value.trim();

      if (lote || inmetro || fabricacao || validade || lacre) {
        detalhes_remessa = { lote, inmetro, fabricacao, validade, lacre };

        const chkUpdate = document.getElementById("atualizar_produto_extintor");
        if (chkUpdate && chkUpdate.checked) {
          if (!product.detalhes_extintor) product.detalhes_extintor = {};
          if (validade) product.detalhes_extintor.data_validade = validade;
          if (fabricacao) product.detalhes_extintor.data_fabricacao = fabricacao;
          if (lacre) product.detalhes_extintor.numero_lacre = lacre;
          if (inmetro) product.detalhes_extintor.registro_inmetro = inmetro;
        }
      }
    }

    const dataIso = new Date().toISOString();

    const apiAtiva = await _testarBackend();
    if (apiAtiva) {
      try {
        const payload = {
          id_produto: idProduto,
          tipo,
          quantidade: qtd,
          motivo,
          data_movimentacao: dataIso,
          preco_unitario: precoUnit || (tipo === "Entrada" ? product.custo : product.preco),
          codigo_pedido: codigoPedido || null,
          canal,
          tipo_envio: tipoEnvio || null,
          cliente: cliente || null,
          uf: uf || null,
          detalhes_remessa,
          atualizar_produto_extintor: document.getElementById("atualizar_produto_extintor")?.checked || false,
        };

        const resApi = await RezFireAPI.createMovimentacao(payload);
        product.quantidade_atual = resApi.novo_saldo;

        const newMov = {
          id_movimentacao: resApi.id_movimentacao,
          id_pedido: isVenda ? Date.now() : null,
          codigo_pedido: codigoPedido,
          canal,
          tipo_envio: tipoEnvio,
          cliente,
          uf,
          status_pedido: "Entregue",
          id_produto: idProduto,
          sku: product.sku,
          nome_produto: product.nome,
          tipo,
          motivo,
          quantidade: qtd,
          preco_unitario: resApi.preco_unitario,
          valor_total: resApi.valor_total,
          data: resApi.data || dataIso,
          responsavel: resApi.responsavel || "Gestor RezFire",
          detalhes_remessa,
        };

        movements.unshift(newMov);
        RezFireData.saveMovements(movements);
        RezFireData.saveProducts(products);

        // Se for Venda, sincroniza também na base de Pedidos de Venda
        if (isVenda) {
          try {
            const orders = RezFireData.loadOrders();
            const custoUnit = product.custo || (product.preco * 0.5);
            orders.unshift({
              id_pedido: newMov.id_pedido,
              codigo_pedido: codigoPedido,
              canal,
              tipo_envio: tipoEnvio,
              data_pedido: dataIso,
              cliente,
              uf,
              status: "Entregue",
              itens: [
                {
                  id_produto: product.id_produto,
                  sku: product.sku,
                  nome: product.nome,
                  categoria: product.sku.startsWith("EXT") ? "Extintores" : (product.sku.startsWith("PLA") ? "Sinalização" : "Acessórios"),
                  quantidade: qtd,
                  preco_unitario: precoUnit || product.preco,
                  custo_unitario: custoUnit,
                  subtotal: (precoUnit || product.preco) * qtd,
                  custo_total: custoUnit * qtd,
                },
              ],
              valor_total: (precoUnit || product.preco) * qtd,
              custo_total: custoUnit * qtd,
              lucro_bruto: ((precoUnit || product.preco) - custoUnit) * qtd,
            });
            localStorage.setItem("rezfire.pedidos", JSON.stringify(orders));
          } catch (err) {
            console.error("Erro ao sincronizar venda com pedidos:", err);
          }
        }

        closeModal();
        renderKPIs();
        renderTable();
        return;
      } catch (err) {
        document.getElementById("form-error").textContent = err.message || "Erro ao registrar movimentação na API.";
        return;
      }
    }

    // 1. Registra a Movimentação
    const newMov = {
      id_movimentacao: Date.now(),
      id_pedido: isVenda ? Date.now() : null,
      codigo_pedido: codigoPedido,
      canal,
      tipo_envio: tipoEnvio,
      cliente,
      uf,
      status_pedido: "Entregue",
      id_produto: idProduto,
      sku: product.sku,
      nome_produto: product.nome,
      tipo,
      motivo,
      quantidade: qtd,
      preco_unitario: precoUnit || product.preco,
      valor_total: (precoUnit || product.preco) * qtd,
      data: dataIso,
      responsavel: canal === "Mercado Livre" ? "Mercado Livre API" : "Gestor RezFire",
      detalhes_remessa,
    };

    movements.unshift(newMov);
    RezFireData.saveMovements(movements);

    // 2. Se for Venda, sincroniza também na base de Pedidos de Venda
    if (isVenda) {
      try {
        const orders = RezFireData.loadOrders();
        const custoUnit = product.custo || (product.preco * 0.5);
        orders.unshift({
          id_pedido: newMov.id_pedido,
          codigo_pedido: codigoPedido,
          canal,
          tipo_envio: tipoEnvio,
          data_pedido: dataIso,
          cliente,
          uf,
          status: "Entregue",
          itens: [
            {
              id_produto: product.id_produto,
              sku: product.sku,
              nome: product.nome,
              categoria: product.sku.startsWith("EXT") ? "Extintores" : (product.sku.startsWith("PLA") ? "Sinalização" : "Acessórios"),
              quantidade: qtd,
              preco_unitario: precoUnit || product.preco,
              custo_unitario: custoUnit,
              subtotal: (precoUnit || product.preco) * qtd,
              custo_total: custoUnit * qtd,
            },
          ],
          valor_total: (precoUnit || product.preco) * qtd,
          custo_total: custoUnit * qtd,
          lucro_bruto: ((precoUnit || product.preco) - custoUnit) * qtd,
        });
        localStorage.setItem("rezfire.pedidos", JSON.stringify(orders));
      } catch (err) {
        console.error("Erro ao sincronizar venda com pedidos:", err);
      }
    }

    // 3. Atualiza saldo de estoque do produto
    if (tipo === "Entrada") {
      product.quantidade_atual += qtd;
    } else {
      product.quantidade_atual -= qtd;
    }
    RezFireData.saveProducts(products);

    closeModal();
    renderKPIs();
    renderTable();
  });
}

async function init() {
  RezFireLayout.renderSidebar("movimentacoes");
  const apiAtiva = await _testarBackend();
  if (apiAtiva) {
    try {
      products = await RezFireAPI.getProdutos();
      RezFireData.saveProducts(products);

      const apiMovs = await RezFireAPI.getMovimentacoes();
      if (Array.isArray(apiMovs) && apiMovs.length > 0) {
        movements = apiMovs;
        RezFireData.saveMovements(movements);
      } else {
        movements = RezFireData.loadMovements();
      }
    } catch {
      products = RezFireData.loadProducts();
      movements = RezFireData.loadMovements();
    }
  } else {
    products = RezFireData.loadProducts();
    movements = RezFireData.loadMovements();
  }

  // Deeplink: lê parâmetros ?busca= ou ?pedido= passados pelo Dashboard de Vendas
  const urlParams = new URLSearchParams(window.location.search);
  const paramBusca = urlParams.get("busca") || urlParams.get("pedido");
  if (paramBusca) {
    query = paramBusca;
    filterPeriodo = "todos"; // garante que o pedido apareça mesmo se for de meses atrás
    const inputBusca = document.getElementById("busca");
    if (inputBusca) inputBusca.value = paramBusca;
    const selectPeriodo = document.getElementById("filtro-mov-periodo");
    if (selectPeriodo) selectPeriodo.value = "todos";
  }

  bindEvents();
  renderKPIs();
  renderTable();

  // Sincronização em tempo real caso nova venda ou pedido seja registrado
  window.addEventListener("storage", (e) => {
    if (e.key === "rezfire.movimentacoes" || e.key === "rezfire.pedidos" || e.key === "rezfire.produtos") {
      products = RezFireData.loadProducts();
      movements = RezFireData.loadMovements();
      renderKPIs();
      renderTable();
    }
  });
}

init();


