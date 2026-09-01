/* Fusion Flavours legacy HTML migration
   Transitional server-side cleanup while the old monolithic index is being retired.
   Keep every rule explicit and removable; feature behaviour belongs in modules.
*/
'use strict';

function stripRetiredOwnerControl(source) {
  return String(source || '')
    .replace(/setTimeout\(tidyTradingPerformanceV332\s*,\s*0\s*\);?/g, '')
    .replace(/setTimeout\(\(\)\s*=>\s*\{\s*const p=currentFinancialPeriod\(\);\s*if\(p\)pnlSelectedPeriod=p\.no\s*\}\s*,\s*300\s*\);?/g, '')
    .replace(/\$\('ownerEntry'\)\.onclick=\(\)=>\{\$\('headerMenu'\)\.classList\.add\('hidden'\);\$\('customer'\)\.classList\.add\('hidden'\);\$\('owner'\)\.classList\.remove\('hidden'\);if\(token\)openOwner\(\)\};\$\('customerBtn'\)\.onclick=\(\)=>\{\$\('owner'\)\.classList\.add\('hidden'\);\$\('customer'\)\.classList\.remove\('hidden'\)\}\s*/i, '')
    .replace(/window\.toggleOwnerNav=\(\)=>\{\$\('ownerNavMenu'\)\?\.classList\.toggle\('hidden'\)\}\s*function ownerTabLabel\(t\)\{[\s\S]*?\}\s*/i, '')
    .replace(/window\.showTab=t=>\{[\s\S]*?\}\s*\nasync function loadOwnerData/i, 'async function loadOwnerData')
    .replace(/window\.showOwnerArea=area=>\{[\s\S]*?decorateOwnerPage\(t\);\s*\};/i, '')
    .replace(/const ffRetailOldShowTab=window\.showTab;\s*window\.showTab=function\(t\)\{ffRetailOldShowTab\(t\);if\(t==='fusionhome'\)renderFusionAtHome\(\);if\(t==='retailorders'\)renderRetailOrders\(\)\}\s*/i, '')
    .replace(/<script>\s*\/\*\s*=====\s*Owner navigation reliability fix\s*=====\s*\*\/[\s\S]*?<\/script>/i, '')
    .replace(/\/\* Owner must be its own exclusive top-level view\. \*\/\s*\$\('ownerEntry'\)\.onclick=\(\)=>\{[\s\S]*?if\(token\)openOwner\(\);\s*\};/i, '')
    .replace(/\/\* Customer View from Owner always returns to the Welcome Hub, not Delivery\. \*\/\s*\$\('customerBtn'\)\.onclick=\(\)=>goCustomerHomeV383\(true\);?/i, '')
    .replace(/\/\* Browser back\/forward follows the customer hub routes properly\. \*\/\s*window\.addEventListener\('popstate',\(\)=>\{[\s\S]*?\}\s*\);/i, '')
    .replace(/function\s+goCustomerHomeV383\(push=true\)\{\s*hideTopLevelViewsV383\(\);\s*if\(push\)\{\s*const u=new URL\(location\.href\);\s*u\.search='';\s*u\.searchParams\.set\('view','home'\);\s*history\.pushState\(\{view:'home'\},'',u\);\s*\}\s*\$\('welcomeHub'\)\?\.classList\.remove\('hidden'\);\s*renderWelcomeHub\(\);\s*\}/i, '')
    .replace(/\/\* Default route is now the Welcome Hub\. \*\/[\s\S]*?(\/\* ===== v3\.8\.3 ROUTING FIX ===== \*\/)/i, '$1');
}

function ensureCanonicalOwnerShell(source) {
  // Delivery is managed inside Orders. Do not recreate the retired standalone
  // Delivery owner area while migrating the legacy document.
  return String(source || '')
    .replace(/\s*<button\b[^>]*data-area=["']delivery["'][^>]*>[^<]*<\/button>/ig, '')
    .replace(/\s*<div\b[^>]*id=["']page-delivery["'][^>]*>\s*<\/div>/ig, '');
}

function ensureDeliveryChefNote(source) {
  let html = String(source || '');
  if (/id=["']deliveryChefNote["']/i.test(html)) return html;

  const note = `<div id="deliveryChefNote" data-design="chef-note-v3" style="margin:14px 0 16px;padding:18px 20px;background:linear-gradient(145deg,#171717,#26211e);color:#fff;border:2px solid #f26b21;border-radius:18px;text-align:center;box-shadow:0 7px 20px rgba(0,0,0,.12);font-family:'Segoe Print','Bradley Hand','Comic Sans MS',cursive;line-height:1.45;font-size:16px;font-weight:700">We keep things fresh and real.<br>Your food is cooked fresh to order,<br>then sent on its way to you<br>as soon as it’s ready.<br><br>Thank you for your patience and support<br>— it means everything.<br><br>Thanks!<br><strong style="color:#f26b21;font-size:18px">Chef Dan</strong></div>`;

  return html.replace(
    /(<a\s+class=["']deliveryHomeBack["'][^>]*>[^<]*<\/a>)/i,
    `$1\n${note}`
  );
}

function legacyShowTabDiagnostics(source) {
  const html = String(source || '');
  const out = [];
  const re = /window\.(showTab|showOwnerArea|showOwnerPage)\s*=/ig;
  let match;
  while ((match = re.exec(html))) {
    out.push({
      name: match[1],
      index: match.index,
      before: html.slice(Math.max(0, match.index - 240), match.index).replace(/\s+/g, ' '),
      after: html.slice(match.index, Math.min(html.length, match.index + 900)).replace(/\s+/g, ' ')
    });
  }
  return out;
}

function migrationFailures(source) {
  const html = String(source || '');
  const failures = [];
  if (/data-area=["']delivery["']/i.test(html)) failures.push('standalone-delivery-nav');
  if (/id=["']page-delivery["']/i.test(html)) failures.push('standalone-delivery-page');
  if (/window\.showTab\s*=/i.test(html)) failures.push('legacy-showtab');
  if (/window\.showOwnerArea\s*=/i.test(html)) failures.push('legacy-owner-area');
  if (/window\.showOwnerPage\s*=/i.test(html)) failures.push('legacy-owner-page');
  if (/window\.toggleOwnerNav\s*=\s*\(\)\s*=>/i.test(html)) failures.push('legacy-owner-menu-toggle');
  if (/function\s+ownerTabLabel\s*\(/i.test(html)) failures.push('legacy-owner-tab-label');
  if (/\$\('ownerEntry'\)\.onclick=\(\)=>\{\$\('headerMenu'\)\.classList\.add\('hidden'\)/i.test(html)) failures.push('legacy-owner-entry-basic');
  if (/Owner must be its own exclusive top-level view/i.test(html)) failures.push('legacy-v383-owner-entry');
  if (/Customer View from Owner always returns to the Welcome Hub/i.test(html)) failures.push('legacy-v383-customer-button');
  if (/Browser back\/forward follows the customer hub routes properly/i.test(html)) failures.push('legacy-v383-popstate');
  if (/function\s+goCustomerHomeV383\s*\(/i.test(html)) failures.push('legacy-v383-home-helper');
  if (/Default route is now the Welcome Hub/i.test(html)) failures.push('legacy-pre-v383-router');
  if (/Owner navigation reliability fix/i.test(html)) failures.push('legacy-owner-navigation-fix');
  if (/setTimeout\(tidyTradingPerformanceV332\s*,\s*0\s*\)/i.test(html)) failures.push('performance-timer');
  if (/setTimeout\(\(\)\s*=>\s*\{\s*const p=currentFinancialPeriod\(\);\s*if\(p\)pnlSelectedPeriod=p\.no\s*\}\s*,\s*300\s*\)/i.test(html)) failures.push('period-timer');
  if (!/async function loadOwnerData\s*\(/i.test(html)) failures.push('owner-loader');
  if (!/<\/head>/i.test(html)) failures.push('closing-head');
  if (!/<\/body>\s*<\/html>\s*$/i.test(html)) failures.push('closing-document');
  return failures;
}

function validateMigratedHtml(source) {
  const failures = migrationFailures(source);
  if (failures.length) throw new Error(`Legacy HTML migration invariant failed: ${failures.join(',')}`);
  return true;
}

function migrateLegacyHtml(source) {
  // The canonical Chef Dan note is injected by api/app.js. Keeping the old
  // v3 note here produced a second, visible copy on the Delivery page.
  return ensureCanonicalOwnerShell(stripRetiredOwnerControl(source));
}

module.exports = {
  migrateLegacyHtml,
  stripRetiredOwnerControl,
  ensureCanonicalOwnerShell,
  ensureDeliveryChefNote,
  legacyShowTabDiagnostics,
  migrationFailures,
  validateMigratedHtml
};
