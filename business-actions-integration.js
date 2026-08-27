/* Fusion Flavours Business actions integration
   Prevents internal controls from escaping back into legacy direct renderer calls.
*/
(() => {
  'use strict';

  const show = tab => window.FusionOwnerRouter?.showTab?.(tab);
  const request = (...args) => {
    if (typeof window.api !== 'function') throw new Error('App API is unavailable');
    return window.api(...args);
  };

  window.setPerformanceMode = mode => {
    try { performanceMode = mode === 'weekly' ? 'weekly' : 'daily'; } catch (_) {}
    return show('performance');
  };

  window.setPerformanceDate = value => {
    try { performanceDate = value || (typeof londonDateKey === 'function' ? londonDateKey() : value); } catch (_) {}
    return show('performance');
  };

  window.setPnlViewMode = mode => {
    try { pnlViewMode = mode; } catch (_) {}
    return show('performance');
  };

  window.setPnlPeriod = period => {
    try { pnlSelectedPeriod = Number(period); } catch (_) {}
    return show('performance');
  };

  window.setPnlCustom = (which, value) => {
    try {
      if (which === 'start') pnlCustomStart = value;
      else pnlCustomEnd = value;
    } catch (_) {}
    return show('performance');
  };

  window.changePnlReport = value => {
    try {
      if (value === 'ptd') pnlViewMode = 'ptd';
      else if (value === 'custom') pnlViewMode = 'custom';
      else if (String(value).startsWith('period:')) {
        pnlViewMode = 'period';
        pnlSelectedPeriod = Number(String(value).split(':')[1]);
      }
    } catch (_) {}
    return show('performance');
  };

  window.setTargetMode = mode => {
    try { targetMode = mode === 'weekly' ? 'weekly' : 'daily'; } catch (_) {}
    return show('targets');
  };

  window.setCostsView = view => {
    try { costsView = view; } catch (_) {}
    return show('costs');
  };

  window.setDailyAdminDate = value => {
    try { dailyAdminDate = value || (typeof londonDateKey === 'function' ? londonDateKey() : value); } catch (_) {}
    return show('dailyadmin');
  };

  async function reloadPerformance() {
    const [waste, labour, costs, targets, stock] = await Promise.all([
      request('/rest/v1/waste_logs?select=*&order=waste_date.desc,id.desc&limit=500'),
      request('/rest/v1/labour_logs?select=*&order=work_date.desc,id.desc&limit=500'),
      request('/rest/v1/business_costs?select=*&order=cost_date.desc,id.desc&limit=500'),
      request('/rest/v1/sales_targets?select=*&order=target_date.desc,period_type.asc&limit=500'),
      request('/rest/v1/stock_items?active=eq.true&select=*&order=stock_category.asc,name.asc')
    ]);
    const owner = window.ownerData;
    if (owner) {
      owner.wasteLogs = waste;
      owner.labourLogs = labour;
      owner.businessCosts = costs;
      owner.salesTargets = targets;
      owner.stock = stock;
    }
    return show('performance');
  }

  async function reloadFinance() {
    const [overheads, rules, usage, dailyAdmin, stock, slots] = await Promise.all([
      request('/rest/v1/overhead_costs?active=eq.true&select=*&order=category.asc,name.asc'),
      request('/rest/v1/consumable_rules?active=eq.true&select=*&order=rule_type.asc,id.asc'),
      request('/rest/v1/consumable_usage?select=*&order=usage_date.desc,id.desc&limit=1000'),
      request('/rest/v1/daily_admin?select=*&order=admin_date.desc&limit=180'),
      request('/rest/v1/stock_items?active=eq.true&select=*&order=stock_category.asc,name.asc'),
      request('/rest/v1/delivery_slots?select=*&order=sort_order.asc,start_time.asc')
    ]);
    const owner = window.ownerData;
    if (owner) {
      owner.overheads = overheads;
      owner.consumableRules = rules;
      owner.consumableUsage = usage;
      owner.dailyAdmin = dailyAdmin;
      owner.stock = stock;
      owner.deliverySlots = slots;
    }
    return show('costs');
  }

  async function reloadDailyAdmin() {
    const [orders, waste, labour, costs, usage, dailyAdmin, stock] = await Promise.all([
      request('/rest/v1/orders?select=*,order_items(*)&order=id.desc&limit=600'),
      request('/rest/v1/waste_logs?select=*&order=waste_date.desc,id.desc&limit=500'),
      request('/rest/v1/labour_logs?select=*&order=work_date.desc,id.desc&limit=500'),
      request('/rest/v1/business_costs?select=*&order=cost_date.desc,id.desc&limit=500'),
      request('/rest/v1/consumable_usage?select=*&order=usage_date.desc,id.desc&limit=1000'),
      request('/rest/v1/daily_admin?select=*&order=admin_date.desc&limit=180'),
      request('/rest/v1/stock_items?active=eq.true&select=*&order=stock_category.asc,name.asc')
    ]);
    const owner = window.ownerData;
    if (owner) {
      owner.orders = orders;
      owner.wasteLogs = waste;
      owner.labourLogs = labour;
      owner.businessCosts = costs;
      owner.consumableUsage = usage;
      owner.dailyAdmin = dailyAdmin;
      owner.stock = stock;
    }
    return show('dailyadmin');
  }

  window.reloadPerformanceData = reloadPerformance;
  window.reloadFinanceOps = reloadFinance;
  window.reloadDailyOps = reloadDailyAdmin;
  window.FusionBusinessActions = { reloadPerformance, reloadFinance, reloadDailyAdmin };
})();
