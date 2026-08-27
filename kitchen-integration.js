/* Fusion Flavours Kitchen integration
   Shared lifecycle for Menu, Stock, Costings, Cookbook and Prep.
*/
(() => {
  'use strict';

  const KITCHEN_TABS = new Set(['menu','stock','costings','cookbook','prep']);

  function pageFor(tab) { return document.getElementById(`page-${tab}`); }
  function rerender(tab) { return window.FusionOwnerRouter?.showTab?.(tab); }

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

  function installStableActions() {
    window.setStockView = value => { try { stockView = value; } catch (_) {} return rerender('stock'); };
    window.setManageStockCategory = value => { try { manageStockCategory = value; } catch (_) {} return rerender('stock'); };
    window.setStockGroup = value => { try { stockGroup = value; } catch (_) {} return rerender('stock'); };

    window.setCostTab = value => {
      try { costTab = value; costingGroup = 'All'; } catch (_) {}
      return rerender('costings');
    };
    window.setCostingGroup = value => { try { costingGroup = value; } catch (_) {} return rerender('costings'); };

    window.setRecipeGroup = value => {
      try {
        recipeGroup = value;
        const recipes = (window.ownerData?.recipes || []).filter(recipe => (recipe.recipe_group || 'Other') === value);
        selectedRecipeId = recipes[0]?.id || null;
      } catch (_) {}
      return rerender('cookbook');
    };
    window.selectRecipe = id => { try { selectedRecipeId = Number(id); } catch (_) {} return rerender('cookbook'); };
    window.setRecipeView = value => { try { recipeViewMode = value; } catch (_) {} return rerender('cookbook'); };
    window.setRecipeScale = value => { try { recipeScaleQty = Math.max(.001, Number(value || 1)); } catch (_) {} return rerender('cookbook'); };
  }

  const api = { afterRender, rerender, installStableActions, tabs: [...KITCHEN_TABS] };
  window.FusionKitchen = api;
  installStableActions();

  KITCHEN_TABS.forEach(tab => {
    window.FusionOwnerRouter?.register?.(tab, { afterRender: () => afterRender(tab) });
  });
})();
