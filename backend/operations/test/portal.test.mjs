import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const localApp=new URL('../public/app.mjs',import.meta.url);
const source=fs.readFileSync(fs.existsSync(localApp)?localApp:new URL('../../../public/ops/app.mjs',import.meta.url),'utf8');
async function portal(data){
 const nodes=new Map();
 const node=key=>{if(!nodes.has(key))nodes.set(key,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,classList:{toggle(){}},addEventListener(){}});return nodes.get(key)};
 const buttons=['business','traffic','inventory','account'].map(module=>({...node('button-'+module),dataset:{module}}));
 const context={window:{OPS_CONFIG:{url:'https://test.invalid',anonKey:'public',siteUrl:'https://test.invalid/ops/'}},document:{querySelector:node,querySelectorAll:()=>buttons},localStorage:{getItem:()=>JSON.stringify({access_token:'unit-test-only',expires_at:4e9}),setItem(){},removeItem(){}},location:{hash:'',pathname:'/ops/',search:''},history:{replaceState(){}},URLSearchParams,Intl,Map,Set,Date,Number,String,Error,JSON,console,fetch:async url=>{const u=new URL(url);const table=u.pathname.split('/').at(-1);const offset=Number(u.searchParams.get('offset')??0);return {ok:true,status:200,json:async()=>offset?[]:data[table]??[]}}};
 await vm.runInNewContext(source,context);
 return {nodes,node,buttons};
}
test('portal renders unknown amounts as a dash and escapes source shop HTML',async()=>{
 const p=await portal({ops_shops:[{shop_key:'s',shop_name:'<script>unsafe</script>',platform:'douyin'}],ops_business:[{id:'1',shop_key:'s',platform:'douyin',start_date:'2026-10-01',end_date:'2026-10-20',gross_cents:null,refund_payment_cents:null,net_cents:null,captured_at:'2026-10-21T00:00:00Z'}]});
 p.node('#start').value='2026-10-01';p.node('#end').value='2026-10-21';p.node('#refresh').onclick();await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(p.node('#table').innerHTML.includes('&lt;script&gt;unsafe'));
 assert.ok(!p.node('#summary').innerHTML.includes('¥0.00'));
 assert.ok(!p.node('#cards').innerHTML.includes('<script>unsafe'));
});
test('traffic platform filter excludes other platforms and preserves original ID text',async()=>{
 const p=await portal({ops_shops:[],ops_business:[],ops_traffic_rows:[{id:'c1',kind:'campaigns',payload:{id:'d',platform:'千川',name:'抖音投流'}},{id:'c2',kind:'campaigns',payload:{id:'k',platform:'快手',name:'快手投流'}},{id:'r1',kind:'records',payload:{id:'a',campaignId:'d',date:'2026-10-20',advertiserId:'18700000000000000001',spend:10,revenue:null}},{id:'r2',kind:'records',payload:{id:'b',campaignId:'k',date:'2026-10-20',advertiserId:'ks-original',spend:20,revenue:null}}]});
 p.node('#start').value='2026-10-01';p.node('#end').value='2026-10-21';p.node('#platform').value='kuaishou';p.buttons.find(b=>b.dataset.module==='traffic').onclick();await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(p.node('#table').innerHTML.includes('ks-original'));
 assert.ok(!p.node('#table').innerHTML.includes('18700000000000000001'));
 p.node('#platform').value='douyin';await p.node('#refresh').onclick();
 assert.ok(p.node('#table').innerHTML.includes('18700000000000000001'));
});
test('business period extension does not double-count overlapping monthly captures',async()=>{
 const base={shop_key:'s',platform:'douyin',start_date:'2026-10-01',refund_payment_cents:0,net_cents:1000};
 const p=await portal({ops_shops:[{shop_key:'s',shop_name:'测试店',platform:'douyin'}],ops_business:[{...base,id:'old',end_date:'2026-10-19',gross_cents:1000,captured_at:'2026-10-20T00:00:00Z'},{...base,id:'new',end_date:'2026-10-20',gross_cents:2000,captured_at:'2026-10-21T00:00:00Z'}]});
 p.node('#start').value='2026-10-01';p.node('#end').value='2026-10-21';await p.node('#refresh').onclick();
 assert.equal(p.node('#row-count').textContent,'1 条');
 assert.ok(p.node('#table').innerHTML.includes('2026-10-20'));
 assert.ok(!p.node('#table').innerHTML.includes('2026-10-19'));
});
