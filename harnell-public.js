/* Fusion Flavours - Harnell public menu module */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let categoryNames = {};
  let basket = [];

  try {
    const saved = JSON.parse(sessionStorage.getItem('ffCommunityBasket') || '[]');
    if (Array.isArray(saved)) basket = saved;
  } catch (_) {}

  function saveBasket() {
    try { sessionStorage.setItem('ffCommunityBasket', JSON.stringify(basket)); } catch (_) {}
    window.harnellBasket = basket;
  }

  function installStyles() {
    if ($('fusionHarnellStyles')) return;
    const style = document.createElement('style');
    style.id = 'fusionHarnellStyles';
    style.textContent = `
      .harnellSection{margin:24px 0 12px}
      .harnellSectionTitle{margin:0 0 12px;padding:9px 2px 8px;border-bottom:4px solid var(--o);font-size:25px;font-weight:950}
      .harnellMenuGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:4px}
      .harnellEmpty{grid-column:1/-1;background:#fff8ef;border:1px dashed #d8c2ae;border-radius:14px;padding:14px;color:var(--muted);font-size:13px}
      @media(max-width:760px){.harnellMenuGrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function safe(value) {
    return typeof window.esc === 'function' ? window.esc(value) : String(value ?? '');
  }

  function money(value) {
    return typeof window.money === 'function' ? window.money(value) : `£${Number(value || 0).toFixed(2)}`;
  }

  function groupFor(row) {
    const itemName = String(row?.resident_name || row?.items?.name || '').toLowerCase();
    if (/rubicon|coke|cola|sprite|fanta|water|juice|drink|lemonade/.test(itemName)) return 'drinks';
    if (/tiramisu|cake|brownie|dessert|baklava|sweet|pudding|cookie|cheesecake/.test(itemName)) return 'desserts';

    const sortOrder = Number(row?.sort_order || 0);
    if (sortOrder >= 4000) return 'drinks';
    if (sortOrder >= 3000) return 'desserts';
    if (sortOrder >= 2000) return 'sides';
    if (sortOrder >= 1000) return 'mains';

    const category = String(categoryNames[Number(row?.items?.category_id || 0)] || '').toLowerCase();
    if (category.includes('drink')) return 'drinks';
    if (category.includes('dessert') || category.includes('sweet')) return 'desserts';
    if (category.includes('side') || category.includes('sauce')) return 'sides';
    if (/tzatziki|ezme|sauce|dip|rice|fries|pita|pitta|bread|salad/.test(itemName)) return 'sides';
    return 'mains';
  }

  function orderingOpen() {
    const settings = window.state?.settings || {};
    if (settings.harnell_enabled !== true) return false;
    const now = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date());
    return now <= String(settings.harnell_cutoff_time || '15:00').slice(0, 5);
  }

  function displayName(row) {
    return row?.resident_name || row?.items?.name || 'Dish';
  }

  function displayDescription(row) {
    return row?.resident_description || row?.items?.description || '';
  }

  function renderBasket() {
    const lines = $('harnellBasketLines');
    if (!lines) return;
    lines.innerHTML = basket.map(item => `<div class="harnellLine">
      <div><b>${safe(item.item_name)}</b><div class="muted">${money(item.price)} each</div></div>
      <div><button type="button" onclick="changeHarnellQty(${Number(item.item_id)},-1)" aria-label="Remove one ${safe(item.item_name)}">−</button> <b>${Number(item.quantity)}</b> <button type="button" onclick="changeHarnellQty(${Number(item.item_id)},1)" aria-label="Add one ${safe(item.item_name)}">+</button></div>
    </div>`).join('') || '<p class="muted">Nothing added yet.</p>';
    if ($('harnellBasketTotal')) {
      $('harnellBasketTotal').textContent = money(basket.reduce((total, item) => total + Number(item.price) * Number(item.quantity), 0));
    }
  }

  function addItem(id) {
    const row = (window.harnellMenuRows || []).find(item => Number(item.item_id) === Number(id));
    if (!row || !orderingOpen() || Number(row?.items?.stock || 0) <= 0) return;
    const existing = basket.find(item => Number(item.item_id) === Number(id));
    if (existing) existing.quantity += 1;
    else basket.push({
      item_id: Number(id), item_name: displayName(row),
      price: Number(row.resident_price_pence || 0) / 100, quantity: 1
    });
    saveBasket();
    renderBasket();
    if (typeof window.showToast === 'function') window.showToast();
  }

  function changeQuantity(id, difference) {
    const item = basket.find(line => Number(line.item_id) === Number(id));
    if (!item) return;
    item.quantity += Number(difference || 0);
    if (item.quantity <= 0) basket = basket.filter(line => line !== item);
    saveBasket();
    renderBasket();
  }

  function dishCard(row) {
    const soldOut = Number(row?.items?.stock || 0) <= 0;
    const canOrder = (typeof window.harnellOpen === 'function' ? window.harnellOpen() : true) && !soldOut;
    const itemName = typeof window.harnellDisplayName === 'function'
      ? window.harnellDisplayName(row)
      : displayName(row);
    const description = typeof window.harnellDisplayDescription === 'function'
      ? window.harnellDisplayDescription(row)
      : displayDescription(row);
    const image = row?.items?.image_url;

    return `<article class="harnellDish">
      ${image ? `<img class="recipeThumb" src="${safe(image)}" alt="${safe(itemName)}">` : ''}
      <span class="harnellVariantBadge">COMMUNITY</span>
      <h3>${safe(itemName)}</h3>
      <p class="muted">${safe(description)}</p>
      <div class="row">
        <span class="harnellPrice">${money(Number(row.resident_price_pence || 0) / 100)}</span>
        <button type="button" ${canOrder ? '' : 'disabled'} onclick="addHarnellItem(${Number(row.item_id)})">${soldOut ? 'Sold out' : 'Add'}</button>
      </div>
    </article>`;
  }

  async function load() {
    if (typeof window.api !== 'function') throw new Error('App API is not ready');
    const [settings, rows, categories] = await Promise.all([
      window.api('/rest/v1/settings?id=eq.1&select=*').then(x => x[0]),
      window.api('/rest/v1/harnell_menu_items?active=eq.true&select=*,items(id,name,description,image_url,active,stock,category_id)&order=sort_order.asc,id.asc'),
      window.api('/rest/v1/categories?select=id,name')
    ]);

    if (window.state) window.state.settings = settings;
    window.harnellMenuRows = (rows || []).filter(x => x.items && x.items.active !== false);
    categoryNames = {};
    (categories || []).forEach(category => {
      categoryNames[Number(category.id)] = String(category.name || '');
    });
  }

  function render() {
    installStyles();
    const settings = window.state?.settings || {};
    const savedTitle = String(settings.harnell_title || '');
    const savedSubtitle = String(settings.harnell_subtitle || '');
    if ($('harnellTitle')) $('harnellTitle').textContent = /harnell|resident/i.test(savedTitle) ? 'Community Meals' : (savedTitle || 'Community Meals');
    if ($('harnellSubtitle')) $('harnellSubtitle').textContent = /harnell|resident/i.test(savedSubtitle) ? 'Affordable, filling meals for the whole community' : (savedSubtitle || 'Affordable, filling meals for the whole community');

    const start = String(settings.harnell_delivery_start || '18:00').slice(0, 5);
    const end = String(settings.harnell_delivery_end || '20:00').slice(0, 5);
    const open = typeof window.harnellOpen === 'function' ? window.harnellOpen() : true;
    if ($('harnellStatus')) {
      $('harnellStatus').innerHTML = `${open ? '<b>🟢 Community ordering open</b> · Order by ' : '<b>🔴 Community ordering closed</b> · Cutoff '}${String(settings.harnell_cutoff_time || '15:00').slice(0, 5)}<br><b>🚪 Delivery window:</b> ${start}–${end}`;
    }

    const groups = [['mains', 'Mains'], ['sides', 'Sides'], ['drinks', 'Drinks'], ['desserts', 'Desserts']];
    const menu = $('harnellMenu');
    if (!menu) return;

    menu.className = '';
    menu.innerHTML = groups.map(([key, label]) => {
      const rows = (window.harnellMenuRows || []).filter(row => groupFor(row) === key);
      return `<section class="harnellSection" data-harnell-section="${key}">
        <h2 class="harnellSectionTitle">${label}</h2>
        <div class="harnellMenuGrid">${rows.length ? rows.map(dishCard).join('') : `<div class="harnellEmpty">No ${label.toLowerCase()} added yet.</div>`}</div>
      </section>`;
    }).join('');

    if (typeof window.renderHarnellBasket === 'function') window.renderHarnellBasket();
  }

  function install() {
    installStyles();
    saveBasket();
    window.harnellOpen = orderingOpen;
    window.harnellDisplayName = displayName;
    window.harnellDisplayDescription = displayDescription;
    window.addHarnellItem = addItem;
    window.changeHarnellQty = changeQuantity;
    window.renderHarnellBasket = renderBasket;
    window.loadHarnellPublic = load;
    window.renderHarnellCustomer = render;
  }

  window.FusionHarnellPublic = { install, load, render };
})();
