import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const frontendDir = path.resolve("frontend");
const serverPort = 4188;
const cdpPort = 9225;

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
    "--user-data-dir=" + (process.env.TEMP || "C:\\Temp") + "\\rezfire-chrome-test",
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
  await client.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/dashboard.html?tab=estoque` });
  await delay(2500);

  const verification = await evalExpr(
    client,
    `(() => {
      const tabEstoque = document.getElementById("tab-estoque");
      const isTabActive = tabEstoque && tabEstoque.classList.contains("is-active");
      const alertBanner = document.getElementById("alerta-estoque-banner");
      const bannerText = alertBanner ? alertBanner.innerText : "";
      const kpis = document.querySelectorAll("#kpis-tab-estoque .kpi-card");
      const kpiValues = Array.from(kpis).map(k => ({
        label: k.querySelector(".kpi-label")?.innerText,
        val: k.querySelector(".kpi-value")?.innerText
      }));
      const tableRows = document.querySelectorAll("#lista-estoque-detalhada tr").length;
      const chart1 = document.querySelector("#chart-estoque-saldo-minimo svg") !== null;
      const chart2 = document.querySelector("#chart-estoque-saude svg") !== null;
      const chart3 = document.querySelector("#chart-estoque-cobertura svg") !== null;
      const chart4 = document.querySelector("#chart-estoque-categoria svg") !== null;

      return {
        isTabActive,
        bannerTextSummary: bannerText.substring(0, 100),
        kpiCount: kpis.length,
        kpiValues,
        tableRows,
        chartsRendered: { chart1, chart2, chart3, chart4 }
      };
    })()`
  );

  console.log("VERIFICATION RESULT:", JSON.stringify(verification, null, 2));

  // Test 1: Filter by Ruptura
  const filterTest = await evalExpr(
    client,
    `(() => {
      filtrarRiscoEstoque('ruptura');
      const rows = document.querySelectorAll("#lista-estoque-detalhada tr").length;
      const sku = document.querySelector("#lista-estoque-detalhada .sku-main")?.innerText;
      return { rows, sku };
    })()`
  );
  console.log("FILTER TEST (ruptura):", filterTest);

  // Test 2: Open and Submit Adjustment Modal
  const modalTest = await evalExpr(
    client,
    `(() => {
      filtrarRiscoEstoque('todos');
      const btn = document.querySelector("button[data-ajuste-id='4']");
      if (btn) btn.click();
      const isOpen = document.getElementById("modal-ajuste-estoque").classList.contains("is-open");
      const currentVal = document.getElementById("ajuste_quantidade_atual").value;
      // Simula reabastecer EXT-CO2-4KG com 25 unidades
      document.getElementById("ajuste_quantidade_atual").value = '25';
      document.getElementById("form-ajuste-estoque").requestSubmit();
      const isClosed = !document.getElementById("modal-ajuste-estoque").classList.contains("is-open");
      const newStatus = document.querySelector("#kpis-tab-estoque")?.innerText.includes("0 SKU zerado");
      return { isOpen, isClosed, currentVal, reabastecidoComSucesso: newStatus };
    })()`
  );
  console.log("MODAL & ADJUSTMENT TEST:", modalTest);

  // Reset products back to mock data default for cleanliness
  await evalExpr(
    client,
    `(() => {
      localStorage.removeItem("rezfire.produtos");
      const defaultProds = RezFireData.loadProducts();
      renderTabEstoque(defaultProds);
    })()`
  );

  client.close();
} catch (error) {
  console.error("TEST FAILED:", error);
} finally {
  try {
    chrome.kill();
  } catch {}
  server.close();
}
