/* Fusion Flavours Owner Router
   Single source of truth for Owner navigation.
   This deliberately bypasses the historical showTab/showOwnerArea wrapper chain in index.html.
*/
(() => {
  'use strict';

  const AREA_CONFIG = {
    dashboard: { label: 'Dashboard', tabs: [['dash', 'Dashboard']] },
    orders: { label: 'Orders', tabs: [['orders', 'Delivery Orders'], ['harnellorders', 'Harnell Orders'], ['retailorders', 'Postal Orders']] },
    kitchen: { label: 'Kitchen', tabs: [['menu', 'Menu'], ['stock', 'Stock'], ['costings', 'Costings'], ['cookbook', 'Cookbook'], ['prep', 'Prep']] },
    business: { label: 'Business', tabs: [['performance', 'P&L / Performance'], ['targets', 'Targets'], ['dailyadmin', 'Daily Admin'], ['costs', 'Costs & Overheads'], ['banking', 'Banking']] },
    catering: { label: 'Catering', tabs: [['catering', 'Catering']] },
    harnell: { label: 'Harnell', tabs: [['harnell', 'Harnell']] },
    fusionhome: { label: 'Fusion at Home', tabs: [['fusionhome', 'Fusion at Home']] },
    delivery: { label: 'Delivery', tabs: [['delivery', 'Delivery Management']] },
    service: { label: 'Service', tabs: [['service', 'Service']] }
  };

  const RENDERERS = {
    dash: 'renderDashboard',
    orders: 'renderOrders',
    harnellorders: 'renderHarnellOrders',
    retailorders: 'renderRetailOrders',
    menu: 'renderMenuAdmin',
    stock: 'renderStock',
    costings: 'renderCostings',
    cookbook: 'renderCookbook',
    prep: 'renderPrep',
    performance: 'renderPerformance',
    targets: 'renderTargets',
    dailyadmin: 'renderDailyAdmin',
    costs: 'renderCostsOverheads',
    banking: 'renderBanking',
    catering: 'renderCateringAdmin',
    harnell: 'renderHarnellAdmin',
    fusionhome: 'renderFusionAtHome',
    service: 'renderService'
  };

  const $ = id => document.getElementById(id);
  let currentArea = 'dashboard';
  let currentTab = 'dash';
  let installed = false;

  function areaForTab(tab) {
    for (const [area, cfg] of Object.entries(AREA_CONFIG)) {
      if (cfg.tabs.some(([id]) => id === tab)) return area;
    }
    return 'dashboard';
  }

  function ensurePage(id) {
    const pageId = `page-${id}`;
    let page = $(pageId);
    if (page) return page;
    const dashboard = $('dashboard');
    if (!dashboard) return null;
    page = document.createElement('div');
    page.id = pageId;
    page.className = 'ownerPage hidden';
    dashboard.appendChild(page);
    return page;
  }

  function rebuildOwnerMenu() {
    const menu = $('ownerNavMenu');
    if (!menu) return;
    menu.innerHTML = Object.entries(AREA_CONFIG).map(([area, cfg]) =>
      `<button type="button" data-area="${area}">${cfg.label}</button>`
    ).join('');
  }

  function ensureStructure() {
    Object.values(AREA_CONFIG).forEach(cfg => cfg.tabs.forEach(([tab]) => ensurePage(tab)));
    rebuildOwnerMenu();
  }

  function hidePages() {
    document.querySelectorAll('#dashboard .ownerPage').forEach(page => page.classList.add('hidden'));
  }

  function setCurrent(area, tab) {
    currentArea = area;
    currentTab = tab;
    const cfg = AREA_CONFIG[area] || AREA_CONFIG.dashboard;
    const current = $('ownerNavCurrent');
    if (current) current.textContent = cfg.label;
    document.querySelectorAll('#ownerNavMenu [data-area]').forEach(button => {
      button.classList.toggle('active', button.dataset.area === area);
    });
  }

  function ownerTabsHtml(area, tab) {
    const cfg = AREA_CONFIG[area];
    if (!cfg || cfg.tabs.length < 2) return '';
    return `<div class="ownerAreaTabs" data-owner-router-tabs="true">${cfg.tabs.map(([id, label]) =>
      `<button type="button" data-owner-tab="${id}" class="${id === tab ? 'active' : ''}">${label}</button>`
    ).join('')}</div>`;
  }

  function decorate(area, tab) {
    const page = $(`page-${tab}`);
    if (!page) return;
    page.querySelectorAll(':scope > [data-owner-router-tabs="true"]').forEach(node => node.remove());
    const tabs = ownerTabsHtml(area, tab);
    if (tabs) page.insertAdjacentHTML('afterbegin', tabs);
  }

  async function renderDelivery() {
    const page = ensurePage('delivery');
    if (!page) return;
    if (!page.innerHTML.trim()) {
      page.innerHTML = '<h2>Delivery</h2><div class="notice">Loading delivery management…</div>';
    }
    if (typeof window.refreshDeliveryManagement === 'function') {
      await window.refreshDeliveryManagement();
      return;
    }
    let tries = 0;
    await new Promise(resolve => {
      const timer = setInterval(() => {
        tries += 1;
        if (typeof window.refreshDeliveryManagement === 'function' || tries >= 30) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
    if (typeof window.refreshDeliveryManagement === 'function') {
      await window.refreshDeliveryManagement();
    } else {
      page.innerHTML = '<h2>Delivery</h2><div class="notice">Delivery management could not start. Refresh once; if this persists it is a code error, not a menu/cache issue.</div>';
    }
  }

  async function prepare(tab) {
    if (tab === 'catering' && typeof window.loadCateringOrders === 'function') {
      const orders = window.ownerData && window.ownerData.cateringOrders;
      if (!orders) await window.loadCateringOrders();
    }
  }

  async function showTab(tab) {
    tab = String(tab || 'dash').toLowerCase();
    const area = areaForTab(tab);
    const page = ensurePage(tab);
    if (!page) return;

    hidePages();
    page.classList.remove('hidden');
    $('ownerNavMenu')?.classList.add('hidden');
    setCurrent(area, tab);

    try {
      if (tab === 'delivery') {
        await renderDelivery();
      } else {
        await prepare(tab);
        const fnName = RENDERERS[tab];
        const fn = fnName && window[fnName];
        if (typeof fn === 'function') await fn();
      }
    } catch (error) {
      console.error(`Owner route ${tab} failed`, error);
      page.innerHTML = `<h2>${AREA_CONFIG[area]?.label || 'Owner'}</h2><div class="notice">This section failed to load: ${String(error?.message || error)}</div>`;
    }

    decorate(area, tab);
    try { window.activeTab = tab; } catch (_) {}
  }

  function showArea(area) {
    area = AREA_CONFIG[area] ? area : 'dashboard';
    const firstTab = AREA_CONFIG[area].tabs[0][0];
    return showTab(firstTab);
  }

  function toggleMenu() {
    $('ownerNavMenu')?.classList.toggle('hidden');
  }

  function installEvents() {
    const menu = $('ownerNavMenu');
    if (menu && !menu.dataset.ownerRouterBound) {
      menu.dataset.ownerRouterBound = 'true';
      menu.addEventListener('click', event => {
        const button = event.target.closest('[data-area]');
        if (!button) return;
        event.preventDefault();
        showArea(button.dataset.area);
      });
    }

    document.addEventListener('click', event => {
      const tab = event.target.closest('[data-owner-tab]');
      if (!tab) return;
      event.preventDefault();
      showTab(tab.dataset.ownerTab);
    });
  }

  function install() {
    if (installed) return;
    installed = true;
    ensureStructure();
    installEvents();

    // Replace the historical wrapper chain with one stable API.
    window.showTab = showTab;
    window.showOwnerArea = showArea;
    window.toggleOwnerNav = toggleMenu;

    // Legacy inline buttons resolve these globals at click time, so all old callers now use this router too.
    window.FusionOwnerRouter = api;
  }

  const api = {
    install,
    showTab,
    showArea,
    ensureStructure,
    config: AREA_CONFIG,
    get currentArea() { return currentArea; },
    get currentTab() { return currentTab; }
  };

  window.FusionOwnerRouter = api;
})();
