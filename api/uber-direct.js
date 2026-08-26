/* Fusion Flavours - secure Uber Direct server bridge */
const SUPA_URL = 'https://uhautgiebtkvrxfsqabq.supabase.co';
const SUPA_KEY = 'sb_publishable_XPAXC44lyPin89u8l_LdKw_3nLMlI9J';
const OWNER_EMAIL = 'fusionflavourkitchen@gmail.com';

let tokenCache = { value: null, expiresAt: 0 };

function send(res,status,body){
  res.status(status);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.send(JSON.stringify(body));
}

function bodyOf(req){
  if(req.body && typeof req.body==='object') return req.body;
  if(typeof req.body==='string'){ try{return JSON.parse(req.body)}catch{} }
  return {};
}

async function verifyOwner(req){
  const auth=String(req.headers.authorization||'');
  if(!auth.startsWith('Bearer ')) throw Object.assign(new Error('Owner sign-in required.'),{status:401});
  const jwt=auth.slice(7).trim();
  if(!jwt) throw Object.assign(new Error('Owner sign-in required.'),{status:401});
  const r=await fetch(SUPA_URL+'/auth/v1/user',{headers:{apikey:SUPA_KEY,Authorization:'Bearer '+jwt}});
  if(!r.ok) throw Object.assign(new Error('Owner session is not valid.'),{status:401});
  const user=await r.json();
  if(String(user.email||'').toLowerCase()!==OWNER_EMAIL) throw Object.assign(new Error('Owner access only.'),{status:403});
  return user;
}

function uberConfig(){
  return {
    clientId:process.env.UBER_DIRECT_CLIENT_ID||'',
    clientSecret:process.env.UBER_DIRECT_CLIENT_SECRET||'',
    customerId:process.env.UBER_DIRECT_CUSTOMER_ID||'',
    mode:(process.env.UBER_DIRECT_MODE||'sandbox').toLowerCase()
  };
}

async function accessToken(){
  const c=uberConfig();
  if(!c.clientId||!c.clientSecret||!c.customerId) throw Object.assign(new Error('Uber Direct credentials are not configured yet.'),{status:503});
  if(tokenCache.value && Date.now()<tokenCache.expiresAt-300000) return tokenCache.value;
  const form=new URLSearchParams();
  form.set('client_id',c.clientId);
  form.set('client_secret',c.clientSecret);
  form.set('grant_type','client_credentials');
  form.set('scope','eats.deliveries');
  const r=await fetch('https://auth.uber.com/oauth/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.access_token) throw Object.assign(new Error(d.error_description||d.error||'Uber authentication failed.'),{status:r.status||502});
  tokenCache={value:d.access_token,expiresAt:Date.now()+Math.max(300,Number(d.expires_in||2592000))*1000};
  return tokenCache.value;
}

function addressJson(a={}){
  const out={
    street_address:[String(a.address_line1||'').trim()],
    city:String(a.city||'').trim(),
    zip_code:String(a.postcode||'').trim().toUpperCase(),
    country:String(a.country||'GB').trim().toUpperCase()
  };
  if(a.address_line2) out.street_address.push(String(a.address_line2).trim());
  if(a.state) out.state=String(a.state).trim();
  return JSON.stringify(out);
}

function phone(v){
  let s=String(v||'').replace(/[^\d+]/g,'');
  if(s.startsWith('00'))s='+'+s.slice(2);
  if(s.startsWith('0'))s='+44'+s.slice(1);
  if(s&&!s.startsWith('+'))s='+'+s;
  return s;
}

async function uberRequest(path,payload){
  const token=await accessToken();
  const r=await fetch('https://api.uber.com'+path,{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify(payload)
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok){
    const msg=d.message||d.error||d.code||`Uber Direct returned ${r.status}`;
    const err=new Error(typeof msg==='string'?msg:JSON.stringify(msg));
    err.status=r.status||502;err.uber=d;throw err;
  }
  return d;
}

module.exports = async function handler(req,res){
  if(req.method!=='POST') return send(res,405,{ok:false,message:'POST required.'});
  try{
    await verifyOwner(req);
    const b=bodyOf(req),action=String(b.action||'status');
    const c=uberConfig();

    if(action==='status'){
      return send(res,200,{
        ok:true,
        configured:!!(c.clientId&&c.clientSecret&&c.customerId),
        mode:c.mode,
        customer_id_present:!!c.customerId,
        client_id_present:!!c.clientId
      });
    }

    if(!(c.clientId&&c.clientSecret&&c.customerId)) throw Object.assign(new Error('Uber Direct is prepared in the app, but the API credentials have not been added yet.'),{status:503});

    if(action==='quote'){
      const pickup=b.pickup||{},dropoff=b.dropoff||{};
      if(!pickup.address_line1||!pickup.postcode||!dropoff.address_line1||!dropoff.postcode) throw Object.assign(new Error('Pickup and drop-off address/postcode are required.'),{status:400});
      const payload={pickup_address:addressJson(pickup),dropoff_address:addressJson(dropoff)};
      if(Number.isFinite(Number(pickup.latitude))&&Number.isFinite(Number(pickup.longitude))){payload.pickup_latitude=Number(pickup.latitude);payload.pickup_longitude=Number(pickup.longitude)}
      if(Number.isFinite(Number(dropoff.latitude))&&Number.isFinite(Number(dropoff.longitude))){payload.dropoff_latitude=Number(dropoff.latitude);payload.dropoff_longitude=Number(dropoff.longitude)}
      const quote=await uberRequest(`/v1/customers/${encodeURIComponent(c.customerId)}/delivery_quotes`,payload);
      return send(res,200,{ok:true,mode:c.mode,quote});
    }

    if(action==='create'){
      const pickup=b.pickup||{},dropoff=b.dropoff||{};
      if(!b.quote_id) throw Object.assign(new Error('A valid Uber quote is required before requesting a courier.'),{status:400});
      if(!pickup.address_line1||!pickup.postcode||!dropoff.address_line1||!dropoff.postcode) throw Object.assign(new Error('Pickup and drop-off address/postcode are required.'),{status:400});
      const manifest=Array.isArray(b.manifest_items)&&b.manifest_items.length?b.manifest_items:[{name:'Fusion Flavours food order',quantity:1}];
      const payload={
        quote_id:String(b.quote_id),
        pickup_address:addressJson(pickup),
        pickup_name:String(pickup.name||'Fusion Flavours'),
        pickup_phone_number:phone(pickup.phone),
        pickup_notes:String(pickup.notes||''),
        dropoff_address:addressJson(dropoff),
        dropoff_name:String(dropoff.name||'Customer'),
        dropoff_phone_number:phone(dropoff.phone),
        dropoff_notes:String(dropoff.notes||''),
        manifest_items:manifest.map(x=>({name:String(x.name||'Food order').slice(0,120),quantity:Math.max(1,Math.round(Number(x.quantity||1)))})),
        external_id:String(b.external_id||'').slice(0,120)
      };
      if(Number.isFinite(Number(pickup.latitude))&&Number.isFinite(Number(pickup.longitude))){payload.pickup_latitude=Number(pickup.latitude);payload.pickup_longitude=Number(pickup.longitude)}
      if(Number.isFinite(Number(dropoff.latitude))&&Number.isFinite(Number(dropoff.longitude))){payload.dropoff_latitude=Number(dropoff.latitude);payload.dropoff_longitude=Number(dropoff.longitude)}
      const delivery=await uberRequest(`/v1/customers/${encodeURIComponent(c.customerId)}/deliveries`,payload);
      return send(res,200,{ok:true,mode:c.mode,delivery});
    }

    return send(res,400,{ok:false,message:'Unknown Uber Direct action.'});
  }catch(e){
    const status=Number(e.status||500);
    console.error('Uber Direct bridge:',e.message,e.uber||'');
    return send(res,status,{ok:false,message:e.message||'Uber Direct request failed.'});
  }
};
