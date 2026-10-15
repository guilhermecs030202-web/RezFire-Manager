import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9224;
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    "--disable-gpu",
    "--window-size=1440,900",
    "--no-first-run",
    "--user-data-dir=" + process.env.TEMP + "\\rezfire-chrome",
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
  await waitJson(`http://127.0.0.1:${port}/json/version`);
  const targets = await waitJson(`http://127.0.0.1:${port}/json/list`);
  const pageTarget =
    targets.find((t) => t.type === "page") ||
    targets.find((t) => t.webSocketDebuggerUrl);
  console.error("target", pageTarget?.type, pageTarget?.webSocketDebuggerUrl);
  const client = connect(pageTarget.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Page.navigate", { url: "http://127.0.0.1:4173/produtos.html" });
  await delay(2000);

  const searchEmpty = await evalExpr(
    client,
    `(() => {
      document.getElementById('busca').value = 'xyz-inexistente';
      document.getElementById('busca').dispatchEvent(new Event('input', { bubbles: true }));
      return document.querySelector('#produtos-body').innerText;
    })()`
  );

  const searchReset = await evalExpr(
    client,
    `(() => {
      document.getElementById('busca').value = 'CO2';
      document.getElementById('busca').dispatchEvent(new Event('input', { bubbles: true }));
      return document.querySelectorAll('#produtos-body tr').length;
    })()`
  );

  const modal = await evalExpr(
    client,
    `(() => {
      document.getElementById('busca').value = '';
      document.getElementById('busca').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('btn-novo').click();
      const open = document.getElementById('modal').classList.contains('is-open');
      document.getElementById('sku').value = 'TST-001';
      document.getElementById('nome').value = 'Produto de teste';
      document.getElementById('preco').value = '10';
      document.getElementById('quantidade_atual').value = '5';
      document.getElementById('estoque_minimo').value = '1';
      document.getElementById('form-produto').requestSubmit();
      const count = document.getElementById('produtos-count').textContent;
      const stillOpen = document.getElementById('modal').classList.contains('is-open');
      return { open, stillOpen, count };
    })()`
  );

  const dash = await evalExpr(
    client,
    `fetch('http://127.0.0.1:4173/dashboard.html').then(r => r.text()).then(t => t.includes('PAINEL EXECUTIVO'))`
  );

  const nav = await evalExpr(
    client,
    `document.querySelector('a[href="dashboard.html"]').href`
  );

  console.log(JSON.stringify({ searchEmpty, searchReset, modal, dash, nav }, null, 2));
  client.close();
} catch (error) {
  console.error("FAIL", error);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
