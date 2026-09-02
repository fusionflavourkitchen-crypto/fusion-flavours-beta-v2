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

const runtimeScripts = [
  'owner-router', 'legacy-state-bridge', 'owner-data-integration', 'harnell-public',
  'harnell-owner-integration', 'main-delivery-cleanup', 'delivery-open-integration', 'catering-policy',
  'delivery-management', 'business-finance-core', 'finance-integration', 'pnl-reporting',
  'financial-period-integration', 'orders-integration', 'orders-delivery-integration',
  'kitchen-integration', 'kitchen-actions-integration', 'prep-integration',
  'service-integration', 'catering-owner-integration', 'business-ui-integration',
  'business-actions-integration', 'fusion-runtime', 'community-meals-labels',
  'community-page-intro', 'tide-tax-integration'
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
assert(!/showOwnerPage\s*\(/.test(migrated), 'Migrated Owner UI must not call the retired showOwnerPage router');
assert(/FusionOwnerRouter\.showTab\('dailyadmin'\)/.test(html), 'P&L daily-cost shortcut must use the canonical Owner router');
assert(/ordersDeliveryIntegrationScript/.test(fs.readFileSync(path.join(root, 'api/app.js'), 'utf8')));
assert(/Array\.isArray\(cateringPackages\)/.test(fs.readFileSync(path.join(root, 'fusion-runtime.js'), 'utf8')), 'Catering package bridge must read the global package array, not the same-named DOM element');
assert(/Array\.isArray\(bridged\)/.test(fs.readFileSync(path.join(root, 'catering-policy.js'), 'utf8')), 'Catering policy must reject a same-named DOM element');
assert(/\['tax', 'Tide Tax'\]/.test(fs.readFileSync(path.join(root, 'owner-router.js'), 'utf8')), 'Business navigation must expose Tide Tax');
assert(/FusionTideTax/.test(fs.readFileSync(path.join(root, 'tide-tax-integration.js'), 'utf8')), 'Tide tax bridge must be available');
const deliveryOpen = fs.readFileSync(path.join(root, 'delivery-open-integration.js'), 'utf8');
assert(/preorder_open/.test(deliveryOpen), 'Delivery open control must use the public service-state field');
assert(/setDeliveryOrdersOpen/.test(deliveryOpen), 'Owner Dashboard must expose the delivery open/closed action');
assert(/\/api\/submit-delivery-order/.test(html), 'Main Delivery checkout must pass through the server-side open/closed gate');
assert(fs.existsSync(path.join(root, 'api/submit-delivery-order.js')), 'Server-side delivery order gate must exist');
const ownerDataIntegration = fs.readFileSync(path.join(root, 'owner-data-integration.js'), 'utf8');
assert(/coreOwnerDataLoader\s*=\s*typeof loadOwnerData/.test(ownerDataIntegration), 'Owner data bridge must capture the canonical loader');
assert(!/typeof loadOwnerDataV38/.test(ownerDataIntegration), 'Owner data bridge must not depend on a removed versioned loader');

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
  assert.ok(rendered.includes('data-fusion-inline="owner-router"'), 'Owner router must be embedded in the live page');
  assert.ok(rendered.includes('data-fusion-inline="fusion-runtime"'), 'Top-level navigation runtime must be embedded in the live page');
  assert.ok(rendered.indexOf('data-fusion-inline="fusion-runtime"') < rendered.lastIndexOf('data-fusion-inline="community-meals-labels"'), 'Community Meals slot integration must load after the final runtime');
  assert.ok(rendered.includes("#ownerEntry,#ownerDirectEntry"), 'Owner entry must be handled from every customer page');
  assert.ok(rendered.includes('data-fusion-inline="orders-delivery-integration"'), 'Orders must embed the driver and delivery control centre');
  assert.ok(rendered.includes('data-fusion-inline="app-core"'), 'Shared application styles must be embedded in the live page');
  runtimeScripts.forEach(name => {
    assert.strictEqual((rendered.match(new RegExp(`data-fusion-inline=["']${name}["']`, 'g')) || []).length, 1, `${name} must be embedded exactly once`);
  });
  assert.ok(!/<script\s+[^>]*src=["']\/(?:[^"']+\.js)/i.test(rendered), 'Rendered application must not depend on unavailable root JavaScript files');
  assert.ok(!/<link\s+[^>]*href=["']\/app-core\.css/i.test(rendered), 'Rendered application must not depend on unavailable app-core.css');
  assert.ok(rendered.includes('🚚 Delivery settings'), 'Orders delivery settings must be present');
  assert.ok(rendered.includes('+ Add driver'), 'Orders driver management must be present');
  assert.ok(rendered.includes('id="communityDeliverySlot"'), 'Community Meals checkout must include the delivery-slot selector');
  assert.ok(!require('fs').readFileSync(require('path').join(process.cwd(), 'community-meals-labels.js'), 'utf8').includes("$('harnellView')"), 'Community Meals integration must target the live customer page');
  const communityIntegration = require('fs').readFileSync(require('path').join(process.cwd(), 'community-meals-labels.js'), 'utf8');
  assert.ok(communityIntegration.includes('customerVisible&&!communityCustomerReady'), 'Community Meals slots must only initialise once while the page is visible');
  assert.ok(rendered.includes('<details class="retailIngredients"><summary>Product details &amp; ingredients</summary>'), 'Fusion at Home product information must be collapsed by default');
  assert.ok(!rendered.includes('<b>Responsible business:</b> Fusion Flavours, 44 Harnall Lane West'), 'Fusion at Home product cards must not show the business address');
}

async function verifyClosedDeliveryGate() {
  const handler = require('../api/submit-delivery-order');
  const originalFetch = global.fetch;
  let orderRpcCalled = false;
  global.fetch = async url => {
    if (String(url).includes('/rest/v1/settings')) {
      return { ok:true, json:async()=>[{ preorder_open:false }] };
    }
    orderRpcCalled = true;
    throw new Error('Order RPC must not be called while delivery is closed');
  };
  let statusCode = 200;
  let body = '';
  const res = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    send(value) { body = String(value); return this; }
  };
  try {
    await handler({ method:'POST', body:{ p_customer_name:'Blocked test' } }, res);
  } finally { global.fetch = originalFetch; }
  assert.strictEqual(statusCode, 423, body);
  assert.strictEqual(JSON.parse(body).message, 'Delivery orders are currently closed.');
  assert.strictEqual(orderRpcCalled, false, 'Closed delivery must stop before the order RPC');
}

Promise.all([verifyHealthHandler(), verifyClosedDeliveryGate()])
  .then(() => console.log(`Validated ${javascriptFiles.length} JavaScript files, ${inlineScripts.length} inline scripts and owner health.`))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
