function icon(name) {
  const paths = {
    dashboard:
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    products:
      '<path d="M4 7h16v12H4z"/><path d="M8 7V5h8v2"/><path d="M8 12h8"/>',
    estoque:
      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    alert:
      '<path d="M12 4 4 18h16L12 4z"/><path d="M12 9v5"/><circle cx="12" cy="16" r="0.8" fill="currentColor"/>',
    flame:
      '<path fill="#e85c2a" stroke="none" d="M12.9 2.7c.4 2.6 2.2 4 2.6 6.3.2 1.2-.2 2.2-1 2.9.9-.4 1.6-1.2 1.9-2.3.9 1.5 1.4 3.1 1.4 4.6 0 4.1-3.1 7.2-7.8 7.2S2.2 18.3 2.2 14.2c0-3.3 1.9-5.5 3.6-7.5C7.2 5.2 8 4.1 8.2 2.6c1.4 1.2 2.8 3.1 4 2.4-.2-1-.5-1.7.7-2.3z"/><path fill="#f4efe8" stroke="none" d="M12 18.4c-1.9 0-3.2-1.3-3.2-3.2 0-1.4.8-2.3 1.8-3.1.1 1.3.8 2.2 1.8 2.6.6-1.1.7-2.2.5-3.4 1.4.8 2.3 2.1 2.3 3.9 0 1.9-1.3 3.2-3.2 3.2z"/>',
    logout: '<path d="M10 6H6v12h4"/><path d="M14 12H8"/><path d="m12 9 3 3-3 3"/>',
    truck:
      '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 4v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    orders:
      '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    anuncios:
      '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 8h10"/><path d="M7 12h6"/>',
  };

  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

function renderSidebar(active) {
  const root = document.getElementById("app-shell");
  if (!root) return;

  const sidebar = document.createElement("aside");
  sidebar.className = "sidebar";
  sidebar.innerHTML = `
    <div class="sidebar-brand">
      ${icon("flame")}
      <span>REZFIRE</span>
    </div>
    <nav class="sidebar-nav">
      <a class="nav-item ${active === "dashboard" ? "is-active" : ""}" href="dashboard.html">
        ${icon("dashboard")} Painel Executivo
      </a>
      <a class="nav-item ${active === "produtos" ? "is-active" : ""}" href="produtos.html">
        ${icon("products")} Produtos
      </a>
      <a class="nav-item ${active === "estoque" ? "is-active" : ""}" href="estoque.html">
        ${icon("estoque")} Estoque
      </a>
      <a class="nav-item ${active === "pedidos" ? "is-active" : ""}" href="pedidos.html">
        ${icon("orders")} Pedidos
      </a>
      <a class="nav-item ${active === "movimentacoes" ? "is-active" : ""}" href="movimentacoes.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M17 3v18"/><path d="m21 7-4-4-4 4"/><path d="M7 21V3"/><path d="m3 17 4 4 4-4"/></svg> Movimentações
      </a>
      <a class="nav-item ${active === "entregas" ? "is-active" : ""}" href="entregas.html">
        ${icon("truck")} Entregas
      </a>
      <a class="nav-item ${active === "anuncios" ? "is-active" : ""}" href="anuncios.html">
        ${icon("anuncios")} Anúncios ML
      </a>
      <a class="nav-item ${active === "alertas" ? "is-active" : ""}" href="alertas.html">
        ${icon("alert")} Central de Alertas
        <span class="nav-badge" id="sidebar-alertas-badge">0</span>
      </a>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user" id="sidebar-user-name">Gestor RezFire</div>
      <div class="sidebar-role">GESTOR</div>
      <button class="sidebar-logout" id="btn-sidebar-logout" type="button" title="Encerrar sessão com segurança">
        ${icon("logout")} Sair
      </button>
    </div>
  `;

  root.prepend(sidebar);

  // Carrega nome do usuário da sessão se disponível
  try {
    const rawUser = localStorage.getItem('rezfire_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u.nome) {
        const nameEl = document.getElementById("sidebar-user-name");
        if (nameEl) nameEl.textContent = u.nome;
      }
    }
  } catch (e) {}

  // Ação de Logout
  const btnLogout = document.getElementById("btn-sidebar-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      if (confirm("Deseja realmente sair do sistema RezFire Manager?")) {
        if (window.RezFireAPI && window.RezFireAPI.auth) {
          window.RezFireAPI.auth.logout();
        } else {
          localStorage.removeItem('rezfire_auth_token');
          localStorage.removeItem('rezfire_user');
          window.location.href = 'login.html';
        }
      }
    });
  }
}

window.RezFireLayout = { renderSidebar };
