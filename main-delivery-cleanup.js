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
