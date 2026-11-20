/**
 * fiscal.js
 * Controlador da página de Configuração Fiscal, Certificado Digital A1 e Ambiente SEFAZ (Story 33a)
 * com diagnóstico rápido das pendências fiscais do catálogo (Story 33b).
 */

(function () {
  const UFS_BR = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  ];

  let currentEmitente = null;

  function escapeHtml(val) {
    return String(val ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function limparDigitos(val) {
    return String(val || '').replace(/\D/g, '');
  }

  function formatarCnpj(val) {
    const d = limparDigitos(val).slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
    if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }

  function formatarCep(val) {
    const d = limparDigitos(val).slice(0, 8);
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)}-${d.slice(5)}`;
  }

  function formatarData(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch {
      return String(iso);
    }
  }

  function showBanner(tipo, texto) {
    const el = document.getElementById('fiscal-banner');
    if (!el) return;
    el.style.display = 'block';
    if (tipo === 'erro') {
      el.className = 'mt-4 p-3 rounded-xl text-sm font-medium bg-red-50 text-red-800 border border-red-200';
    } else {
      el.className = 'mt-4 p-3 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-200';
    }
    el.textContent = texto;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function popularUfs() {
    const sel = document.getElementById('emitente_uf');
    if (!sel) return;
    sel.innerHTML = UFS_BR.map((uf) => `<option value="${uf}" ${uf === 'SP' ? 'selected' : ''}>${uf}</option>`).join('');
  }

  function verificarPerfilGestor() {
    try {
      const rawUser = localStorage.getItem('rezfire_user');
      if (rawUser) {
        const user = JSON.parse(rawUser);
        if (user.perfil && user.perfil.toUpperCase() !== 'GESTOR') {
          document.getElementById('fiscal-conteudo').style.display = 'none';
          document.getElementById('fiscal-acesso-negado').style.display = 'block';
          return false;
        }
      }
    } catch {
      // Fallback: backend ainda valida via JWT + RBAC
    }
    return true;
  }

  function renderEmitente(emitente) {
    currentEmitente = emitente;

    // Preenche formulário se já houver emitente salvo
    if (emitente) {
      document.getElementById('emitente_razao_social').value = emitente.razao_social || '';
      document.getElementById('emitente_nome_fantasia').value = emitente.nome_fantasia || '';
      document.getElementById('emitente_cnpj').value = formatarCnpj(emitente.cnpj || '');
      document.getElementById('emitente_ie').value = emitente.inscricao_estadual || '';
      document.getElementById('emitente_regime').value = emitente.regime_tributario || '1';
      document.getElementById('emitente_serie').value = emitente.serie_nfe || 1;
      document.getElementById('emitente_proximo_numero').value = emitente.proximo_numero_nfe || 1;
      document.getElementById('emitente_modo_integracao').value = emitente.modo_integracao || 'sefaz_direto';
      document.getElementById('emitente_cep').value = formatarCep(emitente.cep || '');
      document.getElementById('emitente_uf').value = emitente.uf || 'SP';
      document.getElementById('emitente_logradouro').value = emitente.logradouro || '';
      document.getElementById('emitente_numero').value = emitente.numero || '';
      document.getElementById('emitente_complemento').value = emitente.complemento || '';
      document.getElementById('emitente_bairro').value = emitente.bairro || '';
      document.getElementById('emitente_municipio').value = emitente.municipio || '';
      document.getElementById('emitente_ibge').value = emitente.codigo_municipio_ibge || '';
    }

    // Badge de prontidão do emitente
    const badgePronto = document.getElementById('badge-emitente-pronto');
    if (badgePronto) {
      if (emitente && emitente.pronto_para_emissao) {
        badgePronto.textContent = 'Pronto para Emissão';
        badgePronto.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200';
      } else {
        badgePronto.textContent = emitente ? 'Certificado Pendente' : 'Não Cadastrado';
        badgePronto.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200';
      }
    }

    // KPI Ambiente
    const kpiAmb = document.getElementById('kpi-ambiente-valor');
    const kpiAmbHint = document.getElementById('kpi-ambiente-hint');
    const badgeAmb = document.getElementById('badge-ambiente');
    const btnHomolog = document.getElementById('btn-usar-homologacao');
    const btnProd = document.getElementById('btn-abrir-modal-producao');

    if (emitente && emitente.ambiente === 'producao') {
      kpiAmb.textContent = 'PRODUÇÃO';
      kpiAmb.style.color = '#991b1b';
      kpiAmbHint.textContent = `Ativo desde ${formatarData(emitente.ambiente_producao_confirmado_em)}`;
      badgeAmb.textContent = 'PRODUÇÃO (REAL)';
      badgeAmb.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300';
      btnHomolog.style.display = 'block';
      btnProd.style.display = 'none';
    } else {
      kpiAmb.textContent = 'HOMOLOGAÇÃO';
      kpiAmb.style.color = '#b45309';
      kpiAmbHint.textContent = emitente ? 'Ambiente padrão seguro para testes SEFAZ' : 'Salve o emitente para iniciar em homologação';
      badgeAmb.textContent = 'HOMOLOGAÇÃO';
      badgeAmb.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200';
      btnHomolog.style.display = 'none';
      btnProd.style.display = 'block';
      btnProd.disabled = !emitente;
    }

    // KPI Numeração
    const kpiNum = document.getElementById('kpi-num-valor');
    if (emitente) {
      kpiNum.textContent = `Série ${emitente.serie_nfe} · Nº ${emitente.proximo_numero_nfe}`;
    }

    // Card e KPI do Certificado A1
    const kpiCert = document.getElementById('kpi-cert-valor');
    const kpiCertHint = document.getElementById('kpi-cert-hint');
    const badgeCert = document.getElementById('badge-certificado');
    const boxMeta = document.getElementById('certificado-metadados');

    if (emitente && emitente.certificado_configurado) {
      const dias = emitente.certificado_dias_restantes;
      const vencido = emitente.certificado_status === 'vencido';
      const vencendo = emitente.certificado_status === 'vencendo';

      kpiCert.textContent = vencido ? 'VENCIDO' : vencendo ? `Vence em ${dias}d` : 'Válido (A1)';
      kpiCert.style.color = vencido ? '#dc2626' : vencendo ? '#d97706' : '#15803d';
      kpiCertHint.textContent = `Válido até ${formatarData(emitente.certificado_valido_ate)}`;

      badgeCert.textContent = vencido ? 'Vencido' : vencendo ? 'Vencendo' : 'Instalado';
      badgeCert.className = vencido
        ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800'
        : vencendo
        ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800'
        : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800';

      boxMeta.style.display = 'block';
      document.getElementById('cert-meta-titular').textContent = emitente.certificado_titular || '—';
      document.getElementById('cert-meta-emissor').textContent = emitente.certificado_emissor || '—';
      document.getElementById('cert-meta-cnpj').textContent = formatarCnpj(emitente.certificado_cnpj || '');
      document.getElementById('cert-meta-validade').textContent = `${formatarData(emitente.certificado_valido_de)} até ${formatarData(emitente.certificado_valido_ate)}`;
      document.getElementById('cert-meta-dias').textContent = vencido ? 'EXPIRADO' : `${dias} dias restantes`;
    } else {
      kpiCert.textContent = 'Não instalado';
      kpiCert.style.color = '#78716c';
      kpiCertHint.textContent = 'Envie o arquivo .pfx ou .p12 da RezFire';
      badgeCert.textContent = 'Não instalado';
      badgeCert.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-700';
      boxMeta.style.display = 'none';
    }
  }

  function renderPendenciasProdutos(relatorio) {
    const kpiCob = document.getElementById('kpi-cobertura-valor');
    const kpiCobHint = document.getElementById('kpi-cobertura-hint');
    const resumoBadge = document.getElementById('pendencias-resumo-badge');
    const tbody = document.getElementById('fiscal-pendencias-body');

    if (!relatorio || !Array.isArray(relatorio.produtos)) return;

    kpiCob.textContent = `${relatorio.total_aptos}/${relatorio.total_produtos} (${relatorio.percentual_cobertura}%)`;
    kpiCob.style.color = relatorio.total_pendentes === 0 ? '#15803d' : '#b45309';
    kpiCobHint.textContent =
      relatorio.total_pendentes === 0
        ? '100% dos produtos ativos aptos para NF-e'
        : `${relatorio.total_pendentes} produto(s) com dados fiscais faltantes`;

    if (resumoBadge) {
      resumoBadge.textContent = `${relatorio.total_pendentes} pendente(s) · ${relatorio.total_aptos} apto(s)`;
    }

    const linhas = relatorio.produtos.filter((p) => !p.fiscal_status?.apto_nfe);
    if (linhas.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Todos os produtos ativos possuem NCM, CFOP, Origem, CST/CSOSN e Unidade cadastrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = linhas
      .map((p) => {
        const faltantes = p.fiscal_status?.campos_faltantes || [];
        return `
          <tr>
            <td><span class="sku-main">${escapeHtml(p.sku)}</span></td>
            <td><strong>${escapeHtml(p.nome)}</strong></td>
            <td class="font-mono text-xs">${escapeHtml(p.ncm || '—')} / ${escapeHtml(p.cfop || '—')}</td>
            <td class="font-mono text-xs">${escapeHtml(p.cst_csosn || '—')}</td>
            <td>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                Falta: ${escapeHtml(faltantes.join(', '))}
              </span>
            </td>
            <td style="text-align:right;">
              <a href="produtos.html?edit=${p.id_produto}&tab=fiscal" class="btn-ghost" style="padding: 4px 10px; font-size: 0.78rem; text-decoration: none;">
                Completar Fiscal
              </a>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  async function carregarTudo() {
    try {
      const [resEmitente, resPendencias] = await Promise.all([
        window.RezFireAPI.fiscal.obterEmitente(),
        window.RezFireAPI.fiscal.obterPendenciasProdutos(),
      ]);
      renderEmitente(resEmitente.emitente || null);
      renderPendenciasProdutos(resPendencias);
    } catch (err) {
      if (String(err.message || '').includes('Acesso negado')) {
        document.getElementById('fiscal-conteudo').style.display = 'none';
        document.getElementById('fiscal-acesso-negado').style.display = 'block';
        return;
      }
      showBanner('erro', err.message || 'Não foi possível carregar as configurações fiscais.');
    }
  }

  function bindEvents() {
    const cnpjInput = document.getElementById('emitente_cnpj');
    cnpjInput?.addEventListener('input', (e) => {
      e.target.value = formatarCnpj(e.target.value);
    });

    const cepInput = document.getElementById('emitente_cep');
    cepInput?.addEventListener('input', (e) => {
      e.target.value = formatarCep(e.target.value);
    });

    // Salvar dados do emitente
    document.getElementById('form-emitente')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('emitente-form-error');
      errEl.textContent = '';

      const payload = {
        razao_social: document.getElementById('emitente_razao_social').value.trim(),
        nome_fantasia: document.getElementById('emitente_nome_fantasia').value.trim(),
        cnpj: document.getElementById('emitente_cnpj').value,
        inscricao_estadual: document.getElementById('emitente_ie').value.trim(),
        regime_tributario: document.getElementById('emitente_regime').value,
        serie_nfe: Number(document.getElementById('emitente_serie').value),
        proximo_numero_nfe: Number(document.getElementById('emitente_proximo_numero').value),
        modo_integracao: document.getElementById('emitente_modo_integracao').value,
        cep: document.getElementById('emitente_cep').value,
        uf: document.getElementById('emitente_uf').value,
        logradouro: document.getElementById('emitente_logradouro').value.trim(),
        numero: document.getElementById('emitente_numero').value.trim(),
        complemento: document.getElementById('emitente_complemento').value.trim(),
        bairro: document.getElementById('emitente_bairro').value.trim(),
        municipio: document.getElementById('emitente_municipio').value.trim(),
        codigo_municipio_ibge: document.getElementById('emitente_ibge').value.trim(),
      };

      try {
        const res = await window.RezFireAPI.fiscal.salvarEmitente(payload);
        renderEmitente(res.emitente);
        showBanner('sucesso', res.mensagem || 'Emitente fiscal salvo com sucesso.');
      } catch (err) {
        errEl.textContent = err.message || 'Erro ao salvar emitente fiscal.';
      }
    });

    // Upload do certificado A1 (.pfx / .p12)
    document.getElementById('form-certificado')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('certificado-form-error');
      errEl.textContent = '';

      const fileInput = document.getElementById('certificado_arquivo');
      const senhaInput = document.getElementById('certificado_senha');
      const arquivo = fileInput?.files?.[0];
      const senha = senhaInput?.value || '';

      if (!arquivo) {
        errEl.textContent = 'Selecione o arquivo .pfx ou .p12 do certificado digital A1.';
        return;
      }
      if (!senha) {
        errEl.textContent = 'Informe a senha do certificado digital.';
        return;
      }

      try {
        const res = await window.RezFireAPI.fiscal.enviarCertificado(arquivo, senha);
        renderEmitente(res.emitente);
        showBanner('sucesso', res.mensagem || 'Certificado A1 instalado com sucesso.');
        fileInput.value = '';
      } catch (err) {
        errEl.textContent = err.message || 'Falha ao validar o certificado digital A1.';
      } finally {
        // Nunca manter a senha em campo de formulário após envio
        if (senhaInput) senhaInput.value = '';
      }
    });

    // Remover certificado A1
    document.getElementById('btn-remover-certificado')?.addEventListener('click', async () => {
      if (!confirm('Remover o certificado digital A1 instalado? Se estiver em produção, o sistema voltará para homologação.')) {
        return;
      }
      try {
        const res = await window.RezFireAPI.fiscal.removerCertificado();
        renderEmitente(res.emitente);
        showBanner('sucesso', res.mensagem || 'Certificado removido com segurança.');
      } catch (err) {
        showBanner('erro', err.message || 'Erro ao remover certificado.');
      }
    });

    // Voltar para Homologação
    document.getElementById('btn-usar-homologacao')?.addEventListener('click', async () => {
      const errEl = document.getElementById('ambiente-form-error');
      errEl.textContent = '';
      try {
        const res = await window.RezFireAPI.fiscal.alterarAmbiente({ ambiente: 'homologacao' });
        renderEmitente(res.emitente);
        showBanner('sucesso', res.mensagem);
      } catch (err) {
        errEl.textContent = err.message || 'Erro ao alterar ambiente.';
      }
    });

    // Modal de confirmação explícita para Produção
    const modalProd = document.getElementById('modal-confirmar-producao');
    const fecharModalProd = () => {
      modalProd?.classList.remove('is-open');
      document.getElementById('modal-prod-error').textContent = '';
      document.getElementById('form-confirmar-producao')?.reset();
    };

    document.getElementById('btn-abrir-modal-producao')?.addEventListener('click', () => {
      document.getElementById('modal-prod-error').textContent = '';
      modalProd?.classList.add('is-open');
    });

    document.getElementById('btn-cancelar-modal-producao')?.addEventListener('click', fecharModalProd);
    modalProd?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-confirmar-producao') fecharModalProd();
    });

    document.getElementById('form-confirmar-producao')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('modal-prod-error');
      errEl.textContent = '';

      const checked = document.getElementById('prod_check_ciencia').checked;
      const texto = document.getElementById('prod_texto_confirmacao').value.trim();

      try {
        const res = await window.RezFireAPI.fiscal.alterarAmbiente({
          ambiente: 'producao',
          confirmacao_producao: checked,
          texto_confirmacao: texto,
        });
        fecharModalProd();
        renderEmitente(res.emitente);
        showBanner('sucesso', res.mensagem);
      } catch (err) {
        errEl.textContent = err.message || 'Não foi possível ativar o ambiente de produção.';
      }
    });
  }

  async function init() {
    window.RezFireLayout.renderSidebar('fiscal');
    popularUfs();
    bindEvents();
    if (verificarPerfilGestor()) {
      await carregarTudo();
    }
  }

  init();
})();

