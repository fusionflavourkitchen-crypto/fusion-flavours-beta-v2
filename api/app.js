const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    if (req.method && !['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).send('Method Not Allowed');
    }

    const htmlPath = path.join(process.cwd(), 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const mode = String(req.query?.mode || '').toLowerCase();

    const bootstrap = [
      `<script>window.__FUSION_BOOT_MODE__=${JSON.stringify(mode)};</script>`,
      '<script src="/fusion-runtime.js?v=20260827-clean"></script>',
      '<script src="/catering-policy.js?v=20260827-clean"></script>',
      '<script src="/delivery-management.js?v=20260827-clean"></script>'
    ].join('\n');

    if (!/<\/body>\s*<\/html>\s*$/i.test(html)) {
      throw new Error('index.html is missing its closing body/html tags');
    }

    html = html.replace(/<\/body>\s*<\/html>\s*$/i, `${bootstrap}\n</body></html>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Fusion-Build', 'clean-runtime-20260827');

    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (err) {
    console.error('Fusion Flavours app:', err);
    return res.status(500).send('<!doctype html><html><body><h2>Fusion Flavours</h2><p>The app could not load. Please refresh.</p></body></html>');
  }
};
