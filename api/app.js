const fs = require('fs');
const path = require('path');

const BUILD = '20260827-refactor-13';

module.exports = async function handler(req, res) {
  try {
    if (req.method && !['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).send('Method Not Allowed');
    }

    const htmlPath = path.join(process.cwd(), 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const mode = String(req.query?.mode || '').toLowerCase();

    if (!/<\/head>/i.test(html) || !/<\/body>\s*<\/html>\s*$/i.test(html)) {
      throw new Error('index.html is missing required closing tags');
    }

    html = html.replace(/<\/head>/i, `<link rel="stylesheet" href="/app-core.css?v=${BUILD}">\n</head>`);

    const bootstrap = [
      `<script>window.__FUSION_BOOT_MODE__=${JSON.stringify(mode)};</script>`,
      `<script src="/owner-router.js?v=${BUILD}"></script>`,
      `<script src="/owner-data-integration.js?v=${BUILD}"></script>`,
      `<script src="/harnell-public.js?v=${BUILD}"></script>`,
      `<script src="/harnell-owner-integration.js?v=${BUILD}"></script>`,
      `<script src="/catering-policy.js?v=${BUILD}"></script>`,
      `<script src="/delivery-management.js?v=${BUILD}"></script>`,
      `<script src="/business-finance-core.js?v=${BUILD}"></script>`,
      `<script src="/finance-integration.js?v=${BUILD}"></script>`,
      `<script src="/orders-integration.js?v=${BUILD}"></script>`,
      `<script src="/kitchen-integration.js?v=${BUILD}"></script>`,
      `<script src="/service-integration.js?v=${BUILD}"></script>`,
      `<script src="/catering-owner-integration.js?v=${BUILD}"></script>`,
      `<script src="/fusion-runtime.js?v=${BUILD}"></script>`
    ].join('\n');

    html = html.replace(/<\/body>\s*<\/html>\s*$/i, `${bootstrap}\n</body></html>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Fusion-Build', BUILD);

    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (err) {
    console.error('Fusion Flavours app:', err);
    return res.status(500).send('<!doctype html><html><body><h2>Fusion Flavours</h2><p>The app could not load. Please refresh.</p></body></html>');
  }
};
