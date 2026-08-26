(function(){
  'use strict';

  function byId(id){ return document.getElementById(id); }
  function pounds(pence){ return '£'+(Number(pence||0)/100).toFixed(2); }
  function moneyLocal(n){ return '£'+Number(n||0).toFixed(2); }

  function workingDaysBefore(dateText,days){
    if(!dateText) return '';
    var d=new Date(dateText+'T12:00:00Z');
    if(Number.isNaN(d.getTime())) return '';
    var left=Number(days||0);
    while(left>0){
      d.setUTCDate(d.getUTCDate()-1);
      var dow=d.getUTCDay();
      if(dow!==0 && dow!==6) left--;
    }
    return d.toISOString().slice(0,10);
  }

  function formatDate(dateText){
    if(!dateText) return '—';
    try{return new Date(dateText+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});}catch(e){return dateText;}
  }

  function selectedPackage(){
    try{
      var id=Number(byId('cePackageId') && byId('cePackageId').value || 0);
      return (window.cateringPackages||[]).find(function(x){return Number(x.id)===id;}) || null;
    }catch(e){return null;}
  }

  function updateDepositNotice50(){
    var n=byId('cateringDepositNotice');
    if(!n) return;
    var guests=Math.max(0,Number(byId('ceGuests') && byId('ceGuests').value || 0));
    var p=selectedPackage();
    var total=p ? Number(p.price_per_head||0)*guests : 0;
    var dep=total*0.5;
    var text='<b>Booking deposit:</b> 50% of the agreed catering total';
    if(p && guests){
      text+=' · '+guests+' guests at '+moneyLocal(Number(p.price_per_head||0))+' = '+moneyLocal(total)+' total · <b>'+moneyLocal(dep)+' deposit</b>';
    }
    text+='<br><span class="muted">The remaining 50% is due 3 working days before the event.</span>';
    if(n.innerHTML!==text) n.innerHTML=text;
    var pay=byId('cateringBookPay');
    if(pay && pay.textContent!=='Book package & pay 50% deposit') pay.textContent='Book package & pay 50% deposit';
  }

  window.updateCustomerDepositNotice=updateDepositNotice50;

  function replaceOldDepositSettings(){
    var input=byId('cat_deposit_head');
    if(!input) return;
    var panel=input.closest('.panel');
    if(!panel || panel.dataset.fixedDepositPolicy==='1') return;
    panel.dataset.fixedDepositPolicy='1';
    panel.innerHTML='<h2>Catering payment policy</h2><div class="notice"><b>50% booking deposit</b><br>The booking is confirmed once the deposit is paid. The remaining 50% is due 3 working days before the event.</div><p class="muted">For a £250 booking this means £125 deposit and £125 final balance.</p>';
  }

  function enhanceNewBooking(){
    var total=byId('cat_new_total'), dep=byId('cat_new_deposit');
    if(!total || !dep || dep.dataset.policyReady==='1') return;
    dep.dataset.policyReady='1';
    dep.setAttribute('placeholder','50% of agreed total');
    var label=dep.closest('label');
    if(label && !label.querySelector('.depositPolicyHint')){
      var hint=document.createElement('small');
      hint.className='muted depositPolicyHint';
      hint.style.display='block';
      hint.textContent='Default: 50% booking deposit';
      label.appendChild(hint);
    }
    function suggested(){
      var t=Number(total.value||0);
      if(t>0) return t;
      try{return Number(window.cateringSuggestedTotal ? window.cateringSuggestedTotal() : 0)||0;}catch(e){return 0;}
    }
    function sync(){
      if(dep.dataset.manual==='1') return;
      var t=suggested();
      dep.value=t>0 ? (t*0.5).toFixed(2) : '0.00';
    }
    total.addEventListener('input',sync);
    dep.addEventListener('input',function(){dep.dataset.manual='1';});
    sync();
    var panel=total.closest('.panel');
    if(panel && !panel.querySelector('.newCateringPolicyNotice')){
      var note=document.createElement('div');
      note.className='notice newCateringPolicyNotice';
      note.style.marginTop='10px';
      note.innerHTML='<b>Payment schedule:</b> 50% to secure the booking · remaining 50% due 3 working days before the event.';
      var save=Array.from(panel.querySelectorAll('button')).find(function(b){return /Save catering booking/i.test(b.textContent||'');});
      if(save) panel.insertBefore(note,save);
      else panel.appendChild(note);
    }
  }

  function orderFor(id){
    try{return (window.ownerData && ownerData.cateringOrders || []).find(function(x){return Number(x.id)===Number(id);})||null;}catch(e){return null;}
  }

  window.setCateringDeposit50=async function(id){
    var total=byId('cb_total_'+id), dep=byId('cb_deposit_'+id);
    if(!total || !dep) return;
    dep.value=(Math.max(0,Number(total.value||0))*0.5).toFixed(2);
    if(typeof window.saveCateringBooking==='function') await window.saveCateringBooking(id);
  };

  window.copyCateringBalanceLink=async function(id){
    try{
      var o=orderFor(id);
      if(!o || !o.public_token) throw new Error('Booking payment reference is missing.');
      var total=Number(o.total_price_pence||0), paid=Number(o.amount_paid_pence||0), due=Math.max(0,total-paid);
      if(due<30) throw new Error('This booking has no outstanding balance.');
      var result=await api('/functions/v1/create-catering-balance-checkout',{method:'POST',body:JSON.stringify({order_id:o.id,public_token:o.public_token})});
      if(!result || !result.url) throw new Error(result && result.message || 'Could not create balance payment link.');
      try{
        await navigator.clipboard.writeText(result.url);
        alert('Balance payment link copied. Amount due: '+pounds(due));
      }catch(copyErr){
        window.prompt('Copy this balance payment link:',result.url);
      }
    }catch(e){alert(e.message||String(e));}
  };

  function enhanceBookingCards(){
    document.querySelectorAll('.cateringBooking').forEach(function(card){
      var totalInput=card.querySelector('input[id^="cb_total_"]');
      if(!totalInput) return;
      var id=Number(totalInput.id.replace('cb_total_',''));
      if(!id) return;
      var o=orderFor(id);
      if(!o) return;
      var total=Number(o.total_price_pence||0)/100;
      var paid=Number(o.amount_paid_pence||0)/100;
      var target=total*0.5;
      var balance=Math.max(0,total-paid);
      var foodCost=0;
      try{foodCost=typeof window.cateringOrderFoodCost==='function'?Number(window.cateringOrderFoodCost(o)||0):0;}catch(e){}
      var projected=Math.max(0,total-foodCost);
      var dueDate=workingDaysBefore(o.event_date,3);
      var box=card.querySelector('.cateringPaymentPolicyBox');
      var html='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">'+
        '<div><b>'+moneyLocal(target)+'</b><br><small>50% deposit target</small></div>'+
        '<div><b>'+moneyLocal(balance)+'</b><br><small>Outstanding balance</small></div>'+
        '<div><b>'+formatDate(dueDate)+'</b><br><small>Balance due date</small></div>'+
        '<div><b>'+moneyLocal(projected)+'</b><br><small>Projected gross after recipe food cost</small></div>'+
        '</div><div class="split" style="margin-top:9px"><button type="button" onclick="setCateringDeposit50('+id+')">Set deposit to 50%</button><button type="button" '+(balance<0.30?'disabled':'')+' onclick="copyCateringBalanceLink('+id+')">Copy balance payment link</button></div>'+
        '<p class="muted" style="margin:8px 0 0">Policy: 50% secures the booking. Final balance is due 3 working days before the event.</p>';
      if(!box){
        box=document.createElement('div');
        box.className='notice cateringPaymentPolicyBox';
        box.style.margin='10px 0';
        var totals=card.querySelector('.cateringTotals');
        if(totals && totals.parentNode) totals.parentNode.insertBefore(box,totals.nextSibling);
        else card.appendChild(box);
      }
      if(box.innerHTML!==html) box.innerHTML=html;
    });
  }

  function customerBalanceStatus(){
    var q=new URLSearchParams(location.search);
    if(q.get('balance')==='success' && !window.__cateringBalanceSuccessShown){
      window.__cateringBalanceSuccessShown=true;
      setTimeout(function(){alert('✅ Catering balance received. Your booking is fully paid.');},250);
    }
    if(q.get('balance')==='cancelled' && !window.__cateringBalanceCancelledShown){
      window.__cateringBalanceCancelledShown=true;
      setTimeout(function(){alert('Balance payment was cancelled. The outstanding balance is still due.');},250);
    }
  }

  function apply(){
    updateDepositNotice50();
    replaceOldDepositSettings();
    enhanceNewBooking();
    enhanceBookingCards();
    customerBalanceStatus();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){apply();setTimeout(apply,250);setTimeout(apply,900);});
  else {apply();setTimeout(apply,250);setTimeout(apply,900);}

  document.addEventListener('input',function(e){
    if(e.target && (e.target.id==='ceGuests' || e.target.id==='cePackageId')) setTimeout(updateDepositNotice50,0);
  });

  var observer=new MutationObserver(function(){setTimeout(apply,0);});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
