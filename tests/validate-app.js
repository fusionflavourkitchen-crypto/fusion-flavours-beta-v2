'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const {
  migrateLegacyHtml,
  migrationFailures
} = require('../api/lib/legacy-html-migration');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function filesIn(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(relative) : [relative];
  });
}

const javascriptFiles = [
  ...fs.readdirSync(root).filter(name => name.endsWith('.js')),
  ...filesIn('api').filter(name => name.endsWith('.js'))
];

for (const file of javascriptFiles) {
  execFileSync(process.execPath, ['--check', file], { cwd: root, stdio: 'pipe' });
}

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(Boolean);
inlineScripts.forEach((source, index) => {
  new vm.Script(source, { filename: `index-inline-${index + 1}.js` });
});

const migrated = migrateLegacyHtml(html);
assert.deepStrictEqual(migrationFailures(migrated), [], 'Owner-shell migration must be clean');
assert(!/id=["']deliveryChefNote["']/i.test(migrated), 'Legacy Delivery welcome note must not be injected');
assert(!/id=["']deliverySlotWrap["']/i.test(html), 'Main Delivery must not ask customers to choose a delivery slot');
assert(/id="ff_estimate"/.test(fs.readFileSync(path.join(root, 'orders-delivery-integration.js'), 'utf8')), 'Orders must expose the live delivery estimate control');
assert(!/data-area=["']delivery["']/i.test(migrated), 'Standalone Delivery navigation must stay retired');
assert(!/id=["']page-delivery["']/i.test(migrated), 'Standalone Delivery page must stay retired');
assert(!/const\s+showTabV\w*\s*=\s*showTab\s*;/i.test(html), 'Legacy showTab wrapper reads the router before it loads');
assert(/ordersDeliveryIntegrationScript/.test(fs.readFileSync(path.join(root, 'api/app.js'), 'utf8')));

const staticReferences = [...html.matchAll(/(?:src|href)=["']([^"'#?{}$]+)["']/gi)]
  .map(match => match[1])
  .filter(value => !/^(?:https?:|mailto:|tel:|data:|\/)/.test(value));
for (const reference of staticReferences) {
  assert(fs.existsSync(path.join(root, reference)), `Missing local asset: ${reference}`);
}

const temporaryDishImages = {
  'Fusion House Wings': 'public/menu-images/fusion-house-wings-ai.webp',
  Keftedes: 'public/menu-images/keftedes-ai.webp',
  'Mediterranean Veggie Pasta': 'public/menu-images/mediterranean-veggie-pasta-ai.webp',
  'Greek Salad': 'public/menu-images/greek-salad-ai.webp',
  Houmous: 'public/menu-images/houmous-ai.webp'
};
for (const [dish, asset] of Object.entries(temporaryDishImages)) {
  assert(fs.existsSync(path.join(root, asset)), `Missing temporary image for ${dish}: ${asset}`);
  assert(html.includes(`'${dish}':'/${asset.replace(/^public\//, '')}'`), `Temporary image mapping missing for ${dish}`);
}

const temporaryRetailImages = {
  'Signature House Blend Retail Pouch': 'public/menu-images/signature-house-blend-retail-ai.webp',
  'Fiery House Blend': 'public/menu-images/fiery-house-blend-ai.webp',
  'Fusion Fries Blend': 'public/menu-images/fusion-fries-blend-ai.webp'
};
for (const [product, asset] of Object.entries(temporaryRetailImages)) {
  assert(fs.existsSync(path.join(root, asset)), `Missing temporary retail image for ${product}: ${asset}`);
  assert(html.includes(`'${product}':'/${asset.replace(/^public\//, '')}'`), `Temporary retail image mapping missing for ${product}`);
}

async function verifyHealthHandler() {
  const handler = require('../api/app');
  let statusCode = 200;
  let body = '';
  const headers = {};
  const req = { method: 'GET', query: { mode: 'owner', health: '1' } };
  const res = {
    setHeader(name, value) { headers[String(name).toLowerCase()] = String(value); },
    status(code) { statusCode = code; return this; },
    send(value) { body = String(value); return this; },
    end() { return this; }
  };

  await handler(req, res);
  const result = JSON.parse(body);
  assert.strictEqual(statusCode, 200, body);
  assert.strictEqual(result.ok, true, body);
  assert.strictEqual(headers['x-fusion-owner-shell'], 'verified');

  let rendered = '';
  const pageRes = {
    setHeader() {},
    status() { return this; },
    send(value) { rendered = String(value); return this; },
    end(value) { if (value) rendered = String(value); return this; }
  };
  await handler({ method: 'GET', query: { view: 'delivery' } }, pageRes);
  const customer = rendered.match(/<section id="customer"[\s\S]*?<section id="legalCustomer"/)?.[0] || '';
  const retail = rendered.match(/<section id="retailCustomer"[\s\S]*?<section id="cateringCustomer"/)?.[0] || '';
  assert.strictEqual((customer.match(/class="mainDeliveryWelcomeNote"/g) || []).length, 1, 'Delivery must have one Chef Dan note');
  assert.strictEqual((retail.match(/class="mainDeliveryWelcomeNote"/g) || []).length, 0, 'Fusion at Home must not contain the Delivery note');
  assert.ok(rendered.includes('data-fusion-inline="community-meals-labels"'), 'Community Meals slot integration must be embedded in the live page');
  assert.ok(rendered.indexOf('fusion-runtime.js?v=20260902-community-slots-stable-1') < rendered.lastIndexOf('data-fusion-inline="community-meals-labels"'), 'Community Meals slot integration must load after the final runtime');
  assert.ok(rendered.includes('id="communityDeliverySlot"'), 'Community Meals checkout must include the delivery-slot selector');
  assert.ok(!require('fs').readFileSync(require('path').join(process.cwd(), 'community-meals-labels.js'), 'utf8').includes("$('harnellView')"), 'Community Meals integration must target the live customer page');
  const communityIntegration = require('fs').readFileSync(require('path').join(process.cwd(), 'community-meals-labels.js'), 'utf8');
  assert.ok(communityIntegration.includes('customerVisible&&!communityCustomerReady'), 'Community Meals slots must only initialise once while the page is visible');
  assert.ok(rendered.includes('<details class="retailIngredients"><summary>Product details &amp; ingredients</summary>'), 'Fusion at Home product information must be collapsed by default');
  assert.ok(!rendered.includes('<b>Responsible business:</b> Fusion Flavours, 44 Harnall Lane West'), 'Fusion at Home product cards must not show the business address');
}

verifyHealthHandler()
  .then(() => console.log(`Validated ${javascriptFiles.length} JavaScript files, ${inlineScripts.length} inline scripts and owner health.`))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
