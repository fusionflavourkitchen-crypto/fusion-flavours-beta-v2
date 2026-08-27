const fs = require('fs');
const path = require('path');

const BUILD = '20260827-refactor-24';

function stripLegacyOwnerControl(source) {
  return source
    .replace(/setTimeout\(tidyTradingPerformanceV332\s*,\s*0\s*\);?/g, '')
    .replace(/setTimeout\(\(\)\s*=>\s*\{\s*const p=currentFinancialPeriod\(\);\s*if\(p\)pnlSelectedPeriod=p\.no\s*\}\s*,\s*300\s*\);?/g, '')
    .replace(/window\.showTab=t=>\{[\s\S]*?\}\s*\nasync function loadOwnerData/i, 'async function loadOwnerData');
}

function ensureOwnerShell(source) {
  let html = source;
  const deliveryButton = '<button data-area="delivery" onclick="showOwnerArea(\'delivery\')">Delivery</button>';

  if (!/data-area=["']delivery["']/i.test(html)) {
    html = html.replace(/(<div\s+id=["']ownerNavMenu["'][^>]*>)([\s\S]*?)(<\/div>)/i, (all, open, body, close) => {
      if (/data-area=["']service["']/i.test(body)) {
        body = body.replace(/(<button\b[^>]*data-area=["']service["'][^>]*>)/i, `${deliveryButton}\n$1`);
      } else {
        body += `\n${deliveryButton}`;
      }
      return open + body + close;
    });
  }

  if (!/id=["']page-delivery["']/i.test(html)) {
    html = html.replace(/(<div\s+id=["']page-service["']\b)/i, '<div id="page-delivery" class="ownerPage hidden"></div>$1');
  }

  return html;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method && !['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).send('Method Not Allowed');
    }

    const htmlPath = path.join(process.cwd(), 'index.html');
    let html = ensureOwnerShell(stripLegacyOwnerControl(fs.readFileSync(htmlPath, 'utf8')));
    const mode = String(req.query?.mode || '').toLowerCase();

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

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Fusion-Build', BUILD);
    if (mode === 'owner') res.setHeader('X-Fusion-Owner-Shell', 'delivery-present');

    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (err) {
    console.error('Fusion Flavours app:', err);
    return res.status(500).send('<!doctype html><html><body><h2>Fusion Flavours</h2><p>The app could not load. Please refresh.</p></body></html>');
  }
};
