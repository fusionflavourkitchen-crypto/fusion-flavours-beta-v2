const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    let html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

    const navFix = `
<script>
(function(){
  function byId(id){ return document.getElementById(id); }
  function hideTop(){
    ['welcomeHub','customer','retailCustomer','cateringCustomer','harnellCustomer','legalCustomer','owner'].forEach(function(id){
      var el=byId(id); if(el) el.classList.add('hidden');
    });
  }
  function cleanViewFromUrl(){
    try{
      var u=new URL(location.href);
      u.searchParams.delete('view');
      history.replaceState({},'',u.pathname+(u.searchParams.toString()?'?'+u.searchParams.toString():'')+u.hash);
    }catch(e){}
  }
  function showWelcome(){
    hideTop();
    var w=byId('welcomeHub'); if(w) w.classList.remove('hidden');
    var hm=byId('headerMenu'); if(hm) hm.classList.add('hidden');
    cleanViewFromUrl();
    try{ if(typeof renderWelcomeHub==='function') renderWelcomeHub(); }catch(e){ console.error('Welcome render',e); }
    window.scrollTo(0,0);
  }
  function showOwner(){
    hideTop();
    var hm=byId('headerMenu'); if(hm) hm.classList.add('hidden');
    var owner=byId('owner'); if(owner) owner.classList.remove('hidden');
    cleanViewFromUrl();
    try{
      if(typeof token!=='undefined' && token && typeof openOwner==='function'){
        openOwner();
      }else{
        var auth=byId('authPanel'); if(auth) auth.classList.remove('hidden');
        var dash=byId('dashboard'); if(dash) dash.classList.add('hidden');
      }
    }catch(e){ console.error('Owner open',e); }
    window.scrollTo(0,0);
  }

  document.addEventListener('click',function(e){
    var t=e.target && e.target.closest ? e.target : null;
    if(!t) return;
    if(t.closest('#ownerEntry')){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showOwner();
      return false;
    }
    if(t.closest('#customerBtn')){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showWelcome();
      return false;
    }
  },true);

  // Every fresh load or browser refresh starts at the customer Welcome page.
  showWelcome();
  window.addEventListener('pageshow',function(e){ if(e.persisted) showWelcome(); });
})();
</script>`;

    html = html.replace(/<\/body>\s*<\/html>\s*$/i, navFix + '\n</body></html>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).send(html);
  } catch (err) {
    console.error('Fusion Flavours app wrapper:', err);
    res.status(500).send('<!doctype html><html><body><h2>Fusion Flavours</h2><p>The app could not load. Please refresh.</p></body></html>');
  }
};
