/* Fusion Flavours Owner data integration
   Restores the core Owner data loader captured before Harnell was globally appended.
   Feature-specific data belongs to feature lifecycle modules.
*/
(() => {
  'use strict';

  // Capture the canonical loader that remains in the migrated legacy shell.
  // Versioned aliases such as loadOwnerDataV38 are deliberately removed by
  // the server-side migration and therefore cannot be used at runtime.
  const coreOwnerDataLoader = typeof loadOwnerData === 'function'
    ? loadOwnerData
    : null;

  async function loadCore(...args) {
    if (coreOwnerDataLoader) return await coreOwnerDataLoader(...args);
    throw new Error('Core Owner data loader is unavailable');
  }

  window.loadOwnerData = loadCore;
  window.FusionOwnerData = { loadCore };
})();
