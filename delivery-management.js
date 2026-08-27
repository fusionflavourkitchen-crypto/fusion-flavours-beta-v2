/* Fusion Flavours - Delivery Management
   Standalone feature module. No navigation, Owner-load or finance hooks.
*/
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = {
    settings: null,
    drivers: [],
    jobs: [],
    uber: { configured: false, mode: 'sandbox' },
    loaded: false,
    loading: null
  };
  window.__fusionDeliveryData = state;

  const money = pence => `£${(Number(pence || 0) / 100).toFixed(2)}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const dateTime = value => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  };
  const dateKey = value => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const get = type => parts.find(part => part.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };

  function injectStyles() {
    if ($('fusionDeliveryStyles')) return;
    const style = document.createElement('style');
    style.id = 'fusionDeliveryStyles';
    style.textContent = `
      .deliveryStatusBar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      .deliveryPill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:900;background:#eee3d7;color:#332a24}
      .deliveryPill.good{background:#dcfce7;color:#166534}.deliveryPill.warn{background:#fef3c7;color:#92400e}.deliveryPill.bad{background:#fee2e2;color:#991b1b}
      .deliveryCards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}
      .deliveryCard{background:#171717;color:white;border-radius:14px;padding:13px;font-weight:950;font-size:22px}
      .deliveryCard small{display:block;color:#ddd;font-size:11px;margin-top:4px}
      .deliveryGrid2{display:grid;grid-template-columns:1fr 1fr;gap:9px}.deliveryGrid3{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
      .deliveryQueueCard,.deliveryDriverCard{background:white;border:1px solid var(--line);border-radius:14px;padding:13px;margin:9px 0}
      .deliveryDriverCard.inactive{opacity:.58}.deliveryTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .deliveryMethod{display:inline-block;padding:5px 8px;border-radius:999px;background:#171717;color:white;font-size:11px;font-weight:900}
      .deliveryActions{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:10px}
      .deliveryActions button,.deliveryActions a{min-height:42px;display:grid;place-items:center;text-align:center;text-decoration:none;border-radius:12px;font-weight:900}
      .deliverySecondary{background:#333!important;color:white!important}.deliverySuccess{background:#26734d!important;color:white!important}.deliveryDanger{background:#8f1f1f!important;color:white!important}
      .deliverySmall{font-size:12px;color:var(--muted)}.deliveryWarnBox{background:#fff3e8;border:1px solid #edc7a8;border-left:4px solid var(--o);border-radius:12px;padding:11px;margin:10px 0}
      @media(max-width:760px){.deliveryCards{grid-template-columns:1fr 1fr}.deliveryGrid2,.deliveryGrid3,.deliveryActions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ownerOrders() { return window.ownerData?.orders || []; }
  function orderById(id) { return ownerOrders().find(order => Number(order.id) === Number(id)); }
  function jobByOrder(id) { return state.jobs.find(job => Number(job.order_id) === Number(id)); }
  function driverById(id) { return state.drivers.find(driver => Number(driver.id) === Number(id)); }
  function orderAddress(order) { return [order?.address_line1, order?.postcode].filter(Boolean).join(', '); }
  function methodLabel(method) { return ({ uber_direct:'Uber Direct', own_driver:'Own driver', owner:'Me delivering', collection:'Collection' })[method] || method || 'Not assigned'; }
  function statusClass(status) { return ['delivered','assigned','collected'].includes(status) ? 'good' : ['failed','cancelled'].includes(status) ? 'bad' : 'warn'; }

  async function uberApi(action, payload = {}) {
    const auth = window.token ? { Authorization: `Bearer ${window.token}` } : {};
    const response = await fetch('/api/uber-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ action, ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || data.error || `Uber Direct request failed (${response.status})`);
    return data;
  }

  async function load(force = false) {
    if (state.loaded && !force) return state;
    if (state.loading) return state.loading;
    if (typeof window.api !== 'function') throw new Error('Owner connection is not ready yet.');
    state.loading = Promise.all([
      window.api('/rest/v1/delivery_settings?id=eq.1&select=*'),
      window.api('/rest/v1/delivery_drivers?select=*&order=active.desc,name.asc'),
      window.api('/rest/v1/delivery_jobs?select=*&order=created_at.desc&limit=500'),
      uberApi('status').catch(error => ({ configured: false, mode: 'sandbox', message: error.message }))
    ]).then(([settings, drivers, jobs, uber]) => {
      state.settings = settings?.[0] || {};
      state.drivers = drivers || [];
      state.jobs = jobs || [];
      state.uber = uber || { configured: false, mode: 'sandbox' };
      state.loaded = true;
      if (window.ownerData) {
        window.ownerData.deliverySettings = state.settings;
        window.ownerData.deliveryDrivers = state.drivers;
        window.ownerData.deliveryJobs = state.jobs;
      }
      return state;
    }).finally(() => { state.loading = null; });
    return state.loading;
  }

  function activeOrders() {
    return ownerOrders().filter(order => {
      const payment = String(order.payment_status || '').toLowerCase();
      const status = String(order.order_status || '').toLowerCase();
      return payment === 'paid' && !['completed','cancelled','refunded'].includes(status);
    }).sort((a,b) => new Date(a.delivery_slot_start || a.created_at) - new Date(b.delivery_slot_start || b.created_at));
  }

  function deliveryCostToday() {
    const today = dateKey(new Date());
    return state.jobs
      .filter(job => ['delivered','collected','assigned','requested'].includes(String(job.status || '')) && dateKey(job.delivered_at || job.updated_at || job.created_at) === today)
      .reduce((sum, job) => sum + Number(job.actual_cost_pence || 0), 0);
  }

  function chargePreview(quotePence, subtotalPence) {
    const settings = state.settings || {};
    if (settings.free_over_pence != null && Number(subtotalPence || 0) >= Number(settings.free_over_pence || 0)) return 0;
    if (settings.customer_charge_mode === 'fixed') return Number(settings.customer_fixed_pence || 0);
    if (settings.customer_charge_mode === 'subsidised') return Math.max(0, Number(quotePence || 0) - Number(settings.subsidy_pence || 0));
    return Number(quotePence || 0);
  }

  function settingsHtml() {
    const s = state.settings || {};
    const uber = state.uber || {};
    return `<details class="ownerDrop"><summary><span>Delivery setup & rules</span><span>${s.enabled ? 'On' : 'Off'} ▾</span></summary><div class="ownerDropBody">
      <div class="deliveryStatusBar"><span class="deliveryPill ${uber.configured ? 'good' : 'warn'}">Uber API: ${uber.configured ? 'Ready' : 'Awaiting credentials'}</span><span class="deliveryPill">${esc(String(uber.mode || 'sandbox').toUpperCase())}</span><span class="deliveryPill ${s.owner_available ? 'good' : 'warn'}">Me delivering: ${s.owner_available ? 'Available' : 'Not available'}</span></div>
      ${!uber.configured ? '<div class="deliveryWarnBox"><b>Uber Direct is prepared but not connected yet.</b><br>Once Uber approves the account, add the credentials securely on the server.</div>' : ''}
      <label class="switch"><input id="del_enabled" type="checkbox" ${s.enabled ? 'checked' : ''}> Delivery management enabled</label>
      <div class="deliveryGrid2"><label>Preferred method<select id="del_preferred"><option value="uber_direct" ${s.preferred_method==='uber_direct'?'selected':''}>Uber Direct</option><option value="own_driver" ${s.preferred_method==='own_driver'?'selected':''}>Own driver</option><option value="owner" ${s.preferred_method==='owner'?'selected':''}>Me delivering</option><option value="collection" ${s.preferred_method==='collection'?'selected':''}>Collection</option></select></label><label>Fallback method<select id="del_fallback"><option value="owner" ${s.fallback_method==='owner'?'selected':''}>Me delivering</option><option value="own_driver" ${s.fallback_method==='own_driver'?'selected':''}>Own driver</option><option value="uber_direct" ${s.fallback_method==='uber_direct'?'selected':''}>Uber Direct</option><option value="collection" ${s.fallback_method==='collection'?'selected':''}>Collection</option></select></label></div>
      <div class="deliveryGrid2"><label>Dispatch mode<select id="del_dispatch"><option value="manual" ${s.dispatch_mode==='manual'?'selected':''}>Manual</option><option value="automatic" ${s.dispatch_mode==='automatic'?'selected':''}>Automatic later</option></select></label><label>Maximum Uber quote £<input id="del_max_quote" type="number" min="0" step=".01" value="${(Number(s.max_uber_quote_pence||0)/100).toFixed(2)}"></label></div>
      <h3>Customer delivery charge</h3><div class="deliveryGrid3"><label>Charging method<select id="del_charge_mode"><option value="full" ${s.customer_charge_mode==='full'?'selected':''}>Customer pays full courier quote</option><option value="fixed" ${s.customer_charge_mode==='fixed'?'selected':''}>Fixed delivery charge</option><option value="subsidised" ${s.customer_charge_mode==='subsidised'?'selected':''}>Subsidise courier cost</option></select></label><label>Fixed charge £<input id="del_fixed" type="number" min="0" step=".01" value="${(Number(s.customer_fixed_pence||0)/100).toFixed(2)}"></label><label>Subsidy £<input id="del_subsidy" type="number" min="0" step=".01" value="${(Number(s.subsidy_pence||0)/100).toFixed(2)}"></label></div>
      <div class="deliveryGrid2"><label>Free delivery over £<input id="del_free_over" type="number" min="0" step=".01" value="${s.free_over_pence == null ? '' : (Number(s.free_over_pence)/100).toFixed(2)}"></label><label>Maximum radius miles<input id="del_radius" type="number" min="0" step=".1" value="${Number(s.max_radius_miles||0)}"></label></div>
      <h3>Courier pickup point</h3><label>Pickup business name<input id="del_pick_name" value="${esc(s.pickup_name || 'Fusion Flavours')}"></label><div class="deliveryGrid2"><label>Pickup phone<input id="del_pick_phone" value="${esc(s.pickup_phone || '')}"></label><label>City<input id="del_pick_city" value="${esc(s.pickup_city || 'Coventry')}"></label></div><label>Pickup address<input id="del_pick_addr" value="${esc(s.pickup_address_line1 || '')}"></label><label>Pickup postcode<input id="del_pick_postcode" value="${esc(s.pickup_postcode || '')}"></label><label>Courier pickup instructions<textarea id="del_pick_notes">${esc(s.pickup_instructions || '')}</textarea></label>
      <h3>Me delivering</h3><label class="switch"><input id="del_owner_available" type="checkbox" ${s.owner_available ? 'checked' : ''}> I am available to deliver</label><div class="deliveryGrid2"><label>Vehicle / note<input id="del_owner_vehicle" value="${esc(s.owner_vehicle || '')}"></label><label>Internal cost per mile £<input id="del_owner_mile" type="number" min="0" step=".01" value="${(Number(s.owner_cost_per_mile_pence||0)/100).toFixed(2)}"></label></div><label class="switch"><input id="del_auto_fallback" type="checkbox" ${s.auto_fallback ? 'checked' : ''}> Allow fallback method</label>
      <button style="width:100%;margin-top:10px" onclick="saveDeliverySettings()">Save delivery settings</button>
    </div></details>`;
  }

  function driversHtml() {
    return `<details class="ownerDrop"><summary><span>Drivers</span><span>${state.drivers.filter(x=>x.active).length} active ▾</span></summary><div class="ownerDropBody">
      <details class="compactOwnerDrop"><summary><b>+ Add potential driver</b><span>▾</span></summary><div class="compactOwnerBody"><div class="deliveryGrid2"><label>Name<input id="driver_name"></label><label>Phone<input id="driver_phone"></label></div><label>Vehicle<input id="driver_vehicle"></label><div class="deliveryGrid2"><label>Cost type<select id="driver_cost_type"><option value="per_delivery">Per delivery</option><option value="hourly">Per hour</option><option value="shift">Per shift</option></select></label><label>Cost £<input id="driver_cost" type="number" min="0" step=".01" value="0"></label></div><label>Notes<textarea id="driver_notes"></textarea></label><button style="width:100%" onclick="addDeliveryDriver()">Add driver</button></div></details>
      ${state.drivers.map(driver => `<div class="deliveryDriverCard ${driver.active ? '' : 'inactive'}"><div class="row"><div><b>${esc(driver.name)}</b><div class="deliverySmall">${esc(driver.phone || 'No phone')} · ${esc(driver.vehicle || 'No vehicle')}</div></div><span class="deliveryMethod">${esc(String(driver.cost_type || '').replace('_',' '))} · ${money(driver.cost_pence)}</span></div>${driver.notes ? `<div class="deliverySmall" style="margin-top:7px">${esc(driver.notes)}</div>` : ''}<div class="deliveryActions"><button class="deliverySecondary" onclick="toggleDeliveryDriver(${driver.id},${driver.active ? 'false' : 'true'})">${driver.active ? 'Set inactive' : 'Reactivate'}</button><button class="deliveryDanger" onclick="deleteDeliveryDriver(${driver.id})">Delete</button></div></div>`).join('') || '<p class="muted">No drivers added yet.</p>'}
    </div></details>`;
  }

  function queueCard(order) {
    const job = jobByOrder(order.id);
    const activeDrivers = state.drivers.filter(driver => driver.active);
    const selectedMethod = job?.method || state.settings?.preferred_method || 'uber_direct';
    return `<div class="deliveryQueueCard"><div class="deliveryTop"><div><b>${esc(order.public_id || `#${order.id}`)} · ${esc(order.customer_name || 'Customer')}</b><div class="deliverySmall">${esc(orderAddress(order))} · ${esc(order.phone || 'No phone')}</div><div class="deliverySmall">Order ${money(order.total_pence)} · customer delivery charge ${money(job?.customer_delivery_charge_pence || order.delivery_fee_pence || 0)}</div></div><div><span class="deliveryMethod">${esc(methodLabel(job?.method))}</span>${job ? `<div class="deliveryPill ${statusClass(job.status)}" style="margin-top:5px">${esc(job.status)}</div>` : ''}</div></div>
      ${job?.method==='uber_direct' && job?.quoted_cost_pence ? `<div class="notice"><b>Uber quote:</b> ${money(job.quoted_cost_pence)}${job.uber_quote_expires_at ? ` · expires ${dateTime(job.uber_quote_expires_at)}` : ''}</div>` : ''}
      ${job?.tracking_url ? `<a href="${esc(job.tracking_url)}" target="_blank" rel="noopener" style="display:block;margin:8px 0;padding:10px;background:#eef3e5;color:#35551f;border-radius:10px;text-align:center;font-weight:900;text-decoration:none">Open Uber live tracking</a>` : ''}
      <div class="deliveryGrid2" style="margin-top:9px"><label>Method<select id="method_${order.id}" onchange="deliveryMethodChanged(${order.id})"><option value="uber_direct" ${selectedMethod==='uber_direct'?'selected':''}>Uber Direct</option><option value="own_driver" ${selectedMethod==='own_driver'?'selected':''}>Own driver</option><option value="owner" ${selectedMethod==='owner'?'selected':''}>Me delivering</option><option value="collection" ${selectedMethod==='collection'?'selected':''}>Collection</option></select></label><label id="driver_wrap_${order.id}" class="${selectedMethod==='own_driver'?'':'hidden'}">Driver<select id="driver_${order.id}"><option value="">Choose driver…</option>${activeDrivers.map(driver => `<option value="${driver.id}" ${Number(job?.driver_id)===Number(driver.id)?'selected':''}>${esc(driver.name)} · ${money(driver.cost_pence)}</option>`).join('')}</select></label></div>
      <label>Delivery notes<input id="job_notes_${order.id}" value="${esc(job?.notes || order.delivery_instructions || '')}"></label><div class="deliveryActions"><button class="deliverySecondary" onclick="assignDeliveryMethod(${order.id})">Save assignment</button><button ${!state.uber.configured?'disabled':''} onclick="quoteUberForOrder(${order.id})">Get Uber quote</button>${job?.uber_quote_id ? `<button ${!state.uber.configured?'disabled':''} onclick="requestUberDelivery(${order.id})">Request Uber courier</button>` : ''}${job ? `<button class="deliverySuccess" onclick="markDeliveryStatus(${job.id},'delivered')">Mark delivered</button>` : ''}</div>
      ${job ? `<div class="deliveryGrid2" style="margin-top:8px"><label>Actual delivery cost £<input id="actual_cost_${job.id}" type="number" min="0" step=".01" value="${(Number(job.actual_cost_pence||0)/100).toFixed(2)}"></label><label>Status<select onchange="markDeliveryStatus(${job.id},this.value)">${['planned','quoted','requested','assigned','collected','delivered','cancelled','failed'].map(status => `<option value="${status}" ${job.status===status?'selected':''}>${status}</option>`).join('')}</select></label></div><button class="deliverySecondary" style="width:100%;margin-top:6px" onclick="saveDeliveryActualCost(${job.id})">Save actual delivery cost</button>` : ''}</div>`;
  }

  function historyHtml() {
    const rows = state.jobs.filter(job => ['delivered','cancelled','failed'].includes(job.status)).slice(0,30);
    return `<details class="ownerDrop"><summary><span>Delivery history & costs</span><span>${rows.length} recent ▾</span></summary><div class="ownerDropBody">${rows.map(job => { const order = orderById(job.order_id), driver = driverById(job.driver_id); return `<div class="deliveryDriverCard"><div class="row"><div><b>${esc(order?.public_id || `#${job.order_id}`)}</b><div class="deliverySmall">${esc(methodLabel(job.method))}${driver ? ` · ${esc(driver.name)}` : ''} · ${dateTime(job.delivered_at || job.updated_at)}</div></div><b>${money(job.actual_cost_pence)}</b></div><div class="deliveryStatusBar"><span class="deliveryPill ${statusClass(job.status)}">${esc(job.status)}</span>${job.quoted_cost_pence ? `<span class="deliveryPill">Quote ${money(job.quoted_cost_pence)}</span>` : ''}</div></div>`; }).join('') || '<p class="muted">No completed delivery jobs yet.</p>'}</div></details>`;
  }

  async function render(force = false) {
    injectStyles();
    const page = $('page-delivery');
    if (!page) return;
    page.innerHTML = '<h2>Delivery</h2><p class="muted">Loading delivery setup…</p>';
    try { await load(force); }
    catch (error) { page.innerHTML = `<h2>Delivery</h2><div class="notice">Could not load delivery setup: ${esc(error.message)}</div>`; return; }
    const active = activeOrders();
    const todayCost = deliveryCostToday();
    page.innerHTML = `<div class="ownerHead"><div><h2 style="margin-bottom:3px">Delivery</h2><div class="muted">Uber Direct, your own driver, you delivering, and collection.</div></div><button onclick="refreshDeliveryManagement()">↻ Refresh</button></div>
      <div class="deliveryCards"><div class="deliveryCard">${active.length}<small>Paid orders awaiting delivery</small></div><div class="deliveryCard">${state.drivers.filter(x=>x.active).length}<small>Active drivers</small></div><div class="deliveryCard">${money(todayCost)}<small>Delivery cost today</small></div><div class="deliveryCard">${state.jobs.filter(job=>['requested','assigned','collected'].includes(job.status)).length}<small>Deliveries in progress</small></div></div>
      <div class="deliveryWarnBox"><b>Launch recommendation:</b> keep dispatch on <b>manual</b>. Choose Uber Direct, a driver, yourself or collection when the order is ready.</div>
      ${settingsHtml()}${driversHtml()}<div class="panel" style="margin-top:12px"><h2>Dispatch queue</h2><p class="muted">Only paid main-delivery orders appear here. Harnell stays separate.</p>${active.map(queueCard).join('') || '<p class="muted">No paid delivery orders are currently waiting.</p>'}</div>${historyHtml()}`;
  }

  async function upsertJob(orderId, patch) {
    const existing = jobByOrder(orderId);
    const now = new Date().toISOString();
    if (existing) await window.api(`/rest/v1/delivery_jobs?id=eq.${existing.id}`, { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({ ...patch, updated_at:now }) });
    else await window.api('/rest/v1/delivery_jobs', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify({ order_id:Number(orderId), ...patch, created_at:now, updated_at:now }) });
    await load(true);
    return jobByOrder(orderId);
  }

  window.refreshDeliveryManagement = () => render(true);
  window.saveDeliverySettings = async () => {
    try {
      const body = {
        enabled: !!$('del_enabled')?.checked, preferred_method: $('del_preferred')?.value || 'uber_direct', fallback_method: $('del_fallback')?.value || 'owner', dispatch_mode: $('del_dispatch')?.value || 'manual',
        uber_enabled: !!state.uber.configured, max_uber_quote_pence: Math.max(0, Math.round(Number($('del_max_quote')?.value || 0) * 100)), customer_charge_mode: $('del_charge_mode')?.value || 'full',
        customer_fixed_pence: Math.max(0, Math.round(Number($('del_fixed')?.value || 0) * 100)), subsidy_pence: Math.max(0, Math.round(Number($('del_subsidy')?.value || 0) * 100)), free_over_pence: $('del_free_over')?.value === '' ? null : Math.max(0, Math.round(Number($('del_free_over')?.value || 0) * 100)),
        max_radius_miles: Math.max(0, Number($('del_radius')?.value || 0)), pickup_name: ($('del_pick_name')?.value || 'Fusion Flavours').trim(), pickup_phone: ($('del_pick_phone')?.value || '').trim(), pickup_address_line1: ($('del_pick_addr')?.value || '').trim(), pickup_city: ($('del_pick_city')?.value || 'Coventry').trim(), pickup_postcode: ($('del_pick_postcode')?.value || '').trim().toUpperCase(), pickup_instructions: ($('del_pick_notes')?.value || '').trim(),
        owner_available: !!$('del_owner_available')?.checked, owner_vehicle: ($('del_owner_vehicle')?.value || '').trim(), owner_cost_per_mile_pence: Math.max(0, Math.round(Number($('del_owner_mile')?.value || 0) * 100)), auto_fallback: !!$('del_auto_fallback')?.checked, updated_at: new Date().toISOString()
      };
      await window.api('/rest/v1/delivery_settings?id=eq.1', { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify(body) });
      state.settings = { ...(state.settings || {}), ...body };
      alert('Delivery settings saved.');
      await render(false);
    } catch (error) { alert(error.message); }
  };

  window.addDeliveryDriver = async () => {
    const name = ($('driver_name')?.value || '').trim();
    if (!name) return alert('Enter the driver name.');
    try {
      const body = { name, phone:($('driver_phone')?.value||'').trim(), vehicle:($('driver_vehicle')?.value||'').trim(), cost_type:$('driver_cost_type')?.value||'per_delivery', cost_pence:Math.max(0,Math.round(Number($('driver_cost')?.value||0)*100)), notes:($('driver_notes')?.value||'').trim(), active:true };
      await window.api('/rest/v1/delivery_drivers', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify(body) });
      await render(true);
    } catch (error) { alert(error.message); }
  };
  window.toggleDeliveryDriver = async (id, active) => { try { await window.api(`/rest/v1/delivery_drivers?id=eq.${id}`, { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({active:!!active,updated_at:new Date().toISOString()}) }); await render(true); } catch(error) { alert(error.message); } };
  window.deleteDeliveryDriver = async id => { if (!confirm('Delete this driver profile?')) return; try { await window.api(`/rest/v1/delivery_drivers?id=eq.${id}`, { method:'DELETE', headers:{Prefer:'return=minimal'} }); await render(true); } catch(error) { alert(error.message); } };
  window.deliveryMethodChanged = id => $('driver_wrap_'+id)?.classList.toggle('hidden', $('method_'+id)?.value !== 'own_driver');

  window.assignDeliveryMethod = async orderId => {
    const method = $('method_'+orderId)?.value || state.settings?.preferred_method || 'uber_direct';
    const driverId = method === 'own_driver' ? Number($('driver_'+orderId)?.value || 0) : null;
    if (method === 'own_driver' && !driverId) return alert('Choose the driver.');
    if (method === 'owner' && !state.settings?.owner_available && !confirm('You are marked unavailable. Assign this order to yourself anyway?')) return;
    const driver = driverById(driverId);
    try {
      await upsertJob(orderId, { method, driver_id:driverId||null, status:'assigned', actual_cost_pence:method==='own_driver'&&driver?.cost_type==='per_delivery'?Number(driver.cost_pence||0):0, customer_delivery_charge_pence:Number(orderById(orderId)?.delivery_fee_pence||0), notes:($('job_notes_'+orderId)?.value||'').trim(), assigned_at:new Date().toISOString() });
      await render(false);
    } catch(error) { alert(error.message); }
  };

  window.quoteUberForOrder = async orderId => {
    const s = state.settings || {}, order = orderById(orderId);
    if (!order) return alert('Order not found.');
    if (!state.uber?.configured) return alert('Uber Direct API credentials are not connected yet.');
    if (!s.pickup_address_line1 || !s.pickup_postcode) return alert('Add the courier pickup address and postcode first.');
    try {
      const response = await uberApi('quote', { pickup:{address_line1:s.pickup_address_line1,city:s.pickup_city,postcode:s.pickup_postcode,country:'GB'}, dropoff:{address_line1:order.address_line1,city:s.pickup_city||'Coventry',postcode:order.postcode,country:'GB'} });
      const quote = response.quote || response;
      await upsertJob(orderId, { method:'uber_direct', driver_id:null, status:'quoted', quoted_cost_pence:Number(quote.fee||0), customer_delivery_charge_pence:chargePreview(quote.fee, Number(order.subtotal_pence||order.total_pence||0)), uber_quote_id:quote.id||null, uber_quote_expires_at:quote.expires||null, pickup_eta:quote.pickup_eta||null, dropoff_eta:quote.dropoff_eta||null, notes:($('job_notes_'+orderId)?.value||'').trim() });
      alert(`Uber quote: ${money(quote.fee)}.`);
      await render(false);
    } catch(error) { alert('Uber quote failed: '+error.message); }
  };

  window.requestUberDelivery = async orderId => {
    const s = state.settings || {}, order = orderById(orderId), job = jobByOrder(orderId);
    if (!order || !job?.uber_quote_id) return alert('Get a fresh Uber quote first.');
    const mode = String(state.uber?.mode || 'sandbox').toLowerCase();
    if (!confirm(`${mode === 'production' ? 'This will request a REAL Uber courier.' : 'This is Uber TEST/SANDBOX mode.'}\n\nQuote: ${money(job.quoted_cost_pence)}\n\nContinue?`)) return;
    try {
      const response = await uberApi('create', { quote_id:job.uber_quote_id, external_id:String(order.public_id||order.id), pickup:{address_line1:s.pickup_address_line1,city:s.pickup_city,postcode:s.pickup_postcode,country:'GB',name:s.pickup_name,phone:s.pickup_phone,notes:s.pickup_instructions}, dropoff:{address_line1:order.address_line1,city:s.pickup_city||'Coventry',postcode:order.postcode,country:'GB',name:order.customer_name,phone:order.phone,notes:order.delivery_instructions||''}, manifest_items:[{name:`Fusion Flavours order ${order.public_id||order.id}`,quantity:1}] });
      const delivery = response.delivery || response;
      await upsertJob(orderId, { method:'uber_direct', status:'requested', actual_cost_pence:Number(delivery.fee||job.quoted_cost_pence||0), uber_delivery_id:delivery.id||null, tracking_url:delivery.tracking_url||null, pickup_eta:delivery.pickup_eta||null, dropoff_eta:delivery.dropoff_eta||null, assigned_at:new Date().toISOString() });
      alert(mode === 'production' ? 'Uber courier requested.' : 'Uber test delivery created successfully.');
      await render(false);
    } catch(error) { alert('Uber delivery was not created: '+error.message); }
  };

  window.saveDeliveryActualCost = async id => { try { const pence=Math.max(0,Math.round(Number($('actual_cost_'+id)?.value||0)*100)); await window.api(`/rest/v1/delivery_jobs?id=eq.${id}`, {method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({actual_cost_pence:pence,updated_at:new Date().toISOString()})}); await render(true); } catch(error) { alert(error.message); } };
  window.markDeliveryStatus = async (id,status) => { const patch={status,updated_at:new Date().toISOString()}; if(status==='collected')patch.collected_at=new Date().toISOString(); if(status==='delivered')patch.delivered_at=new Date().toISOString(); try { await window.api(`/rest/v1/delivery_jobs?id=eq.${id}`, {method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)}); await render(true); } catch(error) { alert(error.message); } };

  window.FusionDelivery = { state, load, render, refresh: () => render(true) };
})();
