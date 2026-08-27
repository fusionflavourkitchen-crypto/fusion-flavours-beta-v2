/* Fusion Flavours financial-period integration
   PTD, full financial period and custom-range P&L use the canonical range calculator.
*/
(() => {
  'use strict';

  function money(value) {
    try { return typeof window.money === 'function' ? window.money(Number(value || 0)) : `£${Number(value || 0).toFixed(2)}`; }
    catch (_) { return `£${Number(value || 0).toFixed(2)}`; }
  }

  function initialiseSelection() {
    try {
      if (typeof currentFinancialPeriod !== 'function') return;
      const period = currentFinancialPeriod();
      if (period?.no) pnlSelectedPeriod = Number(period.no);
    } catch (_) {}
  }

  function selectedRange() {
    try {
      if (typeof pnlRange === 'function') return pnlRange();
    } catch (_) {}
    const today = typeof window.londonDateKey === 'function' ? window.londonDateKey() : new Date().toISOString().slice(0, 10);
    return { start: today, end: today, label: 'Current' };
  }

  function calculateRange(start, end) {
    const data = window.FusionBusinessFinance?.calculateRange?.(start, end);
    if (!data) throw new Error('Financial range calculator is unavailable');
    const courier = Number(window.FusionFinance?.courierCostForRange?.(start, end) || 0);
    return {
      ...data,
      deliveryCourierCost: courier,
      operatingProfitAfterDelivery: Number(data.operatingProfit || 0) - courier
    };
  }

  function selectedData() {
    const range = selectedRange();
    return { range, data: calculateRange(range.start, range.end) };
  }

  function previousData() {
    try {
      if (typeof finSettings !== 'function' || typeof financialPeriodsFor !== 'function') return null;
      const settings = finSettings();
      const rows = financialPeriodsFor(settings.start, settings.type);
      const range = selectedRange();
      const index = rows.findIndex(row => row.no === Number(range.no));
      if (index <= 0) return null;
      const period = rows[index - 1];
      return { period, data: calculateRange(period.start, period.end) };
    } catch (_) { return null; }
  }

  function report() {
    const { range, data } = selectedData();
    const lines = [
      { label: 'Total sales', value: money(data.totalRevenue) },
      { label: 'Main food sales', value: money(data.mainFoodSales) },
      { label: 'Main delivery income', value: money(data.delivery) },
      { label: 'Fusion at Home sales', value: money(data.retailSales) },
      { label: 'Fusion at Home postage', value: money(data.retailPostage) },
      { label: 'Catering sales', value: money(data.cateringRevenue) },
      { label: 'Harnell sales', value: money(data.harnellRevenue) },
      { label: 'Food cost', value: money(data.foodCost) },
      { label: 'Fusion at Home product cost', value: money(data.retailCost) },
      { label: 'Consumables', value: money(data.consCost) },
      { label: 'Gross profit', value: money(data.grossProfit) },
      { label: 'GP %', value: `${Number(data.theoreticalGP || 0).toFixed(1)}%` },
      { label: 'Waste', value: money(data.wasteCost) },
      { label: 'Labour', value: money(data.labourCost) },
      { label: 'Other logged costs', value: money(data.businessCost) },
      { label: 'Allocated overheads', value: money(data.overheadCost) },
      { label: 'Payment fees (included in overheads)', value: money(data.paymentFees) },
      { label: 'Delivery / courier costs', value: money(data.deliveryCourierCost) },
      { label: 'Net profit after delivery costs', value: money(data.operatingProfitAfterDelivery) }
    ];
    (data.overheads || []).forEach(item => lines.push({ label: `Overhead: ${item.name}`, value: money(item.allocated) }));
    return {
      title: `${range.label || 'Selected period'} Profit & Loss`,
      period: `${range.start} to ${range.end}`,
      lines,
      notes: 'Generated from the canonical Fusion Flavours range calculator: main delivery, Fusion at Home, Catering, Harnell, recipe/product costs, consumables, waste, labour, overheads and courier costs.'
    };
  }

  async function email() {
    try {
      await window.FusionFinance?.loadFeatureFinanceData?.();
      const result = await window.api('/functions/v1/send-pnl-report', {
        method: 'POST', body: JSON.stringify({ report: report() })
      });
      if (!result?.ok) throw new Error(result?.message || 'Could not send report');
      let address = 'fusionflavourkitchen@gmail.com';
      try { address = finSettings().email || address; } catch (_) {}
      alert(`P&L emailed to ${address}`);
    } catch (error) { alert(error?.message || String(error)); }
  }

  async function exportCsv() {
    try {
      await window.FusionFinance?.loadFeatureFinanceData?.();
      const data = report();
      const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
      const csv = [
        ['Fusion Flavours P&L', data.period],
        ['Line', 'Value'],
        ...data.lines.map(line => [line.label, line.value])
      ].map(row => row.map(quote).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Fusion_Flavours_PnL_${data.period.replaceAll(' ', '_')}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) { alert(error?.message || String(error)); }
  }

  initialiseSelection();

  const api = { initialiseSelection, calculateRange, selectedData, previousData, report, email, exportCsv };
  window.FusionFinancialPeriods = api;
  window.performanceDataForRange = calculateRange;
  window.selectedPnlData = selectedData;
  window.previousPeriodData = previousData;
  window.pnlReportForSelection = report;
  window.emailSelectedPnl = email;
  window.exportSelectedPnl = exportCsv;
})();
