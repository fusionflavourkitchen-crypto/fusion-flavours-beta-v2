const app = require('./app.js');

module.exports = async function handler(req, res) {
  const originalSend = res.send.bind(res);

  res.send = function patchedSend(body) {
    if (typeof body === 'string' && /<\/body>/i.test(body)) {
      // IMPORTANT: inject Delivery into the actual Owner dashboard markup.
      // Do not use a broad "does the word delivery exist anywhere" test here,
      // because legacy scripts contain delivery strings even when the visible
      // Owner menu itself does not contain a Delivery button.
      const serviceButton = /(<button\s+data-area=["']service["'][^>]*>Service<\/button>)/i;
      if (serviceButton.test(body) && !/<button\b[^>]*data-area=["']delivery["']/i.test(body)) {
        body = body.replace(
          serviceButton,
          '<button type="button" id="fusionDeliveryNavBtn" data-area="delivery" onclick="window.__fusionOpenDelivery&&window.__fusionOpenDelivery(event)">Delivery</button>\n$1'
        );
      }

      // Add the physical Delivery owner page next to the other permanent owner
      // pages on every request. Allow whitespace/content formatting around the
      // Service placeholder so a harmless HTML formatting change cannot break it.
      const pageService = /(<div\s+id=["']page-service["'][^>]*>\s*<\/div>)/i;
      if (pageService.test(body) && !/id=["']page-delivery["']/i.test(body)) {
        body = body.replace(
          pageService,
          '<div id="page-delivery" class="ownerPage hidden"></div>$1'
        );
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

      // Open Delivery directly instead of asking the legacy owner router to
      // understand a tab that was added after the original app was written.
      // The mount guard loaded below is the canonical click path and also
      // repairs any stale/legacy navigation handler that survives startup.
      injections.push(`<script>
(function(){
  var deliveryRetryTimer = null;
  var deliveryRetryCount = 0;

  function renderDeliveryWhenReady(){
    var page=document.getElementById('page-delivery');
    if(typeof window.refreshDeliveryManagement==='function'){
      deliveryRetryCount=0;
      if(deliveryRetryTimer){ clearTimeout(deliveryRetryTimer); deliveryRetryTimer=null; }
      Promise.resolve(window.refreshDeliveryManagement()).catch(function(err){
        console.error('Delivery refresh:',err);
        if(page) page.innerHTML='<h2>Delivery</h2><div class="notice">Could not load Delivery: '+String(err&&err.message||err)+'</div>';
      });
      return;
    }
    if(page && deliveryRetryCount===0){
      page.innerHTML='<h2>Delivery</h2><p class="muted">Loading delivery management…</p>';
    }
    if(deliveryRetryCount<20){
      deliveryRetryCount+=1;
      deliveryRetryTimer=setTimeout(renderDeliveryWhenReady,150);
    }else if(page){
      page.innerHTML='<h2>Delivery</h2><div class="notice">Delivery Management did not finish loading. Refresh the app once and try again.</div>';
    }
  }

  function openDelivery(ev){
    if(ev){ try{ev.preventDefault();ev.stopPropagation();}catch(e){} }
    try{ if(typeof OWNER_AREAS!=='undefined') OWNER_AREAS.delivery=[['delivery','Delivery']]; }catch(e){}

    var page=document.getElementById('page-delivery');
    if(!page){
      var anchor=document.getElementById('page-service')||document.querySelector('.ownerPage');
      if(anchor&&anchor.parentElement){
        page=document.createElement('div');
        page.id='page-delivery';
        page.className='ownerPage hidden';
        anchor.parentElement.insertBefore(page,anchor);
      }
    }

    document.querySelectorAll('.ownerPage').forEach(function(p){ p.classList.add('hidden'); });
    if(page) page.classList.remove('hidden');

    var menu=document.getElementById('ownerNavMenu');
    if(menu){
      menu.querySelectorAll('[data-area]').forEach(function(b){ b.classList.toggle('active',b.dataset.area==='delivery'); });
      menu.classList.add('hidden');
    }
    var current=document.getElementById('ownerNavCurrent');
    if(current) current.textContent='Delivery';

    try{ if(typeof activeTab!=='undefined') activeTab='delivery'; }catch(e){}
    renderDeliveryWhenReady();
    window.scrollTo(0,0);
  }

  window.__fusionOpenDelivery=openDelivery;

  function wire(){
    try{ if(typeof OWNER_AREAS!=='undefined') OWNER_AREAS.delivery=[['delivery','Delivery']]; }catch(e){}
    var menu=document.getElementById('ownerNavMenu');
    if(!menu) return;
    var btn=menu.querySelector('[data-area="delivery"]');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.id='fusionDeliveryNavBtn';
      btn.dataset.area='delivery';
      btn.textContent='Delivery';
      var service=menu.querySelector('[data-area="service"]');
      if(service) menu.insertBefore(btn,service); else menu.appendChild(btn);
    }
    btn.type='button';
    btn.onclick=openDelivery;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire,{once:true});
  else wire();
  setTimeout(wire,100);
  setTimeout(wire,500);
  setTimeout(wire,1500);
})();
</script>`);

      if (!/src=["'][^"']*\/catering-policy\.js(?:[?"'])/i.test(body)) {
        injections.push('<script src="/catering-policy.js?v=20260827b"></script>');
      }
      if (!/src=["'][^"']*\/delivery-management\.js(?:[?"'])/i.test(body)) {
        injections.push('<script src="/delivery-management.js?v=20260827b"></script>');
      }
      if (!/src=["'][^"']*\/delivery-management-mount\.js(?:[?"'])/i.test(body)) {
        injections.push('<script src="/delivery-management-mount.js?v=20260827b"></script>');
      }

      if (injections.length) {
        body = body.replace(/<\/body>/i, injections.join('\n') + '\n</body>');
      }
    }

    return originalSend(body);
  };

  return app(req, res);
};
