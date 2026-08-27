/* Fusion Flavours - Harnell public menu module */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let categoryNames = {};

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

  function dishCard(row) {
    const soldOut = Number(row?.items?.stock || 0) <= 0;
    const canOrder = (typeof window.harnellOpen === 'function' ? window.harnellOpen() : true) && !soldOut;
    const displayName = typeof window.harnellDisplayName === 'function'
      ? window.harnellDisplayName(row)
      : (row.resident_name || row?.items?.name || 'Dish');
    const description = typeof window.harnellDisplayDescription === 'function'
      ? window.harnellDisplayDescription(row)
      : (row.resident_description || row?.items?.description || '');
    const image = row?.items?.image_url;

    return `<article class="harnellDish">
      ${image ? `<img class="recipeThumb" src="${safe(image)}" alt="${safe(displayName)}">` : ''}
      <span class="harnellVariantBadge">HARNELL</span>
      <h3>${safe(displayName)}</h3>
      <p class="muted">${safe(description)}</p>
      <div class="row">
        <span class="harnellPrice">${money(Number(row.resident_price_pence || 0) / 100)}</span>
        <button ${canOrder ? '' : 'disabled'} onclick="addHarnellItem(${Number(row.item_id)})">${soldOut ? 'Sold out' : 'Add'}</button>
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
    const settings = window.state?.settings || {};
    if ($('harnellTitle')) $('harnellTitle').textContent = settings.harnell_title || 'Harnell House Menu';
    if ($('harnellSubtitle')) $('harnellSubtitle').textContent = settings.harnell_subtitle || 'Simple, affordable meals for residents';

    const start = String(settings.harnell_delivery_start || '18:00').slice(0, 5);
    const end = String(settings.harnell_delivery_end || '20:00').slice(0, 5);
    const open = typeof window.harnellOpen === 'function' ? window.harnellOpen() : true;
    if ($('harnellStatus')) {
      $('harnellStatus').innerHTML = `${open ? '<b>🟢 Resident ordering open</b> · Order by ' : '<b>🔴 Resident ordering closed</b> · Cutoff '}${String(settings.harnell_cutoff_time || '15:00').slice(0, 5)}<br><b>🚪 Delivery window:</b> ${start}–${end}`;
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
    window.loadHarnellPublic = load;
    window.renderHarnellCustomer = render;
  }

  window.FusionHarnellPublic = { install, load, render };
})();
