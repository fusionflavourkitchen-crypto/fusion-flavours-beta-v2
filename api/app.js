const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    if (req.method && !['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).send('Method Not Allowed');
    }
    let html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    const openOwner = String(req.query && req.query.mode || '') === 'owner';

    // Make the visible Owner Dashboard control a plain server route. This bypasses
    // all legacy client-side owner click handlers. Keep a hidden #ownerEntry in
    // the DOM so the old scripts that reference it do not throw errors.
    const legacyOwnerButton = '<button id="ownerEntry">⚙ Owner Dashboard</button>';
    const directOwnerLink = '<a id="ownerDirectEntry" href="/owner" style="display:block;width:100%;text-align:left;background:transparent;color:#222;padding:11px 14px;font-weight:850;text-decoration:none;border-radius:12px">⚙ Owner Dashboard</a><button id="ownerEntry" type="button" style="display:none!important" aria-hidden="true" tabindex="-1">⚙ Owner Dashboard</button>';
    if (html.includes(legacyOwnerButton)) {
      html = html.replace(legacyOwnerButton, directOwnerLink);
    }

    // Final navigation guard plus Harnell resident-menu grouping.
    const navFix = `
<style>
.harnellSection{margin:24px 0 12px}
.harnellSectionTitle{margin:0 0 12px;padding:9px 2px 8px;border-bottom:4px solid var(--o);font-size:25px;font-weight:950}
.harnellMenuGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:4px}
.harnellEmpty{grid-column:1/-1;background:#fff8ef;border:1px dashed #d8c2ae;border-radius:14px;padding:14px;color:var(--muted);font-size:13px}
@media(max-width:760px){.harnellMenuGrid{grid-template-columns:1fr}}
</style>
<script>
(function(){
  function byId(id){ return document.getElementById(id); }
  var harnellCategoryNames={};

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
      try{ history.pushState({view:'home'},'','/'); }catch(e){}
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

  function harnellGroupFor(row){
    var itemName=String((row&&row.resident_name)||(row&&row.items&&row.items.name)||'').toLowerCase();
    // Correct recognisable legacy products before reading old sort bands.
    if(/rubicon|coke|cola|sprite|fanta|water|juice|drink|lemonade/.test(itemName)) return 'drinks';
    if(/tiramisu|cake|brownie|dessert|baklava|sweet|pudding|cookie|cheesecake/.test(itemName)) return 'desserts';
    // Harnell categories are stored in sort_order bands so they remain
    // independent from the main delivery-menu category.
    var sortOrder=Number(row && row.sort_order || 0);
    if(sortOrder>=4000) return 'drinks';
    if(sortOrder>=3000) return 'desserts';
    if(sortOrder>=2000) return 'sides';
    if(sortOrder>=1000) return 'mains';
    var categoryId=Number(row && row.items && row.items.category_id || 0);
    var category=String(harnellCategoryNames[categoryId]||'').trim().toLowerCase();

    // Use the real live category name rather than hard-coded database IDs.
    // Specific category and product signals take priority over an inherited
    // main-menu category on older Harnell rows.
    if(category.includes('drink')) return 'drinks';
    if(category.includes('dessert') || category.includes('sweet')) return 'desserts';
    if(category.includes('side') || category.includes('sauce')) return 'sides';
    if(/tzatziki|ezme|sauce|dip|rice|fries|pita|pitta|bread|salad/.test(itemName)) return 'sides';
    if(category.includes('main') || category.includes('bowl') || category.includes('special')) return 'mains';
    return 'mains';
  }

  function harnellDishCard(r){
    var soldOut=Number(r.items && r.items.stock || 0)<=0;
    var canOrder=(typeof harnellOpen==='function' ? harnellOpen() : true) && !soldOut;
    var displayName=(typeof harnellDisplayName==='function') ? harnellDisplayName(r) : (r.resident_name || (r.items&&r.items.name) || 'Dish');
    var displayDescription=(typeof harnellDisplayDescription==='function') ? harnellDisplayDescription(r) : (r.resident_description || (r.items&&r.items.description) || '');
    var image=r.items&&r.items.image_url;
    return '<article class="harnellDish">'+
      (image?'<img class="recipeThumb" src="'+esc(image)+'" alt="'+esc(displayName)+'">':'')+
      '<span class="harnellVariantBadge">HARNELL</span>'+
      '<h3>'+esc(displayName)+'</h3><p class="muted">'+esc(displayDescription)+'</p>'+
      '<div class="row"><span class="harnellPrice">'+money(Number(r.resident_price_pence||0)/100)+'</span><button '+(!canOrder?'disabled':'')+' onclick="addHarnellItem('+r.item_id+')">'+(soldOut?'Sold out':'Add')+'</button></div></article>';
  }

  function installHarnellGrouping(){
    if(typeof api!=='function') return;

    window.loadHarnellPublic = async function(){
      const results=await Promise.all([
        api('/rest/v1/settings?id=eq.1&select=*').then(function(x){return x[0]}),
        api('/rest/v1/harnell_menu_items?active=eq.true&select=*,items(id,name,description,image_url,active,stock,category_id)&order=sort_order.asc,id.asc'),
        api('/rest/v1/categories?select=id,name')
      ]);
      state.settings=results[0];
      harnellMenuRows=(results[1]||[]).filter(function(x){return x.items && x.items.active!==false});
      harnellCategoryNames={};
      (results[2]||[]).forEach(function(c){harnellCategoryNames[Number(c.id)]=String(c.name||'')});
    };

    window.renderHarnellCustomer = function(){
      var s=state.settings||{};
      byId('harnellTitle').textContent=s.harnell_title||'Harnell House Menu';
      byId('harnellSubtitle').textContent=s.harnell_subtitle||'Simple, affordable meals for residents';
      var hWindow=String(s.harnell_delivery_start||'18:00').slice(0,5)+'–'+String(s.harnell_delivery_end||'20:00').slice(0,5);
      byId('harnellStatus').innerHTML=(harnellOpen()?'<b>🟢 Resident ordering open</b> · Order by '+String(s.harnell_cutoff_time||'15:00').slice(0,5):'<b>🔴 Resident ordering closed</b> · Cutoff '+String(s.harnell_cutoff_time||'15:00').slice(0,5))+'<br><b>🚪 Delivery window:</b> '+esc(hWindow);

      var groups=[
        ['mains','Mains'],
        ['sides','Sides'],
        ['drinks','Drinks'],
        ['desserts','Desserts']
      ];
      var menu=byId('harnellMenu');
      menu.className='';
      menu.innerHTML=groups.map(function(group){
        var key=group[0], label=group[1];
        var rows=(harnellMenuRows||[]).filter(function(r){return harnellGroupFor(r)===key});
        return '<section class="harnellSection" data-harnell-section="'+key+'"><h2 class="harnellSectionTitle">'+label+'</h2><div class="harnellMenuGrid">'+
          (rows.length?rows.map(harnellDishCard).join(''):'<div class="harnellEmpty">No '+label.toLowerCase()+' added yet.</div>')+
          '</div></section>';
      }).join('');
      if(typeof renderHarnellBasket==='function') renderHarnellBasket();
    };
  }

  installHarnellGrouping();

  // Fallback for any legacy #ownerEntry activation.
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
  else if(initialView==='harnell'){
    hideTop();
    var h=byId('harnellCustomer');
    if(h) h.classList.remove('hidden');
    Promise.resolve(loadHarnellPublic()).then(renderHarnellCustomer).catch(function(e){alert('Could not load Harnell menu: '+e.message)});
  }
  else showWelcome(false);
})();
</script>`;

    const output = html.replace(/<\/body>\s*<\/html>\s*$/i, navFix + '\n</body></html>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.status(200).send(output);
  } catch (err) {
    console.error('Fusion Flavours app wrapper:', err);
    res.status(500).send('<!doctype html><html><body><h2>Fusion Flavours</h2><p>The app could not load. Please refresh.</p></body></html>');
  }
};
