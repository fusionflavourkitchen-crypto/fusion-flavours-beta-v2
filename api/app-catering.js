const app = require('./app.js');

module.exports = async function handler(req, res) {
  const originalSend = res.send.bind(res);
  res.send = function patchedSend(body) {
    if (typeof body === 'string' && body.includes('</body>')) {
      body = body.replace(/<\/body>/i, '<script src="/catering-policy.js?v=20260826"></script>\n</body>');
    }
    return originalSend(body);
  };
  return app(req, res);
};
