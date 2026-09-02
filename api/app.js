const fs = require('fs');
const path = require('path');
const { migrateLegacyHtml, migrationFailures } = require('./lib/legacy-html-migration');

const BUILD = '20260902-complete-runtime-restore-1';

const RUNTIME_SCRIPTS = [
  'owner-router.js',
  'legacy-state-bridge.js',
  'owner-data-integration.js',
  'harnell-public.js',
  'harnell-owner-integration.js',
  'main-delivery-cleanup.js',
  'catering-policy.js',
  'delivery-management.js',
  'business-finance-core.js',
  'finance-integration.js',
  'pnl-reporting.js',
  'financial-period-integration.js',
  'orders-integration.js',
  'orders-delivery-integration.js',
  'kitchen-integration.js',
  'kitchen-actions-integration.js',
  'prep-integration.js',
  'service-integration.js',
  'catering-owner-integration.js',
  'business-ui-integration.js',
  'business-actions-integration.js',
  'fusion-runtime.js',
  'community-meals-labels.js',
  'community-page-intro.js'
];

function inlineScript(fileName) {
  return fs.readFileSync(path.join(process.cwd(), fileName), 'utf8').replace(/<\/script/gi, '<\\/script');
}

function inlineStyle(fileName) {
  return fs.readFileSync(path.join(process.cwd(), fileName), 'utf8').replace(/<\/style/gi, '<\\/style');
}

function scriptMarker(fileName) {
  return fileName.replace(/\.js$/i, '');
}

const DELIVERY_CHEF_NOTE = `<div class="mainDeliveryWelcomeNote" data-design="chef-note-v4" style="position:relative;background:linear-gradient(180deg,#1a1a1a 0%,#121212 100%);color:#f8f2ea;border:2px solid #f26b21;border-radius:18px;padding:26px 24px 24px;margin:14px 0 22px;text-align:center;box-shadow:0 8px 20px rgba(0,0,0,.18),inset 0 0 0 1px rgba(255,255,255,.04);overflow:hidden">
  <div aria-hidden="true" style="position:absolute;left:12px;top:12px;width:34px;height:34px;border-left:2px solid #f26b21;border-top:2px solid #f26b21;border-radius:10px 0 0 0;opacity:.9"></div>
  <div aria-hidden="true" style="position:absolute;right:12px;bottom:12px;width:34px;height:34px;border-right:2px solid #f26b21;border-bottom:2px solid #f26b21;border-radius:0 0 10px 0;opacity:.9"></div>
  <div style="font-family:'Comic Sans MS','Segoe Print','Bradley Hand',cursive;font-size:21px;line-height:1.5;letter-spacing:.01em;color:#f7f1e8;text-shadow:0 1px 0 #000">
    <div style="margin-bottom:8px">We keep things <span style="color:#f26b21;font-weight:700">fresh</span> and real.</div>
    <div>Your food is cooked <span style="color:#f26b21;font-weight:700">fresh to order</span>,</div>
    <div>then sent on its way to you</div>
    <div>as soon as it’s ready.</div>
    <div style="margin-top:16px">Thank you for your patience and support</div>
    <div>— it means everything.</div>
  </div>
  <div style="margin-top:16px;text-align:right;padding-right:8px;font-family:'Comic Sans MS','Segoe Print','Bradley Hand',cursive;color:#f26b21;font-size:21px;line-height:1.05;transform:rotate(-3deg)">
    <div style="font-size:18px">Thanks!</div>
    <div style="font-size:25px">Chef Dan</div>
  </div>
</div>`;

module.exports = async function handler(req, res) {
  try {
    if (req.method && !['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).send('Method Not Allowed');
    }

    const htmlPath = path.join(process.cwd(), 'index.html');
    let html = migrateLegacyHtml(fs.readFileSync(htmlPath, 'utf8'));
    const migrationIssues = migrationFailures(html);
    const migratedShell = html;
    const mode = String(req.query?.mode || '').toLowerCase();
    const healthRequested = String(req.query?.health || '') === '1';

    if (!/<\/head>/i.test(html) || !/<\/body>\s*<\/html>\s*$/i.test(html)) {
      throw new Error('index.html is missing required closing tags');
    }

    html = html.replace(
      /(<a\b[^>]*class=["'][^"']*\bdeliveryHomeBack\b[^"']*["'][^>]*>\s*←\s*Fusion Flavours Home\s*<\/a>)(?!\s*<div class="mainDeliveryWelcomeNote")/i,
      `$1\n${DELIVERY_CHEF_NOTE}`
    );

    // Vercel serves this application through one function. Keep the complete runtime in
    // that response so customer and Owner tools cannot disappear behind static-file 404s.
    html = html
      .replace(/<script\s+src=["']\/(?:orders-delivery-integration|community-meals-labels)\.js[^"']*["']\s*><\/script>\s*/gi, '')
      .replace(/<\/head>/i, `<style data-fusion-inline="app-core">${inlineStyle('app-core.css')}</style>\n</head>`);

    const bootstrap = [
      `<script>window.__FUSION_BOOT_MODE__=${JSON.stringify(mode)};</script>`,
      ...RUNTIME_SCRIPTS.map(fileName => `<script data-fusion-inline="${scriptMarker(fileName)}">${inlineScript(fileName)}</script>`)
    ].join('\n');

    html = html.replace(/<\/body>\s*<\/html>\s*$/i, `${bootstrap}\n<!-- fusion-build:${BUILD} -->\n</body></html>`);

    const ownerHealth = {
      build: BUILD,
      mode,
      migrationOk: migrationIssues.length === 0,
      migrationIssues,
      standaloneDeliveryNavAbsent: !/data-area=["']delivery["']/i.test(migratedShell),
      standaloneDeliveryPageAbsent: !/id=["']page-delivery["']/i.test(migratedShell),
      ordersDeliveryIntegrationScript: /<script\s+data-fusion-inline=["']orders-delivery-integration["']/i.test(html),
      appCoreStyle: /<style\s+data-fusion-inline=["']app-core["']/i.test(html),
      completeRuntime: RUNTIME_SCRIPTS.every(fileName => html.includes(`data-fusion-inline="${scriptMarker(fileName)}"`)),
      communityMealsIntegrationScript: /<script\s+data-fusion-inline=["']community-meals-labels["']/i.test(html),
      deliveryManagementScript: /<script\s+data-fusion-inline=["']delivery-management["']/i.test(html),
      ownerRouterScript: /<script\s+data-fusion-inline=["']owner-router["']/i.test(html),
      fusionRuntimeScript: /<script\s+data-fusion-inline=["']fusion-runtime["']/i.test(html),
      bootModeOwner: /window\.__FUSION_BOOT_MODE__=["']owner["']/i.test(html),
      legacyShowTabAbsent: !/window\.showTab\s*=/i.test(migratedShell),
      legacyOwnerAreaAbsent: !/window\.showOwnerArea\s*=/i.test(migratedShell),
      legacyOwnerPageAbsent: !/window\.showOwnerPage\s*=/i.test(migratedShell),
      legacyReliabilityPatchAbsent: !/Owner navigation reliability fix/i.test(migratedShell),
      legacyV383OwnerEntryAbsent: !/Owner must be its own exclusive top-level view/i.test(migratedShell),
      legacyV383CustomerButtonAbsent: !/Customer View from Owner always returns to the Welcome Hub/i.test(migratedShell),
      legacyV383PopstateAbsent: !/Browser back\/forward follows the customer hub routes properly/i.test(migratedShell),
      legacyPreV383RouterAbsent: !/Default route is now the Welcome Hub/i.test(migratedShell)
    };
    ownerHealth.ok = mode === 'owner' && ownerHealth.migrationOk && ownerHealth.standaloneDeliveryNavAbsent && ownerHealth.standaloneDeliveryPageAbsent && ownerHealth.appCoreStyle && ownerHealth.completeRuntime && ownerHealth.ordersDeliveryIntegrationScript && ownerHealth.communityMealsIntegrationScript && ownerHealth.deliveryManagementScript && ownerHealth.ownerRouterScript && ownerHealth.fusionRuntimeScript && ownerHealth.bootModeOwner && ownerHealth.legacyShowTabAbsent && ownerHealth.legacyOwnerAreaAbsent && ownerHealth.legacyOwnerPageAbsent && ownerHealth.legacyReliabilityPatchAbsent && ownerHealth.legacyV383OwnerEntryAbsent && ownerHealth.legacyV383CustomerButtonAbsent && ownerHealth.legacyV383PopstateAbsent && ownerHealth.legacyPreV383RouterAbsent;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Fusion-Build', BUILD);
    res.setHeader('X-Fusion-Migration', migrationIssues.length ? migrationIssues.join(',') : 'ok');
    if (mode === 'owner') res.setHeader('X-Fusion-Owner-Shell', ownerHealth.ok ? 'verified' : 'invalid');

    if (healthRequested) {
      console.log('Fusion Owner Health', JSON.stringify(ownerHealth));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(ownerHealth.ok ? 200 : 500).send(JSON.stringify(ownerHealth));
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (err) {
    console.error('Fusion Flavours app:', err);
    return res.status(500).send('<!doctype html><html><body><h2>Fusion Flavours</h2><p>The app could not load. Please refresh.</p></body></html>');
  }
};
