const app = require('./app.js');

module.exports = async function ownerHandler(req, res) {
  // Always ask the core app to open in Owner mode.
  req.query = Object.assign({}, req.query || {}, { mode: 'owner' });

  const originalSend = res.send.bind(res);

  res.send = function ownerSend(body) {
    if (typeof body === 'string' && /<\/body>/i.test(body)) {
      let output = body;

      // Marker used to prove production is serving this exact owner build.
      if (!output.includes('fusion-owner-delivery-v5')) {
        output = output.replace(/<body([^>]*)>/i, '<body$1><!-- fusion-owner-delivery-v5 -->');
      }

      // Server-side guarantee: put Delivery immediately before Service in the
      // actual Owner Menu regardless of small changes to button attributes.
      if (!/data-area=["']delivery["']/i.test(output)) {
        const serviceButton = /(<button\b[^>]*data-area=["']service["'][^>]*>\s*Service\s*<\/button>)/i;
        if (serviceButton.test(output)) {
          output = output.replace(
            serviceButton,
            '<button type="button" data-area="delivery" onclick="showOwnerArea(\'delivery\')">Delivery</button>\n$1'
          );
        }
      }

      // Server-side guarantee: create the matching owner page beside Service.
      if (!/id=["']page-delivery["']/i.test(output)) {
        const servicePage = /(<div\b[^>]*id=["']page-service["'][^>]*>\s*<\/div>)/i;
        if (servicePage.test(output)) {
          output = output.replace(
            servicePage,
            '<div id="page-delivery" class="ownerPage hidden"></div>\n$1'
          );
        }
      }

      // Final browser-side guard. This runs after every legacy script and makes
      // Delivery self-healing even if an older script rebuilds the menu.
      const guard = `
<script id="fusion-owner-delivery-v5-script">
(function(){
  var retryTimer=null;
  var retryCount=0;

  function page(){
    var p=document.getElementById('page-delivery');
    if(p) return p;
    var servicePage=document.getElementById('page-service');
    if(servicePage && servicePage.parentElement){
      p=document.createElement('div');
      p.id='page-delivery';
      p.className='ownerPage hidden';
      servicePage.parentElement.insertBefore(p,servicePage);
    }
    return p;
  }

  function renderDelivery(){
    var p=page();
    if(typeof window.refreshDeliveryManagement==='function'){
      retryCount=0;
      if(retryTimer){ clearTimeout(retryTimer); retryTimer=null; }
      Promise.resolve(window.refreshDeliveryManagement()).catch(function(err){
        if(p) p.innerHTML='<h2>Delivery</h2><div class="notice">Could not load Delivery Management: '+String(err&&err.message||err)+'</div>';
      });
      return;
    }
    if(p && retryCount===0) p.innerHTML='<h2>Delivery</h2><p class="muted">Loading delivery management…</p>';
    if(retryCount<40){
      retryCount++;
      retryTimer=setTimeout(renderDelivery,150);
    } else if(p) {
      p.innerHTML='<h2>Delivery</h2><div class="notice">Delivery Management did not finish loading. Refresh once and try again.</div>';
    }
  }

  function openDelivery(ev){
    if(ev){
      try{ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); }catch(e){}
    }

    try{
      if(typeof OWNER_AREAS!=='undefined') OWNER_AREAS.delivery=[['delivery','Delivery']];
    }catch(e){}

    document.querySelectorAll('.ownerPage').forEach(function(el){ el.classList.add('hidden'); });
    var p=page();
    if(p) p.classList.remove('hidden');

    var menu=document.getElementById('ownerNavMenu');
    if(menu){
      menu.querySelectorAll('[data-area]').forEach(function(b){
        b.classList.toggle('active',b.getAttribute('data-area')==='delivery');
      });
      menu.classList.add('hidden');
    }

    var current=document.getElementById('ownerNavCurrent');
    if(current) current.textContent='Delivery';

    try{ if(typeof activeTab!=='undefined') activeTab='delivery'; }catch(e){}
    renderDelivery();
    try{ window.scrollTo(0,0); }catch(e){}
  }

  function ensure(){
    try{
      if(typeof OWNER_AREAS!=='undefined') OWNER_AREAS.delivery=[['delivery','Delivery']];
    }catch(e){}

    var menu=document.getElementById('ownerNavMenu');
    var service=(menu && menu.querySelector('[data-area="service"]')) || document.querySelector('button[data-area="service"]');
    var parent=menu || (service && service.parentElement);
    if(!parent) return false;

    var btn=parent.querySelector('[data-area="delivery"]');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.setAttribute('data-area','delivery');
      btn.textContent='Delivery';
      if(service) parent.insertBefore(btn,service);
      else parent.appendChild(btn);
    }

    btn.type='button';
    btn.textContent='Delivery';
    btn.onclick=openDelivery;
    if(!btn.__fusionDeliveryCapture){
      btn.addEventListener('click',openDelivery,true);
      btn.__fusionDeliveryCapture=true;
    }
    page();
    return true;
  }

  window.__fusionOwnerDeliveryV5=true;
  window.__fusionOpenDelivery=openDelivery;

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',ensure,{once:true});
  }else{
    ensure();
  }

  [50,200,500,1000,2000,4000].forEach(function(ms){ setTimeout(ensure,ms); });
})();
</script>`;

      if (!output.includes('fusion-owner-delivery-v5-script')) {
        output = output.replace(/<\/body>/i, guard + '\n</body>');
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Fusion-Owner-Build', 'delivery-v5');
      body = output;
    }

    return originalSend(body);
  };

  return app(req, res);
};
