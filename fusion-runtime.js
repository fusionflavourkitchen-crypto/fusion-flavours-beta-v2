/* Fusion Flavours - authoritative runtime
   One bootstrap owns top-level routing and Owner navigation.
   Existing index.html business features stay intact; old routing overrides no longer decide which screen is visible.
*/
(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const TOP_LEVEL = ['welcomeHub','customer','retailCustomer','owner','cateringCustomer','harnellCustomer','legalCustomer'];
  const OWNER_LABELS = {
    dashboard:'Dashboard', orders:'Orders', kitchen:'Kitchen', business:'Business', catering:'Catering',
    harnell:'Harnell', fusionhome:'Fusion at Home', delivery:'Delivery', service:'Service'
  };
  let harnellCategoryNames = {};
  let legacyShowOwnerArea = null;

  function hideTopViews(){
    TOP_LEVEL.forEach(id => byId(id)?.classList.add('hidden'));
  }
  function closeHeaderMenu(){ byId('headerMenu')?.classList.add('hidden'); }
  function closeOwnerMenu(){ byId('ownerNavMenu')?.classList.add('hidden'); }
  function setOwnerCurrent(area){
    const current = byId('ownerNavCurrent');
    if(current) current.textContent = OWNER_LABELS[area] || area || 'Dashboard';
    document.querySelectorAll('#ownerNavMenu [data-area]').forEach(btn => btn.classList.toggle('active', btn.dataset.area === area));
  }

  function ensureOwnerStructure(){
    const menu = byId('ownerNavMenu');
    if(menu && !menu.querySelector('[data-area="delivery"]')){
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.area = 'delivery';
      button.textContent = 'Delivery';
      const service = menu.querySelector('[data-area="service"]');
      if(service) menu.insertBefore(button, service); else menu.appendChild(button);
    }

    if(!byId('page-delivery')){
      const anchor = byId('page-service') || document.querySelector('#dashboard .ownerPage:last-of-type') || document.querySelector('.ownerPage');
      if(anchor?.parentElement){
        const page = document.createElement('div');
        page.id = 'page-delivery';
        page.className = 'ownerPage hidden';
        anchor.parentElement.insertBefore(page, anchor);
      }
    }
  }

  function hideOwnerPages(){
    document.querySelectorAll('#dashboard .ownerPage').forEach(el => el.classList.add('hidden'));
  }

  async function openDelivery(){
    ensureOwnerStructure();
    hideOwnerPages();
    const page = byId('page-delivery');
    if(page){
      page.classList.remove('hidden');
      if(!page.innerHTML.trim()) page.innerHTML = '<h2>Delivery</h2><p class="muted">Loading delivery management…</p>';
    }
    setOwnerCurrent('delivery');
    closeOwnerMenu();
    try { window.activeTab = 'delivery'; } catch(_) {}

    let tries = 0;
    const render = () => {
      tries++;
      if(typeof window.refreshDeliveryManagement === 'function'){
        Promise.resolve(window.refreshDeliveryManagement()).catch(err => {
          if(page) page.innerHTML = '<h2>Delivery</h2><div class="notice">Could not load Delivery: '+String(err?.message||err)+'</div>';
        });
        return;
      }
      if(tries < 40) return setTimeout(render, 125);
      if(page) page.innerHTML = '<h2>Delivery</h2><div class="notice">Delivery management did not load. Refresh the app once and try again.</div>';
    };
    render();
  }

  function openOwnerArea(area){
    area = String(area || 'dashboard').toLowerCase();
    ensureOwnerStructure();
    if(area === 'delivery') return openDelivery();

    setOwnerCurrent(area);
    closeOwnerMenu();
    try {
      if(typeof legacyShowOwnerArea === 'function') return legacyShowOwnerArea(area);
      if(typeof window.showTab === 'function') return window.showTab(area);
    } catch(err){
      console.warn('Owner area failed', area, err);
    }
  }

  function showWelcome(updateUrl = true){
    hideTopViews(); closeHeaderMenu();
    byId('welcomeHub')?.classList.remove('hidden');
    if(updateUrl){ try { history.pushState({view:'home'}, '', '/'); } catch(_) {} }
    try { if(typeof renderWelcomeHub === 'function') renderWelcomeHub(); } catch(_) {}
    try { window.scrollTo(0,0); } catch(_) {}
  }

  function showOwner(updateUrl = true){
    hideTopViews(); closeHeaderMenu(); ensureOwnerStructure();
    byId('owner')?.classList.remove('hidden');
    if(updateUrl){ try { history.pushState({view:'owner'}, '', '/owner'); } catch(_) {} }

    const auth = byId('authPanel'), dash = byId('dashboard');
    try {
      if(typeof token !== 'undefined' && token && typeof openOwner === 'function') openOwner();
      else { auth?.classList.remove('hidden'); dash?.classList.add('hidden'); }
    } catch(_) { auth?.classList.remove('hidden'); dash?.classList.add('hidden'); }
    try { window.scrollTo(0,0); } catch(_) {}
  }

  function showHarnell(updateUrl = true){
    hideTopViews(); closeHeaderMenu();
    byId('harnellCustomer')?.classList.remove('hidden');
    if(updateUrl){ try { history.pushState({view:'harnell'}, '', '/?view=harnell'); } catch(_) {} }
    if(typeof loadHarnellPublic === 'function'){
      Promise.resolve(loadHarnellPublic())
        .then(() => { if(typeof renderHarnellCustomer === 'function') renderHarnellCustomer(); })
        .catch(err => alert('Could not load Harnell menu: ' + (err?.message || err)));
    }
  }

  function harnellGroupFor(row){
    const itemName = String(row?.resident_name || row?.items?.name || '').toLowerCase();
    if(/rubicon|coke|cola|sprite|fanta|water|juice|drink|lemonade/.test(itemName)) return 'drinks';
    if(/tiramisu|cake|brownie|dessert|baklava|sweet|pudding|cookie|cheesecake/.test(itemName)) return 'desserts';
    const sortOrder = Number(row?.sort_order || 0);
    if(sortOrder >= 4000) return 'drinks';
    if(sortOrder >= 3000) return 'desserts';
    if(sortOrder >= 2000) return 'sides';
    if(sortOrder >= 1000) return 'mains';
    const categoryId = Number(row?.items?.category_id || 0);
    const category = String(harnellCategoryNames[categoryId] || '').trim().toLowerCase();
    if(category.includes('drink')) return 'drinks';
    if(category.includes('dessert') || category.includes('sweet')) return 'desserts';
    if(category.includes('side') || category.includes('sauce')) return 'sides';
    if(/tzatziki|ezme|sauce|dip|rice|fries|pita|pitta|bread|salad/.test(itemName)) return 'sides';
    return 'mains';
  }

  function harnellDishCard(row){
    const soldOut = Number(row?.items?.stock || 0) <= 0;
    const canOrder = (typeof harnellOpen === 'function' ? harnellOpen() : true) && !soldOut;
    const displayName = typeof harnellDisplayName === 'function' ? harnellDisplayName(row) : (row.resident_name || row?.items?.name || 'Dish');
    const displayDescription = typeof harnellDisplayDescription === 'function' ? harnellDisplayDescription(row) : (row.resident_description || row?.items?.description || '');
    const image = row?.items?.image_url;
    const safe = typeof esc === 'function' ? esc : (v => String(v ?? ''));
    const fmtMoney = typeof money === 'function' ? money : (v => '£' + Number(v || 0).toFixed(2));
    return '<article class="harnellDish">' +
      (image ? '<img class="recipeThumb" src="' + safe(image) + '" alt="' + safe(displayName) + '">' : '') +
      '<span class="harnellVariantBadge">HARNELL</span><h3>' + safe(displayName) + '</h3><p class="muted">' + safe(displayDescription) + '</p>' +
      '<div class="row"><span class="harnellPrice">' + fmtMoney(Number(row.resident_price_pence || 0) / 100) + '</span><button ' + (!canOrder ? 'disabled' : '') +
      ' onclick="addHarnellItem(' + Number(row.item_id) + ')">' + (soldOut ? 'Sold out' : 'Add') + '</button></div></article>';
  }

  function installHarnellPresentation(){
    if(typeof api !== 'function') return;
    window.loadHarnellPublic = async function(){
      const [settings, rows, categories] = await Promise.all([
        api('/rest/v1/settings?id=eq.1&select=*').then(x => x[0]),
        api('/rest/v1/harnell_menu_items?active=eq.true&select=*,items(id,name,description,image_url,active,stock,category_id)&order=sort_order.asc,id.asc'),
        api('/rest/v1/categories?select=id,name')
      ]);
      state.settings = settings;
      harnellMenuRows = (rows || []).filter(x => x.items && x.items.active !== false);
      harnellCategoryNames = {};
      (categories || []).forEach(c => { harnellCategoryNames[Number(c.id)] = String(c.name || ''); });
    };
    window.renderHarnellCustomer = function(){
      const s = state.settings || {};
      if(byId('harnellTitle')) byId('harnellTitle').textContent = s.harnell_title || 'Harnell House Menu';
      if(byId('harnellSubtitle')) byId('harnellSubtitle').textContent = s.harnell_subtitle || 'Simple, affordable meals for residents';
      const start = String(s.harnell_delivery_start || '18:00').slice(0,5), end = String(s.harnell_delivery_end || '20:00').slice(0,5);
      if(byId('harnellStatus')) byId('harnellStatus').innerHTML = (harnellOpen() ? '<b>🟢 Resident ordering open</b> · Order by ' : '<b>🔴 Resident ordering closed</b> · Cutoff ') + String(s.harnell_cutoff_time || '15:00').slice(0,5) + '<br><b>🚪 Delivery window:</b> ' + start + '–' + end;
      const groups = [['mains','Mains'],['sides','Sides'],['drinks','Drinks'],['desserts','Desserts']];
      const menu = byId('harnellMenu'); if(!menu) return;
      menu.className = '';
      menu.innerHTML = groups.map(([key,label]) => {
        const rows = (harnellMenuRows || []).filter(r => harnellGroupFor(r) === key);
        return '<section class="harnellSection" data-harnell-section="' + key + '"><h2 class="harnellSectionTitle">' + label + '</h2><div class="harnellMenuGrid">' +
          (rows.length ? rows.map(harnellDishCard).join('') : '<div class="harnellEmpty">No ' + label.toLowerCase() + ' added yet.</div>') + '</div></section>';
      }).join('');
      if(typeof renderHarnellBasket === 'function') renderHarnellBasket();
    };
  }

  function installCateringBridge(){
    window.__fusionGetCateringPackages = () => { try { return typeof cateringPackages !== 'undefined' ? cateringPackages : []; } catch(_) { return []; } };
    window.__fusionGetOwnerData = () => { try { return typeof ownerData !== 'undefined' ? ownerData : null; } catch(_) { return null; } };
    window.__fusionCateringOrderFoodCost = o => { try { return typeof cateringOrderFoodCost === 'function' ? cateringOrderFoodCost(o) : 0; } catch(_) { return 0; } };
    window.__fusionCateringSuggestedTotal = () => { try { return typeof cateringSuggestedTotal === 'function' ? cateringSuggestedTotal() : 0; } catch(_) { return 0; } };
    window.__fusionSaveCateringBooking = id => { try { return typeof saveCateringBooking === 'function' ? saveCateringBooking(id) : Promise.resolve(); } catch(e) { return Promise.reject(e); } };
  }

  function installNavigation(){
    if(!legacyShowOwnerArea && typeof window.showOwnerArea === 'function') legacyShowOwnerArea = window.showOwnerArea.bind(window);
    window.__fusionOpenOwnerArea = openOwnerArea;

    document.addEventListener('click', e => {
      const ownerEntry = e.target?.closest?.('#ownerEntry,#ownerDirectEntry');
      if(ownerEntry){ e.preventDefault(); e.stopImmediatePropagation(); showOwner(true); return; }

      const customerBtn = e.target?.closest?.('#customerBtn');
      if(customerBtn){ e.preventDefault(); e.stopImmediatePropagation(); showWelcome(true); return; }

      const ownerNav = e.target?.closest?.('#ownerNavMenu [data-area]');
      if(ownerNav){
        e.preventDefault(); e.stopImmediatePropagation();
        openOwnerArea(ownerNav.dataset.area);
        return;
      }

      const orderBtn = e.target?.closest?.('#orderBtn');
      if(orderBtn){
        const phone = byId('phone');
        if(phone && !String(phone.value || '').trim()){
          e.preventDefault(); e.stopImmediatePropagation(); alert('Please enter a contact phone number.');
          try { phone.focus(); } catch(_) {}
        }
      }
    }, true);

    window.addEventListener('popstate', () => {
      if(location.pathname === '/owner') showOwner(false);
      else if(new URLSearchParams(location.search).get('view') === 'harnell') showHarnell(false);
      else showWelcome(false);
    });
  }

  function injectRuntimeStyles(){
    if(byId('fusionRuntimeStyles')) return;
    const style = document.createElement('style'); style.id = 'fusionRuntimeStyles';
    style.textContent = '.harnellSection{margin:24px 0 12px}.harnellSectionTitle{margin:0 0 12px;padding:9px 2px 8px;border-bottom:4px solid var(--o);font-size:25px;font-weight:950}.harnellMenuGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:4px}.harnellEmpty{grid-column:1/-1;background:#fff8ef;border:1px dashed #d8c2ae;border-radius:14px;padding:14px;color:var(--muted);font-size:13px}#ownerNavMenu [data-area="delivery"]{font-weight:950}#ownerNavMenu button.active{background:#333!important;color:#fff!important}@media(max-width:760px){.harnellMenuGrid{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }

  function boot(){
    injectRuntimeStyles();
    ensureOwnerStructure();
    installCateringBridge();
    installHarnellPresentation();
    installNavigation();

    // Re-run structure checks after legacy index startup code has finished mutating the DOM.
    [50,250,750,1500].forEach(ms => setTimeout(ensureOwnerStructure, ms));

    const mode = String(window.__FUSION_BOOT_MODE__ || '').toLowerCase();
    if(mode === 'owner' || location.pathname === '/owner') showOwner(false);
    else if(new URLSearchParams(location.search).get('view') === 'harnell') showHarnell(false);
    else showWelcome(false);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
