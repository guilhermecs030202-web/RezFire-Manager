import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const frontendDir = path.resolve("frontend");
const serverPort = 4191;
const cdpPort = 9228;

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
    "--user-data-dir=" + (process.env.TEMP || "C:\\Temp") + "\\rezfire-chrome-ent-test",
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
  const pageTarget = targets.find((t) => t.type === "page") || targets.find((t) => t.webSocketDebuggerUrl);
  const client = connect(pageTarget.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  const errors = [];
  client.send("Runtime.setAsyncCallStackDepth", { maxDepth: 4 });
  await client.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/dashboard.html?tab=entregas` });
  await delay(3000);

  const verification = await evalExpr(client, `(() => {
    const kpis = Array.from(document.querySelectorAll("#kpis-tab-entregas .kpi-card")).map(k => k.querySelector(".kpi-label")?.innerText + " = " + k.querySelector(".kpi-value")?.innerText + " | " + (k.querySelector(".kpi-hint")?.innerText || ""));
    const charts = ["pipeline","agenda","prazos","modalidade","uf"].reduce((o, c) => (o[c] = !!document.querySelector("#chart-entregas-" + c + " svg"), o), {});
    const fila = Array.from(document.querySelectorAll("#lista-entregas-fila tr")).map(r => r.innerText.replace(/\\s+/g, " ").slice(0, 170));
    return {
      tabActive: document.getElementById("tab-entregas").classList.contains("is-active"),
      apex: typeof ApexCharts,
      banner: document.getElementById("alerta-entregas-banner").innerText,
      kpis, charts, fila,
      label: document.getElementById("label-total-entregas-fila").innerText,
    };
  })()`);
  console.log(JSON.stringify(verification, null, 2));

  const shot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  if (shot?.result?.data) fs.writeFileSync(path.join(frontendDir, "_verify", "dashboard_entregas.png"), Buffer.from(shot.result.data, "base64"));

  const filterTest = await evalExpr(client, `(() => {
    const out = {};
    document.getElementById("filtro-entregas-fila").value = "todos";
    document.getElementById("filtro-entregas-fila").dispatchEvent(new Event("change"));
    out.todos = document.getElementById("label-total-entregas-fila").innerText;
    document.getElementById("filtro-entregas-canal").value = "Venda Direta";
    document.getElementById("filtro-entregas-canal").dispatchEvent(new Event("change"));
    out.direta = document.getElementById("label-total-entregas-fila").innerText + " | " + document.querySelector("#kpis-tab-entregas .kpi-value").innerText;
    document.getElementById("filtro-entregas-periodo").value = "7";
    document.getElementById("filtro-entregas-canal").value = "todos";
    document.getElementById("filtro-entregas-periodo").dispatchEvent(new Event("change"));
    out.p7 = Array.from(document.querySelectorAll("#kpis-tab-entregas .kpi-value")).map(v => v.innerText).join(" / ");
    return out;
  })()`);
  console.log("FILTERS:", JSON.stringify(filterTest));

  await client.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/entregas.html?id=ENT-007` });
  await delay(2000);
  const deep = await evalExpr(client, `document.getElementById("detalhe-panel")?.classList.contains("is-open")`);
  console.log("DEEP LINK OPEN:", deep);
  client.close();
} catch (error) {
  console.error("TEST FAILED:", error);
} finally {
  try { chrome.kill(); } catch {}
  server.close();
}
