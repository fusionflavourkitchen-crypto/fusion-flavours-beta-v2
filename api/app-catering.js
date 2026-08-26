const app = require('./app.js');

module.exports = async function handler(req, res) {
  const originalSend = res.send.bind(res);

  res.send = function patchedSend(body) {
    if (typeof body === 'string' && /<\/body>/i.test(body)) {
      // Make Delivery a real part of the rendered Owner dashboard rather than
      // depending entirely on a late MutationObserver/runtime mount.
      if (!/data-area=["']delivery["']/i.test(body)) {
        const serviceButton = /(<button\s+data-area=["']service["'][^>]*>Service<\/button>)/i;
        if (serviceButton.test(body)) {
          body = body.replace(serviceButton, '<button type="button" id="fusionDeliveryNavBtn" data-area="delivery" onclick="window.__fusionOpenDelivery&&window.__fusionOpenDelivery(event)">Delivery</button>\n$1');
        }
      }

      if (!/id=["']page-delivery["']/i.test(body)) {
        const pageService = /(<div\s+id=["']page-service["'][^>]*><\/div>)/i;
        if (pageService.test(body)) {
          body = body.replace(pageService, '<div id="page-delivery" class="ownerPage hidden"></div>$1');
        } else {
          body = body.replace(/<\/body>/i, '<div id="page-delivery" class="ownerPage hidden"></div>\n</body>');
        }
      }

      const injections = [];

      if (!body.includes('window.__fusionGetCateringPackages')) {
        injections.push(`<script>
window.__fusionGetCateringPackages = function(){ try { return typeof cateringPackages !== 'undefined' ? cateringPackages : []; } catch(e) { return []; } };
window.__fusionGetOwnerData = function(){ try { return typeof ownerData !== 'undefined' ? ownerData : null; } catch(e) { return null; } };
window.__fusionCateringOrderFoodCost = function(o){ try { return typeof cateringOrderFoodCost === 'function' ? cateringOrderFoodCost(o) : 0; } catch(e) { return 0; } };
window.__fusionCateringSuggestedTotal = function(){ try { return typeof cateringSuggestedTotal === 'function' ? cateringSuggestedTotal() : 0; } catch(e) { return 0; } };
window.__fusionSaveCateringBooking = function(id){ try { return typeof saveCateringBooking === 'function' ? saveCateringBooking(id) : Promise.resolve(); } catch(e) { return Promise.reject(e); } };
</script>`);
      }

      if (!body.includes('window.__fusionOpenDelivery')) {
        injections.push(`<script>
(function(){
  function openDelivery(ev){
    if(ev){ try{ev.preventDefault();ev.stopPropagation();}catch(e){} }
    try{ if(typeof OWNER_AREAS!=='undefined') OWNER_AREAS.delivery=[['delivery','Delivery']]; }catch(e){}

    try{
      if(typeof window.showOwnerArea==='function'){
        window.showOwnerArea('delivery');
      }else{
        document.querySelectorAll('.ownerPage').forEach(function(p){p.classList.add('hidden')});
        var page=document.getElementById('page-delivery');
        if(page) page.classList.remove('hidden');
        var current=document.getElementById('ownerNavCurrent');
        if(current) current.textContent='Delivery';
        var menu=document.getElementById('ownerNavMenu');
        if(menu) menu.classList.add('hidden');
      }
    }catch(e){
      document.querySelectorAll('.ownerPage').forEach(function(p){p.classList.add('hidden')});
      var fallback=document.getElementById('page-delivery');
      if(fallback) fallback.classList.remove('hidden');
    }

    try{
      if(typeof window.initializeDeliveryManagement==='function'){
        Promise.resolve(window.initializeDeliveryManagement()).catch(function(err){console.error('Delivery init:',err)});
      }
    }catch(e){ console.error('Delivery init:',e); }
    try{
      if(typeof window.refreshDeliveryManagement==='function'){
        Promise.resolve(window.refreshDeliveryManagement()).catch(function(err){console.error('Delivery refresh:',err)});
      }
    }catch(e){}
  }

  window.__fusionOpenDelivery=openDelivery;

  function wire(){
    try{ if(typeof OWNER_AREAS!=='undefined') OWNER_AREAS.delivery=[['delivery','Delivery']]; }catch(e){}
    var btn=document.querySelector('#ownerNavMenu [data-area="delivery"]');
    if(btn){ btn.type='button'; btn.onclick=openDelivery; }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire,{once:true});
  else wire();
  setTimeout(wire,250);
  setTimeout(wire,1000);
})();
</script>`);
      }

      if (!/src=["'][^"']*\/catering-policy\.js(?:[?"'])/i.test(body)) {
        injections.push('<script src="/catering-policy.js?v=20260826e"></script>');
      }
      if (!/src=["'][^"']*\/delivery-management\.js(?:[?"'])/i.test(body)) {
        injections.push('<script src="/delivery-management.js?v=20260826f"></script>');
      }
      if (!/src=["'][^"']*\/delivery-management-mount\.js(?:[?"'])/i.test(body)) {
        injections.push('<script src="/delivery-management-mount.js?v=20260826f"></script>');
      }

      if (injections.length) {
        body = body.replace(/<\/body>/i, injections.join('\n') + '\n</body>');
      }
    }

    return originalSend(body);
  };

  return app(req, res);
};
