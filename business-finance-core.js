/* Fusion Flavours Business finance core
   One canonical calculator for current, daily, weekly and financial-period P&L.
*/
(() => {
  'use strict';

  function dateInRange(value, start, end) {
    try {
      if (typeof window.inDateRange === 'function') return window.inDateRange(value, start, end);
    } catch (_) {}
    const key = typeof value === 'string' && value.length === 10
      ? value
      : (typeof window.londonDateKey === 'function' ? window.londonDateKey(new Date(value)) : new Date(value).toISOString().slice(0, 10));
    return key >= start && key <= end;
  }

  function allocated(start, end, revenue, orderCount) {
    try {
      if (typeof window.allocatedOverheads === 'function') return window.allocatedOverheads(start, end, revenue, orderCount) || [];
    } catch (_) {}
    try {
      if (typeof allocatedOverheads === 'function') return allocatedOverheads(start, end, revenue, orderCount) || [];
    } catch (_) {}
    return [];
  }

  function usageForOrders(orders) {
    try {
      if (typeof calculateUsage === 'function') return calculateUsage(orders) || [];
    } catch (_) {}
    try {
      if (typeof window.calculateUsage === 'function') return window.calculateUsage(orders) || [];
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

  function harnellLineCost(line) {
    const owner = window.ownerData || {};
    const recipe = (owner.recipes || []).find(recipe => Number(recipe.item_id) === Number(line.item_id) && recipe.active !== false);
    if (!recipe) return 0;
    const batchCost = (owner.recipeIngredients || [])
      .filter(ingredient => Number(ingredient.recipe_id) === Number(recipe.id))
      .reduce((sum, ingredient) => {
        const stock = (owner.stock || []).find(item => Number(item.id) === Number(ingredient.stock_item_id));
        return sum + Number(ingredient.quantity || 0) * Number(stock?.cost_per_unit || 0);
      }, 0);
    return batchCost / Math.max(0.001, Number(recipe.yield_qty || 1)) * Number(line.quantity || 0);
  }

  function harnellForRange(start, end) {
    const owner = window.ownerData || {};
    const orders = (owner.harnellOrders || []).filter(order => {
      if (String(order.status || '').toLowerCase() !== 'completed') return false;
      return dateInRange(order.created_at, start, end);
    });
    const lines = owner.harnellOrderItems || [];
    const revenue = orders.reduce((sum, order) => sum + Number(order.total_pence || 0) / 100, 0);
    const foodCost = orders.reduce((sum, order) => {
      const orderLines = lines.filter(line => Number(line.harnell_order_id) === Number(order.id));
      return sum + orderLines.reduce((lineSum, line) => lineSum + harnellLineCost(line), 0);
    }, 0);
    return { rows: orders, revenue, foodCost };
  }

  function consumablesForRange(start, end, recipeConsumables = []) {
    const owner = window.ownerData || {};
    const live = (owner.consumableUsage || []).filter(row => dateInRange(row.usage_date, start, end));
    if (!live.length) {
      const groupedRecipe = {};
      recipeConsumables.forEach(row => {
        const key = row.id || row.stock_item_id || row.name;
        groupedRecipe[key] ??= { name: row.name || 'Consumable', unit: row.unit || '', qty: 0, cost: 0 };
        groupedRecipe[key].qty += Number(row.qty || 0);
        groupedRecipe[key].cost += Number(row.cost || 0);
      });
      return Object.values(groupedRecipe);
    }
    const grouped = {};
    live.forEach(row => {
      const stock = (owner.stock || []).find(item => Number(item.id) === Number(row.stock_item_id));
      const key = Number(row.stock_item_id || 0);
      grouped[key] ??= { name: stock?.name || 'Consumable', unit: stock?.unit || '', qty: 0, cost: 0 };
      grouped[key].qty += Number(row.quantity || 0);
      grouped[key].cost += Number(row.cost_pence || 0) / 100;
    });
    return Object.values(grouped);
  }

  function calculateRange(start, end) {
    const owner = window.ownerData || {};
    const orders = (owner.orders || []).filter(order => {
      return order.payment_status === 'paid' && order.order_status !== 'cancelled' && dateInRange(order.created_at, start, end);
    });
    const retailOrders = (owner.retailOrders || []).filter(order => {
      return order.payment_status === 'paid' && order.status !== 'cancelled' && dateInRange(order.created_at, start, end);
    });

    const usage = usageForOrders(orders);
    const foodUsage = usage.filter(row => ['food', 'prepared'].includes(row.type));
    const recipeConsumables = usage.filter(row => row.type === 'consumable');
    const otherUsage = usage.filter(row => !['food', 'prepared', 'consumable'].includes(row.type));

    const mainFoodSales = orders.reduce((sum, order) => sum + Number(order.subtotal_pence || 0), 0) / 100;
    const delivery = orders.reduce((sum, order) => sum + Number(order.delivery_fee_pence || 0), 0) / 100;
    const retailSales = retailOrders.reduce((sum, order) => sum + Number(order.subtotal_pence || 0), 0) / 100;
    const retailPostage = retailOrders.reduce((sum, order) => sum + Number(order.postage_pence || 0), 0) / 100;
    const retailCost = retailOrders.reduce((sum, order) => sum + (order.retail_order_items || []).reduce((lineSum, line) => {
      return lineSum + Number(line.unit_cost_pence || 0) * Number(line.quantity || 0) / 100;
    }, 0), 0);

    const mainFoodCost = foodUsage.reduce((sum, row) => sum + Number(row.cost || 0), 0);
    const otherUseCost = otherUsage.reduce((sum, row) => sum + Number(row.cost || 0), 0);
    const consUsage = consumablesForRange(start, end, recipeConsumables);
    const consCost = consUsage.reduce((sum, row) => sum + Number(row.cost || 0), 0);

    const waste = (owner.wasteLogs || []).filter(row => dateInRange(row.waste_date, start, end));
    const wasteCost = waste.reduce((sum, row) => sum + Number(row.cost_pence || 0) / 100, 0);
    const labour = (owner.labourLogs || []).filter(row => dateInRange(row.work_date, start, end));
    const labourCost = labour.reduce((sum, row) => sum + Number(row.hours || 0) * Number(row.hourly_rate || 0), 0);
    const costs = (owner.businessCosts || []).filter(row => dateInRange(row.cost_date, start, end));
    const businessCost = costs.reduce((sum, row) => sum + Number(row.amount_pence || 0) / 100, 0);

    const catering = cateringForRange(start, end);
    const harnell = harnellForRange(start, end);

    const foodSales = mainFoodSales + catering.revenue + harnell.revenue;
    const foodCost = mainFoodCost + catering.foodCost + harnell.foodCost;
    const totalRevenue = mainFoodSales + delivery + retailSales + retailPostage + catering.revenue + harnell.revenue;
    const orderCount = orders.length + retailOrders.length + catering.rows.length + harnell.rows.length;
    const overheads = allocated(start, end, totalRevenue, orderCount);
    const overheadCost = overheads.reduce((sum, row) => sum + Number(row.allocated || 0), 0);
    const paymentFees = overheads
      .filter(row => String(row.category || '').toLowerCase().includes('payment'))
      .reduce((sum, row) => sum + Number(row.allocated || 0), 0);

    const productSales = foodSales + retailSales;
    const productCost = foodCost + retailCost + consCost;
    const grossProfit = productSales - productCost;
    const theoreticalGP = productSales > 0 ? grossProfit / productSales * 100 : 0;
    const operatingProfit = totalRevenue
      - foodCost
      - retailCost
      - consCost
      - otherUseCost
      - wasteCost
      - labourCost
      - businessCost
      - overheadCost;

    return {
      start, end, orders, retailOrders, usage, foodUsage, consUsage, otherUsage,
      foodSales, mainFoodSales, delivery, retailSales, retailPostage, retailCost, totalRevenue,
      foodCost, mainFoodCost, consCost, otherUseCost,
      waste, wasteCost, labour, labourCost, costs, businessCost,
      cateringRevenue: catering.revenue, cateringFoodCost: catering.foodCost, cateringOrders: catering.rows,
      harnellRevenue: harnell.revenue, harnellFoodCost: harnell.foodCost, harnellOrders: harnell.rows,
      overheads, overheadCost, paymentFees, grossProfit, theoreticalGP, operatingProfit
    };
  }

  function currentBounds() {
    try {
      if (typeof periodBounds === 'function') return periodBounds();
    } catch (_) {}
    const today = typeof window.londonDateKey === 'function' ? window.londonDateKey() : new Date().toISOString().slice(0, 10);
    return { start: today, end: today };
  }

  function calculate() {
    const { start, end } = currentBounds();
    return calculateRange(start, end);
  }

  const api = { calculate, calculateRange, cateringForRange, harnellForRange };
  window.FusionBusinessFinance = api;
  window.performanceData = calculate;
  window.performanceDataForRange = calculateRange;
})();
