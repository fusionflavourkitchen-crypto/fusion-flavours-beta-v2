/* Fusion Flavours finance integration
   Explicit feature integration: no runtime wrapping of performanceData/renderPerformance.
*/
(() => {
  'use strict';

  const state = { jobs: [], loaded: false, loading: null };
  const $ = id => document.getElementById(id);

  function dateKey(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(d);
    const get = type => parts.find(x => x.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function moneyValue(value) {
    try { return typeof window.money === 'function' ? window.money(Number(value || 0)) : `£${Number(value || 0).toFixed(2)}`; }
    catch (_) { return `£${Number(value || 0).toFixed(2)}`; }
  }

  async function load(force = false) {
    if (state.loaded && !force) return state.jobs;
    if (state.loading) return state.loading;
    if (typeof window.api !== 'function') return [];
    state.loading = window.api('/rest/v1/delivery_jobs?select=*&order=created_at.desc&limit=1000')
      .then(rows => {
        state.jobs = Array.isArray(rows) ? rows : [];
        state.loaded = true;
        return state.jobs;
      })
      .finally(() => { state.loading = null; });
    return state.loading;
  }

  function courierCostForRange(start, end) {
    return state.jobs
      .filter(job => {
        if (!['delivered', 'collected', 'assigned', 'requested'].includes(String(job.status || ''))) return false;
        const day = dateKey(job.delivered_at || job.updated_at || job.created_at);
        return day && day >= start && day <= end;
      })
      .reduce((sum, job) => sum + Number(job.actual_cost_pence || 0) / 100, 0);
  }

  async function performanceSnapshot(force = false) {
    await load(force);
    if (typeof window.performanceData !== 'function') return null;
    const base = window.performanceData();
    if (!base) return null;
    const courierCost = courierCostForRange(base.start, base.end);
    return {
      ...base,
      deliveryCourierCost: courierCost,
      operatingProfitAfterDelivery: Number(base.operatingProfit || 0) - courierCost
    };
  }

  async function applyPerformanceView() {
    const page = $('page-performance');
    if (!page) return;
    const data = await performanceSnapshot(true);
    if (!data) return;

    page.querySelectorAll('[data-finance-delivery-card]').forEach(node => node.remove());
    const cards = page.querySelector('.performanceCards');
    if (cards) {
      const deliveryCard = document.createElement('div');
      deliveryCard.className = 'performanceCard';
      deliveryCard.dataset.financeDeliveryCard = 'true';
      deliveryCard.innerHTML = `${moneyValue(data.deliveryCourierCost)}<small>Delivery / courier costs</small>`;
      cards.appendChild(deliveryCard);

      const profitCard = cards.querySelectorAll('.performanceCard')[3];
      if (profitCard) {
        profitCard.classList.toggle('good', data.operatingProfitAfterDelivery >= 0);
        profitCard.classList.toggle('bad', data.operatingProfitAfterDelivery < 0);
        profitCard.innerHTML = `${moneyValue(data.operatingProfitAfterDelivery)}<small>Profit after tracked + delivery costs</small>`;
      }
    }

    let note = page.querySelector('[data-finance-delivery-note]');
    if (!note) {
      note = document.createElement('div');
      note.className = 'notice';
      note.dataset.financeDeliveryNote = 'true';
      const firstDetail = page.querySelector('.performanceDetail');
      if (firstDetail) firstDetail.parentNode.insertBefore(note, firstDetail); else page.appendChild(note);
    }
    note.innerHTML = `<b>Delivery costs included:</b> ${moneyValue(data.deliveryCourierCost)} for ${data.start}${data.end !== data.start ? ` → ${data.end}` : ''}.`;
  }

  function enrichReport(report, data) {
    if (!report || !data) return report;
    const lines = Array.isArray(report.lines) ? [...report.lines] : [];
    lines.push({ label: 'Delivery / courier costs', value: moneyValue(data.deliveryCourierCost || 0) });
    return {
      ...report,
      lines,
      notes: `${report.notes || ''} Delivery / courier costs are read directly from Delivery jobs.`.trim()
    };
  }

  const api = { load, courierCostForRange, performanceSnapshot, applyPerformanceView, enrichReport, state };
  window.FusionFinance = api;
  window.FusionOwnerRouter?.register?.('performance', {
    beforeRender: () => load(true),
    afterRender: applyPerformanceView
  });
})();
