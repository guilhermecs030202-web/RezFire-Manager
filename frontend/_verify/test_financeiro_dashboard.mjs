import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const frontendDir = path.resolve("frontend");
const serverPort = 4189;
const cdpPort = 9226;

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];
  let filePath = path.join(frontendDir, urlPath === "/" ? "index.html" : urlPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(frontendDir, "dashboard.html");
  }
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(serverPort, "127.0.0.1");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${cdpPort}`,
    "--disable-gpu",
    "--window-size=1440,1050",
    "--no-first-run",
    "--user-data-dir=" + (process.env.TEMP || "C:\\Temp") + "\\rezfire-chrome-fin-test",
    "about:blank",
  ],
  { stdio: "ignore" }
);

async function waitJson(url) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch {}
    await delay(150);
  }
  throw new Error("CDP not ready");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  return {
    ready,
    send(method, params = {}) {
      id += 1;
      const payload = { id, method, params };
      const result = new Promise((resolve) => pending.set(id, resolve));
      ws.send(JSON.stringify(payload));
      return result;
    },
    close() {
      ws.close();
    },
  };
}

async function evalExpr(client, expression) {
  const msg = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (msg.result?.exceptionDetails) {
    return { error: msg.result.exceptionDetails.text || msg.result.exceptionDetails };
  }
  return msg.result?.result?.value ?? msg;
}

try {
  await waitJson(`http://127.0.0.1:${cdpPort}/json/version`);
  const targets = await waitJson(`http://127.0.0.1:${cdpPort}/json/list`);
  const pageTarget =
    targets.find((t) => t.type === "page") ||
    targets.find((t) => t.webSocketDebuggerUrl);
  
  const client = connect(pageTarget.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/dashboard.html?tab=financeiro` });
  await delay(2500);

  const verification = await evalExpr(
    client,
    `(() => {
      const tabFin = document.getElementById("tab-financeiro");
      const isTabActive = tabFin && tabFin.classList.contains("is-active");
      const alertBanner = document.getElementById("alerta-financeiro-banner");
      const bannerText = alertBanner ? alertBanner.innerText : "";
      const kpis = document.querySelectorAll("#kpis-tab-financeiro .kpi-card");
      const kpiValues = Array.from(kpis).map(k => ({
        label: k.querySelector(".kpi-label")?.innerText,
        val: k.querySelector(".kpi-value")?.innerText
      }));
      const tableRows = document.querySelectorAll("#lista-financeiro-produtos tr").length;
      const chartTimeline = document.querySelector("#chart-financeiro-timeline svg") !== null;
      const chartDRE = document.querySelector("#chart-financeiro-dre svg") !== null;
      const chartMargens = document.querySelector("#chart-financeiro-margens-produto svg") !== null;
      const chartABC = document.querySelector("#chart-financeiro-curva-abc svg") !== null;
      const chartCanais = document.querySelector("#chart-financeiro-canais svg") !== null;

      return {
        isTabActive,
        bannerTextSummary: bannerText.substring(0, 120),
        kpiCount: kpis.length,
        kpiValues,
        tableRows,
        chartsRendered: { chartTimeline, chartDRE, chartMargens, chartABC, chartCanais }
      };
    })()`
  );

  console.log("FINANCIAL VERIFICATION RESULT:", JSON.stringify(verification, null, 2));

  // Screenshot capture full page
  const screenshotData = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  if (screenshotData && screenshotData.result && screenshotData.result.data) {
    const buffer = Buffer.from(screenshotData.result.data, "base64");
    fs.writeFileSync(path.join(frontendDir, "_verify", "dashboard_financeiro.png"), buffer);
    console.log("Full page screenshot saved to frontend/_verify/dashboard_financeiro.png");
  }

  // Interactive Test: Filter by Low Margin
  const filterTest = await evalExpr(
    client,
    `(() => {
      filtrarMargemFinanceiro('low');
      const rows = document.querySelectorAll("#lista-financeiro-produtos tr").length;
      const firstBadge = document.querySelector("#lista-financeiro-produtos .badge-margin")?.innerText;
      return { rows, firstBadge };
    })()`
  );
  console.log("FILTER TEST (Margem em Risco):", filterTest);

  // Interactive Test: Open and update rates modal
  const ratesModalTest = await evalExpr(
    client,
    `(() => {
      filtrarMargemFinanceiro('todos');
      const btn = document.getElementById("btn-abrir-config-taxas");
      if (btn) btn.click();
      const isOpen = document.getElementById("modal-config-taxas").classList.contains("is-open");
      const mlInput = document.getElementById("config_taxa_ml");
      const diretoInput = document.getElementById("config_taxa_direto");
      const prevMl = mlInput.value;
      const prevDireto = diretoInput.value;
      // Atualiza para ML 18% e Direto 3%
      mlInput.value = "18.5";
      diretoInput.value = "3.0";
      document.getElementById("form-config-taxas").requestSubmit();
      const isClosed = !document.getElementById("modal-config-taxas").classList.contains("is-open");
      const kpiHint = document.querySelector("#kpis-tab-financeiro")?.innerText;
      return { isOpen, isClosed, prevMl, prevDireto, updatedInDashboard: kpiHint.includes("ML: 18.5%") && kpiHint.includes("Direto: 3%") };
    })()`
  );
  console.log("RATES MODAL TEST:", ratesModalTest);

  // Reset back to default
  await evalExpr(
    client,
    `(() => {
      RezFireData.saveFinancialSettings({ taxa_ml_percent: 16.0, taxa_direto_percent: 0.0 });
      const prods = RezFireData.loadProducts();
      renderTabFinanceiro(prods);
    })()`
  );

  client.close();
} catch (error) {
  console.error("FINANCIAL TEST FAILED:", error);
} finally {
  try {
    chrome.kill();
  } catch {}
  server.close();
}
