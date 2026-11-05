import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";

console.log("=== BATERIA DE TESTES DE CERTIFICADOS & SELO INMETRO ===");

// 1. Setup do ambiente simulado de Browser (Vanilla JS)
const storageMap = new Map();
const localStorageMock = {
  getItem: (key) => storageMap.get(key) || null,
  setItem: (key, val) => storageMap.set(key, String(val)),
  removeItem: (key) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

const eventsDispatched = [];

class FakeElement {
  constructor(tag, id = "") {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = "";
    this.classList = {
      classes: new Set(),
      add: (c) => this.classList.classes.add(c),
      remove: (c) => this.classList.classes.delete(c),
      contains: (c) => this.classList.classes.has(c),
    };
    this.style = {};
    this.attributes = new Map();
    this.children = [];
    this.innerHTML = "";
    this.textContent = "";
    this.dataset = {};
    this._listeners = new Map();
  }

  setAttribute(k, v) {
    this.attributes.set(k, String(v));
  }
  getAttribute(k) {
    return this.attributes.get(k) || null;
  }
  addEventListener(evt, fn) {
    if (!this._listeners.has(evt)) this._listeners.set(evt, []);
    this._listeners.get(evt).push(fn);
  }
  querySelector(sel) {
    return new FakeElement("div");
  }
  querySelectorAll(sel) {
    return [];
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  insertAdjacentHTML(pos, html) {
    this.innerHTML += html;
  }
}

const documentMock = {
  body: new FakeElement("body"),
  createElement: (tag) => new FakeElement(tag),
  getElementById: (id) => new FakeElement("div", id),
  querySelector: (sel) => new FakeElement("div"),
  querySelectorAll: (sel) => [],
  addEventListener: () => {},
};

class CustomEventMock {
  constructor(name, options = {}) {
    this.type = name;
    this.detail = options.detail || {};
  }
}

class FileReaderMock {
  readAsDataURL(file) {
    setTimeout(() => {
      this.result = `data:application/pdf;base64,FAKE_BASE64_${file.name}`;
      if (this.onload) this.onload();
    }, 10);
  }
}

globalThis.window = {
  dispatchEvent: (evt) => eventsDispatched.push(evt),
  addEventListener: () => {},
};
globalThis.document = documentMock;
globalThis.localStorage = localStorageMock;
globalThis.CustomEvent = CustomEventMock;
globalThis.FileReader = FileReaderMock;

// 2. Carrega o serviço
const servicePath = path.resolve("frontend/js/certificadosService.js");
const serviceCode = fs.readFileSync(servicePath, "utf-8");
eval(serviceCode);

const Certificados = window.RezFireCertificados;
assert.ok(Certificados, "O serviço RezFireCertificados deve estar disponível em window");

console.log("✓ Serviço RezFireCertificados carregado com sucesso!");

// ========================================================
// TESTE 1: Validações de Formatos e Regras de Negócio
// ========================================================
console.log("\n[TESTE 1] Testando validações de formato e arquivos...");

// Formatos permitidos: PDF, JPG, JPEG, PNG
const pdfValid = Certificados.validarArquivo({ name: "certificado.pdf", size: 1024 * 500, type: "application/pdf" });
assert.strictEqual(pdfValid.valido, true, "PDF deve ser aceito");
assert.strictEqual(pdfValid.formato, "pdf", "Formato detectado deve ser pdf");

const jpgValid = Certificados.validarArquivo({ name: "selo.jpg", size: 1024 * 300, type: "image/jpeg" });
assert.strictEqual(jpgValid.valido, true, "JPG deve ser aceito");

const jpegValid = Certificados.validarArquivo({ name: "foto_conformidade.jpeg", size: 1024 * 200, type: "image/jpeg" });
assert.strictEqual(jpegValid.valido, true, "JPEG deve ser aceito");

const pngValid = Certificados.validarArquivo({ name: "selo_inmetro.png", size: 1024 * 400, type: "image/png" });
assert.strictEqual(pngValid.valido, true, "PNG deve ser aceito");

// Formatos proibidos
const txtInvalid = Certificados.validarArquivo({ name: "notas.txt", size: 500, type: "text/plain" });
assert.strictEqual(txtInvalid.valido, false, "TXT não deve ser aceito");
assert.ok(txtInvalid.erro.includes("não permitido"), "Mensagem de erro clara para TXT");

const zipInvalid = Certificados.validarArquivo({ name: "arquivos.zip", size: 1000, type: "application/zip" });
assert.strictEqual(zipInvalid.valido, false, "ZIP não deve ser aceito");

const exeInvalid = Certificados.validarArquivo({ name: "app.exe", size: 2000, type: "application/x-msdownload" });
assert.strictEqual(exeInvalid.valido, false, "EXE não deve ser aceito");

const docxInvalid = Certificados.validarArquivo({ name: "laudo.docx", size: 2000, type: "application/msword" });
assert.strictEqual(docxInvalid.valido, false, "DOCX não deve ser aceito");

// Validação de limite de tamanho (> 5MB)
const bigFile = Certificados.validarArquivo({ name: "pesado.pdf", size: 6 * 1024 * 1024, type: "application/pdf" });
assert.strictEqual(bigFile.valido, false, "Arquivo maior que 5MB deve ser rejeitado");
assert.ok(bigFile.erro.includes("excede o limite"), "Mensagem de erro de tamanho estourado");

console.log("✓ Todas as validações de extensão, MIME type e tamanho passaram com sucesso!");

// ========================================================
// TESTE 2: Operações com Produtos e Anúncios (Mock Data e Isolamento)
// ========================================================
console.log("\n[TESTE 2] Testando listagem e dados mockados padrão...");

const docsProd2 = Certificados.listarDocumentos("produto", 2);
console.log(`Documentos cadastrados para Produto ID 2: ${docsProd2.length}`);
assert.ok(docsProd2.length >= 2, "Produto ID 2 deve ter documentos de exemplo mockados");
assert.strictEqual(Certificados.temCertificado("produto", 2), true, "temCertificado('produto', 2) deve ser true");

const docsProd4 = Certificados.listarDocumentos("produto", 4);
console.log(`Documentos cadastrados para Produto ID 4: ${docsProd4.length}`);
assert.strictEqual(docsProd4.length, 0, "Produto ID 4 inicialmente sem certificados");
assert.strictEqual(Certificados.temCertificado("produto", 4), false, "temCertificado('produto', 4) deve ser false");

const docsAnuncio1 = Certificados.listarDocumentos("anuncio", 1);
console.log(`Documentos cadastrados para Anúncio ID 1: ${docsAnuncio1.length}`);
assert.ok(docsAnuncio1.length >= 1, "Anúncio ID 1 deve ter documentos de exemplo");
assert.strictEqual(Certificados.temCertificado("anuncio", 1), true, "temCertificado('anuncio', 1) deve ser true");

const docsAnuncio2 = Certificados.listarDocumentos("anuncio", 2);
console.log(`Documentos cadastrados para Anúncio ID 2: ${docsAnuncio2.length}`);
assert.strictEqual(docsAnuncio2.length, 0, "Anúncio ID 2 inicialmente sem documentos");
assert.strictEqual(Certificados.temCertificado("anuncio", 2), false, "temCertificado('anuncio', 2) deve ser false");

console.log("✓ Listagem e identificação de entidades com/sem certificados validada!");

// ========================================================
// TESTE 3: Anexar Documentos a Produtos e Anúncios
// ========================================================
console.log("\n[TESTE 3] Testando anexação de novos certificados...");

async function testAnexar() {
  // Anexa ao Produto 4
  const novoDocProd = await Certificados.anexarDocumento({
    tipoEntidade: "produto",
    entidadeId: 4,
    file: { name: "Certificado_Inmetro_EXT-CO2-4KG.pdf", size: 340000, type: "application/pdf" },
    tipoDocumento: "Certificado Inmetro",
    numeroRegistro: "001890/2020",
    observacoes: "Homologação de cilindro CO2",
  });

  assert.ok(novoDocProd.id_documento, "Deve gerar ID para o documento");
  assert.strictEqual(Certificados.temCertificado("produto", 4), true, "Produto 4 agora deve possuir certificado");
  assert.strictEqual(Certificados.listarDocumentos("produto", 4).length, 1, "Produto 4 deve ter 1 documento");

  // Anexa ao Anúncio 2
  const novoDocAnunc = await Certificados.anexarDocumento({
    tipoEntidade: "anuncio",
    entidadeId: 2,
    file: { name: "Foto_Selo_Inmetro_MLB1002.png", size: 210000, type: "image/png" },
    tipoDocumento: "Selo de Conformidade",
    numeroRegistro: "003180/2022",
  });

  assert.ok(novoDocAnunc.id_documento, "Deve gerar ID para documento do anúncio");
  assert.strictEqual(Certificados.temCertificado("anuncio", 2), true, "Anúncio 2 agora deve possuir certificado");
  assert.strictEqual(Certificados.listarDocumentos("anuncio", 2).length, 1, "Anúncio 2 deve ter 1 documento");

  console.log("✓ Anexação de documentos para produtos e anúncios validada com sucesso!");

  // ========================================================
  // TESTE 4: Teste Estrito de Independência Operacional
  // Regra: Remover certificado de produto NUNCA remove de anúncios e vice-versa
  // ========================================================
  console.log("\n[TESTE 4] Testando isolamento e regra de independência...");

  const totalAnuncio2Antes = Certificados.listarDocumentos("anuncio", 2).length;
  assert.strictEqual(totalAnuncio2Antes, 1);

  // Remove o documento do Produto 4
  const removido = Certificados.removerDocumento(novoDocProd.id_documento);
  assert.strictEqual(removido, true, "Remoção do produto 4 deve retornar true");
  assert.strictEqual(Certificados.listarDocumentos("produto", 4).length, 0, "Produto 4 voltou a ter 0 documentos");

  // O documento do Anúncio 2 continua intacto
  const totalAnuncio2Depois = Certificados.listarDocumentos("anuncio", 2).length;
  assert.strictEqual(totalAnuncio2Depois, 1, "Anúncio 2 deve continuar com seu documento intacto após remoção no produto");

  // Agora remove do Anúncio 2
  const removidoAnunc = Certificados.removerDocumento(novoDocAnunc.id_documento);
  assert.strictEqual(removidoAnunc, true);
  assert.strictEqual(Certificados.listarDocumentos("anuncio", 2).length, 0);

  // Produto 2 continua intacto
  assert.ok(Certificados.listarDocumentos("produto", 2).length >= 2, "Produto 2 permaneceu com seus certificados intactos");

  console.log("✓ Regra de ouro da independência operacional 100% validada!");

  // ========================================================
  // TESTE 5: Eventos de Notificação para Reatividade da UI
  // ========================================================
  console.log("\n[TESTE 5] Testando eventos customizados de atualização...");
  assert.ok(eventsDispatched.length >= 4, "Eventos rezfire:certificados-mudaram devem ter sido emitidos");
  const ultimoEvento = eventsDispatched[eventsDispatched.length - 1];
  assert.strictEqual(ultimoEvento.type, "rezfire:certificados-mudaram");

  console.log("✓ Eventos reativos disparados com sucesso!");

  console.log("\n=======================================================");
  console.log("🎉 TODOS OS TESTES UNITÁRIOS E DE NEGÓCIO PASSARAM (100%)");
  console.log("=======================================================");
}

testAnexar().catch((err) => {
  console.error("FALHA NO TESTE:", err);
  process.exit(1);
});

