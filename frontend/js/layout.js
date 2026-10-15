function icon(name) {
  const paths = {
    dashboard:
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    products:
      '<path d="M4 7h16v12H4z"/><path d="M8 7V5h8v2"/><path d="M8 12h8"/>',
    alert:
      '<path d="M12 4 4 18h16L12 4z"/><path d="M12 9v5"/><circle cx="12" cy="16" r="0.8" fill="currentColor"/>',
    flame:
      '<path fill="#e85c2a" stroke="none" d="M12.9 2.7c.4 2.6 2.2 4 2.6 6.3.2 1.2-.2 2.2-1 2.9.9-.4 1.6-1.2 1.9-2.3.9 1.5 1.4 3.1 1.4 4.6 0 4.1-3.1 7.2-7.8 7.2S2.2 18.3 2.2 14.2c0-3.3 1.9-5.5 3.6-7.5C7.2 5.2 8 4.1 8.2 2.6c1.4 1.2 2.8 3.1 4 2.4-.2-1-.5-1.7.7-2.3z"/><path fill="#f4efe8" stroke="none" d="M12 18.4c-1.9 0-3.2-1.3-3.2-3.2 0-1.4.8-2.3 1.8-3.1.1 1.3.8 2.2 1.8 2.6.6-1.1.7-2.2.5-3.4 1.4.8 2.3 2.1 2.3 3.9 0 1.9-1.3 3.2-3.2 3.2z"/>',
    logout: '<path d="M10 6H6v12h4"/><path d="M14 12H8"/><path d="m12 9 3 3-3 3"/>',
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
        ${icon("dashboard")} Estoque
      </a>
      <a class="nav-item ${active === "movimentacoes" ? "is-active" : ""}" href="movimentacoes.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M17 3v18"/><path d="m21 7-4-4-4 4"/><path d="M7 21V3"/><path d="m3 17 4 4 4-4"/></svg> Movimentações
      </a>
      <span class="nav-item is-static">
        ${icon("alert")} Alertas
        <span class="nav-badge">3</span>
      </span>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">Gestor RezFire</div>
      <div class="sidebar-role">GESTOR</div>
      <button class="sidebar-logout" type="button" title="Login ainda não implementado">
        ${icon("logout")} Sair
      </button>
    </div>
  `;

  root.prepend(sidebar);
}

window.RezFireLayout = { renderSidebar };
