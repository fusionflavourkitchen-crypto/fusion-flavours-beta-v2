/* Fusion Flavours Kitchen integration
   Shared lifecycle for Menu, Stock, Costings, Cookbook and Prep.
*/
(() => {
  'use strict';

  const KITCHEN_TABS = new Set(['menu','stock','costings','cookbook','prep']);

  function pageFor(tab) {
    return document.getElementById(`page-${tab}`);
  }

  function removeLegacyOwnerTabs(page) {
    if (!page) return;
    page.querySelectorAll(':scope > .ownerAreaTabs:not([data-owner-router-tabs="true"])').forEach(node => node.remove());
  }

  function normaliseInteractiveState(page) {
    if (!page) return;
    page.querySelectorAll('button[disabled], input[disabled], select[disabled], textarea[disabled]').forEach(el => {
      el.setAttribute('aria-disabled', 'true');
    });
  }

  function afterRender(tab) {
    tab = String(tab || '').toLowerCase();
    if (!KITCHEN_TABS.has(tab)) return;
    const page = pageFor(tab);
    if (!page) return;
    removeLegacyOwnerTabs(page);
    normaliseInteractiveState(page);
    page.dataset.fusionFeature = 'kitchen';
    page.dataset.fusionKitchenTab = tab;
  }

  const api = { afterRender, tabs: [...KITCHEN_TABS] };
  window.FusionKitchen = api;

  KITCHEN_TABS.forEach(tab => {
    window.FusionOwnerRouter?.register?.(tab, { afterRender: () => afterRender(tab) });
  });
})();
