const fs = require('fs');
const path = require('path');
const { migrateLegacyHtml, migrationFailures } = require('./lib/legacy-html-migration');

const BUILD = '20260828-refactor-33';

module.exports = async function handler(req, res) {
  try {
    if (req.method && !['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).send('Method Not Allowed');
    }

    const htmlPath = path.join(process.cwd(), 'index.html');
    let html = migrateLegacyHtml(fs.readFileSync(htmlPath, 'utf8'));
    const migrationIssues = migrationFailures(html);
    const mode = String(req.query?.mode || '').toLowerCase();
    const healthRequested = String(req.query?.health || '') === '1';

    if (!/<\/head>/i.test(html) || !/<\/body>\s*<\/html>\s*$/i.test(html)) {
      throw new Error('index.html is missing required closing tags');
    }

    html = html.replace(/<\/head>/i, `<link rel="stylesheet" href="/app-core.css?v=${BUILD}">\n</head>`);

    const bootstrap = [
      `<script>window.__FUSION_BOOT_MODE__=${JSON.stringify(mode)};</script>`,
      `<script src="/owner-router.js?v=${BUILD}"></script>`,
      `<script src="/legacy-state-bridge.js?v=${BUILD}"></script>`,
      `<script src="/owner-data-integration.js?v=${BUILD}"></script>`,
      `<script src="/harnell-public.js?v=${BUILD}"></script>`,
      `<script src="/harnell-owner-integration.js?v=${BUILD}"></script>`,
      `<script src="/community-page-intro.js?v=${BUILD}"></script>`,
      `<script src="/main-delivery-cleanup.js?v=${BUILD}"></script>`,
      `<script src="/catering-policy.js?v=${BUILD}"></script>`,
      `<script src="/delivery-management.js?v=${BUILD}"></script>`,
      `<script src="/business-finance-core.js?v=${BUILD}"></script>`,
      `<script src="/finance-integration.js?v=${BUILD}"></script>`,
      `<script src="/pnl-reporting.js?v=${BUILD}"></script>`,
      `<script src="/financial-period-integration.js?v=${BUILD}"></script>`,
      `<script src="/orders-integration.js?v=${BUILD}"></script>`,
      `<script src="/kitchen-integration.js?v=${BUILD}"></script>`,
      `<script src="/kitchen-actions-integration.js?v=${BUILD}"></script>`,
      `<script src="/prep-integration.js?v=${BUILD}"></script>`,
      `<script src="/service-integration.js?v=${BUILD}"></script>`,
      `<script src="/catering-owner-integration.js?v=${BUILD}"></script>`,
      `<script src="/business-ui-integration.js?v=${BUILD}"></script>`,
      `<script src="/business-actions-integration.js?v=${BUILD}"></script>`,
      `<script src="/fusion-runtime.js?v=${BUILD}"></script>`
    ].join('\n');

    html = html.replace(/<\/body>\s*<\/html>\s*$/i, `${bootstrap}\n<!-- fusion-build:${BUILD} -->\n</body></html>`);

    const ownerHealth = {
      build: BUILD,
      mode,
      migrationOk: migrationIssues.length === 0,
      migrationIssues,
      deliveryNav: /data-area=["']delivery["']/i.test(html),
      deliveryPage: /id=["']page-delivery["']/i.test(html),
      deliveryManagementScript: /<script\s+src=["']\/delivery-management\.js\?v=/i.test(html),
      ownerRouterScript: /<script\s+src=["']\/owner-router\.js\?v=/i.test(html),
      fusionRuntimeScript: /<script\s+src=["']\/fusion-runtime\.js\?v=/i.test(html),
      bootModeOwner: /window\.__FUSION_BOOT_MODE__=["']owner["']/i.test(html),
      legacyShowTabAbsent: !/window\.showTab\s*=/i.test(html),
      legacyOwnerAreaAbsent: !/window\.showOwnerArea\s*=/i.test(html),
      legacyOwnerPageAbsent: !/window\.showOwnerPage\s*=/i.test(html),
      legacyReliabilityPatchAbsent: !/Owner navigation reliability fix/i.test(html),
      legacyV383OwnerEntryAbsent: !/Owner must be its own exclusive top-level view/i.test(html),
      legacyV383CustomerButtonAbsent: !/Customer View from Owner always returns to the Welcome Hub/i.test(html),
      legacyV383PopstateAbsent: !/Browser back\/forward follows the customer hub routes properly/i.test(html),
      legacyPreV383RouterAbsent: !/Default route is now the Welcome Hub/i.test(html)
    };
    ownerHealth.ok = mode === 'owner' && ownerHealth.migrationOk && ownerHealth.deliveryNav && ownerHealth.deliveryPage && ownerHealth.deliveryManagementScript && ownerHealth.ownerRouterScript && ownerHealth.fusionRuntimeScript && ownerHealth.bootModeOwner && ownerHealth.legacyShowTabAbsent && ownerHealth.legacyOwnerAreaAbsent && ownerHealth.legacyOwnerPageAbsent && ownerHealth.legacyReliabilityPatchAbsent && ownerHealth.legacyV383OwnerEntryAbsent && ownerHealth.legacyV383CustomerButtonAbsent && ownerHealth.legacyV383PopstateAbsent && ownerHealth.legacyPreV383RouterAbsent;

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
