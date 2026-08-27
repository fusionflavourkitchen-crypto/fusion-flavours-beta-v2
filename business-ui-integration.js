/* Fusion Flavours Business UI integration
   Makes Trading Performance composition explicit instead of relying on renderer wrappers and timers.
*/
(() => {
  'use strict';

  async function renderPerformancePage() {
    // _renderPerformanceV323 is the Performance renderer captured before the whole-dish waste wrapper.
    // It already contains the established trading/overhead presentation but not later timer-based composition.
    let rendered = false;
    try {
      if (typeof _renderPerformanceV323 === 'function') {
        await _renderPerformanceV323();
        rendered = true;
      }
    } catch (error) {
      console.warn('Stable Performance base unavailable', error);
    }
    if (!rendered) {
      try {
        if (typeof renderPerformanceV33 === 'function') {
          await renderPerformanceV33();
          rendered = true;
        }
      } catch (_) {}
    }
    if (!rendered && typeof window.renderPerformance === 'function') await window.renderPerformance();

    try { if (typeof enhanceTradingWaste === 'function') enhanceTradingWaste(); } catch (_) {}
    try { if (typeof renderFinancialPnlPanel === 'function') renderFinancialPnlPanel(); } catch (error) { console.warn('Financial P&L panel', error); }
    try { if (typeof tidyTradingPerformanceV332 === 'function') tidyTradingPerformanceV332(); } catch (_) {}

    const page = document.getElementById('page-performance');
    if (page) page.dataset.fusionFeature = 'business-performance';
  }

  async function afterRender() {
    await window.FusionFinance?.applyPerformanceView?.();
  }

  const api = { renderPerformancePage, afterRender };
  window.FusionBusinessUI = api;
  window.FusionOwnerRouter?.register?.('performance', {
    beforeRender: window.FusionFinance?.loadFeatureFinanceData,
    render: renderPerformancePage,
    afterRender
  });
})();
