/* Fusion Flavours - Catering policy module */
(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const pounds = pence => `£${(Number(pence || 0) / 100).toFixed(2)}`;
  const moneyLocal = value => `£${Number(value || 0).toFixed(2)}`;

  function workingDaysBefore(dateText, days) {
    if (!dateText) return '';
    const date = new Date(`${dateText}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return '';
    let left = Number(days || 0);
    while (left > 0) {
      date.setUTCDate(date.getUTCDate() - 1);
      const dow = date.getUTCDay();
      if (dow !== 0 && dow !== 6) left -= 1;
    }
    return date.toISOString().slice(0, 10);
  }

  function formatDate(dateText) {
    if (!dateText) return '—';
    try {
      return new Date(`${dateText}T12:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
      });
    } catch (_) {
      return dateText;
    }
  }

  function packages() {
    try {
      if (typeof window.__fusionGetCateringPackages === 'function') return window.__fusionGetCateringPackages() || [];
      return window.cateringPackages || [];
    } catch (_) {
      return [];
    }
  }

  function getOwnerData() {
    try {
      if (typeof window.__fusionGetOwnerData === 'function') return window.__fusionGetOwnerData();
      return window.ownerData || null;
    } catch (_) {
      return null;
    }
  }

  function selectedPackage() {
    const id = Number(byId('cePackageId')?.value || 0);
    return packages().find(item => Number(item.id) === id) || null;
  }

  function updateCustomerDepositNotice() {
    const notice = byId('cateringDepositNotice');
    if (!notice) return;

    const guests = Math.max(0, Number(byId('ceGuests')?.value || 0));
    const pack = selectedPackage();
    const total = pack ? Number(pack.price_per_head || 0) * guests : 0;
    const deposit = total * 0.5;

    let html = '<b>Booking deposit:</b> 50% of the agreed catering total';
    if (pack && guests) {
      html += ` · ${guests} guests at ${moneyLocal(Number(pack.price_per_head || 0))} = ${moneyLocal(total)} total · <b>${moneyLocal(deposit)} deposit</b>`;
    }
    html += '<br><span class="muted">The remaining 50% is due 3 working days before the event.</span>';
    notice.innerHTML = html;

    const pay = byId('cateringBookPay');
    if (pay) pay.textContent = 'Book package & pay 50% deposit';
  }

  function renderPaymentPolicyPanel() {
    const input = byId('cat_deposit_head');
    if (!input) return;
    const panel = input.closest('.panel');
    if (!panel || panel.dataset.fixedDepositPolicy === '1') return;
    panel.dataset.fixedDepositPolicy = '1';
    panel.innerHTML = '<h2>Catering payment policy</h2><div class="notice"><b>50% booking deposit</b><br>The booking is confirmed once the deposit is paid. The remaining 50% is due 3 working days before the event.</div><p class="muted">For a £250 booking this means £125 deposit and £125 final balance.</p>';
  }

  function enhanceNewBooking() {
    const total = byId('cat_new_total');
    const deposit = byId('cat_new_deposit');
    if (!total || !deposit || deposit.dataset.policyReady === '1') return;

    deposit.dataset.policyReady = '1';
    deposit.setAttribute('placeholder', '50% of agreed total');

    const label = deposit.closest('label');
    if (label && !label.querySelector('.depositPolicyHint')) {
      const hint = document.createElement('small');
      hint.className = 'muted depositPolicyHint';
      hint.style.display = 'block';
      hint.textContent = 'Default: 50% booking deposit';
      label.appendChild(hint);
    }

    const suggested = () => {
      const typed = Number(total.value || 0);
      if (typed > 0) return typed;
      try {
        if (typeof window.__fusionCateringSuggestedTotal === 'function') return Number(window.__fusionCateringSuggestedTotal() || 0);
        return Number(window.cateringSuggestedTotal?.() || 0);
      } catch (_) {
        return 0;
      }
    };

    const sync = () => {
      if (deposit.dataset.manual === '1') return;
      const value = suggested();
      deposit.value = value > 0 ? (value * 0.5).toFixed(2) : '0.00';
    };

    total.addEventListener('input', sync);
    deposit.addEventListener('input', () => { deposit.dataset.manual = '1'; });
    sync();

    const panel = total.closest('.panel');
    if (panel && !panel.querySelector('.newCateringPolicyNotice')) {
      const note = document.createElement('div');
      note.className = 'notice newCateringPolicyNotice';
      note.style.marginTop = '10px';
      note.innerHTML = '<b>Payment schedule:</b> 50% to secure the booking · remaining 50% due 3 working days before the event.';
      const save = Array.from(panel.querySelectorAll('button')).find(button => /Save catering booking/i.test(button.textContent || ''));
      if (save) panel.insertBefore(note, save); else panel.appendChild(note);
    }
  }

  function orderFor(id) {
    return getOwnerData()?.cateringOrders?.find(order => Number(order.id) === Number(id)) || null;
  }

  async function setDeposit50(id) {
    const total = byId(`cb_total_${id}`);
    const deposit = byId(`cb_deposit_${id}`);
    if (!total || !deposit) return;
    deposit.value = (Math.max(0, Number(total.value || 0)) * 0.5).toFixed(2);
    if (typeof window.__fusionSaveCateringBooking === 'function') await window.__fusionSaveCateringBooking(id);
    else if (typeof window.saveCateringBooking === 'function') await window.saveCateringBooking(id);
  }

  async function copyBalanceLink(id) {
    try {
      const order = orderFor(id);
      if (!order?.public_token) throw new Error('Booking payment reference is missing.');
      const total = Number(order.total_price_pence || 0);
      const paid = Number(order.amount_paid_pence || 0);
      const due = Math.max(0, total - paid);
      if (due < 30) throw new Error('This booking has no outstanding balance.');

      const result = await window.api('/functions/v1/create-catering-balance-checkout', {
        method: 'POST', body: JSON.stringify({ order_id: order.id, public_token: order.public_token })
      });
      if (!result?.url) throw new Error(result?.message || 'Could not create balance payment link.');

      try {
        await navigator.clipboard.writeText(result.url);
        alert(`Balance payment link copied. Amount due: ${pounds(due)}`);
      } catch (_) {
        window.prompt('Copy this balance payment link:', result.url);
      }
    } catch (error) {
      alert(error?.message || String(error));
    }
  }

  function enhanceBookingCards() {
    document.querySelectorAll('.cateringBooking').forEach(card => {
      const totalInput = card.querySelector('input[id^="cb_total_"]');
      if (!totalInput) return;
      const id = Number(totalInput.id.replace('cb_total_', ''));
      const order = id ? orderFor(id) : null;
      if (!order) return;

      const total = Number(order.total_price_pence || 0) / 100;
      const paid = Number(order.amount_paid_pence || 0) / 100;
      const target = total * 0.5;
      const balance = Math.max(0, total - paid);
      let foodCost = 0;
      try {
        if (typeof window.__fusionCateringOrderFoodCost === 'function') foodCost = Number(window.__fusionCateringOrderFoodCost(order) || 0);
        else if (typeof window.cateringOrderFoodCost === 'function') foodCost = Number(window.cateringOrderFoodCost(order) || 0);
      } catch (_) {}

      const projected = Math.max(0, total - foodCost);
      const dueDate = workingDaysBefore(order.event_date, 3);
      let box = card.querySelector('.cateringPaymentPolicyBox');

      const html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">
        <div><b>${moneyLocal(target)}</b><br><small>50% deposit target</small></div>
        <div><b>${moneyLocal(balance)}</b><br><small>Outstanding balance</small></div>
        <div><b>${formatDate(dueDate)}</b><br><small>Balance due date</small></div>
        <div><b>${moneyLocal(projected)}</b><br><small>Projected gross after recipe food cost</small></div>
      </div>
      <div class="split" style="margin-top:9px">
        <button type="button" onclick="setCateringDeposit50(${id})">Set deposit to 50%</button>
        <button type="button" ${balance < 0.30 ? 'disabled' : ''} onclick="copyCateringBalanceLink(${id})">Copy balance payment link</button>
      </div>
      <p class="muted" style="margin:8px 0 0">Policy: 50% secures the booking. Final balance is due 3 working days before the event.</p>`;

      if (!box) {
        box = document.createElement('div');
        box.className = 'notice cateringPaymentPolicyBox';
        box.style.margin = '10px 0';
        const totals = card.querySelector('.cateringTotals');
        if (totals?.parentNode) totals.parentNode.insertBefore(box, totals.nextSibling); else card.appendChild(box);
      }
      box.innerHTML = html;
    });
  }

  function showBalanceStatus() {
    const query = new URLSearchParams(location.search);
    if (query.get('balance') === 'success' && !window.__cateringBalanceSuccessShown) {
      window.__cateringBalanceSuccessShown = true;
      alert('✅ Catering balance received. Your booking is fully paid.');
    }
    if (query.get('balance') === 'cancelled' && !window.__cateringBalanceCancelledShown) {
      window.__cateringBalanceCancelledShown = true;
      alert('Balance payment was cancelled. The outstanding balance is still due.');
    }
  }

  function apply() {
    updateCustomerDepositNotice();
    renderPaymentPolicyPanel();
    enhanceNewBooking();
    enhanceBookingCards();
    showBalanceStatus();
  }

  window.setCateringDeposit50 = setDeposit50;
  window.copyCateringBalanceLink = copyBalanceLink;
  window.updateCustomerDepositNotice = updateCustomerDepositNotice;
  window.FusionCateringPolicy = { apply, updateCustomerDepositNotice, setDeposit50, copyBalanceLink };

  document.addEventListener('input', event => {
    if (event.target?.id === 'ceGuests' || event.target?.id === 'cePackageId') updateCustomerDepositNotice();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
})();
