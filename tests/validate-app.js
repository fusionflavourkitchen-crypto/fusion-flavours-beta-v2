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
assert(!/data-area=["']delivery["']/i.test(migrated), 'Standalone Delivery navigation must stay retired');
assert(!/id=["']page-delivery["']/i.test(migrated), 'Standalone Delivery page must stay retired');
assert(/ordersDeliveryIntegrationScript/.test(fs.readFileSync(path.join(root, 'api/app.js'), 'utf8')));

const staticReferences = [...html.matchAll(/(?:src|href)=["']([^"'#?{}$]+)["']/gi)]
  .map(match => match[1])
  .filter(value => !/^(?:https?:|mailto:|tel:|data:|\/)/.test(value));
for (const reference of staticReferences) {
  assert(fs.existsSync(path.join(root, reference)), `Missing local asset: ${reference}`);
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
}

verifyHealthHandler()
  .then(() => console.log(`Validated ${javascriptFiles.length} JavaScript files, ${inlineScripts.length} inline scripts and owner health.`))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
