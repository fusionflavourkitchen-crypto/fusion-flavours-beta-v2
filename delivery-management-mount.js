/* Fusion Flavours - Delivery Management mount guard */
(() => {
  'use strict';

  const MOUNT_VERSION = '2026-08-27.2';
  if (window.__fusionDeliveryMountGuardLoaded === MOUNT_VERSION) return;
  window.__fusionDeliveryMountGuardLoaded = MOUNT_VERSION;
  window.__fusionDeliveryMountVersion = MOUNT_VERSION;

  const byId = id => document.getElementById(id);
  let repairTimer = null;
  let renderRetryTimer = null;
  let renderRetryCount = 0;

  function ensureDeliveryAreaDefinition() {
    try {
      if (typeof OWNER_AREAS !== 'undefined' && OWNER_AREAS) {
        OWNER_AREAS.delivery = [['delivery', 'Delivery']];
      }
    } catch (_) {}
  }

  function ownerPagesParent() {
    const service = byId('page-service');
    const orders = byId('page-orders');
    const dash = byId('page-dash');
    return service?.parentElement || orders?.parentElement || dash?.parentElement || document.querySelector('.ownerPage')?.parentElement || null;
  }

  function ensureDeliveryPage() {
    let page = byId('page-delivery');
    const service = byId('page-service');
    const parent = ownerPagesParent();
    if (!parent) return page || null;

    if (!page) {
      page = document.createElement('div');
      page.id = 'page-delivery';
      page.className = 'ownerPage hidden';
    }

    // Delivery must be a sibling of the permanent Owner pages. If an older
    // injection accidentally nested it inside Service, move it out before
    // trying to show it; a visible child of a hidden Service page is still hidden.
    if (page.parentElement !== parent || (service && page.nextElementSibling !== service)) {
      if (service && service.parentElement === parent) parent.insertBefore(page, service);
      else parent.appendChild(page);
    }

    if (!page.classList.contains('ownerPage')) page.classList.add('ownerPage');
    return page;
  }

  function ensureDeliveryNav() {
    ensureDeliveryAreaDefinition();

    const menu = byId('ownerNavMenu');
    if (!menu) return null;

    let button = menu.querySelector('[data-area="delivery"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'fusionDeliveryNavBtn';
      button.dataset.area = 'delivery';
      button.textContent = 'Delivery';

      const service = menu.querySelector('[data-area="service"]');
      if (service) menu.insertBefore(button, service);
      else menu.appendChild(button);
    }

    button.type = 'button';
    button.dataset.area = 'delivery';
    if (!button.textContent.trim()) button.textContent = 'Delivery';
    return button;
  }

  function setDeliveryNavState() {
    const menu = byId('ownerNavMenu');
    if (menu) {
      menu.querySelectorAll('[data-area]').forEach(node => {
        const active = node.dataset.area === 'delivery';
        node.classList.toggle('active', active);
        if (active) node.setAttribute('aria-current', 'page');
        else node.removeAttribute('aria-current');
      });
      menu.classList.add('hidden');
    }

    const current = byId('ownerNavCurrent');
    if (current) current.textContent = 'Delivery';
  }

  function setOwnerState() {
    try { if (typeof ownerArea !== 'undefined') ownerArea = 'delivery'; } catch (_) {}
    try { if (typeof activeTab !== 'undefined') activeTab = 'delivery'; } catch (_) {}
  }

  function renderDeliveryWhenReady() {
    const page = ensureDeliveryPage();
    if (!page) return;

    if (typeof window.refreshDeliveryManagement === 'function') {
      renderRetryCount = 0;
      if (renderRetryTimer) {
        clearTimeout(renderRetryTimer);
        renderRetryTimer = null;
      }
      try {
        Promise.resolve(window.refreshDeliveryManagement()).catch(error => {
          console.error('Delivery Management render failed', error);
          page.innerHTML = `<h2>Delivery</h2><div class="notice">Could not load Delivery: ${String(error?.message || error)}</div>`;
        });
      } catch (error) {
        console.error('Delivery Management render failed', error);
        page.innerHTML = `<h2>Delivery</h2><div class="notice">Could not load Delivery: ${String(error?.message || error)}</div>`;
      }
      return;
    }

    if (renderRetryCount === 0) {
      page.innerHTML = '<h2>Delivery</h2><p class="muted">Loading delivery management…</p>';
    }
    if (renderRetryCount < 20) {
      renderRetryCount += 1;
      renderRetryTimer = setTimeout(renderDeliveryWhenReady, 150);
    } else {
      page.innerHTML = '<h2>Delivery</h2><div class="notice">Delivery Management did not finish loading. Refresh the app once and try again.</div>';
    }
  }

  function activateDelivery(event) {
    if (event) {
      try { event.preventDefault(); } catch (_) {}
      try { event.stopPropagation(); } catch (_) {}
      try { event.stopImmediatePropagation(); } catch (_) {}
    }

    const page = ensureDeliveryPage();
    ensureDeliveryNav();
    if (!page) return false;

    document.querySelectorAll('.ownerPage').forEach(node => {
      if (node === page) node.classList.remove('hidden');
      else node.classList.add('hidden');
    });

    setOwnerState();
    setDeliveryNavState();
    renderDeliveryWhenReady();

    try { window.scrollTo(0, 0); } catch (_) {}
    return true;
  }

  // One canonical entry point. The server-injected button resolves this at click
  // time, so this replaces older open logic without having to rewrite index.html.
  window.__fusionActivateDelivery = activateDelivery;
  window.__fusionOpenDelivery = activateDelivery;
  window.openDeliveryManagement = activateDelivery;

  function patchShowTab() {
    const current = window.showTab;
    if (typeof current !== 'function' || current.__fusionDeliveryMountWrapper === MOUNT_VERSION) return;

    function wrappedShowTab(tab, ...args) {
      if (tab === 'delivery') return activateDelivery();
      return current.call(this, tab, ...args);
    }

    wrappedShowTab.__fusionDeliveryMountWrapper = MOUNT_VERSION;
    wrappedShowTab.__fusionDeliveryWrappedFunction = current;
    window.showTab = wrappedShowTab;
  }

  function patchShowOwnerArea() {
    const current = window.showOwnerArea;
    if (typeof current !== 'function' || current.__fusionDeliveryMountWrapper === MOUNT_VERSION) return;

    function wrappedShowOwnerArea(area, ...args) {
      if (area === 'delivery') return activateDelivery();
      return current.call(this, area, ...args);
    }

    wrappedShowOwnerArea.__fusionDeliveryMountWrapper = MOUNT_VERSION;
    wrappedShowOwnerArea.__fusionDeliveryWrappedFunction = current;
    window.showOwnerArea = wrappedShowOwnerArea;
  }

  function interceptDeliveryNavigation(event) {
    const target = event.target?.closest?.('[data-area="delivery"]');
    if (!target) return;
    activateDelivery(event);
  }

  function repair() {
    ensureDeliveryPage();
    ensureDeliveryNav();
    patchShowTab();
    patchShowOwnerArea();
    // A legacy inline script may replace this function after initial load.
    window.__fusionOpenDelivery = activateDelivery;
  }

  function scheduleRepair() {
    if (repairTimer) return;
    repairTimer = setTimeout(() => {
      repairTimer = null;
      repair();
    }, 75);
  }

  function start() {
    repair();
    document.addEventListener('click', interceptDeliveryNavigation, true);

    const observer = new MutationObserver(scheduleRepair);
    observer.observe(document.body, { childList: true, subtree: true });
    window.__fusionDeliveryMountObserver = observer;

    // Re-wrap navigation for a short startup window because the Owner dashboard
    // replaces some globals after data loads. The click interceptor remains as a
    // permanent final guard after this interval ends.
    let attempts = 0;
    const interval = setInterval(() => {
      repair();
      attempts += 1;
      if (attempts >= 40) clearInterval(interval);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
