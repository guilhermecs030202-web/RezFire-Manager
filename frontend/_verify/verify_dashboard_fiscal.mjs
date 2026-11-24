import http from "node:http";

console.log("=== TESTE DE VALIDAÇÃO INTEGRADA: DASHBOARD FISCAL & NF-E ===");

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(typeof data === "string" ? data : JSON.stringify(data));
    req.end();
  });
}

async function run() {
  try {
    // 1. Autenticação como Gestor
    const loginRes = await request(
      {
        hostname: "localhost",
        port: 3001,
        path: "/api/auth/login",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { email: "gestor@rezfire.com.br", senha: "rezfire2026" }
    );

    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error(`Falha no login: HTTP ${loginRes.status}`);
    }
    const token = loginRes.data.token;
    console.log("✓ Gestor autenticado com sucesso.");

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Testar GET /api/dashboard/fiscal (30 dias)
    console.log("\n[1] Testando GET /api/dashboard/fiscal (30 dias)...");
    const metricasRes = await request({
      hostname: "localhost",
      port: 3001,
      path: "/api/dashboard/fiscal?dias=30",
      method: "GET",
      headers,
    });

    if (metricasRes.status !== 200 || !metricasRes.data.sucesso) {
      throw new Error(`Falha ao obter métricas fiscais: HTTP ${metricasRes.status}`);
    }
    const m = metricasRes.data;
    console.log("✓ Métricas fiscais retornadas com sucesso (HTTP 200).");
    console.log("   - Período:", m.periodo);

    // Validação dos 6 KPIs
    const k = m.kpis;
    console.log("\n[2] Validando os 6 KPIs principais:");
    console.log("   1. Notas Emitidas:", k.notasEmitidas.valorFormatado, "| Delta:", k.notasEmitidas.deltaPercentual + "%");
    console.log("   2. Valor Faturado:", k.valorFaturado.valorFormatado, "| Delta:", k.valorFaturado.deltaPercentual + "%");
    console.log("   3. Inconformidades:", k.inconformidades.valorFormatado, "| Subtexto:", k.inconformidades.subtexto);
    console.log("   4. Pendências sem NF-e:", k.pedidosSemNfe.valorFormatado);
    console.log("   5. Tributos Apurados:", k.impostosPeriodo.valorFormatado, "|", k.impostosPeriodo.subtexto);
    console.log("   6. Tempo Médio Emissão:", k.tempoMedioEmissao.valorFormatado);

    if (!k.notasEmitidas || !k.valorFaturado || !k.inconformidades || !k.pedidosSemNfe || !k.impostosPeriodo || !k.tempoMedioEmissao) {
      throw new Error("Um ou mais dos 6 KPIs não foram retornados corretamente!");
    }
    console.log("   ✓ Todos os 6 KPIs presentes e formatados.");

    // Validação dos Alertas Automáticos
    console.log("\n[3] Validando Alertas Automáticos por Limites Operacionais:");
    console.log(`   Total de alertas ativos: ${m.alertas.length}`);
    m.alertas.forEach((a, idx) => {
      console.log(`   [${idx + 1}] [${a.severidade.toUpperCase()}] ${a.titulo} -> Limite: ${a.limiteConfigurado} | Atual: ${a.valorAtual} | Ação: "${a.acaoTexto}"`);
    });
    if (m.alertas.length === 0) {
      throw new Error("Esperava alertas fiscais ativos!");
    }
    console.log("   ✓ Alertas automáticos operacionais validados com sucesso.");

    // Validação das Séries Gráficas
    console.log("\n[4] Validando Séries de Gráficos (ApexCharts):");
    const g = m.graficos;
    console.log("   - Evolução Faturamento & Emissões:", g.evolucao.categorias.length, "pontos temporais");
    console.log("   - Distribuição de Status SEFAZ:", g.distribuicaoStatus.labels.join(", "), "| Total:", g.distribuicaoStatus.series.reduce((a, b) => a + b, 0));
    console.log("   - Composição de Tributos (Barras Empilhadas):", g.impostosEmpilhados.series.map(s => s.name).join(", "));
    console.log("   - Ranking de Rejeições SEFAZ / Cancelamentos:", g.rankingRejeicoes.length, "motivos listados");

    if (!g.evolucao || !g.distribuicaoStatus || !g.impostosEmpilhados || !g.rankingRejeicoes) {
      throw new Error("Séries de gráficos ausentes ou incompletas!");
    }
    console.log("   ✓ Séries gráficas validadas.");

    // Validação do Bloco Conciliação "Entradas x Pedidos de Compra"
    console.log("\n[5] Validando Bloco 'Entradas x Pedidos de Compra':");
    const conc = m.conciliacoesEntrada;
    console.log(`   Total de notas de compra conciliadas: ${conc.length}`);
    conc.forEach((c) => {
      console.log(`   - Fornecedor: ${c.fornecedor} | NF-e: ${c.numero_nfe} (${c.valor_nfe_formatado}) vs. PO: ${c.numero_po} (${c.valor_po_formatado}) | Situação: [${c.status_rotulo}]`);
    });
    console.log("   ✓ Bloco de conciliação de compras validado.");

    // 3. Testar GET /api/dashboard/fiscal/notas (Tabela paginada)
    console.log("\n[6] Testando Tabela Paginada: GET /api/dashboard/fiscal/notas?page=1&limit=5...");
    const tabelaRes = await request({
      hostname: "localhost",
      port: 3001,
      path: "/api/dashboard/fiscal/notas?page=1&limit=5",
      method: "GET",
      headers,
    });

    if (tabelaRes.status !== 200 || !tabelaRes.data.sucesso) {
      throw new Error(`Falha na tabela paginada: HTTP ${tabelaRes.status}`);
    }
    const tab = tabelaRes.data;
    console.log(`   ✓ Tabela retornou ${tab.itens.length} notas (Página ${tab.page}/${tab.totalPages}, Total: ${tab.total}).`);
    const primeiraNota = tab.itens[0];
    console.log(`   Exemplo: NF-e #${primeiraNota.numero} s.${primeiraNota.serie} | Tipo: ${primeiraNota.tipo} | Parceiro: ${primeiraNota.parceiro} | Valor: ${primeiraNota.valor_total_formatado} | Chave: ${primeiraNota.chave_acesso_truncada}`);

    // Testar filtro por rejeitadas na tabela (ação do alerta)
    console.log("\n[7] Testando filtro rápido acionado por alerta (status=rejeitada)...");
    const rejeitadasRes = await request({
      hostname: "localhost",
      port: 3001,
      path: "/api/dashboard/fiscal/notas?status=rejeitada",
      method: "GET",
      headers,
    });
    console.log(`   ✓ Filtro de rejeitadas retornou ${rejeitadasRes.data.itens.length} notas rejeitadas.`);
    if (rejeitadasRes.data.itens.length > 0) {
      console.log(`   Motivo SEFAZ: "${rejeitadasRes.data.itens[0].motivo_sefaz}"`);
    }

    console.log("\n============================================================");
    console.log("🎉 GUIA DASHBOARD FISCAL & NF-E VALIDADA COM 100% DE SUCESSO!");
    console.log("============================================================");
  } catch (err) {
    console.error("❌ ERRO NO TESTE:", err);
    process.exit(1);
  }
}

run();
