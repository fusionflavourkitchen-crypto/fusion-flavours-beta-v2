/* Fusion Flavours Service Owner integration
   Uses the stable Service renderer and adds Service extras synchronously.
*/
(() => {
  'use strict';

  function closeSlotDetails() {
    const page = document.getElementById('page-service');
    if (!page) return;
    [...page.querySelectorAll('details')].forEach(details => {
      const title = details.querySelector(':scope > summary')?.textContent || '';
      if (/Delivery time slots|Add new delivery slot/i.test(title)) details.removeAttribute('open');
    });
  }

  async function render() {
    // renderServiceV38 is captured before the old timer-based Service wrappers.
    if (typeof renderServiceV38 === 'function') renderServiceV38();
    else if (typeof window.renderService === 'function') window.renderService();
    else throw new Error('Service renderer is unavailable');

    if (typeof window.renderWelcomeAdmin === 'function') await window.renderWelcomeAdmin();
    else {
      try { if (typeof renderWelcomeAdmin === 'function') await renderWelcomeAdmin(); } catch (_) {}
    }

    closeSlotDetails();
    const page = document.getElementById('page-service');
    if (page) page.dataset.fusionFeature = 'service';
  }

  const api = { render, closeSlotDetails };
  window.FusionService = api;
  window.FusionOwnerRouter?.register?.('service', { render });
})();
