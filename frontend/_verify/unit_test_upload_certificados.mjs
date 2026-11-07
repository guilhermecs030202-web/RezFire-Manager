// unit_test_upload_certificados.mjs
// Teste Automatizado para a User Story SCRUM-21 (#16) - Upload definitivo de Certificados Inmetro
import fs from "node:fs";
import path from "node:path";

console.log("=== TESTE DA USER STORY SCRUM-21 (#16) - UPLOAD DEFINITIVO DE CERTIFICADOS INMETRO ===");

const storageStore = {};
globalThis.localStorage = {
  getItem: (k) => (storageStore[k] !== undefined ? storageStore[k] : null),
  setItem: (k, v) => { storageStore[k] = String(v); },
  removeItem: (k) => { delete storageStore[k]; },
  clear: () => { for (const k in storageStore) delete storageStore[k]; },
};
globalThis.window = globalThis;
globalThis.window.dispatchEvent = () => true;
globalThis.CustomEvent = class {
  constructor(type, eventInitDict) {
    this.type = type;
    this.detail = eventInitDict?.detail;
  }
};

// Carrega os módulos mock-data, api e certificadosService
const codeMockData = fs.readFileSync("frontend/js/mock-data.js", "utf8");
new Function(codeMockData)();

const codeApi = fs.readFileSync("frontend/js/api.js", "utf8");
new Function(codeApi)();

const codeCert = fs.readFileSync("frontend/js/certificadosService.js", "utf8");
new Function(codeCert)();

// ─── TESTE 1: Verificação da API de Certificados no Client-Side (api.js) ───────
console.log("\n[TESTE 1] Verificação dos métodos de Certificados no Client-Side (api.js):");
if (typeof window.RezFireAPI.certificados.listar !== "function") {
  throw new Error("window.RezFireAPI.certificados.listar deve ser uma função definida!");
}
if (typeof window.RezFireAPI.certificados.upload !== "function") {
  throw new Error("window.RezFireAPI.certificados.upload deve ser uma função definida!");
}
if (typeof window.RezFireAPI.certificados.remover !== "function") {
  throw new Error("window.RezFireAPI.certificados.remover deve ser uma função definida!");
}
if (typeof window.RezFireAPI.certificados.urlDownload !== "function") {
  throw new Error("window.RezFireAPI.certificados.urlDownload deve ser uma função definida!");
}
console.log("   ✓ Todos os métodos da API de Certificados estão mapeados no cliente.");

// ─── TESTE 2: Validação de Formatos Homologados e Limite de Tamanho ───────────
console.log("\n[TESTE 2] Validação de Tipos de Arquivo e Limite de Tamanho:");
const certSvc = window.RezFireCertificados;

// Arquivo válido (PDF)
const fakePdf = { name: "laudo_inmetro_pqs.pdf", size: 1024 * 500, type: "application/pdf" };
const v1 = certSvc.validarArquivo(fakePdf);
console.log(` - Validação PDF (500 KB): Válido = ${v1.valido} (Formato: ${v1.formato})`);
if (!v1.valido || v1.formato !== "pdf") throw new Error("PDF deveria ser aceito!");

// Arquivo válido (JPG)
const fakeJpg = { name: "foto_selo_inmetro.jpg", size: 1024 * 300, type: "image/jpeg" };
const v2 = certSvc.validarArquivo(fakeJpg);
console.log(` - Validação JPG (300 KB): Válido = ${v2.valido} (Formato: ${v2.formato})`);
if (!v2.valido || v2.formato !== "jpg") throw new Error("JPG deveria ser aceito!");

// Arquivo inválido (.exe)
const fakeExe = { name: "script.exe", size: 1024 * 10, type: "application/x-msdownload" };
const v3 = certSvc.validarArquivo(fakeExe);
console.log(` - Validação .exe (Bloqueio): Válido = ${v3.valido} (Erro: ${v3.erro})`);
if (v3.valido) throw new Error("Arquivo .exe deveria ter sido recusado!");

// Arquivo que excede o tamanho máximo (> 5 MB)
const fakeGrande = { name: "laudo_pesado.pdf", size: 6 * 1024 * 1024, type: "application/pdf" };
const v4 = certSvc.validarArquivo(fakeGrande);
console.log(` - Validação Tamanho Excessivo (6 MB): Válido = ${v4.valido} (Erro: ${v4.erro})`);
if (v4.valido) throw new Error("Arquivo acima de 5 MB deveria ter sido recusado!");

console.log("   ✓ Critério de conformidade técnica: Apenas PDFs e imagens até 5 MB são aceitos.");

// ─── TESTE 3: Armazenamento Físico em Disco Local no Backend ─────────────────
console.log("\n[TESTE 3] Verificação da Estrutura de Armazenamento em Disco Local:");
const uploadMiddlewareCode = fs.readFileSync("backend/src/middlewares/upload.middleware.ts", "utf8");

if (!uploadMiddlewareCode.includes("env.UPLOAD_DIR")) {
  throw new Error("Middleware de upload deve salvar arquivos em env.UPLOAD_DIR no disco local do servidor!");
}
if (!uploadMiddlewareCode.includes("inmetro-")) {
  throw new Error("Middleware de upload deve prefixar arquivos salvos com 'inmetro-'!");
}

const entityCode = fs.readFileSync("backend/src/entities/DocumentoCertificacao.ts", "utf8");
if (!entityCode.includes("caminho_disco")) {
  throw new Error("Entidade DocumentoCertificacao deve persistir o campo 'caminho_disco'!");
}
console.log("   ✓ Backend configurado para gravar arquivos físicos em pasta local e registrar 'caminho_disco'.");

// ─── TESTE 4: Isolamento Estrito entre Certificados de Produtos e Anúncios ────
console.log("\n[TESTE 4] Regra de Ouro: Independência entre Produtos e Anúncios:");
const prodId = 1;
const anuncioId = 1;

const docsProd1 = certSvc.listarDocumentos("PRODUTO", prodId);
const docsAnuncio1 = certSvc.listarDocumentos("ANUNCIO", anuncioId);

console.log(` - Documentos vinculados ao Produto #${prodId}: ${docsProd1.length}`);
console.log(` - Documentos vinculados ao Anúncio #${anuncioId}: ${docsAnuncio1.length}`);

// Remoção de documento de anúncio
const docAnuncioParaRemover = docsAnuncio1[0];
if (docAnuncioParaRemover) {
  certSvc.removerDocumento(docAnuncioParaRemover.id_documento);
  const docsProdApos = certSvc.listarDocumentos("PRODUTO", prodId);
  if (docsProdApos.length !== docsProd1.length) {
    throw new Error("Remover documento de anúncio NUNCA deve alterar os documentos do produto!");
  }
}
console.log("   ✓ Isolamento 100% verificado: Documentos de produto e anúncio são estritamente independentes.");

// ─── TESTE 5: Visualizador e Rota Autenticada de Download ─────────────────────
console.log("\n[TESTE 5] Verificação de Rotas Autenticadas de Download:");
const routesCode = fs.readFileSync("backend/src/routes/certificado.routes.ts", "utf8");

if (!routesCode.includes("/:id/download")) {
  throw new Error("Rota de download autenticado '/:id/download' não encontrada em certificado.routes.ts!");
}
if (!routesCode.includes("authMiddleware")) {
  throw new Error("Rotas de certificados devem ser protegidas por authMiddleware!");
}
console.log("   ✓ Rota autenticada de download e proteção de acesso ao disco local validadas.");

console.log("\n=========================================================================");
console.log("TODOS OS 5 TESTES DA USER STORY SCRUM-21 (#16) FORAM EXECUTADOS COM SUCESSO!");
console.log("=========================================================================\n");
