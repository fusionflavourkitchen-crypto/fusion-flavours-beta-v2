/* Fusion Flavours legacy HTML migration
   Transitional server-side cleanup while the old monolithic index is being retired.
   Keep every rule explicit and removable; feature behaviour belongs in modules.
*/
'use strict';

function stripRetiredOwnerControl(source) {
  return String(source || '')
    .replace(/setTimeout\(tidyTradingPerformanceV332\s*,\s*0\s*\);?/g, '')
    .replace(/setTimeout\(\(\)\s*=>\s*\{\s*const p=currentFinancialPeriod\(\);\s*if\(p\)pnlSelectedPeriod=p\.no\s*\}\s*,\s*300\s*\);?/g, '')
    .replace(/window\.showTab=t=>\{[\s\S]*?\}\s*\nasync function loadOwnerData/i, 'async function loadOwnerData');
}

function ensureCanonicalOwnerShell(source) {
  let html = String(source || '');
  const deliveryButton = '<button data-area="delivery" onclick="showOwnerArea(\'delivery\')">Delivery</button>';

  if (!/data-area=["']delivery["']/i.test(html)) {
    html = html.replace(/(<div\s+id=["']ownerNavMenu["'][^>]*>)([\s\S]*?)(<\/div>)/i, (all, open, body, close) => {
      if (/data-area=["']service["']/i.test(body)) {
        body = body.replace(/(<button\b[^>]*data-area=["']service["'][^>]*>)/i, `${deliveryButton}\n$1`);
      } else {
        body += `\n${deliveryButton}`;
      }
      return open + body + close;
    });
  }

  if (!/id=["']page-delivery["']/i.test(html)) {
    html = html.replace(/(<div\s+id=["']page-service["']\b)/i, '<div id="page-delivery" class="ownerPage hidden"></div>$1');
  }

  return html;
}

function migrationFailures(source) {
  const html = String(source || '');
  const failures = [];
  if (!/data-area=["']delivery["']/i.test(html)) failures.push('delivery-nav');
  if (!/id=["']page-delivery["']/i.test(html)) failures.push('delivery-page');
  if (/window\.showTab=t=>\{/i.test(html)) failures.push('legacy-showtab');
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
  return ensureCanonicalOwnerShell(stripRetiredOwnerControl(source));
}

module.exports = {
  migrateLegacyHtml,
  stripRetiredOwnerControl,
  ensureCanonicalOwnerShell,
  migrationFailures,
  validateMigratedHtml
};
