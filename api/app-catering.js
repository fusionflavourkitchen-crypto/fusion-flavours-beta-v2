const app = require('./app.js');

module.exports = async function handler(req, res) {
  const originalSend = res.send.bind(res);

  res.send = function patchedSend(body) {
    if (typeof body === 'string' && /<\/body>/i.test(body)) {
      const injections = [];

      // Keep the catering bridge available, but do not inject it twice if the
      // response has already been patched elsewhere.
      if (!body.includes('window.__fusionGetCateringPackages')) {
        injections.push(`<script>
window.__fusionGetCateringPackages = function(){ try { return typeof cateringPackages !== 'undefined' ? cateringPackages : []; } catch(e) { return []; } };
window.__fusionGetOwnerData = function(){ try { return typeof ownerData !== 'undefined' ? ownerData : null; } catch(e) { return null; } };
window.__fusionCateringOrderFoodCost = function(o){ try { return typeof cateringOrderFoodCost === 'function' ? cateringOrderFoodCost(o) : 0; } catch(e) { return 0; } };
window.__fusionCateringSuggestedTotal = function(){ try { return typeof cateringSuggestedTotal === 'function' ? cateringSuggestedTotal() : 0; } catch(e) { return 0; } };
window.__fusionSaveCateringBooking = function(id){ try { return typeof saveCateringBooking === 'function' ? saveCateringBooking(id) : Promise.resolve(); } catch(e) { return Promise.reject(e); } };
</script>`);
      }

      // Load these independently. Delivery Management must still be injected
      // even when catering-policy.js is already present in the HTML.
      if (!/src=["'][^"']*\/catering-policy\.js(?:[?"'])/i.test(body)) {
        injections.push('<script src="/catering-policy.js?v=20260826d"></script>');
      }
      if (!/src=["'][^"']*\/delivery-management\.js(?:[?"'])/i.test(body)) {
        injections.push('<script src="/delivery-management.js?v=20260826c"></script>');
      }
      if (!/src=["'][^"']*\/delivery-management-mount\.js(?:[?"'])/i.test(body)) {
        injections.push('<script src="/delivery-management-mount.js?v=20260826b"></script>');
      }

      if (injections.length) {
        body = body.replace(/<\/body>/i, injections.join('\n') + '\n</body>');
      }
    }

    return originalSend(body);
  };

  return app(req, res);
};
