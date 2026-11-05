import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const frontendDir = path.resolve("frontend");
const serverPort = 4192;
const cdpPort = 9229;

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
  let filePath = path.join(frontendDir, urlPath === "/" ? "anuncios.html" : urlPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(frontendDir, "anuncios.html");
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
    "--window-size=1440,1100",
    "--no-first-run",
    "--user-data-dir=" + (process.env.TEMP || "C:\\Temp") + "\\rezfire-chrome-anuncios-test",
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

  await client.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/anuncios.html` });
  await delay(1000);
  // Limpa o localStorage e recarrega para carregar os novos dados com múltiplos itens
  await evalExpr(client, `localStorage.removeItem("rezfire.anuncios"); location.reload();`);
  await delay(2500);

  const verification = await evalExpr(
    client,
    `(() => {
      const kpis = Array.from(document.querySelectorAll("#kpis-anuncios .kpi-card")).map(k => ({
        label: k.querySelector(".kpi-label")?.innerText,
        val: k.querySelector(".kpi-value")?.innerText,
        hint: k.querySelector(".kpi-hint")?.innerText
      }));

      const rowsCount = document.querySelectorAll("#anuncios-body tr").length;
      const firstRowTitle = document.querySelector("#anuncios-body tr td a")?.innerText;
      const sidebarActive = document.querySelector(".sidebar .nav-item.is-active")?.innerText.trim();
      const syncStatus = document.getElementById("sync-status-text")?.innerText;
      const divergenciaBadges = document.querySelectorAll("#anuncios-body .badge-divergencia").length;

      return {
        sidebarActive,
        syncStatus,
        kpis,
        rowsCount,
        firstRowTitle,
        divergenciaBadges
      };
    })()`
  );

  console.log("ANUNCIOS INITIAL VERIFICATION:", JSON.stringify(verification, null, 2));

  // Screenshot da listagem completa
  const screenshotData = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  if (screenshotData?.result?.data) {
    fs.writeFileSync(
      path.join(frontendDir, "_verify", "tela_anuncios.png"),
      Buffer.from(screenshotData.result.data, "base64")
    );
    console.log("Screenshot salvo em frontend/_verify/tela_anuncios.png");
  }

  // Teste 1: Filtrar por divergência
  const filterDivergencia = await evalExpr(
    client,
    `(() => {
      const select = document.getElementById("filtro-divergencia");
      select.value = "com_divergencia";
      select.dispatchEvent(new Event("change"));
      const rows = document.querySelectorAll("#anuncios-body tr").length;
      const label = document.getElementById("label-total-filtrado")?.innerText;
      return { rows, label };
    })()`
  );
  console.log("FILTER TEST (Com Divergência):", filterDivergencia);

  // Teste 2: Abrir Drawer de um anúncio com divergência (ex: MLB-2894012201 - estoque zerado)
  const openDrawerTest = await evalExpr(
    client,
    `(() => {
      const btn = Array.from(document.querySelectorAll(".btn-ver-detalhe")).find(b => b.innerText.includes("Ver Detalhes"));
      if (btn) btn.click();
      const drawer = document.getElementById("anuncio-drawer");
      const isOpen = drawer.classList.contains("is-open");
      const titulo = document.getElementById("drawer-titulo")?.innerText;
      const mlb = document.getElementById("drawer-mlb")?.innerText;
      const divergencias = Array.from(document.querySelectorAll("#drawer-divergencias-lista .divergencia-card")).map(d => ({
        titulo: d.querySelector("strong")?.innerText,
        gravidade: d.querySelector("span")?.innerText
      }));
      return { isOpen, titulo, mlb, divergencias };
    })()`
  );
  console.log("DRAWER OPEN TEST:", JSON.stringify(openDrawerTest, null, 2));

  // Screenshot do Drawer aberto
  const screenshotDrawer = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  if (screenshotDrawer?.result?.data) {
    fs.writeFileSync(
      path.join(frontendDir, "_verify", "tela_anuncios_drawer.png"),
      Buffer.from(screenshotDrawer.result.data, "base64")
    );
    console.log("Screenshot salvo em frontend/_verify/tela_anuncios_drawer.png");
  }

  // Teste 3: Sincronização manual
  const syncTest = await evalExpr(
    client,
    `(() => {
      const btn = document.getElementById("btn-sync-manual");
      btn.click();
      return { syncing: document.getElementById("sync-status-indicator").classList.contains("syncing") };
    })()`
  );
  console.log("MANUAL SYNC TRIGGERED:", syncTest);

  await delay(1200);

  const syncResult = await evalExpr(
    client,
    `(() => {
      const banner = document.getElementById("sync-feedback-banner");
      return {
        bannerVisible: banner && banner.style.display !== "none",
        bannerText: banner?.innerText
      };
    })()`
  );
  console.log("MANUAL SYNC RESULT:", syncResult);

  client.close();
} catch (error) {
  console.error("ANUNCIOS TEST FAILED:", error);
} finally {
  try {
    chrome.kill();
  } catch {}
  server.close();
}

