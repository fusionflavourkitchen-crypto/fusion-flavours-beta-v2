/* Fusion Flavours Catering Owner integration
   Removes the delayed branding-control injection from the active Owner path.
*/
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = value => {
    try { return typeof window.esc === 'function' ? window.esc(value ?? '') : String(value ?? ''); }
    catch (_) { return String(value ?? ''); }
  };

  function addBrandingControls() {
    const page = $('page-catering');
    if (!page || $('cateringBrandAdmin')) return;
    const settings = window.ownerData?.settings || {};
    const html = `<details id="cateringBrandAdmin" class="ownerDrop"><summary><span>Catering page branding</span><span>Hero ▾</span></summary><div class="ownerDropBody"><label>Hero title<input id="cbh_title" value="${safe(settings.catering_hero_title || 'Fusion Flavours Catering')}"></label><label>Tagline<input id="cbh_tag" value="${safe(settings.catering_hero_tagline || 'Big flavours. Your occasion. Done properly.')}"></label><label>Intro text<textarea id="cbh_text">${safe(settings.catering_hero_text || 'From small gatherings to larger events — choose one of our packages or tell us what you have in mind.')}</textarea></label><button style="width:100%" onclick="saveCateringBranding()">Save catering branding</button></div></details>`;
    const tabs = page.querySelector('.cateringTopTabs');
    if (tabs) tabs.insertAdjacentHTML('afterend', html);
    else page.insertAdjacentHTML('afterbegin', html);
  }

  async function render() {
    // renderCateringAdminV38 is captured before the old setTimeout branding wrapper.
    if (typeof renderCateringAdminV38 === 'function') await renderCateringAdminV38();
    else if (typeof window.renderCateringAdmin === 'function') await window.renderCateringAdmin();
    else throw new Error('Catering renderer is unavailable');
    addBrandingControls();
    const page = $('page-catering');
    if (page) page.dataset.fusionFeature = 'catering';
  }

  const api = { render, addBrandingControls };
  window.FusionCateringOwner = api;
  window.FusionOwnerRouter?.register?.('catering', { render });
})();
