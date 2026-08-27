/* Fusion Flavours legacy state bridge
   The historical index declares core state with let/const, so it is not exposed on window.
   This bridge gives new modules one explicit, stable compatibility boundary while index is being extracted.
*/
(() => {
  'use strict';

  function define(name, getter, setter) {
    try {
      const existing = Object.getOwnPropertyDescriptor(window, name);
      if (existing && !existing.configurable) return;
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: false,
        get: getter,
        set: setter || (() => {})
      });
    } catch (error) {
      console.warn(`Could not bridge ${name}`, error);
    }
  }

  define('ownerData', () => {
    try { return ownerData; } catch (_) { return null; }
  }, value => { try { ownerData = value; } catch (_) {} });

  define('state', () => {
    try { return state; } catch (_) { return null; }
  }, value => { try { state = value; } catch (_) {} });

  define('token', () => {
    try { return token; } catch (_) { return ''; }
  }, value => { try { token = value || ''; } catch (_) {} });

  define('performanceMode', () => {
    try { return performanceMode; } catch (_) { return 'daily'; }
  }, value => { try { performanceMode = value; } catch (_) {} });

  define('performanceDate', () => {
    try { return performanceDate; } catch (_) { return ''; }
  }, value => { try { performanceDate = value; } catch (_) {} });

  define('money', () => {
    try { return money; } catch (_) { return value => `£${Number(value || 0).toFixed(2)}`; }
  });

  define('esc', () => {
    try { return esc; } catch (_) { return value => String(value ?? ''); }
  });

  // Function declarations generally already live on window, but explicitly expose the core API helper too.
  if (typeof window.api !== 'function') {
    try { window.api = api; } catch (_) {}
  }

  window.FusionLegacyState = {
    get ownerData() { return window.ownerData; },
    get state() { return window.state; },
    get token() { return window.token; }
  };
})();
