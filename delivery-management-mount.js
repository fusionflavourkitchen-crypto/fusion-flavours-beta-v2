/* Fusion Flavours - Delivery Management mount guard */
(() => {
  'use strict';

  if (window.__fusionDeliveryMountGuardLoaded) return;
  window.__fusionDeliveryMountGuardLoaded = true;

  const byId = id => document.getElementById(id);
  let repairTimer = null;

  function ensureDeliveryAreaDefinition() {
    try {
      if (typeof OWNER_AREAS !== 'undefined') {
        OWNER_AREAS.delivery = [['delivery', 'Delivery']];
      }
    } catch (_) {}
  }

  function ensureDeliveryPage() {
    let page = byId('page-delivery');
    if (page) return page;

    const anchor = byId('page-orders') || byId('page-service') || document.querySelector('.ownerPage');
    const parent = anchor && anchor.parentElement;
    if (!parent) return null;

    page = document.createElement('div');
    page.id = 'page-delivery';
    page.className = 'ownerPage hidden';
    parent.appendChild(page);
    return page;
  }

  function ensureDeliveryNav() {
    ensureDeliveryAreaDefinition();

    const menu = byId('ownerNavMenu');
    if (!menu) return;

    let button = menu.querySelector('[data-area="delivery"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.area = 'delivery';
      button.textContent = 'Delivery';
      button.addEventListener('click', () => activateDelivery());

      const orders = menu.querySelector('[data-area="orders"]');
      if (orders && orders.nextSibling) menu.insertBefore(button, orders.nextSibling);
      else menu.appendChild(button);
    }
  }

  function setDeliveryNavState() {
    const menu = byId('ownerNavMenu');
    if (menu) {
      menu.querySelectorAll('[data-area]').forEach(node => {
        const active = node.dataset.area === 'delivery';
        node.classList.toggle('active', active);
        node.setAttribute('aria-current', active ? 'page' : 'false');
      });
    }

    const current = byId('ownerNavCurrent');
    if (current) current.textContent = 'Delivery';
  }

  function activateDelivery() {
    const page = ensureDeliveryPage();
    ensureDeliveryNav();
    if (!page) return false;

    document.querySelectorAll('.ownerPage').forEach(node => {
      if (node === page) node.classList.remove('hidden');
      else node.classList.add('hidden');
    });

    try {
      if (typeof activeTab !== 'undefined') activeTab = 'delivery';
    } catch (_) {}

    setDeliveryNavState();

    queueMicrotask(() => {
      try {
        if (typeof window.refreshDeliveryManagement === 'function') {
          window.refreshDeliveryManagement();
        }
      } catch (error) {
        console.error('Delivery Management render failed', error);
      }
    });

    return true;
  }

  window.__fusionActivateDelivery = activateDelivery;

  function patchShowTab() {
    const current = window.showTab;
    if (typeof current !== 'function' || current.__fusionDeliveryMountWrapper) return;

    function wrappedShowTab(tab, ...args) {
      if (tab === 'delivery') return activateDelivery();
      return current.call(this, tab, ...args);
    }

    wrappedShowTab.__fusionDeliveryMountWrapper = true;
    wrappedShowTab.__fusionDeliveryWrappedFunction = current;
    window.showTab = wrappedShowTab;
  }

  function patchShowOwnerArea() {
    const current = window.showOwnerArea;
    if (typeof current !== 'function' || current.__fusionDeliveryMountWrapper) return;

    function wrappedShowOwnerArea(area, ...args) {
      if (area === 'delivery') return activateDelivery();
      return current.call(this, area, ...args);
    }

    wrappedShowOwnerArea.__fusionDeliveryMountWrapper = true;
    wrappedShowOwnerArea.__fusionDeliveryWrappedFunction = current;
    window.showOwnerArea = wrappedShowOwnerArea;
  }

  function repair() {
    ensureDeliveryPage();
    ensureDeliveryNav();
    patchShowTab();
    patchShowOwnerArea();
  }

  function scheduleRepair() {
    if (repairTimer) return;
    repairTimer = setTimeout(() => {
      repairTimer = null;
      repair();
    }, 30);
  }

  function start() {
    repair();

    // The owner dashboard rebuilds parts of its navigation after data loads.
    // Re-attach Delivery whenever that happens, and re-wrap navigation if a
    // later script replaces showTab/showOwnerArea.
    const observer = new MutationObserver(scheduleRepair);
    observer.observe(document.body, { childList: true, subtree: true });
    window.__fusionDeliveryMountObserver = observer;

    let attempts = 0;
    const interval = setInterval(() => {
      repair();
      attempts += 1;
      if (attempts >= 80) clearInterval(interval);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
