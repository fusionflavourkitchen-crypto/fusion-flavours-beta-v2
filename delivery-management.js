/* Fusion Flavours - Delivery Management v1.0 */
(() => {
  'use strict';

  const OWNER_EMAIL = 'fusionflavourkitchen@gmail.com';
  const deliveryData = {
    settings: null,
    drivers: [],
    jobs: [],
    uberStatus: {configured:false, mode:'sandbox'},
    loaded: false,
    loading: false
  };
  window.__fusionDeliveryData = deliveryData;

  const dMoney = p => {
    const n = Number(p || 0) / 100;
    try { return typeof money === 'function' ? money(n) : '£' + n.toFixed(2); }
    catch { return '£' + n.toFixed(2); }
  };
  const dEsc = v => {
    try { return typeof esc === 'function' ? esc(v ?? '') : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
    catch { return String(v ?? ''); }
  };
  const dDate = v => {
    if(!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'});
  };
  const dDateKey = v => {
    const d = new Date(v);
    if(Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const get=t=>parts.find(x=>x.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const el = id => document.getElementById(id);

  function injectStyles(){
    if(el('fusionDeliveryStyles')) return;
    const s=document.createElement('style');s.id='fusionDeliveryStyles';
    s.textContent=`
      .deliveryStatusBar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      .deliveryPill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:900;background:#eee3d7;color:#332a24}
      .deliveryPill.good{background:#dcfce7;color:#166534}.deliveryPill.warn{background:#fef3c7;color:#92400e}.deliveryPill.bad{background:#fee2e2;color:#991b1b}
      .deliveryCards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}
      .deliveryCard{background:#171717;color:white;border-radius:14px;padding:13px;font-weight:950;font-size:22px}
      .deliveryCard small{display:block;color:#ddd;font-size:11px;margin-top:4px}
      .deliveryGrid2{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .deliveryGrid3{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
      .deliveryQueueCard{background:white;border:1px solid var(--line);border-radius:14px;padding:13px;margin:9px 0}
      .deliveryQueueCard .deliveryTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .deliveryMethod{display:inline-block;padding:5px 8px;border-radius:999px;background:#171717;color:white;font-size:11px;font-weight:900}
      .deliveryActions{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:10px}
      .deliveryActions button,.deliveryActions a{min-height:42px;display:grid;place-items:center;text-align:center;text-decoration:none;border-radius:12px;font-weight:900}
      .deliverySecondary{background:#333!important;color:white!important}
      .deliverySuccess{background:#26734d!important;color:white!important}
      .deliveryDanger{background:#8f1f1f!important;color:white!important}
      .deliveryDriverCard{background:white;border:1px solid var(--line);border-radius:13px;padding:11px;margin:8px 0}
      .deliveryDriverCard.inactive{opacity:.58}
      .deliverySmall{font-size:12px;color:var(--muted)}
      .deliveryWarnBox{background:#fff3e8;border:1px solid #edc7a8;border-left:4px solid var(--o);border-radius:12px;padding:11px;margin:10px 0}
      @media(max-width:760px){.deliveryCards{grid-template-columns:1fr 1fr}.deliveryGrid2,.deliveryGrid3{grid-template-columns:1fr}.deliveryActions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function ensurePage(){
    if(el('page-delivery')) return el('page-delivery');
    const anchor=el('page-orders')||el('page-service')||document.querySelector('.ownerPage');
    if(!anchor?.parentElement) return null;
    const p=document.createElement('div');
    p.id='page-delivery';p.className='ownerPage hidden';
    anchor.parentElement.appendChild(p);
    return p;
  }

  function ensureNav(){
    try{
      if(typeof OWNER_AREAS!=='undefined') OWNER_AREAS.delivery=[['delivery','Delivery']];
    }catch{}
    const menu=el('ownerNavMenu');
    if(menu && !menu.querySelector('[data-area="delivery"]')){
      const b=document.createElement('button');
      b.dataset.area='delivery';b.textContent='Delivery';b.onclick=()=>window.showOwnerArea?.('delivery');
      const orders=menu.querySelector('[data-area="orders"]');
      if(orders?.nextSibling) menu.insertBefore(b,orders.nextSibling); else menu.appendChild(b);
    }
  }

  try{
    if(typeof ownerAreaLabel==='function'){
      const oldOwnerAreaLabel=ownerAreaLabel;
      ownerAreaLabel=function(area){return area==='delivery'?'Delivery':oldOwnerAreaLabel(area)};
    }
  }catch{}

  function deliveryOrderById(id){ return (typeof ownerData!=='undefined' ? (ownerData.orders||[]) : []).find(o=>Number(o.id)===Number(id)); }
  function jobForOrder(id){ return (deliveryData.jobs||[]).find(j=>Number(j.order_id)===Number(id)); }
  function driverById(id){ return (deliveryData.drivers||[]).find(d=>Number(d.id)===Number(id)); }
  function orderAddress(o){ return [o?.address_line1,o?.postcode].filter(Boolean).join(', '); }

  async function uberApi(action,payload={}){
    const auth = typeof token!=='undefined' && token ? {'Authorization':'Bearer '+token} : {};
    const r=await fetch('/api/uber-direct',{
      method:'POST',
      headers:{'Content-Type':'application/json',...auth},
      body:JSON.stringify({action,...payload})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok || data.ok===false) throw new Error(data.message||data.error||`Uber Direct request failed (${r.status})`);
    return data;
  }

  async function loadDeliveryData(force=false){
    if(deliveryData.loading) return;
    if(deliveryData.loaded&&!force) return;
    if(typeof api!=='function') throw new Error('Owner connection is not ready yet.');
    deliveryData.loading=true;
    try{
      const [settings,drivers,jobs,uber]=await Promise.all([
        api('/rest/v1/delivery_settings?id=eq.1&select=*'),
        api('/rest/v1/delivery_drivers?select=*&order=active.desc,name.asc'),
        api('/rest/v1/delivery_jobs?select=*&order=created_at.desc&limit=500'),
        uberApi('status').catch(e=>({ok:false,configured:false,mode:'sandbox',message:e.message}))
      ]);
      deliveryData.settings=settings?.[0]||null;
      deliveryData.drivers=drivers||[];
      deliveryData.jobs=jobs||[];
      deliveryData.uberStatus=uber||{configured:false,mode:'sandbox'};
      deliveryData.loaded=true;
      try{
        if(typeof ownerData!=='undefined'){
          ownerData.deliverySettings=deliveryData.settings;
          ownerData.deliveryDrivers=deliveryData.drivers;
          ownerData.deliveryJobs=deliveryData.jobs;
        }
      }catch{}
    }finally{deliveryData.loading=false}
  }

  function activeMainOrders(){
    const rows=(typeof ownerData!=='undefined'?(ownerData.orders||[]):[]);
    return rows.filter(o=>{
      const pay=String(o.payment_status||'').toLowerCase();
      const st=String(o.order_status||'').toLowerCase();
      return pay==='paid' && !['completed','cancelled','refunded'].includes(st);
    }).sort((a,b)=>new Date(a.delivery_slot_start||a.created_at)-new Date(b.delivery_slot_start||b.created_at));
  }

  function deliveryCostToday(){
    const today=dDateKey(new Date());
    return (deliveryData.jobs||[]).filter(j=>['delivered','collected','assigned','requested'].includes(j.status)&&dDateKey(j.delivered_at||j.updated_at||j.created_at)===today).reduce((n,j)=>n+Number(j.actual_cost_pence||0),0);
  }

  function methodLabel(m){
    return {uber_direct:'Uber Direct',own_driver:'Own driver',owner:'Me delivering',collection:'Collection'}[m]||m||'Not assigned';
  }

  function statusClass(s){
    return ['delivered','assigned','collected'].includes(s)?'good':['failed','cancelled'].includes(s)?'bad':'warn';
  }

  function chargePreview(quotePence,subtotalPence){
    const s=deliveryData.settings||{};
    if(s.free_over_pence!=null && Number(subtotalPence||0)>=Number(s.free_over_pence||0)) return 0;
    if(s.customer_charge_mode==='fixed') return Number(s.customer_fixed_pence||0);
    if(s.customer_charge_mode==='subsidised') return Math.max(0,Number(quotePence||0)-Number(s.subsidy_pence||0));
    return Number(quotePence||0);
  }

  function settingsHtml(){
    const s=deliveryData.settings||{};
    const uber=deliveryData.uberStatus||{};
    return `<details class="ownerDrop"><summary><span>Delivery setup & rules</span><span>${s.enabled?'On':'Off'} ▾</span></summary><div class="ownerDropBody">
      <div class="deliveryStatusBar">
        <span class="deliveryPill ${uber.configured?'good':'warn'}">Uber API: ${uber.configured?'Ready':'Awaiting credentials'}</span>
        <span class="deliveryPill">${dEsc(String(uber.mode||'sandbox').toUpperCase())}</span>
        <span class="deliveryPill ${s.owner_available?'good':'warn'}">Me delivering: ${s.owner_available?'Available':'Not available'}</span>
      </div>
      ${!uber.configured?`<div class="deliveryWarnBox"><b>Uber Direct is prepared but not connected yet.</b><br>Once Uber approves the account, the Client ID, Client Secret and Customer ID are added securely on the server. They are never stored in this page or the database.</div>`:''}
      <label class="switch"><input id="del_enabled" type="checkbox" ${s.enabled?'checked':''}> Delivery management enabled</label>
      <div class="deliveryGrid2">
        <label>Preferred method<select id="del_preferred"><option value="uber_direct" ${s.preferred_method==='uber_direct'?'selected':''}>Uber Direct</option><option value="own_driver" ${s.preferred_method==='own_driver'?'selected':''}>Own driver</option><option value="owner" ${s.preferred_method==='owner'?'selected':''}>Me delivering</option><option value="collection" ${s.preferred_method==='collection'?'selected':''}>Collection</option></select></label>
        <label>Fallback method<select id="del_fallback"><option value="owner" ${s.fallback_method==='owner'?'selected':''}>Me delivering</option><option value="own_driver" ${s.fallback_method==='own_driver'?'selected':''}>Own driver</option><option value="uber_direct" ${s.fallback_method==='uber_direct'?'selected':''}>Uber Direct</option><option value="collection" ${s.fallback_method==='collection'?'selected':''}>Collection</option></select></label>
      </div>
      <div class="deliveryGrid2">
        <label>Dispatch mode<select id="del_dispatch"><option value="manual" ${s.dispatch_mode==='manual'?'selected':''}>Manual — safest to start</option><option value="automatic" ${s.dispatch_mode==='automatic'?'selected':''}>Automatic later</option></select></label>
        <label>Maximum Uber quote £<input id="del_max_quote" type="number" min="0" step=".01" value="${(Number(s.max_uber_quote_pence||0)/100).toFixed(2)}"></label>
      </div>
      <h3>Customer delivery charge</h3>
      <div class="deliveryGrid3">
        <label>Charging method<select id="del_charge_mode"><option value="full" ${s.customer_charge_mode==='full'?'selected':''}>Customer pays full courier quote</option><option value="fixed" ${s.customer_charge_mode==='fixed'?'selected':''}>Fixed delivery charge</option><option value="subsidised" ${s.customer_charge_mode==='subsidised'?'selected':''}>Subsidise part of courier cost</option></select></label>
        <label>Fixed charge £<input id="del_fixed" type="number" min="0" step=".01" value="${(Number(s.customer_fixed_pence||0)/100).toFixed(2)}"></label>
        <label>Subsidy £<input id="del_subsidy" type="number" min="0" step=".01" value="${(Number(s.subsidy_pence||0)/100).toFixed(2)}"></label>
      </div>
      <div class="deliveryGrid2">
        <label>Free delivery over £<input id="del_free_over" type="number" min="0" step=".01" value="${s.free_over_pence==null?'':(Number(s.free_over_pence)/100).toFixed(2)}" placeholder="Leave blank for none"></label>
        <label>Maximum service radius miles<input id="del_radius" type="number" min="0" step=".1" value="${Number(s.max_radius_miles||0)}"></label>
      </div>
      <h3>Courier pickup point</h3>
      <p class="muted">Keep this as a temporary address until the new kitchen is confirmed, then change it here before real Uber deliveries.</p>
      <label>Pickup business name<input id="del_pick_name" value="${dEsc(s.pickup_name||'Fusion Flavours')}"></label>
      <div class="deliveryGrid2"><label>Pickup phone<input id="del_pick_phone" value="${dEsc(s.pickup_phone||'')}"></label><label>City<input id="del_pick_city" value="${dEsc(s.pickup_city||'Coventry')}"></label></div>
      <label>Pickup address<input id="del_pick_addr" value="${dEsc(s.pickup_address_line1||'')}"></label>
      <label>Pickup postcode<input id="del_pick_postcode" value="${dEsc(s.pickup_postcode||'')}"></label>
      <label>Courier pickup instructions<textarea id="del_pick_notes">${dEsc(s.pickup_instructions||'')}</textarea></label>
      <h3>Me delivering</h3>
      <label class="switch"><input id="del_owner_available" type="checkbox" ${s.owner_available?'checked':''}> I am available to deliver</label>
      <div class="deliveryGrid2"><label>Vehicle / note<input id="del_owner_vehicle" value="${dEsc(s.owner_vehicle||'')}"></label><label>Internal cost per mile £<input id="del_owner_mile" type="number" min="0" step=".01" value="${(Number(s.owner_cost_per_mile_pence||0)/100).toFixed(2)}"></label></div>
      <label class="switch"><input id="del_auto_fallback" type="checkbox" ${s.auto_fallback?'checked':''}> Allow fallback method when preferred method is unavailable</label>
      <button style="width:100%;margin-top:10px" onclick="saveDeliverySettings()">Save delivery settings</button>
    </div></details>`;
  }

  function driverHtml(){
    const rows=deliveryData.drivers||[];
    return `<details class="ownerDrop"><summary><span>Drivers</span><span>${rows.filter(x=>x.active).length} active ▾</span></summary><div class="ownerDropBody">
      <p class="muted">Add a driver now or later. This does not employ or pay anyone automatically — it simply prepares the dispatch and costing system.</p>
      <details class="compactOwnerDrop"><summary><b>+ Add potential driver</b><span>▾</span></summary><div class="compactOwnerBody">
        <div class="deliveryGrid2"><label>Name<input id="driver_name"></label><label>Phone<input id="driver_phone"></label></div>
        <label>Vehicle<input id="driver_vehicle" placeholder="Car / bike / registration if useful"></label>
        <div class="deliveryGrid2"><label>Cost type<select id="driver_cost_type"><option value="per_delivery">Per delivery</option><option value="hourly">Per hour</option><option value="shift">Per shift</option></select></label><label>Cost £<input id="driver_cost" type="number" min="0" step=".01" value="0"></label></div>
        <label>Notes<textarea id="driver_notes" placeholder="Availability, insurance check, areas covered, etc."></textarea></label>
        <button style="width:100%" onclick="addDeliveryDriver()">Add driver</button>
      </div></details>
      ${rows.map(d=>`<div class="deliveryDriverCard ${d.active?'':'inactive'}"><div class="row"><div><b>${dEsc(d.name)}</b><div class="deliverySmall">${dEsc(d.phone||'No phone')} · ${dEsc(d.vehicle||'No vehicle')}</div></div><span class="deliveryMethod">${dEsc(d.cost_type.replace('_',' '))} · ${dMoney(d.cost_pence)}</span></div>${d.notes?`<div class="deliverySmall" style="margin-top:7px">${dEsc(d.notes)}</div>`:''}<div class="deliveryActions"><button class="deliverySecondary" onclick="toggleDeliveryDriver(${d.id},${d.active?'false':'true'})">${d.active?'Set inactive':'Reactivate'}</button><button class="deliveryDanger" onclick="deleteDeliveryDriver(${d.id})">Delete</button></div></div>`).join('')||'<p class="muted">No drivers added yet.</p>'}
    </div></details>`;
  }

  function queueCard(o){
    const job=jobForOrder(o.id),drivers=(deliveryData.drivers||[]).filter(x=>x.active);
    const current=job?methodLabel(job.method):'Not assigned';
    const uber=deliveryData.uberStatus||{};
    const customerCharge=job?.customer_delivery_charge_pence||o.delivery_fee_pence||0;
    return `<div class="deliveryQueueCard">
      <div class="deliveryTop"><div><b>${dEsc(o.public_id||('#'+o.id))} · ${dEsc(o.customer_name||'Customer')}</b><div class="deliverySmall">${dEsc(orderAddress(o))} · ${dEsc(o.phone||'No phone')}</div><div class="deliverySmall">Order ${dMoney(o.total_pence)} · customer delivery charge ${dMoney(customerCharge)}</div></div><div><span class="deliveryMethod">${dEsc(current)}</span>${job?`<div class="deliveryPill ${statusClass(job.status)}" style="margin-top:5px">${dEsc(job.status)}</div>`:''}</div></div>
      ${job?.method==='uber_direct'&&job?.quoted_cost_pence?`<div class="notice"><b>Uber quote:</b> ${dMoney(job.quoted_cost_pence)}${job.uber_quote_expires_at?' · expires '+dDate(job.uber_quote_expires_at):''}${Number(job.quoted_cost_pence)>Number(deliveryData.settings?.max_uber_quote_pence||999999)?'<br><b>⚠ Above your maximum Uber quote.</b>':''}</div>`:''}
      ${job?.tracking_url?`<a href="${dEsc(job.tracking_url)}" target="_blank" rel="noopener" style="display:block;margin:8px 0;padding:10px;background:#eef3e5;color:#35551f;border-radius:10px;text-align:center;font-weight:900;text-decoration:none">Open Uber live tracking</a>`:''}
      <div class="deliveryGrid2" style="margin-top:9px">
        <label>Method<select id="method_${o.id}" onchange="deliveryMethodChanged(${o.id})"><option value="uber_direct" ${(job?.method||deliveryData.settings?.preferred_method)==='uber_direct'?'selected':''}>Uber Direct</option><option value="own_driver" ${(job?.method)==='own_driver'?'selected':''}>Own driver</option><option value="owner" ${(job?.method)==='owner'?'selected':''}>Me delivering</option><option value="collection" ${(job?.method)==='collection'?'selected':''}>Collection</option></select></label>
        <label id="driver_wrap_${o.id}" class="${(job?.method)==='own_driver'?'':'hidden'}">Driver<select id="driver_${o.id}"><option value="">Choose driver…</option>${drivers.map(d=>`<option value="${d.id}" ${Number(job?.driver_id)===Number(d.id)?'selected':''}>${dEsc(d.name)} · ${dMoney(d.cost_pence)} ${dEsc(d.cost_type.replace('_',' '))}</option>`).join('')}</select></label>
      </div>
      <label>Delivery notes<input id="job_notes_${o.id}" value="${dEsc(job?.notes||o.delivery_instructions||'')}"></label>
      <div class="deliveryActions">
        <button class="deliverySecondary" onclick="assignDeliveryMethod(${o.id})">Save assignment</button>
        <button ${!uber.configured?'disabled':''} onclick="quoteUberForOrder(${o.id})">Get Uber quote</button>
        ${job?.uber_quote_id?`<button ${!uber.configured?'disabled':''} onclick="requestUberDelivery(${o.id})">Request Uber courier</button>`:''}
        ${job?`<button class="deliverySuccess" onclick="markDeliveryStatus(${job.id},'delivered')">Mark delivered</button>`:''}
      </div>
      ${job?`<div class="deliveryGrid2" style="margin-top:8px"><label>Actual delivery cost £<input id="actual_cost_${job.id}" type="number" min="0" step=".01" value="${(Number(job.actual_cost_pence||0)/100).toFixed(2)}"></label><label>Update status<select id="job_status_${job.id}" onchange="markDeliveryStatus(${job.id},this.value)">${['planned','quoted','requested','assigned','collected','delivered','cancelled','failed'].map(s=>`<option value="${s}" ${job.status===s?'selected':''}>${s}</option>`).join('')}</select></label></div><button class="deliverySecondary" style="width:100%;margin-top:6px" onclick="saveDeliveryActualCost(${job.id})">Save actual delivery cost</button>`:''}
    </div>`;
  }

  function historyHtml(){
    const rows=(deliveryData.jobs||[]).filter(j=>['delivered','cancelled','failed'].includes(j.status)).slice(0,30);
    return `<details class="ownerDrop"><summary><span>Delivery history & costs</span><span>${rows.length} recent ▾</span></summary><div class="ownerDropBody">${rows.map(j=>{const o=deliveryOrderById(j.order_id),d=driverById(j.driver_id);return `<div class="deliveryDriverCard"><div class="row"><div><b>${dEsc(o?.public_id||('#'+j.order_id))}</b><div class="deliverySmall">${dEsc(methodLabel(j.method))}${d?' · '+dEsc(d.name):''} · ${dDate(j.delivered_at||j.updated_at)}</div></div><b>${dMoney(j.actual_cost_pence)}</b></div><div class="deliveryStatusBar"><span class="deliveryPill ${statusClass(j.status)}">${dEsc(j.status)}</span>${j.quoted_cost_pence?`<span class="deliveryPill">Quote ${dMoney(j.quoted_cost_pence)}</span>`:''}${j.customer_delivery_charge_pence?`<span class="deliveryPill">Customer paid ${dMoney(j.customer_delivery_charge_pence)}</span>`:''}</div></div>`}).join('')||'<p class="muted">No completed delivery jobs yet.</p>'}</div></details>`;
  }

  async function renderDeliveryManagement(force=false){
    injectStyles();ensurePage();ensureNav();
    const p=el('page-delivery');if(!p)return;
    p.innerHTML='<h2>Delivery</h2><p class="muted">Loading delivery setup…</p>';
    try{await loadDeliveryData(force)}catch(e){p.innerHTML=`<h2>Delivery</h2><div class="notice">Could not load delivery setup: ${dEsc(e.message)}</div>`;return}
    const active=activeMainOrders(),jobs=deliveryData.jobs||[],todayCost=deliveryCostToday(),activeDrivers=(deliveryData.drivers||[]).filter(x=>x.active).length;
    p.innerHTML=`<div class="ownerHead"><div><h2 style="margin-bottom:3px">Delivery</h2><div class="muted">One place for Uber Direct, your own driver, you delivering, and collection.</div></div><button onclick="refreshDeliveryManagement()">↻ Refresh</button></div>
      <div class="deliveryCards"><div class="deliveryCard">${active.length}<small>Paid orders awaiting delivery</small></div><div class="deliveryCard">${activeDrivers}<small>Active drivers</small></div><div class="deliveryCard">${dMoney(todayCost)}<small>Delivery cost today</small></div><div class="deliveryCard">${jobs.filter(j=>['requested','assigned','collected'].includes(j.status)).length}<small>Deliveries in progress</small></div></div>
      <div class="deliveryWarnBox"><b>Launch recommendation:</b> keep dispatch on <b>manual</b>. You stay cooking, then choose Uber Direct, a driver, or yourself per order. Automatic dispatch can be enabled later when the workflow is proven.</div>
      ${settingsHtml()}
      ${driverHtml()}
      <div class="panel" style="margin-top:12px"><h2>Dispatch queue</h2><p class="muted">Only paid main-delivery orders appear here. Harnell is deliberately left separate for now.</p>${active.map(queueCard).join('')||'<p class="muted">No paid delivery orders are currently waiting.</p>'}</div>
      ${historyHtml()}`;
    try{ if(typeof decorateOwnerPage==='function') decorateOwnerPage('delivery'); }catch{}
  }

  window.refreshDeliveryManagement=()=>renderDeliveryManagement(true);

  window.saveDeliverySettings=async()=>{
    try{
      const body={
        enabled:!!el('del_enabled')?.checked,
        preferred_method:el('del_preferred')?.value||'uber_direct',
        fallback_method:el('del_fallback')?.value||'owner',
        dispatch_mode:el('del_dispatch')?.value||'manual',
        uber_enabled:!!deliveryData.uberStatus?.configured,
        max_uber_quote_pence:Math.max(0,Math.round(Number(el('del_max_quote')?.value||0)*100)),
        customer_charge_mode:el('del_charge_mode')?.value||'full',
        customer_fixed_pence:Math.max(0,Math.round(Number(el('del_fixed')?.value||0)*100)),
        subsidy_pence:Math.max(0,Math.round(Number(el('del_subsidy')?.value||0)*100)),
        free_over_pence:el('del_free_over')?.value===''?null:Math.max(0,Math.round(Number(el('del_free_over')?.value||0)*100)),
        max_radius_miles:Math.max(0,Number(el('del_radius')?.value||0)),
        pickup_name:(el('del_pick_name')?.value||'Fusion Flavours').trim(),
        pickup_phone:(el('del_pick_phone')?.value||'').trim(),
        pickup_address_line1:(el('del_pick_addr')?.value||'').trim(),
        pickup_city:(el('del_pick_city')?.value||'Coventry').trim(),
        pickup_postcode:(el('del_pick_postcode')?.value||'').trim().toUpperCase(),
        pickup_instructions:(el('del_pick_notes')?.value||'').trim(),
        owner_available:!!el('del_owner_available')?.checked,
        owner_vehicle:(el('del_owner_vehicle')?.value||'').trim(),
        owner_cost_per_mile_pence:Math.max(0,Math.round(Number(el('del_owner_mile')?.value||0)*100)),
        auto_fallback:!!el('del_auto_fallback')?.checked,
        updated_at:new Date().toISOString()
      };
      await api('/rest/v1/delivery_settings?id=eq.1',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});
      deliveryData.settings={...(deliveryData.settings||{}),...body};
      alert('Delivery settings saved.');
      renderDeliveryManagement(false);
    }catch(e){alert(e.message)}
  };

  window.addDeliveryDriver=async()=>{
    const name=(el('driver_name')?.value||'').trim();if(!name)return alert('Enter the driver name.');
    try{
      const body={name,phone:(el('driver_phone')?.value||'').trim(),vehicle:(el('driver_vehicle')?.value||'').trim(),cost_type:el('driver_cost_type')?.value||'per_delivery',cost_pence:Math.max(0,Math.round(Number(el('driver_cost')?.value||0)*100)),notes:(el('driver_notes')?.value||'').trim(),active:true};
      await api('/rest/v1/delivery_drivers',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});
      await renderDeliveryManagement(true);
    }catch(e){alert(e.message)}
  };

  window.toggleDeliveryDriver=async(id,active)=>{
    try{await api('/rest/v1/delivery_drivers?id=eq.'+id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active:!!active,updated_at:new Date().toISOString()})});await renderDeliveryManagement(true)}catch(e){alert(e.message)}
  };
  window.deleteDeliveryDriver=async id=>{
    if(!confirm('Delete this driver profile? Existing delivery history will keep the job but remove the driver link.'))return;
    try{await api('/rest/v1/delivery_drivers?id=eq.'+id,{method:'DELETE',headers:{Prefer:'return=minimal'}});await renderDeliveryManagement(true)}catch(e){alert(e.message)}
  };

  window.deliveryMethodChanged=id=>{
    const v=el('method_'+id)?.value;
    el('driver_wrap_'+id)?.classList.toggle('hidden',v!=='own_driver');
  };

  async function upsertJob(orderId,patch){
    const existing=jobForOrder(orderId);
    const now=new Date().toISOString();
    if(existing){
      await api('/rest/v1/delivery_jobs?id=eq.'+existing.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({...patch,updated_at:now})});
    }else{
      await api('/rest/v1/delivery_jobs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({order_id:Number(orderId),...patch,created_at:now,updated_at:now})});
    }
    await loadDeliveryData(true);
    return jobForOrder(orderId);
  }

  window.assignDeliveryMethod=async orderId=>{
    const method=el('method_'+orderId)?.value||deliveryData.settings?.preferred_method||'uber_direct';
    const driverId=method==='own_driver'?Number(el('driver_'+orderId)?.value||0):null;
    if(method==='own_driver'&&!driverId)return alert('Choose the driver.');
    if(method==='owner'&&!deliveryData.settings?.owner_available && !confirm('You are currently marked as not available to deliver. Assign this order to yourself anyway?')) return;
    const driver=driverById(driverId);
    const defaultCost=method==='own_driver'&&driver?.cost_type==='per_delivery'?Number(driver.cost_pence||0):0;
    try{
      await upsertJob(orderId,{method,driver_id:driverId||null,status:'assigned',actual_cost_pence:defaultCost,customer_delivery_charge_pence:Number(deliveryOrderById(orderId)?.delivery_fee_pence||0),notes:(el('job_notes_'+orderId)?.value||'').trim(),assigned_at:new Date().toISOString()});
      await renderDeliveryManagement(false);
    }catch(e){alert(e.message)}
  };

  window.quoteUberForOrder=async orderId=>{
    const s=deliveryData.settings||{},o=deliveryOrderById(orderId);
    if(!o)return alert('Order not found.');
    if(!deliveryData.uberStatus?.configured)return alert('Uber Direct API credentials are not connected yet.');
    if(!s.pickup_address_line1||!s.pickup_postcode)return alert('Add the courier pickup address and postcode in Delivery setup first.');
    try{
      const r=await uberApi('quote',{pickup:{address_line1:s.pickup_address_line1,city:s.pickup_city,postcode:s.pickup_postcode,country:'GB'},dropoff:{address_line1:o.address_line1,city:s.pickup_city||'Coventry',postcode:o.postcode,country:'GB'}});
      const q=r.quote||r;
      const customerCharge=chargePreview(q.fee,Number(o.subtotal_pence||o.total_pence||0));
      await upsertJob(orderId,{method:'uber_direct',driver_id:null,status:'quoted',quoted_cost_pence:Number(q.fee||0),customer_delivery_charge_pence:customerCharge,uber_quote_id:q.id||null,uber_quote_expires_at:q.expires||null,pickup_eta:q.pickup_eta||null,dropoff_eta:q.dropoff_eta||null,notes:(el('job_notes_'+orderId)?.value||'').trim()});
      const max=Number(s.max_uber_quote_pence||0);
      alert(`Uber quote: ${dMoney(q.fee)}.${max&&Number(q.fee)>max?' This is above your maximum quote setting.':''}`);
      await renderDeliveryManagement(false);
    }catch(e){alert('Uber quote failed: '+e.message)}
  };

  window.requestUberDelivery=async orderId=>{
    const s=deliveryData.settings||{},o=deliveryOrderById(orderId),j=jobForOrder(orderId);
    if(!o||!j?.uber_quote_id)return alert('Get a fresh Uber quote first.');
    const max=Number(s.max_uber_quote_pence||0),over=max&&Number(j.quoted_cost_pence||0)>max;
    const mode=String(deliveryData.uberStatus?.mode||'sandbox').toLowerCase();
    const warning=(mode==='production'?'This will request a REAL Uber courier and can create a real delivery charge.':'This is Uber TEST/SANDBOX mode and should not create a real courier delivery.')+`\n\nQuote: ${dMoney(j.quoted_cost_pence)}${over?'\n⚠ This is above your maximum quote setting.':''}\n\nContinue?`;
    if(!confirm(warning))return;
    try{
      const r=await uberApi('create',{
        quote_id:j.uber_quote_id,
        external_id:String(o.public_id||o.id),
        pickup:{address_line1:s.pickup_address_line1,city:s.pickup_city,postcode:s.pickup_postcode,country:'GB',name:s.pickup_name,phone:s.pickup_phone,notes:s.pickup_instructions},
        dropoff:{address_line1:o.address_line1,city:s.pickup_city||'Coventry',postcode:o.postcode,country:'GB',name:o.customer_name,phone:o.phone,notes:o.delivery_instructions||''},
        manifest_items:[{name:`Fusion Flavours order ${o.public_id||o.id}`,quantity:1}]
      });
      const d=r.delivery||r;
      await upsertJob(orderId,{method:'uber_direct',status:'requested',actual_cost_pence:Number(d.fee||j.quoted_cost_pence||0),uber_delivery_id:d.id||null,tracking_url:d.tracking_url||null,pickup_eta:d.pickup_eta||null,dropoff_eta:d.dropoff_eta||null,assigned_at:new Date().toISOString()});
      alert(mode==='production'?'Uber courier requested.':'Uber test delivery created successfully.');
      await renderDeliveryManagement(false);
    }catch(e){alert('Uber delivery was not created: '+e.message)}
  };

  window.saveDeliveryActualCost=async id=>{
    const j=(deliveryData.jobs||[]).find(x=>Number(x.id)===Number(id));if(!j)return;
    const p=Math.max(0,Math.round(Number(el('actual_cost_'+id)?.value||0)*100));
    try{await api('/rest/v1/delivery_jobs?id=eq.'+id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({actual_cost_pence:p,updated_at:new Date().toISOString()})});await renderDeliveryManagement(true)}catch(e){alert(e.message)}
  };

  window.markDeliveryStatus=async(id,status)=>{
    const patch={status,updated_at:new Date().toISOString()};
    if(status==='collected')patch.collected_at=new Date().toISOString();
    if(status==='delivered')patch.delivered_at=new Date().toISOString();
    try{await api('/rest/v1/delivery_jobs?id=eq.'+id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});await renderDeliveryManagement(true)}catch(e){alert(e.message)}
  };

  function installTabHook(){
    ensurePage();ensureNav();
    if(window.__fusionDeliveryTabHooked) return;
    if(typeof window.showTab==='function'){
      const base=window.showTab;
      window.showTab=function(t){
        const r=base(t);
        if(t==='delivery') queueMicrotask(()=>renderDeliveryManagement(false));
        return r;
      };
      window.__fusionDeliveryTabHooked=true;
    }
  }

  function installOwnerLoadHook(){
    try{
      if(window.__fusionDeliveryOwnerLoadHooked || typeof loadOwnerData!=='function') return;
      const base=loadOwnerData;
      loadOwnerData=async function(...args){
        const r=await base(...args);
        try{await loadDeliveryData(true)}catch{}
        return r;
      };
      window.__fusionDeliveryOwnerLoadHooked=true;
    }catch{}
  }

  function installFinanceHook(){
    try{
      if(window.__fusionDeliveryFinanceHooked || typeof performanceDataForRange!=='function') return;
      const base=performanceDataForRange;
      performanceDataForRange=function(start,end){
        const d=base(start,end);
        const jobs=(deliveryData.jobs||[]).filter(j=>{
          if(!['delivered','collected','assigned','requested'].includes(String(j.status||'')))return false;
          const day=dDateKey(j.delivered_at||j.updated_at||j.created_at);
          return day>=start&&day<=end;
        });
        const deliveryCourierCost=jobs.reduce((n,j)=>n+Number(j.actual_cost_pence||0)/100,0);
        d.deliveryCourierCost=deliveryCourierCost;
        d.operatingProfit=Number(d.operatingProfit||0)-deliveryCourierCost;
        return d;
      };
      if(typeof pnlReportForSelection==='function'){
        const baseReport=pnlReportForSelection;
        pnlReportForSelection=function(){
          const report=baseReport(),d=selectedPnlData().data;
          report.lines.splice(Math.max(0,report.lines.length-1),0,{label:'Delivery / courier costs',value:dMoney(Math.round(Number(d.deliveryCourierCost||0)*100))});
          report.notes+=' Delivery / courier costs are taken from the Delivery jobs record and deducted from net profit.';
          return report;
        };
      }
      window.__fusionDeliveryFinanceHooked=true;
    }catch(e){console.warn('Delivery finance hook',e)}
  }

  function init(){
    injectStyles();ensurePage();ensureNav();installTabHook();installOwnerLoadHook();installFinanceHook();
    setTimeout(()=>{ensureNav();installTabHook();installOwnerLoadHook();installFinanceHook()},1000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
