/* Fusion Flavours Tide tax bridge
   Produces a cash-basis sales/expense ledger without exposing banking credentials.
*/
(() => {
  'use strict';

  const state = { start: '', end: '' };
  const $ = id => document.getElementById(id);
  const pounds = pence => Number(pence || 0) / 100;
  const dateKey = value => {
    try { return window.londonDateKey(new Date(value)); }
    catch (_) { return new Date(value).toISOString().slice(0, 10); }
  };
  const inRange = (value, start, end) => {
    const key = String(value || '').length === 10 ? String(value) : dateKey(value);
    return key >= start && key <= end;
  };
  const moneyValue = value => typeof window.money === 'function' ? window.money(Number(value || 0)) : `£${Number(value || 0).toFixed(2)}`;
  const escapeHtml = value => typeof window.esc === 'function' ? window.esc(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function defaultBounds() {
    const today = dateKey(new Date());
    const year = Number(today.slice(0, 4));
    const taxStartYear = today.slice(5) < '04-06' ? year - 1 : year;
    return { start: `${taxStartYear}-04-06`, end: today };
  }

  function paymentMethod(order) {
    const value = String(order.payment_method || order.payment_type || order.checkout_method || '').toLowerCase();
    if (/cash|pay_later|pay later/.test(value)) return 'Cash / pay later';
    if (/stripe|card/.test(value) || order.stripe_payment_intent_id || order.payment_intent_id) return 'Card / Stripe';
    return 'Check payment method';
  }

  function saleRows(start, end) {
    const owner = window.ownerData || {};
    const rows = [];
    const add = (orders, source, amountField, statusField = 'payment_status', cancelledField = 'order_status') => {
      (orders || []).forEach(order => {
        const status = String(order[statusField] || '').toLowerCase();
        const cancelled = String(order[cancelledField] || '').toLowerCase() === 'cancelled';
        if (!['paid', 'payment_due', 'pay_later'].includes(status) || cancelled || !inRange(order.created_at || order.event_date, start, end)) return;
        rows.push({
          date: dateKey(order.created_at || order.event_date), type: 'Income', category: 'Sales / turnover',
          description: `${source} ${order.public_id || `#${order.id}`}`, moneyIn: pounds(order[amountField]), moneyOut: 0,
          payment: paymentMethod(order), source, reference: order.public_id || order.id
        });
      });
    };
    add(owner.orders, 'Delivery order', 'total_pence');
    add(owner.retailOrders, 'Postal order', 'total_pence', 'payment_status', 'status');
    add(owner.harnellOrders, 'Community order', 'total_pence', 'payment_status', 'status');
    (owner.cateringOrders || []).forEach(order => {
      if (String(order.status || '').toLowerCase() !== 'completed' || !inRange(order.event_date, start, end)) return;
      rows.push({ date: order.event_date, type: 'Income', category: 'Sales / turnover', description: `Catering ${order.reference || `#${order.id}`}`, moneyIn: pounds(order.total_price_pence), moneyOut: 0, payment: paymentMethod(order), source: 'Catering', reference: order.reference || order.id });
    });
    return rows;
  }

  function refundRows(start, end) {
    return ((window.ownerData || {}).refunds || [])
      .filter(row => String(row.status || '').toLowerCase() === 'succeeded' && inRange(row.processed_at || row.requested_at, start, end))
      .map(row => ({ date: dateKey(row.processed_at || row.requested_at), type: 'Income adjustment', category: 'Sales refunds', description: `Refund ${row.order_public_id || `#${row.order_id}`}`, moneyIn: -pounds(row.amount_pence), moneyOut: 0, payment: 'Original payment method', source: row.order_type || 'Order', reference: row.stripe_refund_id || row.id }));
  }

  function hmrcExpenseCategory(category) {
    const value = String(category || '').toLowerCase();
    if (/food|stock|ingredient|consumable|packag/.test(value)) return 'Cost of goods bought for resale';
    if (/fuel|delivery|travel|vehicle|parking/.test(value)) return 'Car, van and travel expenses';
    if (/labour|staff|wage|driver|courier/.test(value)) return 'Wages, salaries and other staff costs';
    if (/rent|kitchen|premises|heat|light/.test(value)) return 'Rent, rates, power and insurance';
    if (/phone|communication|office|stationery|software|website/.test(value)) return 'Phone, office and other business expenses';
    if (/market|advert|facebook|google|tiktok|flyer/.test(value)) return 'Advertising and business entertainment costs';
    if (/bank|payment|platform|stripe|insurance|interest/.test(value)) return 'Bank, card and financial charges';
    if (/equipment|tool|utensil|knife|pan/.test(value)) return 'Other allowable business expenses';
    return 'Other allowable business expenses';
  }

  function expenseRows(start, end) {
    return ((window.ownerData || {}).businessCosts || [])
      .filter(row => inRange(row.cost_date, start, end))
      .map(row => ({ date: row.cost_date, type: 'Expense', category: hmrcExpenseCategory(row.category), description: row.notes || row.category || 'Business expense', moneyIn: 0, moneyOut: pounds(row.amount_pence), payment: /Tide:/i.test(row.notes || '') ? 'Tide' : 'Check payment account', source: 'Business costs', reference: row.id }));
  }

  function ledger(start, end) {
    return [...saleRows(start, end), ...refundRows(start, end), ...expenseRows(start, end)]
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.reference).localeCompare(String(b.reference)));
  }

  function summary(start, end) {
    const rows = ledger(start, end);
    const income = rows.reduce((sum, row) => sum + Number(row.moneyIn || 0), 0);
    const expenses = rows.reduce((sum, row) => sum + Number(row.moneyOut || 0), 0);
    const cash = rows.filter(row => row.moneyIn > 0 && row.payment === 'Cash / pay later').reduce((sum, row) => sum + row.moneyIn, 0);
    const uncertain = rows.filter(row => /Check/.test(row.payment)).length;
    return { rows, income, expenses, profit: income - expenses, cash, uncertain };
  }

  function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
  function download(name, content) {
    const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob); anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  }

  function exportLedger() {
    const start = $('tideTaxStart')?.value || state.start, end = $('tideTaxEnd')?.value || state.end;
    const headings = ['Date', 'Type', 'HMRC category', 'Description', 'Money in', 'Money out', 'Payment method', 'Fusion source', 'Reference'];
    const lines = ledger(start, end).map(row => [row.date, row.type, row.category, row.description, row.moneyIn.toFixed(2), row.moneyOut.toFixed(2), row.payment, row.source, row.reference]);
    download(`Fusion_Flavours_Tide_Tax_Ledger_${start}_${end}.csv`, [headings, ...lines].map(row => row.map(csvCell).join(',')).join('\n'));
  }

  function exportSummary() {
    const start = $('tideTaxStart')?.value || state.start, end = $('tideTaxEnd')?.value || state.end, data = summary(start, end);
    const grouped = {};
    data.rows.forEach(row => { grouped[row.category] = (grouped[row.category] || 0) + row.moneyIn - row.moneyOut; });
    const lines = [['Period', `${start} to ${end}`], ['Total sales after refunds', data.income.toFixed(2)], ['Allowable expenses recorded', data.expenses.toFixed(2)], ['Estimated cash-basis profit', data.profit.toFixed(2)], [], ['Category', 'Net amount'], ...Object.entries(grouped).map(([key, value]) => [key, value.toFixed(2)])];
    download(`Fusion_Flavours_Tide_Tax_Summary_${start}_${end}.csv`, lines.map(row => row.map(csvCell).join(',')).join('\n'));
  }

  function setRange() {
    state.start = $('tideTaxStart')?.value || state.start;
    state.end = $('tideTaxEnd')?.value || state.end;
    render();
  }

  function render() {
    const page = $('page-tax');
    if (!page) return;
    if (!state.start) Object.assign(state, defaultBounds());
    const data = summary(state.start, state.end);
    page.innerHTML = `<h2>Tide Tax</h2>
      <div class="bankHero"><b>Fusion → Tide tax bridge</b><p class="muted">Tide already receives your bank transactions. This screen supplies the information a bank feed cannot know on its own: gross order sales, cash orders, refunds and expenses recorded in Fusion.</p></div>
      <div class="logGrid"><label>From<input id="tideTaxStart" type="date" value="${escapeHtml(state.start)}"></label><label>To<input id="tideTaxEnd" type="date" value="${escapeHtml(state.end)}"></label></div>
      <button style="width:100%;margin:8px 0 12px" onclick="FusionTideTax.setRange()">Update tax period</button>
      <div class="bankStats"><div class="bankStat"><b>${moneyValue(data.income)}</b><small>Sales after refunds</small></div><div class="bankStat"><b>${moneyValue(data.expenses)}</b><small>Recorded expenses</small></div><div class="bankStat"><b>${moneyValue(data.profit)}</b><small>Estimated profit</small></div></div>
      <div class="bankSyncCard"><h3>Ready for Tide</h3>
        <div class="bankReconRow"><span>Ledger entries</span><b>${data.rows.length}</b></div>
        <div class="bankReconRow"><span>Cash / pay-later sales to add</span><b class="${data.cash ? 'bankStatusWarn' : 'bankStatusGood'}">${moneyValue(data.cash)}</b></div>
        <div class="bankReconRow"><span>Payment methods needing review</span><b class="${data.uncertain ? 'bankStatusWarn' : 'bankStatusGood'}">${data.uncertain}</b></div>
        <div class="bankActions" style="margin-top:12px"><button onclick="FusionTideTax.exportLedger()">⬇ Export transaction ledger</button><button style="background:#333" onclick="FusionTideTax.exportSummary()">⬇ Export tax summary</button></div>
      </div>
      <div class="notice"><b>Important:</b> do not count Stripe’s net payout as another sale. Fusion records the customer’s gross sale; Tide records the payout and Stripe fee. Match them during reconciliation.</div>
      <details class="performanceDetail"><summary>What still happens in Tide</summary><div class="ownerDropBody"><ol><li>Turn on Tide’s free MTD for Income Tax feature and authorise HMRC.</li><li>Categorise Tide bank transactions and photograph purchase receipts.</li><li>Add cash sales and any personally paid business expenses shown here.</li><li>Use this ledger to check Tide’s total before filing.</li></ol><p class="muted">The connection is deliberately read-only/export based. Fusion never asks for or stores your Tide password or banking consent token.</p></div></details>`;
  }

  const api = { render, setRange, exportLedger, exportSummary, ledger, summary };
  window.FusionTideTax = api;
  window.FusionOwnerRouter?.register?.('tax', { render });
})();
