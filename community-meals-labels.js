/* Fusion Flavours: display rename Harnell -> Community Meals. Internal IDs/data stay unchanged. */
(()=>{
  'use strict';
  const rules=[
    [/Harnell Orders/gi,'Community Orders'],
    [/Harnell Menu/gi,'Community Menu'],
    [/Harnell Delivery/gi,'Community Meal Delivery'],
    [/Harnell/gi,'Community Meals']
  ];
  const skip=new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','SELECT','OPTION']);
  function renameText(root=document.body){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[]; let n;
    while((n=walker.nextNode())) nodes.push(n);
    nodes.forEach(node=>{
      const p=node.parentElement;
      if(!p||skip.has(p.tagName))return;
      let v=node.nodeValue;
      if(!/harnell/i.test(v||''))return;
      rules.forEach(([re,to])=>{v=v.replace(re,to)});
      if(v!==node.nodeValue)node.nodeValue=v;
    });
  }
  function run(){renameText(document.body)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
  const observer=new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type==='characterData') renameText(m.target.parentElement||document.body);
      else m.addedNodes.forEach(x=>{if(x.nodeType===1)renameText(x);else if(x.nodeType===3&&x.parentElement)renameText(x.parentElement)});
    }
  });
  document.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{subtree:true,childList:true,characterData:true}),{once:true});
  if(document.body)observer.observe(document.body,{subtree:true,childList:true,characterData:true});
})();
