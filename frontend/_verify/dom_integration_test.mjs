import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";

console.log("=== TESTE DE INTEGRAÇÃO DO DOM E TELAS EXISTENTES ===");

// 1. Validação de produtos.html
const produtosHtml = fs.readFileSync(path.resolve("frontend/produtos.html"), "utf-8");
assert.ok(produtosHtml.includes('src="js/certificadosService.js"'), "produtos.html deve incluir js/certificadosService.js");
assert.ok(produtosHtml.includes('id="filtro-certificados"'), "produtos.html deve conter o filtro de certificados");
assert.ok(produtosHtml.includes('<th>CERTIFICAÇÃO</th>'), "produtos.html deve conter a coluna CERTIFICAÇÃO");
assert.ok(produtosHtml.includes('id="tab-btn-certificados"'), "produtos.html deve conter a aba Certificados no modal");
assert.ok(produtosHtml.includes('id="tab-pane-certificados"'), "produtos.html deve conter o painel de certificados");
console.log("✓ Estrutura de produtos.html validada com sucesso!");

// 2. Validação de anuncios.html
const anunciosHtml = fs.readFileSync(path.resolve("frontend/anuncios.html"), "utf-8");
assert.ok(anunciosHtml.includes('src="js/certificadosService.js"'), "anuncios.html deve incluir js/certificadosService.js");
assert.ok(anunciosHtml.includes('id="filtro-certificados-anuncio"'), "anuncios.html deve conter o filtro de certificados do anúncio");
assert.ok(anunciosHtml.includes('<th>STATUS & INMETRO</th>'), "anuncios.html deve conter a coluna STATUS & INMETRO no thead");
assert.ok(anunciosHtml.includes('id="drawer-certificados-container"'), "anuncios.html deve conter o container de certificados no drawer");
assert.ok(anunciosHtml.includes('id="drawer-certificados-produtos-componentes"'), "anuncios.html deve conter o container de certificados dos componentes");
console.log("✓ Estrutura de anuncios.html validada com sucesso!");

// 3. Validação de produtos.js
const produtosJs = fs.readFileSync(path.resolve("frontend/js/produtos.js"), "utf-8");
assert.ok(produtosJs.includes("RezFireCertificados"), "produtos.js deve interagir com RezFireCertificados");
assert.ok(produtosJs.includes("filtroCertificado"), "produtos.js deve ter lógica para filtro de certificados");
assert.ok(produtosJs.includes("tab-btn-certificados"), "produtos.js deve ter controle da aba de certificados");
assert.ok(produtosJs.includes("view-certificados-container"), "produtos.js deve renderizar certificados na visualização");
console.log("✓ Integração em produtos.js validada com sucesso!");

// 4. Validação de anuncios.js
const anunciosJs = fs.readFileSync(path.resolve("frontend/js/anuncios.js"), "utf-8");
assert.ok(anunciosJs.includes("RezFireCertificados"), "anuncios.js deve interagir com RezFireCertificados");
assert.ok(anunciosJs.includes("certificados:"), "anuncios.js deve incluir filtro de certificados no estado");
assert.ok(anunciosJs.includes("renderizarCertificadosDrawer"), "anuncios.js deve renderizar a seção de certificados no drawer");
console.log("✓ Integração em anuncios.js validada com sucesso!");

console.log("\n=======================================================");
console.log("🎉 TODAS AS VALIDAÇÕES DE DOM E INTEGRAÇÃO PASSARAM (100%)");
console.log("=======================================================");

