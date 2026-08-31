/* Fusion Flavours: main Delivery is normal on-demand ordering. Community Meals preorder flow is unchanged. */
(()=>{
'use strict';

try{window.serviceOpen=()=>true}catch(e){}

function buildWelcomeNote(){
  const note=document.createElement('div');
  note.className='mainDeliveryWelcomeNote';
  note.dataset.design='chef-note-v3';
  note.style.cssText='position:relative;background:linear-gradient(180deg,#1a1a1a 0%,#121212 100%);color:#f8f2ea;border:2px solid #f26b21;border-radius:18px;padding:26px 24px 24px;margin:14px 0 22px;text-align:center;box-shadow:0 8px 20px rgba(0,0,0,.18),inset 0 0 0 1px rgba(255,255,255,.04);overflow:hidden';
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

function normalText(el){
  return String(el?.innerText||el?.textContent||'').replace(/\s+/g,' ').trim();
}

function isLegacyCreamNote(el){
  if(!el || el.classList?.contains('mainDeliveryWelcomeNote'))return false;
  const text=normalText(el);
  return /Fresh food,\s*cooked with care\.?/i.test(text) && /Thanks for supporting Fusion Flavours/i.test(text);
}

function removeLegacyCreamNote(){
  const matches=[...document.querySelectorAll('div,section,article,aside')].filter(isLegacyCreamNote);
  const smallest=matches.filter(el=>![...el.children].some(child=>isLegacyCreamNote(child)));
  smallest.forEach(el=>el.remove());
}

function findDeliveryHome(){
  const controls=[...document.querySelectorAll('a,button')];
  let home=controls.find(el=>/^(?:←\s*)?Fusion Flavours Home$/i.test(normalText(el)));
  if(home)return home;
  return [...document.querySelectorAll('h1,h2,h3,div,span')].find(el=>/^(?:←\s*)?Fusion Flavours Home$/i.test(normalText(el)))||null;
}

function isOpenDeliveryCard(el){
  const text=normalText(el);
  return /^Open\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(text) && /Delivery area\s*:/i.test(text);
}

function findOpenDeliveryCard(){
  const matches=[...document.querySelectorAll('div,section,article,aside')].filter(isOpenDeliveryCard);
  if(!matches.length)return null;
  return matches.find(el=>![...el.children].some(child=>isOpenDeliveryCard(child)))||matches[0];
}

function cleanMainDelivery(){
  const card=findOpenDeliveryCard();
  if(!card)return;

  const conflictingServerNote=document.getElementById('mainDeliveryChefNote');
  if(conflictingServerNote)conflictingServerNote.remove();
  removeLegacyCreamNote();

  const notes=[...document.querySelectorAll('.mainDeliveryWelcomeNote')];
  notes.slice(1).forEach(n=>n.remove());
  let note=notes[0]||null;
  if(note && note.dataset.design!=='chef-note-v3'){
    const replacement=buildWelcomeNote();
    note.replaceWith(replacement);
    note=replacement;
  }
  if(!note)note=buildWelcomeNote();

  if(card.parentElement && (note.parentElement!==card.parentElement || note.nextElementSibling!==card)){
    card.parentElement.insertBefore(note,card);
  }

  const preorder=document.getElementById('preorderBox');
  if(preorder)preorder.remove();
}

let queued=false;
const observer=new MutationObserver(()=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;cleanMainDelivery()});
});
function startMainDeliveryCleanup(){
  if(document.body)observer.observe(document.body,{subtree:true,childList:true});
  cleanMainDelivery();
  setTimeout(cleanMainDelivery,250);
  setTimeout(cleanMainDelivery,750);
  setTimeout(cleanMainDelivery,1500);
  setTimeout(cleanMainDelivery,3000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startMainDeliveryCleanup,{once:true});else startMainDeliveryCleanup();
})();
