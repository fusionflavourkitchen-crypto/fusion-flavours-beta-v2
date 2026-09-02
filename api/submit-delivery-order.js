/* Server-side gate for Main Delivery ordering. */
const SUPA_URL = 'https://uhautgiebtkvrxfsqabq.supabase.co';
const SUPA_KEY = 'sb_publishable_XPAXC44lyPin89u8l_LdKw_3nLMlI9J';

function send(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { message: 'POST required.' });
  try {
    const statusResponse = await fetch(`${SUPA_URL}/rest/v1/settings?id=eq.1&select=preorder_open`, {
      headers: { apikey: SUPA_KEY }
    });
    const statusRows = await statusResponse.json().catch(() => []);
    if (!statusResponse.ok) throw new Error('Delivery availability could not be checked.');
    if (statusRows?.[0]?.preorder_open !== true) {
      return send(res, 423, { message: 'Delivery orders are closed today, please see open times above.' });
    }

    const orderResponse = await fetch(`${SUPA_URL}/rest/v1/rpc/submit_delivery_order`, {
      method: 'POST',
      headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body && typeof req.body === 'object' ? req.body : {})
    });
    const text = await orderResponse.text();
    res.status(orderResponse.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(text);
  } catch (error) {
    console.error('Delivery order gate:', error);
    return send(res, 503, { message: 'Delivery ordering is temporarily unavailable. Please try again.' });
  }
};
