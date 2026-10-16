import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const allow=!origin||origin==='https://songyunjie1994.github.io'||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(origin&&allow)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'content-type,x-acct-token','Access-Control-Allow-Methods':'POST,OPTIONS'});
 const reply=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers});
 if(!allow)return reply({error:'origin_not_allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
  const raw=await req.text();if(raw.length>100000)return reply({error:'payload_too_large'},413);
  const body=JSON.parse(raw);
  if(body.action==='public_business'){
   const {data:snaps,error:se}=await db.from('acct_snapshots').select('device_id,data').order('updated_at',{ascending:false}).limit(5);if(se)throw se;
   const shops=[...new Set((snaps||[]).flatMap((s:any)=>Object.keys(s.data?.stores||{})))].sort();
   const {data,error}=await db.from('acct_business_ranges').select('shop_name,start_date,end_date,gross_cents,refund_payment_cents,captured_at,updated_at').in('device_id',(snaps||[]).map((s:any)=>s.device_id)).order('captured_at',{ascending:false}).limit(5000);if(error)throw error;
   const seen=new Set<string>();const records=(data||[]).filter((r:any)=>{const key=[r.shop_name,r.start_date,r.end_date].join('|');if(seen.has(key))return false;seen.add(key);return shops.includes(r.shop_name)}).map((r:any)=>({shopName:r.shop_name,startDate:r.start_date,endDate:r.end_date,grossCents:r.gross_cents,refundPaymentCents:r.refund_payment_cents,netCents:r.refund_payment_cents===null||r.gross_cents===null?null:r.gross_cents-r.refund_payment_cents,capturedAt:r.captured_at,uploadedAt:r.updated_at}));
   return reply({ok:true,shops,records});
  }
  if(body.action!=='device_business_publish')return reply({error:'unknown_action'},400);
  const token=req.headers.get('x-acct-token')||'';if(token.length<32)return reply({error:'unauthorized'},401);
  const {data:device,error:de}=await db.from('acct_devices').select('id').eq('id',String(body.deviceId||'')).eq('token_hash',await hash(token)).maybeSingle();if(de||!device)return reply({error:'unauthorized'},401);
  const {data:snapshot,error:se}=await db.from('acct_snapshots').select('data').eq('device_id',device.id).single();if(se)throw se;
  const names=new Set(Object.keys(snapshot.data?.stores||{}));
  if(!Array.isArray(body.records)||body.records.length<1||body.records.length>100)return reply({error:'invalid_records'},400);
  const rows=[];const keys=new Set();
  for(const r of body.records){
   const a=Date.parse(r.startDate+'T00:00:00Z'),b=Date.parse(r.endDate+'T00:00:00Z'),stamp=Date.parse(r.capturedAt);
   const money=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=1000000000000;
   const key=[r.shopName,r.startDate,r.endDate].join('|');
   if(keys.has(key)||!names.has(r.shopName)||!/^\d{4}-\d{2}-\d{2}$/.test(r.startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(r.endDate)||!Number.isFinite(a)||!Number.isFinite(b)||b<a||b-a>=31*86400000||(r.grossCents!==null&&!money(r.grossCents))||(r.refundPaymentCents!==null&&!money(r.refundPaymentCents))||!Number.isFinite(stamp)||stamp>Date.now()+300000||!/^[a-f0-9]{64}$/.test(r.sourceHash))return reply({error:'invalid_record'},400);
   keys.add(key);rows.push({device_id:device.id,shop_name:r.shopName,start_date:r.startDate,end_date:r.endDate,gross_cents:r.grossCents,refund_payment_cents:r.refundPaymentCents,captured_at:r.capturedAt,source_hash:r.sourceHash,updated_at:new Date().toISOString()});
  }
  const {error}=await db.from('acct_business_ranges').upsert(rows,{onConflict:'device_id,shop_name,start_date,end_date'});if(error)throw error;
  return reply({ok:true,count:rows.length});
 }catch(e){console.error(e);return reply({error:'request_failed'},500)}
});
