/* Fusion Flavours Community Meals Owner integration
   Community Meals data is loaded only when its Owner screen is opened.
*/
(() => {
  'use strict';

  async function beforeRender() {
    try {
      if (typeof loadHarnellOwnerData === 'function') await loadHarnellOwnerData();
      else if (typeof window.loadHarnellOwnerData === 'function') await window.loadHarnellOwnerData();
    } catch (error) {
      throw new Error(`Could not load Community Meals data: ${error?.message || error}`);
    }
  }

  async function render() {
    if (typeof window.renderHarnellAdmin === 'function') return window.renderHarnellAdmin();
    try { if (typeof renderHarnellAdmin === 'function') return renderHarnellAdmin(); } catch (_) {}
    throw new Error('Community Meals Owner renderer is unavailable');
  }

  const api = { beforeRender, render };
  window.FusionHarnellOwner = api;
  window.FusionOwnerRouter?.register?.('harnell', { beforeRender, render });
})();
