/* Fusion Flavours application bootstrap
   One top-level router owns Home, Delivery, Fusion at Home, Catering, Community Meals, Legal and Owner.
   Owner section routing lives in owner-router.js; feature modules own their own screens.
*/
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const TOP_LEVEL = ['welcomeHub', 'customer', 'retailCustomer', 'owner', 'cateringCustomer', 'harnellCustomer', 'legalCustomer'];
  const KNOWN_VIEWS = new Set(['home','delivery','fusionhome','catering','harnell','legal','owner']);
  let installed = false;

  function hideTopViews() { TOP_LEVEL.forEach(id => $(id)?.classList.add('hidden')); }
  function closeMenus() { $('headerMenu')?.classList.add('hidden'); $('ownerNavMenu')?.classList.add('hidden'); }
  function scrollTop() { try { window.scrollTo(0, 0); } catch (_) {} }

  function pushView(view, extra = {}) {
    try {
      if (view === 'owner') {
        history.pushState({ view }, '', '/owner');
        return;
      }
      const url = new URL(location.origin + '/');
      if (view !== 'home') url.searchParams.set('view', view);
      Object.entries(extra).forEach(([key, value]) => {
        if (value != null && value !== '') url.searchParams.set(key, value);
      });
      history.pushState({ view }, '', url.pathname + url.search);
    } catch (_) {}
  }

  function showWelcome(updateUrl = true) {
    hideTopViews(); closeMenus();
    $('welcomeHub')?.classList.remove('hidden');
    if (updateUrl) pushView('home');
    try { window.renderWelcomeHub?.(); } catch (error) { console.error(error); }
    scrollTop();
  }

  function showDelivery(updateUrl = true) {
    hideTopViews(); closeMenus();
    $('customer')?.classList.remove('hidden');
    if (updateUrl) pushView('delivery');
    try { window.renderCustomer?.(); } catch (error) { console.error(error); }
    scrollTop();
  }

  async function showRetail(updateUrl = true) {
    hideTopViews(); closeMenus();
    $('retailCustomer')?.classList.remove('hidden');
    if (updateUrl) pushView('fusionhome');
    try { if (typeof window.loadRetailShop === 'function') await window.loadRetailShop(); } catch (error) { console.error(error); }
    scrollTop();
  }

  function showCatering(updateUrl = true) {
    hideTopViews(); closeMenus();
    $('cateringCustomer')?.classList.remove('hidden');
    if (updateUrl) pushView('catering');
    try { window.renderCateringCustomer?.(); } catch (error) { console.error(error); }
    scrollTop();
  }

  function showLegal(page = 'terms', updateUrl = true) {
    hideTopViews(); closeMenus();
    $('legalCustomer')?.classList.remove('hidden');
    if (updateUrl) pushView('legal', { page });
    try { window.renderLegalCustomer?.(page); } catch (error) { console.error(error); }
    scrollTop();
  }

  function showOwner(updateUrl = true) {
    hideTopViews(); closeMenus();
    $('owner')?.classList.remove('hidden');
    window.FusionOwnerRouter?.ensureStructure();
    if (updateUrl) pushView('owner');

    const auth = $('authPanel');
    const dashboard = $('dashboard');
    try {
      if (window.token && typeof window.openOwner === 'function') window.openOwner();
      else { auth?.classList.remove('hidden'); dashboard?.classList.add('hidden'); }
    } catch (_) {
      auth?.classList.remove('hidden'); dashboard?.classList.add('hidden');
    }
    scrollTop();
  }

  async function showHarnell(updateUrl = true) {
    hideTopViews(); closeMenus();
    $('harnellCustomer')?.classList.remove('hidden');
    if (updateUrl) pushView('harnell');
    try {
      const load = window.FusionHarnellPublic?.load || window.loadHarnellPublic;
      const render = window.FusionHarnellPublic?.render || window.renderHarnellCustomer;
      if (typeof load === 'function') await load();
      if (typeof render === 'function') render();
    } catch (error) {
      alert('Could not load Community Meals: ' + (error?.message || error));
    }
    scrollTop();
  }

  function currentView() {
    if (location.pathname === '/owner') return { view: 'owner', page: null };
    const params = new URLSearchParams(location.search);
    const raw = String(params.get('view') || 'home').toLowerCase();
    return { view: KNOWN_VIEWS.has(raw) ? raw : 'home', page: params.get('page') || 'terms' };
  }

  function routeFromLocation() {
    const { view, page } = currentView();
    if (view === 'owner') return showOwner(false);
    if (view === 'delivery') return showDelivery(false);
    if (view === 'fusionhome') return showRetail(false);
    if (view === 'catering') return showCatering(false);
    if (view === 'harnell') return showHarnell(false);
    if (view === 'legal') return showLegal(page, false);
    return showWelcome(false);
  }

  function route(view, extra = {}) {
    view = String(view || 'home').toLowerCase();
    if (!KNOWN_VIEWS.has(view)) view = 'home';
    if (view === 'owner') return showOwner(true);
    if (view === 'delivery') return showDelivery(true);
    if (view === 'fusionhome') return showRetail(true);
    if (view === 'catering') return showCatering(true);
    if (view === 'harnell') return showHarnell(true);
    if (view === 'legal') return showLegal(extra.page || 'terms', true);
    return showWelcome(true);
  }

  function installCateringBridge() {
    window.__fusionGetCateringPackages = () => {
      try { return typeof cateringPackages !== 'undefined' && Array.isArray(cateringPackages) ? cateringPackages : []; }
      catch (_) { return []; }
    };
    window.__fusionGetOwnerData = () => { try { return window.ownerData || null; } catch (_) { return null; } };
    window.__fusionCateringOrderFoodCost = order => { try { return window.cateringOrderFoodCost?.(order) || 0; } catch (_) { return 0; } };
    window.__fusionCateringSuggestedTotal = () => { try { return window.cateringSuggestedTotal?.() || 0; } catch (_) { return 0; } };
    window.__fusionSaveCateringBooking = id => { try { return window.saveCateringBooking?.(id) || Promise.resolve(); } catch (error) { return Promise.reject(error); } };
  }

  function installNavigation() {
    document.addEventListener('click', event => {
      const ownerEntry = event.target?.closest?.('#ownerEntry,#ownerDirectEntry');
      if (ownerEntry) {
        event.preventDefault(); event.stopImmediatePropagation(); showOwner(true); return;
      }

      const customerButton = event.target?.closest?.('#customerBtn');
      if (customerButton) {
        event.preventDefault(); event.stopImmediatePropagation(); showWelcome(true); return;
      }

      const routeLink = event.target?.closest?.('a[href]');
      if (routeLink && !routeLink.target && !routeLink.hasAttribute('download')) {
        try {
          const url = new URL(routeLink.href, location.href);
          const view = String(url.searchParams.get('view') || '').toLowerCase();
          if (url.origin === location.origin && KNOWN_VIEWS.has(view)) {
            event.preventDefault();
            route(view, { page: url.searchParams.get('page') || undefined });
            return;
          }
        } catch (_) {}
      }

      const orderButton = event.target?.closest?.('#orderBtn');
      if (orderButton) {
        const phone = $('phone');
        if (phone && !String(phone.value || '').trim()) {
          event.preventDefault(); event.stopImmediatePropagation();
          alert('Please enter a contact phone number.');
          try { phone.focus(); } catch (_) {}
        }
      }
    }, true);

    window.addEventListener('popstate', routeFromLocation);
  }

  function installCompatibilityApi() {
    // Old index callers now resolve to this one router rather than their historical wrapper chain.
    window.routeCustomerView = routeFromLocation;
    window.goCustomerHomeV383 = (push = true) => showWelcome(push);
    window.hideTopLevelViewsV383 = hideTopViews;
  }

  function boot() {
    if (installed) return;
    installed = true;
    installCateringBridge();
    window.FusionHarnellPublic?.install();
    window.FusionOwnerRouter?.install();
    installCompatibilityApi();
    installNavigation();
    routeFromLocation();
  }

  window.FusionApp = {
    boot, route, routeFromLocation,
    showWelcome, showDelivery, showRetail, showCatering, showHarnell, showLegal, showOwner
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
