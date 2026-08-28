/* Fusion Flavours: main Delivery is normal on-demand ordering. Community Meals preorder flow is unchanged. */
(()=>{
'use strict';

try{window.serviceOpen=()=>true}catch(e){}

let rerendered=false;
function buildWelcomeNote(){
  const note=document.createElement('div');
  note.className='mainDeliveryWelcomeNote';
  note.style.cssText='background:#171717;color:#fff;border:2px solid #f26b21;border-radius:18px;padding:22px 20px;margin:0 0 18px;text-align:center;box-shadow:0 5px 14px rgba(0,0,0,.12)';
  note.innerHTML='<div style="font-size:22px;font-weight:950;margin-bottom:10px">Fresh food, cooked with care.</div><div style="font-size:16px;line-height:1.55;color:#f5eee7">Order from the menu and we’ll cook your food fresh, then get it on its way to you as soon as it’s ready.</div><div style="margin-top:14px;color:#f26b21;font-weight:900">Thanks for supporting Fusion Flavours — Chef Dan</div>';
  return note;
}

function cleanMainDelivery(){
  const customer=document.getElementById('customer');
  if(!customer)return;

  // Remove stale duplicates before placing one authoritative welcome note.
  const notes=[...customer.querySelectorAll('.mainDeliveryWelcomeNote')];
  notes.slice(1).forEach(n=>n.remove());
  let note=notes[0]||null;

  // Find the actual opening/delivery hero shown on the main Delivery page rather than simply
  // taking the first .hero in the document, because older shells can contain other hero blocks.
  const heroes=[...customer.querySelectorAll('.hero')];
  const openingHero=heroes.find(h=>/\bOpen\b/i.test(h.textContent||'') || /Delivery area/i.test(h.textContent||'')) || heroes[0] || null;

  if(!note) note=buildWelcomeNote();

  // Preferred location: immediately before the opening-days card, matching the original layout.
  if(openingHero && openingHero.parentNode){
    if(note.nextElementSibling!==openingHero) openingHero.parentNode.insertBefore(note,openingHero);
  }else{
    // Fallback: place it immediately after the visible Home/back link if present.
    const links=[...customer.querySelectorAll('a')];
    const back=links.find(a=>/Fusion Flavours Home|Back to Fusion Flavours/i.test(a.textContent||''));
    if(back){
      const holder=back.parentElement||back;
      holder.insertAdjacentElement('afterend',note);
    }else if(!note.isConnected){
      customer.prepend(note);
    }
  }

  if(openingHero){
    const eyebrow=openingHero.querySelector(':scope > small');
    if(eyebrow && /pre\s*-?order/i.test(eyebrow.textContent||'')) eyebrow.remove();
  }

  const preorder=document.getElementById('preorderBox');
  if(preorder) preorder.remove();

  customer.querySelectorAll('[alt],[title],[aria-label]').forEach(el=>{
    ['alt','title','aria-label'].forEach(a=>{
      const v=el.getAttribute(a);
      if(v && /pre\s*-?order/i.test(v)) el.setAttribute(a,v.replace(/pre\s*-?order(?:ing)?/gi,'ordering'));
    });
  });

  if(!rerendered && !customer.classList.contains('hidden') && typeof window.renderCustomer==='function' && window.state?.settings){
    rerendered=true;
    try{window.renderCustomer()}catch(e){console.warn('Main Delivery refresh',e)}
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanMainDelivery,{once:true});else cleanMainDelivery();
const observer=new MutationObserver(cleanMainDelivery);
if(document.body)observer.observe(document.body,{subtree:true,childList:true});
})();
