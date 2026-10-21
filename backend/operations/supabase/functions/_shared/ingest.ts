import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import {hash,buildAccount,business,shop,timestamp} from './migration.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const sha=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const check=(r:any)=>{if(r.error)throw new Error('database_request_failed');return r.data};
async function upload(payload:any,batch:string){
 const payloadHash=hash(payload);
 return check(await db.rpc('ops_import_bundle',{p_batch:batch,p_hash:payloadHash,p_payload:payload}));
}
const emptyPayload=(sources:any[],shops:any[]=[])=>({sources,shops,accounts:[],inventories:[],business:[],traffic_baseline:[],traffic_rows:[]});
const source=(value:any,label:string)=>({source_hash:hash(value),label,bytes:new TextEncoder().encode(JSON.stringify(value)).length,file_modified_at:new Date().toISOString(),freshness:'device_collected'});
export async function serve(req:Request,kind:'account'|'business'){
 const origin=req.headers.get('origin')||'';
 const allowed=!origin||origin==='https://songyunjie1994.github.io'||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(origin&&allowed)Object.assign(headers,{'Access-Control-Allow-Origin':origin,Vary:'Origin','Access-Control-Allow-Headers':'content-type,authorization,apikey,x-acct-token','Access-Control-Allow-Methods':'POST,OPTIONS'});
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(!allowed)return reply({error:'origin_not_allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
  const raw=await req.text();if(raw.length>2*1024*1024)return reply({error:'payload_too_large'},413);
  const body=JSON.parse(raw),token=req.headers.get('x-acct-token')||'';
  let device:any=null;
  if(token.length>=32){device=check(await db.from('ops_devices').select('id,config').eq('id',String(body.deviceId||'')).eq('token_hash',await sha(token)).maybeSingle())}
  if(!device)return reply({error:'unauthorized'},401);
  if(kind==='account'){
   if(body.action==='device_heartbeat'){
    check(await db.rpc('ops_device_heartbeat',{p_device:device.id,p_status:body.status||{}}));
    return reply({ok:true,config:device.config,commands:[]});
   }
   if(body.action==='device_ack')return reply({ok:true});
   if(body.action==='device_receipt'){
    const run=check(await db.from('ops_collector_runs').select('data_hash').eq('device_id',device.id).eq('run_id',String(body.runId||'')).maybeSingle());
    const snapshot=check(await db.from('ops_collector_snapshots').select('data_hash,updated_at').eq('device_id',device.id).maybeSingle());
    return reply({ok:true,run,snapshot});
   }
   if(body.action!=='device_publish'||typeof body.runId!=='string'||!/^[a-zA-Z0-9:_-]{1,160}$/.test(body.runId)||!['success','partial','failed','skipped'].includes(body.status))return reply({error:'invalid_publish'},400);
   let dataHash=null;
   if(body.data){
    dataHash=await sha(JSON.stringify(body.data));
    const src=source(body.data,'device-account:'+device.id),normalized=buildAccount(body.data,src.source_hash);
    const payload={...emptyPayload([src],normalized.shops),accounts:normalized.accounts,inventories:normalized.inventories,business:normalized.business};
    // Stable source timestamps keep duplicate delivery metadata from changing batch content.
    src.file_modified_at=timestamp(body.data.updatedAt);
    await upload(payload,'device-account:'+device.id+':'+body.runId);
   }
   const summary={...(body.summary||{}),...(body.data?{_capturedAt:Date.parse(timestamp(body.data.updatedAt))}:{})};
   const result=check(await db.rpc('ops_receive_account_run',{p_device:device.id,p_run:body.runId,p_status:body.status,p_summary:summary,p_hash:dataHash}));
   return reply(result);
  }
  const platform=body.platform||'douyin';if(!['douyin','kuaishou'].includes(platform))return reply({error:'invalid_platform'},400);
  if(body.action==='public_business'){
   const shops=check(await db.from('ops_shops').select('shop_key,shop_name').eq('platform',platform));
   const byKey=new Map(shops.map((s:any)=>[s.shop_key,s.shop_name]));
   const rows=check(await db.from('ops_business').select('*').eq('platform',platform).order('captured_at',{ascending:false}).limit(5000));
   const seen=new Set();const records=rows.filter((r:any)=>{const k=[r.shop_key,r.start_date,r.end_date].join('|');if(seen.has(k))return false;seen.add(k);return true}).map((r:any)=>({platform,shopName:byKey.get(r.shop_key),startDate:r.start_date,endDate:r.end_date,requestedEndDate:r.requested_end_date,grossCents:r.gross_cents,refundPaymentCents:r.refund_payment_cents,netCents:r.net_cents,capturedAt:r.captured_at,uploadedAt:null}));
   return reply({ok:true,platform,shops:shops.map((s:any)=>s.shop_name),records});
  }
  if(body.action!=='device_business_publish'||!Array.isArray(body.records)||body.records.length<1||body.records.length>100)return reply({error:'invalid_records'},400);
  if(platform==='kuaishou'&&body.records.some((r:any)=>r.platform!=='kuaishou'))return reply({error:'platform_mismatch'},400);
  const src=source(body.records,'device-business:'+platform+':'+device.id);
  src.file_modified_at=new Date(Math.max(...body.records.map((r:any)=>Date.parse(timestamp(r.capturedAt))))).toISOString();
  const shops=[...new Map(body.records.map((r:any)=>{const s=shop(platform,r.shopName);return [s.shop_key,s]})).values()];
  const payload={...emptyPayload([src],shops),business:body.records.map((r:any)=>business(r,platform,src.source_hash))};
  const unique=new Set(payload.business.map((r:any)=>[r.shop_key,r.start_date,r.end_date].join('|')));if(unique.size!==body.records.length)return reply({error:'duplicate_period'},400);
  await upload(payload,'device-business:'+device.id+':'+src.source_hash);
  return reply({ok:true,count:body.records.length});
 }catch(error){
  const validation=/Invalid|Missing|Ambiguous|Source net|Inventory|Incomplete|Cargo|Requested|Unexpected/.test(String(error?.message));
  return reply({error:validation?'invalid_source_record':'request_failed'},validation?400:500);
 }
}
