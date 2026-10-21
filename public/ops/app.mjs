const C=window.OPS_CONFIG;
const $=s=>document.querySelector(s);
const labels={traffic:'投流管理',business:'经营数据',inventory:'库存数据',account:'账户资金'};
const requestedModule=new URLSearchParams(location.search).get('module');
let session=null,module=Object.hasOwn(labels,requestedModule)?requestedModule:'business',cache={},loadGeneration=0;
const esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(n,currency='CNY')=>typeof n==='number'&&Number.isFinite(n)?new Intl.NumberFormat('zh-CN',{style:'currency',currency,maximumFractionDigits:2}).format(n):'—';
const stamp=t=>t?new Date(t).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'—';
const badge=p=>`<span class="badge ${p==='kuaishou'?'kuaishou':''}">${p==='kuaishou'?'快手':'抖店'}</span>`;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
$('#start').value=today.slice(0,7)+'-01';$('#end').value=today;
const readSession=()=>{try{return JSON.parse(localStorage.getItem('anbito-ops-session'))}catch{return null}};
const saveSession=s=>{session=s;if(s)localStorage.setItem('anbito-ops-session',JSON.stringify(s));else localStorage.removeItem('anbito-ops-session')};
async function auth(route,body){const r=await fetch(C.url+'/auth/v1/'+route,{method:'POST',headers:{apikey:C.anonKey,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error(route.startsWith('token?grant_type=password')?'账号或密码不正确，请重新输入':'登录请求未成功，请检查邮箱或稍后重试');return r.json()}
async function ensureSession(){if(!session?.access_token)throw Error('请先登录');const until=session.user?.app_metadata?.access_expires_at;if(until&&Date.parse(until)<=Date.now()){saveSession(null);cache={};$('#workspace').hidden=true;$('#login').hidden=false;$('#login-message').textContent='临时账号已到期，请联系管理员';throw Error('临时账号已到期，请联系管理员')};if(session.expires_at&&session.expires_at<Date.now()/1000+60){if(!session.refresh_token)throw Error('登录已过期，请重新登录');const s=await auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token});saveSession({...s,expires_at:Date.now()/1000+s.expires_in})}}
async function rows(table,select='*'){
 await ensureSession();const result=[];
 for(let offset=0;offset<10000;offset+=200){const r=await fetch(C.url+'/rest/v1/'+table+'?select='+encodeURIComponent(select)+'&order='+ (table==='ops_shops'?'shop_key':'id')+'&limit=200&offset='+offset,{headers:{apikey:C.anonKey,Authorization:'Bearer '+session.access_token},cache:'no-store'});if(r.status===401)throw Error('登录已过期，请重新登录');if(!r.ok)throw Error('数据暂时不可读取，请稍后刷新');const page=await r.json();result.push(...page);if(page.length<200)return result}throw Error('数据量超过当前查询上限，请联系管理员');
}
const latest=(items,key)=>[...items.reduce((m,r)=>{const k=key(r),old=m.get(k);if(!old||r.captured_at>old.captured_at)m.set(k,r);return m},new Map()).values()];
const latestPeriods=items=>[...items.reduce((m,r)=>{const key=[r.platform,r.shop_key,r.start_date].join('|'),old=m.get(key);if(!old||r.end_date>old.end_date||(r.end_date===old.end_date&&r.captured_at>old.captured_at))m.set(key,r);return m},new Map()).values()];
const sum=(items,get)=>{const values=items.map(get).filter(x=>typeof x==='number'&&Number.isFinite(x));return values.length?values.reduce((a,b)=>a+b,0):null};
function stats(items){$('#summary').innerHTML=items.map(([label,value,note])=>`<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note??'已迁入的可验证数据')}</small></div>`).join('')}
const PAGE_SIZE=15;let page=0;
const pageSize=()=>window.innerWidth<=700?8:PAGE_SIZE;
const numericHeader=/金额|消费|成交|退款|可提现|待结算|可用|锁定/;
const optionalHeader=/采集时间|平台账户ID|抖音号|货品编码|仓库|锁定|待结算/;
function table(headers,items){
 $('#row-count').textContent=items.length+' 条';
 if(!items.length){$('#table').innerHTML='<div class="empty">当前筛选下没有可读取的数据。未完成首次邮箱验证或尚未加入成员时，也不会显示业务数据。</div>';return}
 const pages=Math.ceil(items.length/pageSize());page=Math.min(Math.max(page,0),pages-1);
 const size=pageSize(),from=page*size,visible=items.slice(from,from+size),meta=headers.map(h=>({num:numericHeader.test(h),opt:optionalHeader.test(h)})),cls=i=>{const c=[meta[i].num?'num':'',meta[i].opt?'opt':''].filter(Boolean).join(' ');return c?' class="'+c+'"':''};
 let numbers='';
 if(pages>1){const span=5,first=Math.max(0,Math.min(page-2,pages-span)),last=Math.min(pages,first+span);
  if(first>0)numbers+='<button data-page="0" aria-label="第 1 页">1</button>'+(first>1?'<span class="ellipsis">…</span>':'');
  for(let i=first;i<last;i++)numbers+=`<button data-page="${i}"${i===page?' class="active" aria-current="page"':''}>${i+1}</button>`;
  if(last<pages)numbers+=(last<pages-1?'<span class="ellipsis">…</span>':'')+`<button data-page="${pages-1}" aria-label="第 ${pages} 页">${pages}</button>`}
 const pager=pages>1?`<div class="pager"><span class="range">第 ${from+1}–${from+visible.length} 条 / 共 ${items.length} 条</span><button data-page="${page-1}"${page===0?' disabled':''}>上一页</button><span class="pages">${numbers}</span><button data-page="${page+1}"${page===pages-1?' disabled':''}>下一页</button></div>`:'';
 $('#table').innerHTML=`<div class="table-wrap"><table><thead><tr>${headers.map((h,i)=>`<th${cls(i)}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${visible.map(row=>'<tr>'+row.map((cell,i)=>`<td${cls(i)} data-label="${esc(headers[i])}"${i===1?` title="${esc(cell)}"`:''}>${esc(cell)}</td>`).join('')+'</tr>').join('')}</tbody></table></div>`+pager;
}
function render(){
 const start=$('#start').value,end=$('#end').value,search=$('#search').value.trim().toLowerCase(),platform=$('#platform').value;
 const shops=new Map((cache.shops??[]).map(s=>[s.shop_key,s]));
 const allowed=r=>{const s=shops.get(r.shop_key);return s&&(!platform||s.platform===platform)&&(!search||s.shop_name.toLowerCase().includes(search))};
 const name=r=>shops.get(r.shop_key)?.shop_name??'未映射店铺';
 const range=d=>d&&(!start||d>=start)&&(!end||d<=end);
 $('#cards').innerHTML='';$('#module-title').textContent=labels[module];
 if(module==='business'){
  const data=latestPeriods((cache.business??[]).filter(r=>allowed(r)&&(!start||r.start_date>=start)&&(!end||r.end_date<=end)));
  stats([['已采店铺',new Set(data.map(r=>r.shop_key)).size+' 家'],['成交金额',money(sum(data,r=>r.gross_cents)/100),'人民币；仅含已采期间'],['退款金额',money(sum(data,r=>r.refund_payment_cents)/100),'按支付时间/支付日口径'],['期间记录',data.length+' 条','抖店经营仍有已知缺口']].map((r,i)=>{if(i===1&&sum(data,r=>r.gross_cents)===null)r[1]='—';if(i===2&&sum(data,r=>r.refund_payment_cents)===null)r[1]='—';return r}));
  $('#table-title').textContent='各店铺经营汇总';table(['平台','店铺','期间','成交金额','退款金额','净成交（抖店）','采集时间'],data.map(r=>[r.platform==='kuaishou'?'快手':'抖店',name(r),r.start_date+' 至 '+r.end_date,r.gross_cents===null?'—':money(r.gross_cents/100),r.refund_payment_cents===null?'—':money(r.refund_payment_cents/100),r.net_cents===null?'—':money(r.net_cents/100),stamp(r.captured_at)]));
  $('#cards').innerHTML=data.map(r=>`<article class="shop-card"><h3>${badge(r.platform)}${esc(name(r))}</h3><dl><div><dt>成交金额</dt><dd>${esc(r.gross_cents===null?'—':money(r.gross_cents/100))}</dd></div><div><dt>${r.platform==='kuaishou'?'退款金额（支付日）':'退款金额（支付时间）'}</dt><dd>${esc(r.refund_payment_cents===null?'—':money(r.refund_payment_cents/100))}</dd></div></dl><footer>${esc(r.start_date)} — ${esc(r.end_date)}<br>请求截至：${esc(r.requested_end_date??r.end_date)}<br>采集：${esc(stamp(r.captured_at))}</footer></article>`).join('');
 }else if(module==='account'){
  const data=latest(cache.accounts??[],r=>r.shop_key).filter(allowed);const total=(currency,key)=>sum(data,r=>r.funds?.goods?.[currency]?.[key]);
  stats([['账户店铺',data.length+' 家'],['人民币可提现',money(total('rmb','withdrawable')),'人民币独立统计'],['美元可提现',money(total('usd','withdrawable'),'USD'),'美元独立统计'],['未知来源字段',data.reduce((n,r)=>n+['usd','rmb'].filter(c=>!r.funds.goods[c]).length,0)+' 项','缺失不作为0参与统计']]);
  $('#table-title').textContent='账户资金快照';table(['平台','店铺','人民币可提现','美元可提现','待结算（元）','采集时间'],data.map(r=>[shops.get(r.shop_key).platform==='kuaishou'?'快手':'抖店',name(r),money(r.funds?.goods?.rmb?.withdrawable),money(r.funds?.goods?.usd?.withdrawable,'USD'),money(r.funds?.pending?.toSettle),stamp(r.captured_at)]));
 }else if(module==='inventory'){
  const inventories=latest(cache.inventory??[],r=>r.shop_key).filter(r=>!platform||shops.get(r.shop_key)?.platform===platform);
  const data=inventories.flatMap(r=>r.items.map(item=>({...item,shop_key:r.shop_key,captured_at:r.captured_at}))).filter(r=>!search||[name(r),r.name,r.code,r.warehouse].some(v=>String(v??'').toLowerCase().includes(search)));
  stats([['库存店铺',new Set(data.map(r=>r.shop_key)).size+' 家'],['库存明细',data.length+' 条'],['可用库存',sum(data,r=>r.available)??'—','按来源库存单位'],['不完整快照',inventories.filter(r=>r.summary.truncated).length+' 家']]);
  $('#table-title').textContent='商品与仓库明细';table(['店铺','商品','货品编码','仓库','可用','锁定','采集时间'],data.map(r=>[name(r),r.name,r.code,r.warehouse,r.available??'—',r.allocated??'—',stamp(r.captured_at)]));
 }else{
  const rows=(cache.traffic??[]).map(r=>({...r.payload,kind:r.kind}));const campaigns=new Map(rows.filter(r=>r.kind==='campaigns').map(r=>[r.id,r]));
  const allowedTraffic=r=>{const p=campaigns.get(r.campaignId)?.platform;return !platform||(platform==='kuaishou'?p==='快手':['千川','巨量引擎','抖音'].includes(p))};
  const data=rows.filter(r=>r.kind==='records'&&range(r.date)&&allowedTraffic(r)&&(!search||[r.douyinName,r.advertiserId,campaigns.get(r.campaignId)?.name].some(v=>String(v??'').toLowerCase().includes(search))));
  const finances=rows.filter(r=>r.kind==='financeRecords'&&range(r.date)&&allowedTraffic(r));
  const spend=sum(data,r=>r.spend);
  stats([['投流账户',campaigns.size+' 个','来自10月20日保存的快照'],['范围内消费',money(spend),'按消费记录原口径'],['消费记录',data.length+' 条'],['财务日结',finances.length+' 条','财务与当日消费分别统计']]);
  $('#table-title').textContent='投流消费记录 · 历史快照';table(['日期','账户','平台账户ID','抖音号','消费（元）','成交（元）'],data.map(r=>[r.date,campaigns.get(r.campaignId)?.name??r.advertiserId,r.advertiserId,r.douyinNumber,money(r.spend),money(r.revenue)]));
 }
}
async function load(force=false){
 const generation=++loadGeneration;$('#status').textContent='正在读取新运营项目…';$('#refresh').disabled=true;
 try{
  if(!cache.shops||force)cache.shops=await rows('ops_shops');
  const [key,tableName,select]=({business:['business','ops_business','*'],account:['accounts','ops_accounts','*'],inventory:['inventory','ops_inventory','*'],traffic:['traffic','ops_traffic_rows','id,kind,payload']})[module];
  if(!cache[key]||force)cache[key]=await rows(tableName,select);
  if(generation!==loadGeneration)return;render();$('#status').textContent='已从新运营项目读取 · '+stamp(new Date().toISOString());
 }catch(error){if(generation===loadGeneration)$('#status').textContent=error.message}finally{if(generation===loadGeneration)$('#refresh').disabled=false}
}
async function enter(){if(!session)return;$('#login').hidden=true;$('#workspace').hidden=false;await load()}
$('#login-form').onsubmit=async e=>{e.preventDefault();$('#login-button').disabled=true;try{const username=$('#email').value.trim(),email=username.toLowerCase()==='admin'?'ops-temp-admin@anbito.invalid':username;const result=await auth('token?grant_type=password',{email,password:$('#password').value});$('#password').value='';saveSession({...result,expires_at:Date.now()/1000+result.expires_in});$('#login-message').textContent='';await enter()}catch(error){$('#login-message').textContent=error.message}finally{$('#login-button').disabled=false}};
$('#send-link').onclick=async()=>{const email=$('#email').value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('#login-message').textContent='邮箱链接登录需要填写管理员邮箱；临时账号请填写密码后点登录';return}$('#send-link').disabled=true;try{await auth('otp?redirect_to='+encodeURIComponent(C.siteUrl),{email,create_user:true});$('#login-message').textContent='登录链接已发送，请打开邮箱中的链接完成验证。'}catch(error){$('#login-message').textContent=error.message}finally{$('#send-link').disabled=false}};
$('#logout').onclick=()=>{saveSession(null);cache={};$('#workspace').hidden=true;$('#login').hidden=false};
$('#refresh').onclick=()=>{page=0;load(true)};
$('#table').addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(!button||button.disabled)return;const next=Number(button.dataset.page);if(!Number.isInteger(next))return;page=next;render();const wrap=$('#table').querySelector('.table-wrap');if(wrap)wrap.scrollTo({top:0,left:0})});
for(const id of ['start','end','search','platform'])$('#'+id).addEventListener(id==='search'?'input':'change',()=>{page=0;render()});
for(const button of document.querySelectorAll('[data-module]')){button.classList.toggle('active',button.dataset.module===module);button.onclick=()=>{module=button.dataset.module;page=0;history.replaceState(null,'',location.pathname+'?module='+module);document.querySelectorAll('[data-module]').forEach(b=>b.classList.toggle('active',b===button));load()}};
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('access_token')){saveSession({access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token'),expires_at:Date.now()/1000+Number(fragment.get('expires_in')??3600)});history.replaceState(null,'',location.pathname+location.search)}else session=readSession();
if(fragment.get('error_description'))$('#login-message').textContent='登录链接已失效，请重新发送。';
enter();
