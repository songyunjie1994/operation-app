import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const localApp=new URL('../public/app.mjs',import.meta.url);
const appFile=fs.existsSync(localApp)?localApp:new URL('../../../public/ops/app.mjs',import.meta.url);
const source=fs.readFileSync(appFile,'utf8');
const inventorySource=fs.readFileSync(new URL('inventory-name-map.js',appFile),'utf8')+'\n'+fs.readFileSync(new URL('inventory.js',appFile),'utf8');
async function portal(data,options={}){
 const nodes=new Map();
 const node=key=>{if(!nodes.has(key))nodes.set(key,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,classList:{toggle(){}},addEventListener(event,fn){this['on'+event]=fn}});return nodes.get(key)};
 const buttons=['business','traffic','inventory','account'].map(module=>({...node('button-'+module),dataset:{module}}));
 const views=['account','creator','daily','detail'].map(view=>({...node('view-'+view),dataset:{view}}));
 const ranges=['month','previous','latest','all'].map(range=>({...node('range-'+range),dataset:{range}}));
 const calls=[],writes=[];
 const initial=options.signedOut?null:{access_token:'unit-test-only',expires_at:4e9,user:options.user};
 const context={window:{OPS_CONFIG:{url:'https://test.invalid',anonKey:'public',siteUrl:'https://test.invalid/ops/'}},document:{querySelector:node,querySelectorAll:selector=>selector==='[data-view]'?views:selector==='[data-range]'?ranges:buttons},localStorage:{getItem:()=>JSON.stringify(initial),setItem(k,v){writes.push(v)},removeItem(){}},location:{hash:'',pathname:'/ops/',search:''},history:{replaceState(){}},URLSearchParams,Intl,Map,Set,Date,Number,String,Error,JSON,console,fetch:async(url,init)=>{const u=new URL(url);calls.push({url,body:init?.body?JSON.parse(init.body):null});if(u.pathname==='/auth/v1/token')return {ok:!options.badPassword,status:options.badPassword?400:200,json:async()=>({access_token:'unit-login-session',refresh_token:'unit-refresh-only',expires_in:3600,user:{}})};const table=u.pathname.split('/').at(-1);const offset=Number(u.searchParams.get('offset')??0);return {ok:true,status:200,json:async()=>offset?[]:data[table]??[]}}};
 await vm.runInNewContext(inventorySource+'\n'+source,context);
 return {nodes,node,buttons,views,ranges,calls,writes};
}
test('portal renders unknown amounts as a dash and escapes source shop HTML',async()=>{
 const p=await portal({ops_shops:[{shop_key:'s',shop_name:'<script>unsafe</script>',platform:'douyin'}],ops_business:[{id:'1',shop_key:'s',platform:'douyin',start_date:'2026-10-01',end_date:'2026-10-20',gross_cents:null,refund_payment_cents:null,net_cents:null,captured_at:'2026-10-21T00:00:00Z'}]});
 p.node('#start').value='2026-10-01';p.node('#end').value='2026-10-21';p.node('#refresh').onclick();await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(p.node('#table').innerHTML.includes('&lt;script&gt;unsafe'));
 assert.ok(!p.node('#summary').innerHTML.includes('¥0.00'));
 assert.ok(!p.node('#cards').innerHTML.includes('<script>unsafe'));
});
test('traffic platform filter excludes other platforms and preserves original ID text',async()=>{
 const p=await portal({ops_shops:[],ops_business:[],ops_traffic_current_rows:[{id:'c1',kind:'campaigns',payload:{id:'d',platform:'千川',name:'抖音投流'}},{id:'c2',kind:'campaigns',payload:{id:'k',platform:'快手',name:'快手投流'}},{id:'r1',kind:'records',payload:{id:'a',campaignId:'d',date:'2026-10-20',advertiserId:'18700000000000000001',spend:10,revenue:null}},{id:'r2',kind:'records',payload:{id:'b',campaignId:'k',date:'2026-10-20',advertiserId:'ks-original',spend:20,revenue:null}}]});
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
test('password login maps admin alias, clears password and persists only the session',async()=>{
 const p=await portal({},{signedOut:true});p.node('#email').value='admin';p.node('#password').value='unit-password-not-a-real-secret';
 await p.node('#login-form').onsubmit({preventDefault(){}});
 const request=p.calls.find(c=>c.url.includes('grant_type=password'));
 assert.equal(request.body.email,'ops-temp-admin@anbito.invalid');
 assert.equal(p.node('#password').value,'');
 assert.ok(p.writes.every(v=>!v.includes('unit-password-not-a-real-secret')));
 assert.equal(p.node('#workspace').hidden,false);
});
test('invalid password keeps login visible without triggering an email',async()=>{
 const p=await portal({},{signedOut:true,badPassword:true});p.node('#login').hidden=false;p.node('#email').value='admin';p.node('#password').value='unit-wrong-password';
 await p.node('#login-form').onsubmit({preventDefault(){}});
 assert.equal(p.node('#login').hidden,false);assert.match(p.node('#login-message').textContent,/账号或密码不正确/);assert.ok(p.calls.every(c=>!c.url.includes('/otp')));assert.equal(p.writes.length,0);
});
test('expired temporary session is cleared before private business queries',async()=>{
 const p=await portal({},{user:{app_metadata:{access_expires_at:'2000-01-01T00:00:00Z'}}});
 assert.equal(p.node('#workspace').hidden,true);assert.equal(p.node('#login').hidden,false);assert.match(p.node('#login-message').textContent,/已到期/);assert.equal(p.calls.length,0);
});

test('consumption groups use weighted ROI and financial spend stays separate',async()=>{
 const p=await portal({ops_traffic_current_rows:[
  {kind:'campaigns',payload:{id:'c',name:'账户',platform:'千川',broker:'服务商甲'}},
  {kind:'records',payload:{campaignId:'c',date:'2026-10-19',spend:100,revenue:200,netRevenue:100,douyinNumber:'001'}},
  {kind:'records',payload:{campaignId:'c',date:'2026-10-19',spend:300,revenue:300,netRevenue:200,douyinNumber:'002'}},
  {kind:'financeRecords',payload:{campaignId:'c',date:'2026-10-19',balanceTotalSpend:999}}
 ]});
 p.node('#start').value='2026-10-01';p.node('#end').value='2026-10-21';await p.buttons.find(b=>b.dataset.module==='traffic').onclick();await new Promise(r=>setTimeout(r,0));
 assert.match(p.node('#summary').innerHTML,/400\.00/);assert.match(p.node('#summary').innerHTML,/1\.25/);assert.match(p.node('#summary').innerHTML,/0\.75/);
 assert.ok(!p.node('#summary').innerHTML.includes('999'));assert.match(p.node('#analytics').innerHTML,/999\.00/);
 assert.equal(p.node('#row-count').textContent,'1 条');
 p.views.find(b=>b.dataset.view==='creator').onclick();assert.equal(p.node('#row-count').textContent,'2 条');
 p.views.find(b=>b.dataset.view==='daily').onclick();assert.equal(p.node('#row-count').textContent,'1 条');
 p.views.find(b=>b.dataset.view==='detail').onclick();assert.equal(p.node('#row-count').textContent,'2 条');
});

test('unknown revenue does not create a false ROI and filters apply to all consumption views',async()=>{
 const p=await portal({ops_traffic_current_rows:[
  {kind:'campaigns',payload:{id:'a',name:'甲账户',platform:'千川',broker:'甲'}},
  {kind:'campaigns',payload:{id:'b',name:'乙账户',platform:'千川',broker:'乙'}},
  {kind:'records',payload:{campaignId:'a',date:'2026-10-19',spend:10,revenue:null,netRevenue:null,douyinNumber:'keep-id'}},
  {kind:'records',payload:{campaignId:'b',date:'2026-10-19',spend:20,revenue:100,netRevenue:50,douyinNumber:'excluded-id'}}
 ]});
 p.node('#start').value='2026-10-01';p.node('#end').value='2026-10-21';await p.buttons.find(b=>b.dataset.module==='traffic').onclick();await new Promise(r=>setTimeout(r,0));
 p.node('#traffic-broker').value='甲';p.node('#traffic-broker').onchange();
 assert.match(p.node('#summary').innerHTML,/10\.00/);assert.match(p.node('#summary').innerHTML,/成交投产 ROI<\/span><strong>—/);
 assert.ok(!p.node('#analytics').innerHTML.includes('乙账户'));assert.ok(!p.node('#table').innerHTML.includes('乙账户'));
 p.views.find(b=>b.dataset.view==='detail').onclick();assert.match(p.node('#table').innerHTML,/keep-id/);assert.ok(!p.node('#table').innerHTML.includes('excluded-id'));
});

test('business coverage reports unknown amounts and latest-month shortcut finds saved data',async()=>{
 const p=await portal({ops_shops:[{shop_key:'s',shop_name:'有记录',platform:'douyin'},{shop_key:'m',shop_name:'缺记录',platform:'douyin'}],ops_business:[{shop_key:'s',platform:'douyin',start_date:'2026-09-01',end_date:'2026-09-30',gross_cents:null,refund_payment_cents:0,net_cents:null,captured_at:'2026-10-01T00:00:00Z'}]});
 await p.node('#refresh').onclick();p.ranges.find(b=>b.dataset.range==='latest').onclick();
 assert.equal(p.node('#start').value,'2026-09-01');assert.equal(p.node('#end').value,'2026-09-30');
 assert.match(p.node('#coverage').innerHTML,/1 \/ 2/);assert.match(p.node('#coverage').innerHTML,/1 个期间金额不全/);assert.match(p.node('#coverage').innerHTML,/缺记录/);
 assert.ok(!p.node('#summary').innerHTML.includes('¥0.00</strong><small>人民币'));
});

test('inventory portal uses the existing product map and keeps store breakdowns searchable',async()=>{
 const p=await portal({ops_shops:[{shop_key:'s',shop_name:'甲店',platform:'douyin'}],ops_inventory:[{shop_key:'s',captured_at:'2026-10-21T00:00:00Z',summary:{total:2,status:'success'},items:[{name:'原始胶囊',code:'BEERGO30',available:10,allocated:2,defective:1},{name:'原始片剂',code:'MBWNEW',available:20,allocated:0,defective:0}]}]});
 p.node('#start').value='2026-10-30';p.node('#end').value='2026-10-01';
 await p.buttons.find(b=>b.dataset.module==='inventory').onclick();await new Promise(r=>setTimeout(r,0));
 assert.equal(p.node('#table-title').textContent,'品名库存总览');
 assert.equal(p.node('#row-count').textContent,'2 个品名');
 assert.match(p.node('#table').innerHTML,/麦角/);
 assert.match(p.node('#inventory-stores').innerHTML,/甲店/);
 assert.equal(p.node('#inventory-stores').hidden,false);
 p.node('#search').value='麦角';p.node('#search').oninput();
 assert.equal(p.node('#row-count').textContent,'1 个品名');
 assert.ok(!p.node('#table').innerHTML.includes('美白'));
 assert.match(p.node('#summary').innerHTML,/10/);
});

test('pagination preserves total counts while limiting rendered consumption rows',async()=>{
 const p=await portal({ops_traffic_current_rows:[{kind:'campaigns',payload:{id:'c',name:'分页账户',platform:'千川'}},...Array.from({length:40},(_,i)=>({kind:'records',payload:{id:'r'+i,campaignId:'c',date:'2026-10-19',spend:i+1,revenue:1,netRevenue:1}}))]});
 p.node('#start').value='2026-10-01';p.node('#end').value='2026-10-21';await p.buttons.find(b=>b.dataset.module==='traffic').onclick();await new Promise(r=>setTimeout(r,0));p.views.find(b=>b.dataset.view==='detail').onclick();
 assert.equal(p.node('#row-count').textContent,'40 条');
 assert.equal((p.node('#table').innerHTML.match(/<tr>/g)||[]).length,16);
 assert.match(p.node('#table').innerHTML,/第 1–15 条 \/ 共 40 条/);
 p.node('#table').querySelector=()=>null;
 p.node('#table').onclick({target:{closest:()=>({dataset:{page:'2'}})}});
 assert.match(p.node('#table').innerHTML,/第 31–40 条 \/ 共 40 条/);
 p.node('#search').value='不存在';p.node('#search').oninput();assert.equal(p.node('#row-count').textContent,'0 条');
 p.node('#search').value='';p.node('#search').oninput();assert.match(p.node('#table').innerHTML,/第 1–15 条/);
});
