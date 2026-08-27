/* Fusion Flavours Service Owner integration
   Uses the stable Service renderer and adds Welcome Hub controls explicitly.
*/
(() => {
  'use strict';

  async function render() {
    // renderServiceV38 is the Service renderer captured before the old timer wrapper.
    try {
      if (typeof renderServiceV38 === 'function') renderServiceV38();
      else if (typeof window.renderService === 'function') window.renderService();
      else throw new Error('Service renderer is unavailable');
    } catch (error) {
      throw error;
    }

    if (typeof window.renderWelcomeAdmin === 'function') await window.renderWelcomeAdmin();
    else {
      try { if (typeof renderWelcomeAdmin === 'function') await renderWelcomeAdmin(); } catch (_) {}
    }

    const page = document.getElementById('page-service');
    if (page) page.dataset.fusionFeature = 'service';
  }

  const api = { render };
  window.FusionService = api;
  window.FusionOwnerRouter?.register?.('service', { render });
})();
