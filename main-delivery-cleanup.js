/* Fusion Flavours: main Delivery is normal on-demand ordering. Community Meals preorder flow is unchanged. */
(()=>{
'use strict';

// The main Delivery menu must not be controlled by the old preorder/open-day switch.
// Keep the legacy settings in the database for compatibility, but stop using them here.
try{window.serviceOpen=()=>true}catch(e){}

let rerendered=false;
function cleanMainDelivery(){
  const customer=document.getElementById('customer');
  if(!customer)return;

  // Replace the old baked-in preorder chalkboard image with a live message that matches
  // the new normal ordering model. This keeps the same prominent note position without
  // any preorder/cut-off wording.
  const note=customer.querySelector('.welcomeNoteWrap');
  if(note && !note.querySelector('.mainDeliveryWelcomeNote')){
    note.innerHTML=`<div class="mainDeliveryWelcomeNote" style="background:#171717;color:#fff;border:2px solid #f26b21;border-radius:18px;padding:22px 20px;margin:0 0 18px;text-align:center;box-shadow:0 5px 14px rgba(0,0,0,.12)"><div style="font-size:22px;font-weight:950;margin-bottom:10px">Fresh food, cooked with care.</div><div style="font-size:16px;line-height:1.55;color:#f5eee7">Order from the menu and we’ll cook your food fresh, then get it on its way to you as soon as it’s ready.</div><div style="margin-top:14px;color:#f26b21;font-weight:900">Thanks for supporting Fusion Flavours — Chef Dan</div></div>`;
  }

  const hero=customer.querySelector('.hero');
  if(hero){
    const eyebrow=hero.querySelector(':scope > small');
    if(eyebrow && /pre\s*-?order/i.test(eyebrow.textContent||'')) eyebrow.remove();
  }

  const preorder=document.getElementById('preorderBox');
  if(preorder) preorder.remove();

  // Remove any remaining customer-facing preorder wording from accessibility labels/titles.
  customer.querySelectorAll('[alt],[title],[aria-label]').forEach(el=>{
    ['alt','title','aria-label'].forEach(a=>{
      const v=el.getAttribute(a);
      if(v && /pre\s*-?order/i.test(v)) el.setAttribute(a,v.replace(/pre\s*-?order(?:ing)?/gi,'ordering'));
    });
  });

  // If the old renderer ran before this module loaded, rebuild the visible Delivery menu once
  // so Add to Basket buttons are enabled using the new always-open main Delivery behaviour.
  if(!rerendered && !customer.classList.contains('hidden') && typeof window.renderCustomer==='function' && window.state?.settings){
    rerendered=true;
    try{window.renderCustomer()}catch(e){console.warn('Main Delivery refresh',e)}
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanMainDelivery,{once:true});else cleanMainDelivery();
const observer=new MutationObserver(cleanMainDelivery);
if(document.body)observer.observe(document.body,{subtree:true,childList:true});
})();
