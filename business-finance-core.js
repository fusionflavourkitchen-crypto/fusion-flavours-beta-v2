/* Fusion Flavours Business finance core
   One canonical calculator for trading P&L.
   Replaces the historical performanceData wrapper chain at runtime.
*/
(() => {
  'use strict';

  function dateInRange(value, start, end) {
    try {
      if (typeof window.inDateRange === 'function') return window.inDateRange(value, start, end);
    } catch (_) {}
    const key = typeof value === 'string' && value.length === 10
      ? value
      : (typeof window.londonDateKey === 'function' ? window.londonDateKey(new Date(value)) : new Date(value).toISOString().slice(0,10));
    return key >= start && key <= end;
  }

  function allocated(start, end, revenue, orderCount) {
    try {
      if (typeof window.allocatedOverheads === 'function') return window.allocatedOverheads(start, end, revenue, orderCount) || [];
    } catch (_) {}
    return [];
  }

  function cateringForRange(start, end) {
    const rows = (window.ownerData?.cateringOrders || [])
      .filter(order => String(order.status || '').toLowerCase() === 'completed' && order.event_date >= start && order.event_date <= end);
    const revenue = rows.reduce((sum, order) => sum + Number(order.total_price_pence || 0) / 100, 0);
    const foodCost = rows.reduce((sum, order) => {
      try { return sum + Number(window.cateringOrderFoodCost?.(order) || 0); }
      catch (_) { return sum; }
    }, 0);
    return { rows, revenue, foodCost };
  }

  function baseSnapshot() {
    // performanceDataV27 is the preserved calculator before later finance/catering wrappers.
    // It is a global lexical binding from the legacy index and remains accessible to classic scripts.
    try {
      if (typeof performanceDataV27 === 'function') return performanceDataV27();
    } catch (_) {}
    throw new Error('Base finance calculator is unavailable');
  }

  function calculate() {
    const data = baseSnapshot();
    const owner = window.ownerData || {};

    const usage = (owner.consumableUsage || []).filter(row => dateInRange(row.usage_date, data.start, data.end));
    const grouped = {};
    usage.forEach(row => {
      const stock = (owner.stock || []).find(item => Number(item.id) === Number(row.stock_item_id));
      const key = Number(row.stock_item_id || 0);
      grouped[key] ??= { name: stock?.name || 'Consumable', unit: stock?.unit || '', qty: 0, cost: 0 };
      grouped[key].qty += Number(row.quantity || 0);
      grouped[key].cost += Number(row.cost_pence || 0) / 100;
    });

    data.consUsage = Object.values(grouped);
    data.consCost = data.consUsage.reduce((sum, row) => sum + Number(row.cost || 0), 0);

    const catering = cateringForRange(data.start, data.end);
    data.cateringRevenue = catering.revenue;
    data.cateringFoodCost = catering.foodCost;
    data.cateringOrders = catering.rows;
    data.foodSales = Number(data.foodSales || 0) + catering.revenue;
    data.totalRevenue = Number(data.totalRevenue || 0) + catering.revenue;
    data.foodCost = Number(data.foodCost || 0) + catering.foodCost;

    data.overheads = allocated(data.start, data.end, data.totalRevenue, (data.orders || []).length + catering.rows.length);
    data.overheadCost = data.overheads.reduce((sum, row) => sum + Number(row.allocated || 0), 0);
    data.paymentFees = data.overheads
      .filter(row => String(row.category || '').toLowerCase().includes('payment'))
      .reduce((sum, row) => sum + Number(row.allocated || 0), 0);

    data.grossProfit = Number(data.foodSales || 0) - Number(data.foodCost || 0) - Number(data.consCost || 0);
    data.theoreticalGP = Number(data.foodSales || 0) > 0 ? data.grossProfit / Number(data.foodSales || 0) * 100 : 0;
    data.operatingProfit = Number(data.totalRevenue || 0)
      - Number(data.foodCost || 0)
      - Number(data.consCost || 0)
      - Number(data.otherUseCost || 0)
      - Number(data.wasteCost || 0)
      - Number(data.labourCost || 0)
      - Number(data.businessCost || 0)
      - Number(data.overheadCost || 0);

    return data;
  }

  const api = { calculate, cateringForRange };
  window.FusionBusinessFinance = api;

  // Make all later callers use the canonical calculation rather than the legacy wrapper chain.
  window.performanceData = calculate;
})();
