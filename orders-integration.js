/* Fusion Flavours Orders integration
   Adds cross-cutting Orders UI without wrapping renderOrders/showTab.
*/
(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  function escText(v) {
    try { return typeof window.esc === 'function' ? window.esc(v ?? '') : String(v ?? ''); }
    catch (_) { return String(v ?? ''); }
  }
  function moneyValue(v) {
    try { return typeof window.money === 'function' ? window.money(Number(v || 0)) : `£${Number(v || 0).toFixed(2)}`; }
    catch (_) { return `£${Number(v || 0).toFixed(2)}`; }
  }

  function ensureDeliverySlotFilter() {
    const page = $('page-orders');
    if (!page || page.querySelector('[data-orders-slot-filter]')) return;
    const tabs = page.querySelector('.orderTabs');
    if (!tabs) return;
    const slots = window.ownerData?.deliverySlots || [];
    const current = String(window.deliverySlotFilter || 'all');
    const wrap = document.createElement('label');
    wrap.dataset.ordersSlotFilter = 'true';
    wrap.innerHTML = `<b>Delivery window</b><select data-orders-slot-select><option value="all">All delivery windows</option>${slots.map(s => `<option value="${s.id}" ${current === String(s.id) ? 'selected' : ''}>${escText(s.name)}</option>`).join('')}<option value="none" ${current === 'none' ? 'selected' : ''}>No slot / old orders</option></select>`;
    tabs.insertAdjacentElement('afterend', wrap);
    wrap.querySelector('select')?.addEventListener('change', event => {
      const value = event.target.value;
      window.deliverySlotFilter = value;
      if (typeof window.setDeliverySlotFilter === 'function') window.setDeliverySlotFilter(value);
      else window.FusionOwnerRouter?.showTab?.('orders');
    });
  }

  function ensureRefundTab() {
    const page = $('page-orders');
    const tabs = page?.querySelector('.orderTabs');
    if (!tabs || tabs.querySelector('[data-orders-refunds]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.ordersRefunds = 'true';
    button.textContent = 'Refunds';
    button.classList.toggle('active', String(window.orderFilter || '') === 'refunds');
    button.addEventListener('click', () => {
      if (typeof window.setOrderFilter === 'function') window.setOrderFilter('refunds');
      else {
        window.orderFilter = 'refunds';
        window.FusionOwnerRouter?.showTab?.('orders');
      }
    });
    tabs.appendChild(button);
  }

  function enhanceDeliverySlotLabels() {
    const page = $('page-orders');
    if (!page) return;
    const orders = window.ownerData?.orders || [];
    page.querySelectorAll('.orderRow').forEach((row, index) => {
      if (row.querySelector('[data-orders-slot-label]')) return;
      const order = orders[index];
      if (!order) return;
      const label = document.createElement('div');
      label.className = 'notice';
      label.dataset.ordersSlotLabel = 'true';
      const slot = order.delivery_slot_start && order.delivery_slot_end
        ? `${String(order.delivery_slot_start).slice(0,5)}–${String(order.delivery_slot_end).slice(0,5)}`
        : 'No slot';
      label.innerHTML = `<b>🚗 Delivery slot:</b> ${escText(slot)}`;
      const heading = row.querySelector('h3');
      if (heading) heading.insertAdjacentElement('afterend', label);
    });
  }

  function refundSummary() {
    if (String(window.orderFilter || '') !== 'refunds') return;
    const page = $('page-orders');
    if (!page || page.querySelector('[data-orders-refund-summary]')) return;
    const refunds = window.ownerData?.refunds || [];
    const successful = refunds.filter(r => ['succeeded','completed','refunded'].includes(String(r.status || '').toLowerCase()))
      .reduce((sum, r) => sum + Number(r.amount_pence || 0), 0) / 100;
    const box = document.createElement('div');
    box.className = 'notice';
    box.dataset.ordersRefundSummary = 'true';
    box.innerHTML = `<b>Successful refunds recorded:</b> ${moneyValue(successful)}`;
    const tabs = page.querySelector('.orderTabs');
    if (tabs) tabs.insertAdjacentElement('afterend', box);
  }

  function apply() {
    ensureRefundTab();
    ensureDeliverySlotFilter();
    enhanceDeliverySlotLabels();
    refundSummary();
  }

  const api = { apply };
  window.FusionOrders = api;
  window.FusionOwnerRouter?.register?.('orders', { afterRender: apply });
})();
