/* Fusion Flavours Owner Router
   Single source of truth for Owner navigation and feature lifecycle.
   Feature modules register their own lifecycle hooks.
*/
(() => {
  'use strict';

  const AREA_CONFIG = {
    dashboard: { label: 'Dashboard', tabs: [['dash', 'Dashboard']] },
    orders: { label: 'Orders', tabs: [['orders', 'Delivery Orders'], ['harnellorders', 'Community Orders'], ['retailorders', 'Postal Orders']] },
    kitchen: { label: 'Kitchen', tabs: [['menu', 'Menu'], ['stock', 'Stock'], ['costings', 'Costings'], ['cookbook', 'Cookbook'], ['prep', 'Prep']] },
    business: { label: 'Business', tabs: [['performance', 'P&L / Performance'], ['targets', 'Targets'], ['dailyadmin', 'Daily Admin'], ['costs', 'Costs & Overheads'], ['banking', 'Banking'], ['tax', 'Tide Tax']] },
    catering: { label: 'Catering', tabs: [['catering', 'Catering']] },
    harnell: { label: 'Community Meals', tabs: [['harnell', 'Community Meals']] },
    fusionhome: { label: 'Fusion at Home', tabs: [['fusionhome', 'Fusion at Home']] },

    service: { label: 'Service', tabs: [['service', 'Service']] }
  };

  const RENDERERS = {
    dash: 'renderDashboard', orders: 'renderOrders', harnellorders: 'renderHarnellOrders', retailorders: 'renderRetailOrders',
    menu: 'renderMenuAdmin', stock: 'renderStock', costings: 'renderCostings', cookbook: 'renderCookbook', prep: 'renderPrep',
    performance: 'renderPerformance', targets: 'renderTargets', dailyadmin: 'renderDailyAdmin', costs: 'renderCostsOverheads', banking: 'renderBanking', tax: 'FusionTideTax.render',
    catering: 'renderCateringAdmin', harnell: 'renderHarnellAdmin', fusionhome: 'renderFusionAtHome', delivery: 'refreshDeliveryManagement', service: 'renderService'
  };

  const LIFECYCLE = new Map();
  const $ = id => document.getElementById(id);
  let currentArea = 'dashboard';
  let currentTab = 'dash';
  let installed = false;

  function register(tab, hooks = {}) {
    tab = String(tab || '').toLowerCase();
    if (!tab) throw new Error('Owner lifecycle registration requires a tab name');
    const existing = LIFECYCLE.get(tab) || {};
    LIFECYCLE.set(tab, { ...existing, ...hooks });
  }

  function areaForTab(tab) {
    for (const [area, config] of Object.entries(AREA_CONFIG)) {
      if (config.tabs.some(([id]) => id === tab)) return area;
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
    menu.innerHTML = Object.entries(AREA_CONFIG)
      .map(([area, config]) => `<button type="button" data-area="${area}">${config.label}</button>`)
      .join('');
  }

  function ensureStructure() {
    Object.values(AREA_CONFIG).forEach(config => config.tabs.forEach(([tab]) => ensurePage(tab)));
    rebuildOwnerMenu();
  }

  function hidePages() {
    document.querySelectorAll('#dashboard .ownerPage').forEach(page => page.classList.add('hidden'));
  }

  function setCurrent(area, tab) {
    currentArea = area;
    currentTab = tab;
    const config = AREA_CONFIG[area] || AREA_CONFIG.dashboard;
    const current = $('ownerNavCurrent');
    if (current) current.textContent = config.label;
    document.querySelectorAll('#ownerNavMenu [data-area]').forEach(button => {
      button.classList.toggle('active', button.dataset.area === area);
    });
  }

  function ownerTabsHtml(area, tab) {
    const config = AREA_CONFIG[area];
    if (!config || config.tabs.length < 2) return '';
    return `<div class="ownerAreaTabs" data-owner-router-tabs="true">${config.tabs.map(([id, label]) =>
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

  async function renderBase(tab) {
    const fnName = RENDERERS[tab];
    const fn = fnName && window[fnName];
    if (typeof fn !== 'function') throw new Error(`Owner renderer is not available for ${tab}`);
    await fn();
  }

  async function runLifecycle(tab) {
    const hooks = LIFECYCLE.get(tab) || {};
    if (typeof hooks.beforeRender === 'function') await hooks.beforeRender();
    if (typeof hooks.render === 'function') await hooks.render();
    else await renderBase(tab);
    if (typeof hooks.afterRender === 'function') await hooks.afterRender();
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
      await runLifecycle(tab);
    } catch (error) {
      console.error(`Owner route ${tab} failed`, error);
      page.innerHTML = `<h2>${AREA_CONFIG[area]?.label || 'Owner'}</h2><div class="notice">This section failed to load: ${String(error?.message || error)}</div>`;
    }

    decorate(area, tab);
    try { window.activeTab = tab; } catch (_) {}
  }

  function showArea(area) {
    area = AREA_CONFIG[area] ? area : 'dashboard';
    return showTab(AREA_CONFIG[area].tabs[0][0]);
  }

  function toggleMenu() { $('ownerNavMenu')?.classList.toggle('hidden'); }

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
    window.showTab = showTab;
    window.showOwnerArea = showArea;
    window.toggleOwnerNav = toggleMenu;
    window.decorateOwnerPage = function legacyOwnerDecorationRetired() {};
    window.FusionOwnerRouter = api;
  }

  const api = {
    install, showTab, showArea, ensureStructure, decorate, register, config: AREA_CONFIG,
    get currentArea() { return currentArea; },
    get currentTab() { return currentTab; }
  };

  window.FusionOwnerRouter = api;
})();
