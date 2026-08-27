/* Fusion Flavours application bootstrap
   Keeps top-level navigation and startup in one place.
   Owner routing lives in owner-router.js; feature modules own their own screens and styles.
*/
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const TOP_LEVEL = ['welcomeHub', 'customer', 'retailCustomer', 'owner', 'cateringCustomer', 'harnellCustomer', 'legalCustomer'];
  let installed = false;

  function hideTopViews() {
    TOP_LEVEL.forEach(id => $(id)?.classList.add('hidden'));
  }

  function closeMenus() {
    $('headerMenu')?.classList.add('hidden');
    $('ownerNavMenu')?.classList.add('hidden');
  }

  function showWelcome(updateUrl = true) {
    hideTopViews();
    closeMenus();
    $('welcomeHub')?.classList.remove('hidden');
    if (updateUrl) {
      try { history.pushState({ view: 'home' }, '', '/'); } catch (_) {}
    }
    try { if (typeof window.renderWelcomeHub === 'function') window.renderWelcomeHub(); } catch (error) { console.error(error); }
    try { window.scrollTo(0, 0); } catch (_) {}
  }

  function showOwner(updateUrl = true) {
    hideTopViews();
    closeMenus();
    $('owner')?.classList.remove('hidden');
    window.FusionOwnerRouter?.ensureStructure();

    if (updateUrl) {
      try { history.pushState({ view: 'owner' }, '', '/owner'); } catch (_) {}
    }

    const auth = $('authPanel');
    const dashboard = $('dashboard');
    try {
      if (typeof window.token !== 'undefined' && window.token && typeof window.openOwner === 'function') {
        window.openOwner();
      } else {
        auth?.classList.remove('hidden');
        dashboard?.classList.add('hidden');
      }
    } catch (_) {
      auth?.classList.remove('hidden');
      dashboard?.classList.add('hidden');
    }
    try { window.scrollTo(0, 0); } catch (_) {}
  }

  function showHarnell(updateUrl = true) {
    hideTopViews();
    closeMenus();
    $('harnellCustomer')?.classList.remove('hidden');
    if (updateUrl) {
      try { history.pushState({ view: 'harnell' }, '', '/?view=harnell'); } catch (_) {}
    }

    const load = window.FusionHarnellPublic?.load || window.loadHarnellPublic;
    const render = window.FusionHarnellPublic?.render || window.renderHarnellCustomer;
    if (typeof load === 'function') {
      Promise.resolve(load())
        .then(() => { if (typeof render === 'function') render(); })
        .catch(error => alert('Could not load Harnell menu: ' + (error?.message || error)));
    }
  }

  function installCateringBridge() {
    window.__fusionGetCateringPackages = () => {
      try { return typeof window.cateringPackages !== 'undefined' ? window.cateringPackages : []; } catch (_) { return []; }
    };
    window.__fusionGetOwnerData = () => {
      try { return typeof window.ownerData !== 'undefined' ? window.ownerData : null; } catch (_) { return null; }
    };
    window.__fusionCateringOrderFoodCost = order => {
      try { return typeof window.cateringOrderFoodCost === 'function' ? window.cateringOrderFoodCost(order) : 0; } catch (_) { return 0; }
    };
    window.__fusionCateringSuggestedTotal = () => {
      try { return typeof window.cateringSuggestedTotal === 'function' ? window.cateringSuggestedTotal() : 0; } catch (_) { return 0; }
    };
    window.__fusionSaveCateringBooking = id => {
      try { return typeof window.saveCateringBooking === 'function' ? window.saveCateringBooking(id) : Promise.resolve(); } catch (error) { return Promise.reject(error); }
    };
  }

  function installNavigation() {
    document.addEventListener('click', event => {
      const ownerEntry = event.target?.closest?.('#ownerEntry,#ownerDirectEntry');
      if (ownerEntry) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showOwner(true);
        return;
      }

      const customerButton = event.target?.closest?.('#customerBtn');
      if (customerButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showWelcome(true);
        return;
      }

      const orderButton = event.target?.closest?.('#orderBtn');
      if (orderButton) {
        const phone = $('phone');
        if (phone && !String(phone.value || '').trim()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          alert('Please enter a contact phone number.');
          try { phone.focus(); } catch (_) {}
        }
      }
    }, true);

    window.addEventListener('popstate', () => {
      if (location.pathname === '/owner') showOwner(false);
      else if (new URLSearchParams(location.search).get('view') === 'harnell') showHarnell(false);
      else showWelcome(false);
    });
  }

  function boot() {
    if (installed) return;
    installed = true;

    installCateringBridge();
    window.FusionHarnellPublic?.install();
    window.FusionOwnerRouter?.install();
    installNavigation();

    const mode = String(window.__FUSION_BOOT_MODE__ || '').toLowerCase();
    if (mode === 'owner' || location.pathname === '/owner') showOwner(false);
    else if (new URLSearchParams(location.search).get('view') === 'harnell') showHarnell(false);
    else showWelcome(false);
  }

  window.FusionApp = { boot, showWelcome, showOwner, showHarnell };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
