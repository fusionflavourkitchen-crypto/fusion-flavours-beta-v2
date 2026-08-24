const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    let html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    const openOwner = String(req.query && req.query.mode || '') === 'owner';

    /* Do not use #ownerEntry here. The legacy app contains several different
       scripts that keep overwriting that element's onclick handler. Replace
       the control with a normal link using a new id so none of those old
       handlers can touch it. */
    html = html.replace(
      '<button id="ownerEntry">⚙ Owner Dashboard</button>',
      '<a id="ownerDirectLink" href="/api/app?mode=owner" style="display:block;padding:10px 12px;color:#f4efe9;text-decoration:none;font-weight:800">⚙ Owner Dashboard</a>'
    );

    const navFix = `
<script>
(function(){
  function byId(id){ return document.getElementById(id); }
  function hideTop(){
    ['welcomeHub','customer','retailCustomer','cateringCustomer','harnellCustomer','legalCustomer','owner'].forEach(function(id){
      var el=byId(id); if(el) el.classList.add('hidden');
    });
  }
  function showWelcome(){
    hideTop();
    var w=byId('welcomeHub'); if(w) w.classList.remove('hidden');
    var hm=byId('headerMenu'); if(hm) hm.classList.add('hidden');
    try{ if(typeof renderWelcomeHub==='function') renderWelcomeHub(); }catch(e){}
    window.scrollTo(0,0);
  }
  function showOwner(){
    hideTop();
    var hm=byId('headerMenu'); if(hm) hm.classList.add('hidden');
    var owner=byId('owner'); if(owner) owner.classList.remove('hidden');
    var auth=byId('authPanel');
    var dash=byId('dashboard');
    try{
      if(typeof token!=='undefined' && token && typeof openOwner==='function') openOwner();
      else {
        if(auth) auth.classList.remove('hidden');
        if(dash) dash.classList.add('hidden');
      }
    }catch(e){
      if(auth) auth.classList.remove('hidden');
      if(dash) dash.classList.add('hidden');
    }
    /* Remove the owner route immediately. A browser refresh therefore loads
       the normal / route and returns a customer to Welcome. */
    try{ history.replaceState({},'', '/'); }catch(e){}
    window.scrollTo(0,0);
  }

  /* Customer View must always return to Welcome. Capture phase prevents the
     legacy customerBtn handlers from sending the user to a blank section. */
  document.addEventListener('click',function(e){
    var t=e.target && e.target.closest ? e.target.closest('#customerBtn') : null;
    if(!t) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showWelcome();
  },true);

  if(${openOwner ? 'true' : 'false'}) showOwner();
  else showWelcome();
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
