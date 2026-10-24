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
 p.views.find(b=>b.dataset.view==='detail').onclick();
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

test('business gross, refund and calculated net include both platforms and follow platform filters',async()=>{
 const base={start_date:'2026-10-01',end_date:'2026-10-20',captured_at:'2026-10-21T00:00:00Z'};
 const p=await portal({ops_shops:[{shop_key:'d',shop_name:'抖店甲',platform:'douyin'},{shop_key:'k',shop_name:'快手乙',platform:'kuaishou'}],ops_business:[{...base,shop_key:'d',platform:'douyin',gross_cents:269719190,refund_payment_cents:96458899,net_cents:173260291},{...base,shop_key:'k',platform:'kuaishou',gross_cents:433757800,refund_payment_cents:297118293,net_cents:null}]});
 p.node('#start').value='2026-10-01';p.node('#end').value='2026-10-21';await p.node('#refresh').onclick();
 assert.match(p.node('#summary').innerHTML,/7,034,769\.90/);assert.match(p.node('#summary').innerHTML,/3,935,771\.92/);assert.match(p.node('#summary').innerHTML,/3,098,997\.98/);
 assert.match(p.node('#table').innerHTML,/1,366,395\.07/);assert.match(p.node('#cards').innerHTML,/1,366,395\.07/);assert.ok(!p.node('#summary').innerHTML.includes('净成交（抖店）'));
 for(const [platform,expected] of [['douyin','1,732,602.91'],['kuaishou','1,366,395.07']]){p.node('#platform').value=platform;p.node('#platform').onchange();assert.ok(p.node('#summary').innerHTML.includes(expected));assert.equal(p.node('#row-count').textContent,'1 条');}
 p.node('#platform').value='';p.node('#search').value='乙';p.node('#search').oninput();assert.match(p.node('#summary').innerHTML,/1,366,395\.07/);assert.equal(p.node('#row-count').textContent,'1 条');
});

test('business missing values do not create net, while zero and negative net remain visible',async()=>{
 const base={start_date:'2026-10-01',end_date:'2026-10-20',captured_at:'2026-10-21T00:00:00Z',platform:'kuaishou'};
 const metrics=[{shop_key:'missing',gross_cents:null,refund_payment_cents:500,net_cents:999},{shop_key:'zero',gross_cents:0,refund_payment_cents:0,net_cents:null},{shop_key:'negative',gross_cents:1000,refund_payment_cents:2000,net_cents:null}];
 const p=await portal({ops_shops:metrics.map(r=>({shop_key:r.shop_key,shop_name:r.shop_key,platform:'kuaishou'})),ops_business:metrics.map(r=>({...base,...r}))});
 p.node('#start').value='2026-10-01';p.node('#end').value='2026-10-21';await p.node('#refresh').onclick();
 assert.match(p.node('#summary').innerHTML,/-¥10\.00/);assert.match(p.node('#summary').innerHTML,/已知 2 \/ 3 个期间/);assert.match(p.node('#coverage').innerHTML,/当前为已知金额小计/);assert.match(p.node('#table').innerHTML,/>¥0\.00</);assert.ok(!p.node('#summary').innerHTML.includes('9.99'));
 p.node('#search').value='missing';p.node('#search').oninput();assert.match(p.node('#summary').innerHTML,/净成交金额<\/span><strong>—/);
 p.node('#search').value='zero';p.node('#search').oninput();assert.match(p.node('#summary').innerHTML,/净成交金额<\/span><strong>¥0\.00/);
 p.node('#end').value='2026-10-10';p.node('#end').onchange();assert.equal(p.node('#row-count').textContent,'0 条');assert.match(p.node('#summary').innerHTML,/净成交金额<\/span><strong>—/);
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
 assert.equal(p.node('#summary').hidden,true);assert.equal(p.node('#analytics').hidden,true);
 assert.ok(!p.node('#table').innerHTML.includes('999'));assert.equal(p.node('#row-count').textContent,'2 条');
 p.views.find(b=>b.dataset.view==='account').onclick();
 assert.ok(!p.node('#summary').innerHTML.includes('999'));assert.match(p.node('#analytics').innerHTML,/999\.00/);
 assert.equal(p.node('#row-count').textContent,'1 条');
 p.views.find(b=>b.dataset.view==='creator').onclick();assert.equal(p.node('#row-count').textContent,'2 条');
 p.views.find(b=>b.dataset.view==='daily').onclick();assert.equal(p.node('#row-count').textContent,'1 条');
 p.views.find(b=>b.dataset.view==='detail').onclick();assert.equal(p.node('#row-count').textContent,'2 条');
});

test('creator consumption separates dates and accounts and sums only the same daily identity',async()=>{
 const p=await portal({ops_traffic_current_rows:[
  {kind:'campaigns',payload:{id:'a',name:'甲账户',platform:'千川'}},
  {kind:'campaigns',payload:{id:'b',name:'乙账户',platform:'千川'}},
  ...[
   ['a','2026-10-19','001',100,200],['a','2026-10-20','001',10,20],
   ['a','2026-10-20','001',30,90],['b','2026-10-20','001',5,null],
   ['a','2026-10-20','002',null,null]
  ].map(([campaignId,date,douyinNumber,spend,revenue])=>({kind:'records',payload:{campaignId,date,douyinNumber,douyinName:'号'+douyinNumber,spend,revenue,netRevenue:revenue}}))
 ]});
 p.node('#start').value='2026-10-01';p.node('#end').value='2026-10-21';await p.buttons.find(b=>b.dataset.module==='traffic').onclick();await new Promise(r=>setTimeout(r,0));
 p.views.find(b=>b.dataset.view==='creator').onclick();
 assert.equal(p.node('#row-count').textContent,'4 条');
 const table=p.node('#table').innerHTML,rows=table.match(/<tr>.*?<\/tr>/g).slice(1);
 assert.match(rows[0],/2026-10-20.*001.*甲账户.*¥40\.00.*2\.75.*2 条/);
 assert.match(rows[1],/2026-10-20.*001.*乙账户.*¥5\.00/);
 assert.match(rows[2],/2026-10-20.*002.*data-label="广告消耗">—/);
 assert.match(rows[3],/2026-10-19.*001.*甲账户.*¥100\.00/);
 assert.match(table,/data-label="日期"/);assert.match(table,/data-label="抖音号"/);
 p.node('#start').value='2026-10-20';p.node('#start').onchange();assert.equal(p.node('#row-count').textContent,'3 条');
 p.node('#traffic-account').value='a';p.node('#traffic-account').onchange();assert.equal(p.node('#row-count').textContent,'2 条');
 p.node('#search').value='001';p.node('#search').oninput();assert.equal(p.node('#row-count').textContent,'1 条');assert.match(p.node('#table').innerHTML,/¥40\.00/);
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
