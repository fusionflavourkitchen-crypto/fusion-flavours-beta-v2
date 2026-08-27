/* Fusion Flavours Kitchen actions integration
   Keeps Stock, Costings and Cookbook data reloads inside the Owner lifecycle.
*/
(() => {
  'use strict';

  const request = (...args) => {
    if (typeof window.api !== 'function') throw new Error('App API is unavailable');
    return window.api(...args);
  };
  const show = tab => window.FusionOwnerRouter?.showTab?.(tab);

  async function reloadStock() {
    const [stock, stockCategories] = await Promise.all([
      request('/rest/v1/stock_items?active=eq.true&select=*&order=stock_category.asc,name.asc'),
      request('/rest/v1/stock_categories?active=eq.true&select=*&order=sort_order.asc,name.asc')
    ]);
    const owner = window.ownerData;
    if (owner) {
      owner.stock = stock;
      owner.stockCategories = stockCategories;
    }
    return show('stock');
  }

  async function reloadCostings() {
    const [stock, suppliers, supplierPrices] = await Promise.all([
      request('/rest/v1/stock_items?active=eq.true&select=*&order=stock_category.asc,name.asc'),
      request('/rest/v1/suppliers?active=eq.true&select=*&order=name.asc'),
      request('/rest/v1/supplier_prices?select=*&order=stock_item_id.asc,preferred.desc,id.asc')
    ]);
    const owner = window.ownerData;
    if (owner) {
      owner.stock = stock;
      owner.suppliers = suppliers;
      owner.supplierPrices = supplierPrices;
    }
    return show('costings');
  }

  async function reloadCookbook() {
    const [recipes, recipeIngredients, stock, items] = await Promise.all([
      request('/rest/v1/recipes?active=eq.true&select=*&order=recipe_group.asc,name.asc'),
      request('/rest/v1/recipe_ingredients?select=*&order=recipe_id.asc,sort_order.asc,id.asc'),
      request('/rest/v1/stock_items?active=eq.true&select=*&order=stock_category.asc,name.asc'),
      request('/rest/v1/items?select=*&order=sort_order.asc,id.asc')
    ]);
    const owner = window.ownerData;
    if (owner) {
      owner.recipes = recipes;
      owner.recipeIngredients = recipeIngredients;
      owner.stock = stock;
      owner.items = items;
    }
    try {
      if ((!selectedRecipeId || !recipes.some(r => Number(r.id) === Number(selectedRecipeId))) && recipes.length) {
        selectedRecipeId = recipes[0].id;
      }
    } catch (_) {}
    return show('cookbook');
  }

  window.reloadStockAll = reloadStock;
  window.reloadStock = reloadStock;
  window.reloadCostingData = reloadCostings;
  window.reloadRecipeData = reloadCookbook;
  window.FusionKitchenActions = { reloadStock, reloadCostings, reloadCookbook };
})();
