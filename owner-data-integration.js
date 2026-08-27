/* Fusion Flavours Owner data integration
   Restores the core Owner data loader captured before Harnell was globally appended.
   Feature-specific data belongs to feature lifecycle modules.
*/
(() => {
  'use strict';

  async function loadCore(...args) {
    try {
      if (typeof loadOwnerDataV38 === 'function') return await loadOwnerDataV38(...args);
    } catch (error) {
      throw error;
    }
    throw new Error('Core Owner data loader is unavailable');
  }

  window.loadOwnerData = loadCore;
  window.FusionOwnerData = { loadCore };
})();
