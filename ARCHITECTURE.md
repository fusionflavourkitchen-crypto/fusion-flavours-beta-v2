# Fusion Flavours application architecture

## Rule going forward
New features must be added to a named module or an existing feature module. Do not append another version block to `index.html`, do not save an old function and redefine it, and do not inject replacement navigation after page load.

## Current modules

- `api/app.js` — server entrypoint and app bootstrap only.
- `fusion-runtime.js` — top-level Home / Owner / Harnell startup and browser navigation.
- `owner-router.js` — the single Owner route table, Owner menu, Owner subtabs and screen renderer dispatch.
- `harnell-public.js` — Harnell customer menu loading and presentation.
- `delivery-management.js` — Delivery settings, drivers, dispatch jobs and Uber Direct UI.
- `catering-policy.js` — Catering policy/pricing rules.
- `api/uber-direct.js` — server-side Uber Direct API integration.
- `index.html` — legacy application UI and feature implementations while they are progressively extracted.

## Forbidden update patterns

Do not add patterns such as:

```js
const oldFunction = someFunction;
someFunction = function () {
  oldFunction();
  // another update
};
```

Do not add `showTabVxx`, `renderSomethingVxx`, `ffOldSomething`, delayed menu injection, or repeated `setTimeout` repair code.

## Owner navigation

`owner-router.js` is authoritative. A new Owner area or subtab is added once to `AREA_CONFIG` and once to `RENDERERS` if it has a normal renderer. Do not redefine `showTab` or `showOwnerArea` anywhere else.

## Feature integration

A feature module should expose a small public API on one namespace, for example:

```js
window.FusionDelivery = {
  load,
  render,
  financeAdjustment
};
```

Other modules call that API explicitly. A feature must not wrap an unrelated global function simply to get notified that something happened.

## Refactor priorities

1. Owner routing — moved to `owner-router.js`.
2. Harnell public presentation — moved to `harnell-public.js`.
3. Delivery — remove historical `showTab`, owner-load and finance wrappers; expose explicit module methods.
4. Finance / P&L — create one calculation pipeline with explicit cost contributors rather than repeated `performanceData*` redefinitions.
5. Costings / Cookbook — consolidate repeated renderer replacements into one implementation for each screen.
6. Orders — consolidate delivery-slot and postal-order extensions into the Orders module.
7. CSS — move accumulated versioned style blocks from `index.html` into stable feature stylesheets.
8. Legacy `index.html` — progressively reduce to semantic page markup plus the core app boot scripts.

## Definition of done for each migration

A migrated feature has one owner module, one public API, no saved-old-function wrapper chain, no version-number function names, no delayed DOM repair, and no duplicate route definition.
