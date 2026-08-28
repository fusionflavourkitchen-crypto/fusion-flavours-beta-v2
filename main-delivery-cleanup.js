/* Fusion Flavours: main Delivery page cleanup. Community Meals preorder flow is unchanged. */
(()=>{
'use strict';
function cleanMainDelivery(){
  const customer=document.getElementById('customer');
  if(!customer)return;
  const hero=customer.querySelector('.hero');
  if(!hero)return;
  const eyebrow=hero.querySelector(':scope > small');
  if(eyebrow && /pre\s*-?order/i.test(eyebrow.textContent||'')) eyebrow.remove();
  const preorder=document.getElementById('preorderBox');
  if(preorder) preorder.remove();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanMainDelivery,{once:true});else cleanMainDelivery();
const observer=new MutationObserver(cleanMainDelivery);
if(document.body)observer.observe(document.body,{subtree:true,childList:true});
})();
