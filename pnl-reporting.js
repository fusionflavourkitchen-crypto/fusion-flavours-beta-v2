/* Fusion Flavours P&L reporting
   One reporting path for on-screen finance, email reports and CSV export.
*/
(() => {
  'use strict';

  function money(value) {
    try { return typeof window.money === 'function' ? window.money(Number(value || 0)) : `£${Number(value || 0).toFixed(2)}`; }
    catch (_) { return `£${Number(value || 0).toFixed(2)}`; }
  }

  async function snapshot() {
    await window.FusionFinance?.loadFeatureFinanceData?.();
    const base = window.FusionBusinessFinance?.calculate?.();
    if (!base) throw new Error('P&L calculator is unavailable');
    const deliveryCourierCost = window.FusionFinance?.courierCostForRange?.(base.start, base.end) || 0;
    return {
      ...base,
      deliveryCourierCost,
      operatingProfitAfterDelivery: Number(base.operatingProfit || 0) - Number(deliveryCourierCost || 0)
    };
  }

  function linesFor(data) {
    const lines = [
      { label: 'Total sales', value: money(data.totalRevenue) },
      { label: 'Food sales', value: money(data.foodSales) },
      { label: 'Main delivery income', value: money(data.delivery) },
      { label: 'Catering sales', value: money(data.cateringRevenue) },
      { label: 'Harnell sales', value: money(data.harnellRevenue) },
      { label: 'Food cost', value: money(data.foodCost) },
      { label: 'Catering food cost', value: money(data.cateringFoodCost) },
      { label: 'Harnell food cost', value: money(data.harnellFoodCost) },
      { label: 'Consumables', value: money(data.consCost) },
      { label: 'Waste', value: money(data.wasteCost) },
      { label: 'Labour', value: money(data.labourCost) },
      { label: 'Other logged costs', value: money(data.businessCost) },
      { label: 'Allocated overheads', value: money(data.overheadCost) },
      { label: 'Payment fees', value: money(data.paymentFees) },
      { label: 'Delivery / courier costs', value: money(data.deliveryCourierCost) },
      { label: 'GP %', value: `${Number(data.theoreticalGP || 0).toFixed(1)}%` },
      { label: 'Net profit after delivery costs', value: money(data.operatingProfitAfterDelivery) }
    ];

    (data.foodUsage || []).forEach(item => lines.push({
      label: `Food: ${item.name}`,
      value: `${Number(Number(item.qty || 0).toFixed(3))} ${item.unit || ''} · ${money(item.cost)}`
    }));
    (data.consUsage || []).forEach(item => lines.push({
      label: `Consumable: ${item.name}`,
      value: `${Number(Number(item.qty || 0).toFixed(3))} ${item.unit || ''} · ${money(item.cost)}`
    }));
    (data.overheads || []).forEach(item => lines.push({ label: `Overhead: ${item.name}`, value: money(item.allocated) }));
    return lines;
  }

  async function build() {
    const data = await snapshot();
    let mode = 'daily';
    try { mode = String(performanceMode || 'daily'); } catch (_) {}
    return {
      title: `${mode === 'weekly' ? 'Weekly' : 'Daily'} Profit & Loss`,
      period: data.start + (data.end !== data.start ? ` to ${data.end}` : ''),
      lines: linesFor(data),
      notes: 'Generated from the canonical Fusion Flavours finance calculator, including completed main orders, Fusion at Home data in the base calculator, Catering, Harnell, recipe costs, consumables, waste, labour, overheads and delivery/courier costs.',
      data
    };
  }

  async function email() {
    try {
      const report = await build();
      const response = await window.api('/functions/v1/send-pnl-report', {
        method: 'POST', body: JSON.stringify({ report: { title: report.title, period: report.period, lines: report.lines, notes: report.notes } })
      });
      if (!response?.ok) throw new Error(response?.message || 'Could not send report');
      alert('Full P&L emailed to fusionflavourkitchen@gmail.com');
    } catch (error) { alert(error?.message || String(error)); }
  }

  async function exportCsv() {
    try {
      const report = await build();
      const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
      const csv = [
        ['Fusion Flavours P&L', report.period],
        ['Line', 'Value'],
        ...report.lines.map(line => [line.label, line.value])
      ].map(row => row.map(quote).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Fusion_Flavours_PnL_${report.period.replaceAll(' ', '_')}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) { alert(error?.message || String(error)); }
  }

  const api = { snapshot, build, email, exportCsv };
  window.FusionPnlReporting = api;
  window.buildPnlReport = build;
  window.emailPnl = email;
  window.exportPnlCsv = exportCsv;
})();
