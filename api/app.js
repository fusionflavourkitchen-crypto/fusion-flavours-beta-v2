module.exports = async function handler(req, res) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const sourceUrl = `${proto}://${host}/index.html?source=${Date.now()}`;
    const source = await fetch(sourceUrl, { cache: 'no-store' });
    if (!source.ok) throw new Error(`index.html returned ${source.status}`);
    let html = await source.text();

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

  // A browser load/refresh is always customer-safe and starts at Welcome.
  showWelcome();
  window.addEventListener('pageshow',function(e){ if(e.persisted) showWelcome(); });
})();
</script>`;

    html = html.replace(/<\/body>\s*<\/html>\s*$/i, navFix + '\n</body></html>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('<!doctype html><html><body><h2>Fusion Flavours</h2><p>The app could not load. Please refresh.</p></body></html>');
  }
};
