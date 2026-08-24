const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    const openOwner = String(req.query && req.query.mode || '') === 'owner';

    // Keep the original Owner Dashboard button in the page so the legacy app
    // does not lose #ownerEntry. A final capture-phase handler below becomes
    // the single authority for switching into and out of the owner view.
    const navFix = `
<script>
(function(){
  function byId(id){ return document.getElementById(id); }

  function hideTop(){
    ['welcomeHub','customer','retailCustomer','owner','cateringCustomer','harnellCustomer','legalCustomer'].forEach(function(id){
      var el=byId(id);
      if(el) el.classList.add('hidden');
    });
  }

  function showWelcome(updateUrl){
    hideTop();
    var w=byId('welcomeHub');
    if(w) w.classList.remove('hidden');
    var hm=byId('headerMenu');
    if(hm) hm.classList.add('hidden');
    if(updateUrl){
      try{ history.pushState({view:'home'},'',location.pathname); }catch(e){}
    }
    try{ if(typeof renderWelcomeHub==='function') renderWelcomeHub(); }catch(e){}
    window.scrollTo(0,0);
  }

  function showOwner(updateUrl){
    hideTop();
    var hm=byId('headerMenu');
    if(hm) hm.classList.add('hidden');
    var owner=byId('owner');
    if(owner) owner.classList.remove('hidden');

    if(updateUrl){
      try{
        var u=new URL(location.href);
        u.search='';
        u.searchParams.set('view','owner');
        history.pushState({view:'owner'},'',u);
      }catch(e){}
    }

    var auth=byId('authPanel');
    var dash=byId('dashboard');
    try{
      if(typeof token!=='undefined' && token && typeof openOwner==='function'){
        openOwner();
      }else{
        if(auth) auth.classList.remove('hidden');
        if(dash) dash.classList.add('hidden');
      }
    }catch(e){
      if(auth) auth.classList.remove('hidden');
      if(dash) dash.classList.add('hidden');
    }
    window.scrollTo(0,0);
  }

  // Capture the Owner click before any of the older click handlers can run.
  document.addEventListener('click',function(e){
    var t=e.target && e.target.closest ? e.target.closest('#ownerEntry') : null;
    if(!t) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showOwner(true);
  },true);

  // Customer View from inside the owner area returns to the welcome hub.
  document.addEventListener('click',function(e){
    var t=e.target && e.target.closest ? e.target.closest('#customerBtn') : null;
    if(!t) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showWelcome(true);
  },true);

  window.addEventListener('popstate',function(){
    var view=new URLSearchParams(location.search).get('view') || 'home';
    if(view==='owner') showOwner(false);
    else if(view==='home') showWelcome(false);
  });

  var initialView=new URLSearchParams(location.search).get('view') || '';
  if(${openOwner ? 'true' : 'false'} || initialView==='owner') showOwner(false);
  else showWelcome(false);
})();
</script>`;

    const output = html.replace(/<\/body>\s*<\/html>\s*$/i, navFix + '\n</body></html>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.status(200).send(output);
  } catch (err) {
    console.error('Fusion Flavours app wrapper:', err);
    res.status(500).send('<!doctype html><html><body><h2>Fusion Flavours</h2><p>The app could not load. Please refresh.</p></body></html>');
  }
};
