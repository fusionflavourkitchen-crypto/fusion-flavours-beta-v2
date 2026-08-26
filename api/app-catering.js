const app = require('./app.js');

module.exports = async function handler(req, res) {
  const originalSend = res.send.bind(res);
  res.send = function patchedSend(body) {
    if (typeof body === 'string' && body.includes('</body>')) {
      const bridge = `<script>
window.__fusionGetCateringPackages = function(){ try { return typeof cateringPackages !== 'undefined' ? cateringPackages : []; } catch(e) { return []; } };
window.__fusionGetOwnerData = function(){ try { return typeof ownerData !== 'undefined' ? ownerData : null; } catch(e) { return null; } };
window.__fusionCateringOrderFoodCost = function(o){ try { return typeof cateringOrderFoodCost === 'function' ? cateringOrderFoodCost(o) : 0; } catch(e) { return 0; } };
window.__fusionCateringSuggestedTotal = function(){ try { return typeof cateringSuggestedTotal === 'function' ? cateringSuggestedTotal() : 0; } catch(e) { return 0; } };
window.__fusionSaveCateringBooking = function(id){ try { return typeof saveCateringBooking === 'function' ? saveCateringBooking(id) : Promise.resolve(); } catch(e) { return Promise.reject(e); } };
</script>
<script src="/catering-policy.js?v=20260826b"></script>
<script src="/delivery-management.js?v=20260826a"></script>`;
      body = body.replace(/<\/body>/i, bridge + '\n</body>');
    }
    return originalSend(body);
  };
  return app(req, res);
};
