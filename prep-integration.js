/* Fusion Flavours Prep integration
   One Prep lifecycle for Takeaway, Catering and Harnell modes.
*/
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = value => {
    try { return typeof window.esc === 'function' ? window.esc(value ?? '') : String(value ?? ''); }
    catch (_) { return String(value ?? ''); }
  };

  function currentMode() {
    try { return String(prepMode || 'takeaway'); }
    catch (_) { return 'takeaway'; }
  }

  async function ensureHarnellData() {
    if (window.ownerData?.harnellOrders && window.ownerData?.harnellOrderItems) return;
    try {
      if (typeof loadHarnellOwnerData === 'function') await loadHarnellOwnerData();
      else if (typeof window.loadHarnellOwnerData === 'function') await window.loadHarnellOwnerData();
    } catch (error) {
      throw new Error(`Could not load Harnell prep data: ${error?.message || error}`);
    }
  }

  function addHarnellTab() {
    const tabs = $('page-prep')?.querySelector('.prepModeTabs');
    if (!tabs || tabs.querySelector('[data-harnell-prep]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.harnellPrep = 'true';
    button.textContent = 'Harnell';
    button.addEventListener('click', () => setMode('harnell'));
    tabs.appendChild(button);
  }

  function harnellLines(orderId) {
    try {
      if (typeof harnellOrderLines === 'function') return harnellOrderLines(orderId) || [];
    } catch (_) {}
    return (window.ownerData?.harnellOrderItems || []).filter(line => Number(line.harnell_order_id) === Number(orderId));
  }

  function recipeRequirements(items) {
    try {
      if (typeof prepRequirementsFromItems === 'function') return prepRequirementsFromItems(items) || {};
    } catch (_) {}
    return {};
  }

  async function renderHarnell() {
    await ensureHarnellData();
    const page = $('page-prep');
    if (!page) return;
    const today = typeof window.londonDateKey === 'function' ? window.londonDateKey() : new Date().toISOString().slice(0,10);
    const orders = (window.ownerData?.harnellOrders || []).filter(order => {
      const day = typeof window.londonDateKey === 'function' ? window.londonDateKey(new Date(order.created_at)) : String(order.created_at || '').slice(0,10);
      return day === today && !['cancelled','completed'].includes(String(order.status || '').toLowerCase());
    });
    const flat = [];
    orders.forEach(order => harnellLines(order.id).forEach(line => flat.push({
      item_id: line.item_id,
      quantity: Number(line.quantity || 0),
      item_name: line.item_name
    })));
    const requirements = recipeRequirements(flat);
    const totals = {};
    flat.forEach(line => { totals[line.item_name] = (totals[line.item_name] || 0) + Number(line.quantity || 0); });

    page.innerHTML = `<h2>Prep</h2><div class="prepModeTabs"><button data-prep-mode="takeaway">Takeaway</button><button data-prep-mode="catering">Catering</button><button class="active" data-prep-mode="harnell">Community Meals</button></div><div class="notice"><b>Community Meals prep</b> · Today's open community orders only.</div><div class="panel"><h2>Portions to prepare</h2>${Object.entries(totals).map(([name, qty]) => `<div class="prepRow"><b>${safe(name)}</b><div class="prepQty">× ${qty}</div></div>`).join('') || '<p class="muted">No Community Meals prep required.</p>'}</div><div class="panel" style="margin-top:12px"><h2>Recipe ingredient requirements</h2>${Object.values(requirements).map(item => `<div class="prepRow"><b>${safe(item.name)}</b><div class="prepQty">${Number(Number(item.qty || 0).toFixed(3))} ${safe(item.unit)}</div></div>`).join('') || '<p class="muted">No linked recipe requirements.</p>'}</div>`;
    page.querySelectorAll('[data-prep-mode]').forEach(button => {
      button.addEventListener('click', () => setMode(button.dataset.prepMode));
    });
  }

  async function render() {
    const mode = currentMode();
    if (mode === 'harnell') {
      await renderHarnell();
      return;
    }
    // renderPrepV38 is captured before the Harnell renderPrep wrapper.
    if (typeof renderPrepV38 === 'function') await renderPrepV38();
    else if (typeof window.renderPrep === 'function') await window.renderPrep();
    else throw new Error('Prep renderer is unavailable');
    addHarnellTab();
  }

  function setMode(mode) {
    try { prepMode = String(mode || 'takeaway'); } catch (_) {}
    window.FusionOwnerRouter?.showTab?.('prep');
  }

  function setCateringBooking(id) {
    try { selectedCateringPrepId = Number(id) || null; } catch (_) {}
    window.FusionOwnerRouter?.showTab?.('prep');
  }

  window.setPrepMode = setMode;
  window.setCateringPrep = setCateringBooking;
  window.FusionPrep = { render, setMode, ensureHarnellData };
  window.FusionOwnerRouter?.register?.('prep', { render });
})();
