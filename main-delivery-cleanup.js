/* Fusion Flavours: main Delivery is normal on-demand ordering. Community Meals preorder flow is unchanged. */
(()=>{
'use strict';

try{window.serviceOpen=()=>true}catch(e){}

let rerendered=false;
function buildWelcomeNote(){
  const note=document.createElement('div');
  note.className='mainDeliveryWelcomeNote';
  note.style.cssText='position:relative;background:linear-gradient(180deg,#1a1a1a 0%,#121212 100%);color:#f8f2ea;border:2px solid #f26b21;border-radius:18px;padding:26px 24px 24px;margin:0 0 22px;text-align:center;box-shadow:0 8px 20px rgba(0,0,0,.18),inset 0 0 0 1px rgba(255,255,255,.04);overflow:hidden';
  note.innerHTML=`
    <div aria-hidden="true" style="position:absolute;left:12px;top:12px;width:34px;height:34px;border-left:2px solid #f26b21;border-top:2px solid #f26b21;border-radius:10px 0 0 0;opacity:.9"></div>
    <div aria-hidden="true" style="position:absolute;right:12px;bottom:12px;width:34px;height:34px;border-right:2px solid #f26b21;border-bottom:2px solid #f26b21;border-radius:0 0 10px 0;opacity:.9"></div>
    <div style="font-family:'Comic Sans MS','Segoe Print','Bradley Hand',cursive;font-size:21px;line-height:1.5;letter-spacing:.01em;color:#f7f1e8;text-shadow:0 1px 0 #000">
      <div style="margin-bottom:8px">We keep things <span style="color:#f26b21;font-weight:700">fresh</span> and real.</div>
      <div>Your food is cooked <span style="color:#f26b21;font-weight:700">fresh to order</span>,</div>
      <div>then sent on its way to you</div>
      <div>as soon as it’s ready.</div>
      <div style="margin-top:16px">Thank you for your patience and support</div>
      <div>— it means everything.</div>
    </div>
    <div style="margin-top:16px;text-align:right;padding-right:8px;font-family:'Comic Sans MS','Segoe Print','Bradley Hand',cursive;color:#f26b21;font-size:21px;line-height:1.05;transform:rotate(-3deg)">
      <div style="font-size:18px">Thanks!</div>
      <div style="font-size:25px">Chef Dan</div>
    </div>`;
  return note;
}

function cleanMainDelivery(){
  const customer=document.getElementById('customer');
  if(!customer)return;

  // Self-heal the short-lived broken server-rendered note experiment. That version
  // ran a second MutationObserver against the same area and could loop with this module.
  const conflictingServerNote=document.getElementById('mainDeliveryChefNote');
  if(conflictingServerNote) conflictingServerNote.remove();

  const notes=[...customer.querySelectorAll('.mainDeliveryWelcomeNote')];
  notes.slice(1).forEach(n=>n.remove());
  let note=notes[0]||null;

  const heroes=[...customer.querySelectorAll('.hero')];
  const openingHero=heroes.find(h=>/\bOpen\b/i.test(h.textContent||'') || /Delivery area/i.test(h.textContent||'')) || heroes[0] || null;

  // Rebuild old/plain versions so the note always uses the approved handwritten design.
  if(note && note.dataset.design!=='chef-note-v2'){
    const replacement=buildWelcomeNote();
    replacement.dataset.design='chef-note-v2';
    note.replaceWith(replacement);
    note=replacement;
  }
  if(!note){
    note=buildWelcomeNote();
    note.dataset.design='chef-note-v2';
  }

  if(openingHero && openingHero.parentNode){
    if(note.nextElementSibling!==openingHero) openingHero.parentNode.insertBefore(note,openingHero);
  }else{
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
