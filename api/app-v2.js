const baseApp = require('./app');

module.exports = async function handler(req, res) {
  let statusCode = 200;
  const headers = {};
  let body = '';

  const capture = {
    setHeader(name, value) {
      headers[name] = value;
      return this;
    },
    getHeader(name) {
      return headers[name];
    },
    status(code) {
      statusCode = code;
      return this;
    },
    send(value) {
      body = value == null ? '' : value;
      return this;
    },
    end(value) {
      if (value != null) body = value;
      return this;
    }
  };

  await baseApp(req, capture);

  let output = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '');

  if (statusCode === 200 && /<html/i.test(output)) {
    // Delivery page: remove the two fixed spice/Fusion at Home promo panels.
    // The separate postal Fusion at Home shop remains untouched.
    output = output.replace(
      /<div class="spiceBanner"[\s\S]*?<section id="specialSection"/,
      '<section id="specialSection"'
    );

    // Add a normal Blends section to the Delivery menu. This also makes Blends
    // available in Owner > Menu/Dishes because those tabs use FIXED_SECTIONS.
    output = output.replace(
      "FIXED_SECTIONS=['Mains','Bowls','Sides','Sauces','Desserts','Drinks']",
      "FIXED_SECTIONS=['Mains','Bowls','Sides','Sauces','Desserts','Drinks','Blends']"
    );

    output = output.replaceAll(
      'Customer order is fixed: Specials, Mains, Bowls, Sides, Sauces, Desserts, Drinks.',
      'Customer order is fixed: Specials, Mains, Bowls, Sides, Sauces, Desserts, Drinks, Blends.'
    );

    // First-paint routing lock must only protect initial render. Removing it at
    // the end keeps Welcome smooth but allows Owner and all other routes to show.
    output = output.replace(
      /<\/body>\s*<\/html>\s*$/i,
      '<script>document.documentElement.removeAttribute(\'data-initial-view\');</script>\n</body></html>'
    );
  }

  Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
  res.status(statusCode).send(output);
};
