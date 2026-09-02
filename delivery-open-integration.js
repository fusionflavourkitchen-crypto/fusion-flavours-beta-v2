/* Fusion Flavours Main Delivery open/closed control.
   Uses settings.preorder_open as the single public service-state flag.
*/
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const isOpen = () => window.state?.settings?.preorder_open === true;

  function injectStyles() {
    if ($('deliveryOpenStyles')) return;
    const style = document.createElement('style');
    style.id = 'deliveryOpenStyles';
    style.textContent = `
      .deliveryOpenBanner{margin:14px 0;padding:16px;border-radius:14px;text-align:center;font-weight:900;border:2px solid #207348;background:#e8f7ee;color:#155b38}
      .deliveryOpenBanner.closed{border-color:#a4261d;background:#fff0ee;color:#8d2019}
      .deliveryOwnerControl{margin:0 0 14px;padding:16px;border:2px solid var(--line);border-radius:16px;background:#fff}
      .deliveryOwnerControl.open{border-color:#207348;background:#effaf3}.deliveryOwnerControl.closed{border-color:#a4261d;background:#fff0ee}
      .deliveryOwnerState{font-size:22px;font-weight:950;margin-bottom:5px}.deliveryOwnerActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      .deliveryOwnerActions button.closeDelivery{background:#9b241c}.deliveryOwnerActions button.openDelivery{background:#207348}
      @media(max-width:560px){.deliveryOwnerActions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function applyCustomerState() {
    const customer = $('customer');
    if (!customer) return;
    let banner = $('deliveryOpenBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'deliveryOpenBanner';
      const hero = customer.querySelector('.hero');
      (hero || customer.firstElementChild)?.insertAdjacentElement('afterend', banner);
    }
    const open = isOpen();
    banner.className = `deliveryOpenBanner ${open ? 'open' : 'closed'}`;
    banner.innerHTML = open
      ? '<b>🟢 Delivery orders are OPEN</b><br><span>Order now and we’ll start preparing your food.</span>'
      : '<b>Delivery orders are closed today, please see open times above.</b>';
    customer.querySelectorAll('.card button').forEach(button => {
      if (button.textContent.trim() === 'Out of stock') return;
      button.disabled = !open;
      if (!open) button.dataset.deliveryClosed = 'true';
      else delete button.dataset.deliveryClosed;
    });
    const checkout = $('orderBtn');
    if (checkout) {
      checkout.disabled = !open;
      checkout.textContent = open ? 'Order & pay securely' : 'Delivery orders are closed';
    }
  }

  async function refreshPublicState() {
    try {
      const rows = await window.api('/rest/v1/settings?id=eq.1&select=preorder_open');
      if (window.state?.settings) window.state.settings.preorder_open = rows?.[0]?.preorder_open === true;
    } catch (error) {
      console.warn('Delivery open status', error);
      if (window.state?.settings) window.state.settings.preorder_open = false;
    }
    applyCustomerState();
    return isOpen();
  }

  function ownerControlHtml() {
    const open = window.ownerData?.settings?.preorder_open === true;
    return `<div id="deliveryOwnerControl" class="deliveryOwnerControl ${open ? 'open' : 'closed'}">
      <div class="deliveryOwnerState">${open ? '🟢 DELIVERY ORDERS OPEN' : '🔴 DELIVERY ORDERS CLOSED'}</div>
      <div>${open ? 'Customers can currently place Main Delivery orders.' : 'Customers cannot place Main Delivery orders.'}</div>
      <div class="deliveryOwnerActions">
        <button class="openDelivery" ${open ? 'disabled' : ''} onclick="setDeliveryOrdersOpen(true)">Open delivery orders</button>
        <button class="closeDelivery" ${open ? '' : 'disabled'} onclick="setDeliveryOrdersOpen(false)">Close delivery orders</button>
      </div>
    </div>`;
  }

  function communityOwnerControlHtml() {
    const open = window.ownerData?.settings?.harnell_enabled === true;
    return `<div id="communityOwnerControl" class="deliveryOwnerControl ${open ? 'open' : 'closed'}">
      <div class="deliveryOwnerState">${open ? '🟢 COMMUNITY ORDERS OPEN' : '🔴 COMMUNITY ORDERS CLOSED'}</div>
      <div>${open ? 'Customers can currently place Community Meals orders.' : 'Customers cannot place Community Meals orders.'}</div>
      <div class="deliveryOwnerActions">
        <button class="openDelivery" ${open ? 'disabled' : ''} onclick="setCommunityOrdersOpen(true)">Open community orders</button>
        <button class="closeDelivery" ${open ? '' : 'disabled'} onclick="setCommunityOrdersOpen(false)">Close community orders</button>
      </div>
    </div>`;
  }

  function enhanceDashboard() {
    const page = $('page-dash');
    if (!page || page.classList.contains('hidden')) return;
    $('deliveryOwnerControl')?.remove();
    $('communityOwnerControl')?.remove();
    page.insertAdjacentHTML('afterbegin', ownerControlHtml() + communityOwnerControlHtml());
  }

  window.setDeliveryOrdersOpen = async open => {
    try {
      await window.api('/rest/v1/settings?id=eq.1', {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ preorder_open: open === true })
      });
      if (window.ownerData?.settings) window.ownerData.settings.preorder_open = open === true;
      if (window.state?.settings) window.state.settings.preorder_open = open === true;
      enhanceDashboard();
      applyCustomerState();
      alert(open ? 'Delivery orders are now OPEN.' : 'Delivery orders are now CLOSED. Customers cannot place an order.');
    } catch (error) { alert('Could not change delivery ordering: ' + (error?.message || error)); }
  };

  window.setCommunityOrdersOpen = async open => {
    try {
      await window.api('/rest/v1/settings?id=eq.1', {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ harnell_enabled: open === true })
      });
      if (window.ownerData?.settings) window.ownerData.settings.harnell_enabled = open === true;
      if (window.state?.settings) window.state.settings.harnell_enabled = open === true;
      enhanceDashboard();
      alert(open ? 'Community orders are now OPEN.' : 'Community orders are now CLOSED. Customers cannot place an order.');
    } catch (error) { alert('Could not change Community ordering: ' + (error?.message || error)); }
  };

  function install() {
    injectStyles();
    try { window.serviceOpen = isOpen; } catch (_) {}

    if (typeof window.renderCustomer === 'function' && !window.renderCustomer.__deliveryOpen) {
      const baseCustomer = window.renderCustomer;
      const wrappedCustomer = function () {
        const result = baseCustomer.apply(this, arguments);
        Promise.resolve(result).then(applyCustomerState);
        return result;
      };
      wrappedCustomer.__deliveryOpen = true;
      window.renderCustomer = wrappedCustomer;
    }

    if (typeof window.addItem === 'function' && !window.addItem.__deliveryOpen) {
      const baseAddItem = window.addItem;
      const guardedAddItem = function () {
        if (!isOpen()) return alert('Delivery orders are closed today, please see open times above.');
        return baseAddItem.apply(this, arguments);
      };
      guardedAddItem.__deliveryOpen = true;
      window.addItem = guardedAddItem;
    }

    if (typeof window.confirmOptions === 'function' && !window.confirmOptions.__deliveryOpen) {
      const baseConfirmOptions = window.confirmOptions;
      const guardedConfirmOptions = function () {
        if (!isOpen()) return alert('Delivery orders are closed today, please see open times above.');
        return baseConfirmOptions.apply(this, arguments);
      };
      guardedConfirmOptions.__deliveryOpen = true;
      window.confirmOptions = guardedConfirmOptions;
    }

    if (typeof window.renderDashboard === 'function' && !window.renderDashboard.__deliveryOpen) {
      const base = window.renderDashboard;
      const wrapped = function () {
        const result = base.apply(this, arguments);
        Promise.resolve(result).then(enhanceDashboard);
        return result;
      };
      wrapped.__deliveryOpen = true;
      window.renderDashboard = wrapped;
    }

    const checkout = $('orderBtn');
    if (checkout && checkout.onclick && !checkout.dataset.deliveryOpenGuard) {
      const original = checkout.onclick;
      checkout.dataset.deliveryOpenGuard = 'true';
      checkout.onclick = async function (event) {
        checkout.disabled = true;
        checkout.textContent = 'Checking availability…';
        const open = await refreshPublicState();
        if (!open) {
          alert('Delivery orders are closed today, please see open times above.');
          return;
        }
        return original.call(this, event);
      };
    }

    applyCustomerState();
  }

  window.FusionDeliveryOpen = { isOpen, refreshPublicState, applyCustomerState, enhanceDashboard, communityOwnerControlHtml };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  setInterval(() => {
    if (!$('customer')?.classList.contains('hidden')) refreshPublicState();
    if (!$('page-dash')?.classList.contains('hidden')) enhanceDashboard();
  }, 15000);
})();
