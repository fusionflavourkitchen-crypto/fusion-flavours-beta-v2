/* Community Meals customer-page introduction */
(()=>{
'use strict';
function ensureIntro(){
  const view=document.getElementById('harnellView');
  if(!view||view.classList.contains('hidden')||document.getElementById('communityMealsIntro'))return;
  const title=document.getElementById('harnellTitle');
  const anchor=title?.parentElement||view.firstElementChild;
  const box=document.createElement('div');
  box.id='communityMealsIntro';
  box.className='notice';
  box.style.margin='12px 0 16px';
  box.innerHTML='<b>Community Meals</b><br>Affordable, filling meals with good portions for people in the community who need them. Pre-order your food, choose an available delivery slot at checkout, and we’ll deliver it to you during that selected time window.';
  if(anchor)anchor.insertAdjacentElement('afterend',box);else view.prepend(box);
}
function run(){ensureIntro()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(run).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
setInterval(run,1500);
})();
