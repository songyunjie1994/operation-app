const C=window.OPS_CONFIG;
const $=s=>document.querySelector(s);
const labels={traffic:'投流消耗',business:'经营数据',inventory:'库存数据',account:'账户资金'};
const requestedModule=new URLSearchParams(location.search).get('module');
let session=null,module=Object.hasOwn(labels,requestedModule)?requestedModule:'business',cache={},loadGeneration=0,trafficView='account';
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
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const moneyCents=n=>finite(n)?money(n/100):'—';
const addMoney=(items,get)=>{const values=items.map(get).filter(finite);return values.length?values.reduce((s,v)=>s+Math.round(v*100),0)/100:null};
const ratio=(items,key)=>items.length&&items.every(r=>finite(r.spend)&&finite(r[key]))&&addMoney(items,r=>r.spend)>0?(addMoney(items,r=>r[key])/addMoney(items,r=>r.spend)).toFixed(2):'—';
function renderCoverage(data,shops,allowed,start,end){
 const expected=[...shops.values()].filter(s=>allowed({shop_key:s.shop_key}));
 const missing=expected.filter(s=>!data.some(r=>r.shop_key===s.shop_key));
 const unknown=data.filter(r=>!finite(r.gross_cents)||!finite(r.refund_payment_cents));
 const adjusted=data.filter(r=>r.requested_end_date&&r.requested_end_date>r.end_date);
 const partial=data.filter(r=>r.start_date<=(start||r.start_date)&&r.end_date<(end||r.end_date));
 const last=data.map(r=>r.captured_at).sort().at(-1);
 $('#coverage').hidden=false;
 $('#coverage').innerHTML=`<div><strong>经营数据覆盖</strong><span class="coverage-pill">${new Set(data.map(r=>r.shop_key)).size} / ${expected.length} 家有记录</span></div><p>所选范围内 ${data.length} 个已采期间 · ${unknown.length} 个期间金额不全 · ${adjusted.length} 个期间未达到请求截止日${partial.length?' · '+partial.length+' 个期间早于筛选截止日':''}${last?' · 最近采集 '+esc(stamp(last)):''}</p>${missing.length?`<details><summary>查看 ${missing.length} 家暂无期间记录的店铺</summary><p>${missing.map(s=>esc(s.shop_name)).join('、')}</p></details>`:''}`;
}
function trafficRecords(platform,search){
 const raw=(cache.traffic??[]).map(r=>({...r.payload,kind:r.kind}));
 const campaigns=new Map(raw.filter(r=>r.kind==='campaigns').map(r=>[r.id,r]));
 const selected=$('#traffic-account').value,broker=$('#traffic-broker').value;
 const matchesPlatform=c=>!platform||(platform==='kuaishou'?c?.platform==='快手':['千川','巨量引擎','抖音','抖店'].includes(c?.platform));
 const data=raw.filter(r=>r.kind==='records').map(r=>({...r,campaign:campaigns.get(r.campaignId)})).filter(r=>matchesPlatform(r.campaign)&&(!selected||r.campaignId===selected)&&(!broker||r.campaign?.broker===broker)&&(!search||[r.douyinName,r.douyinNumber,r.advertiserId,r.campaign?.name,r.campaign?.broker].some(v=>String(v??'').toLowerCase().includes(search))));
 return {raw,campaigns,data,matchesPlatform};
}
function renderTraffic(start,end,search,platform){
 const raw=(cache.traffic??[]).map(r=>({...r.payload,kind:r.kind}));
 const allCampaigns=raw.filter(r=>r.kind==='campaigns');
 const selected=$('#traffic-account').value,selectedBroker=$('#traffic-broker').value;
 $('#traffic-account').innerHTML='<option value="">全部账户</option>'+allCampaigns.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
 $('#traffic-broker').innerHTML='<option value="">全部中介</option>'+[...new Set(allCampaigns.map(c=>c.broker).filter(Boolean))].sort().map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('');
 $('#traffic-account').value=selected;$('#traffic-broker').value=selectedBroker;
 const {campaigns,data:filtered,matchesPlatform}=trafficRecords(platform,search);
 const data=filtered.filter(r=>(!start||r.date>=start)&&(!end||r.date<=end));
 const allDates=raw.filter(r=>r.kind==='records'&&r.date).map(r=>r.date).sort();
 const spend=addMoney(data,r=>r.spend),missing=data.filter(r=>!finite(r.spend)).length;
 const accountCount=new Set(data.map(r=>r.campaignId||r.advertiserId)).size;
 stats([['广告总消耗',money(spend),`${data.length} 条明细${missing?'；'+missing+' 条消耗缺失':'；按广告报表口径'}`],['成交投产 ROI',ratio(data,'revenue'),'合计成交金额 ÷ 同范围消耗；金额缺失时不计算'],['净成交投产',ratio(data,'netRevenue'),'合计净成交金额 ÷ 同范围消耗'],['消耗账户',accountCount+' 个',new Set(data.map(r=>r.date)).size+' 个有记录日期；不推定缺失日期为零']]);
 const grouped=by=>[...data.reduce((m,r)=>{const k=by(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);return m},new Map()).entries()];
 const daily=grouped(r=>r.date).sort((a,b)=>a[0].localeCompare(b[0]));
 const rank=grouped(r=>r.campaignId||r.advertiserId||'unknown').sort((a,b)=>(addMoney(b[1],r=>r.spend)??-Infinity)-(addMoney(a[1],r=>r.spend)??-Infinity));
 const dayMax=Math.max(1,...daily.map(([,rs])=>addMoney(rs,r=>r.spend)??0));
 const top=rank.slice(0,6),topMax=Math.max(1,...top.map(([,rs])=>addMoney(rs,r=>r.spend)??0));
 const finance=raw.filter(r=>r.kind==='financeRecords'&&(!start||r.date>=start)&&(!end||r.date<=end)&&matchesPlatform(campaigns.get(r.campaignId))&&(!selected||r.campaignId===selected)&&(!selectedBroker||campaigns.get(r.campaignId)?.broker===selectedBroker)&&(!search||[r.advertiserName,r.advertiserId,campaigns.get(r.campaignId)?.name,campaigns.get(r.campaignId)?.broker].some(v=>String(v??'').toLowerCase().includes(search))));
 const graph=daily.length?`<div class="bar-chart" role="img" aria-label="各有记录日期的广告消耗，缺失日期不补零">${daily.map(([date,rs])=>{const v=addMoney(rs,r=>r.spend);return `<div class="chart-day" title="${esc(date+' · '+money(v))}"><span class="bar-value">${esc(v===null?'—':new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:1}).format(v))}</span><div class="bar-track"><i style="height:${v===null?0:Math.max(v>0?2:0,v/dayMax*100)}%"></i></div><span class="bar-date">${esc(date.slice(5))}</span></div>`}).join('')}</div>`:'<div class="empty">当前范围暂无消耗记录，可选择「最近有数据月份」。</div>';
 $('#analytics').innerHTML=`<div class="source-strip"><span class="source-tag">历史快照</span><span>消耗记录覆盖 ${esc(allDates[0]??'—')} 至 ${esc(allDates.at(-1)??'—')} · 尚未接入实时回传</span></div><div class="analysis-grid"><article class="panel trend-panel"><div class="panel-title"><h2>每日消耗趋势</h2><span class="muted">人民币 · 已采日期${daily.length>12?' · 横向滚动查看更多':''}</span></div>${graph}</article><article class="panel ranking-panel"><div class="panel-title"><h2>账户消耗排行</h2><span class="muted">TOP 6</span></div><div class="rank-list">${top.map(([id,rs],i)=>{const v=addMoney(rs,r=>r.spend);return `<div class="rank-row"><span class="rank-number">${i+1}</span><div><div class="rank-label"><span>${esc(campaigns.get(id)?.name??rs[0].advertiserId??'未映射账户')}</span><strong>${esc(money(v))}</strong></div><div class="rank-track"><i style="width:${Math.max(0,(v??0)/topMax*100)}%"></i></div></div></div>`}).join('')||'<div class="empty">当前范围暂无记录</div>'}</div></article></div><div class="finance-note">财务日结参考：${finance.length} 条，余额总消耗 ${esc(money(addMoney(finance,r=>r.balanceTotalSpend)))}。广告消耗与财务日结分别展示，不相加。</div>`;
 const groupRow=(label,rs)=>{const total=addMoney(rs,r=>r.spend),share=spend>0&&total!==null?(total/spend*100).toFixed(1)+'%':'—';return [label,money(total),share,money(addMoney(rs,r=>r.revenue)),ratio(rs,'revenue'),money(addMoney(rs,r=>r.netRevenue)),ratio(rs,'netRevenue'),rs.length+' 条'+(rs.some(r=>!finite(r.spend)||!finite(r.revenue)||!finite(r.netRevenue))?' · 金额不全':'')]};
 const headers=['账户','广告消耗','消耗占比','成交金额','成交投产','净成交金额','净成交投产','明细'];
 let body;
 if(trafficView==='detail'){
  $('#table-title').textContent='广告消耗明细';
  table(['日期','账户','中介','平台账户ID','抖音号名称','抖音号','广告消耗','成交金额','成交投产','净成交金额','净成交投产'],[...data].sort((a,b)=>b.date.localeCompare(a.date)||(b.spend??0)-(a.spend??0)).map(r=>[r.date,r.campaign?.name??r.advertiserId,r.campaign?.broker,r.advertiserId,r.douyinName,r.douyinNumber,money(r.spend),money(r.revenue),ratio([r],'revenue'),money(r.netRevenue),ratio([r],'netRevenue')]));return;
 }else if(trafficView==='creator'){
  headers[0]='抖音号（按账户区分）';body=grouped(r=>[r.campaignId||r.advertiserId,r.douyinNumber||r.douyinName||'未提供抖音号'].join('|')).sort((a,b)=>(addMoney(b[1],r=>r.spend)??-Infinity)-(addMoney(a[1],r=>r.spend)??-Infinity)).map(([,rs])=>groupRow((rs[0].douyinName||rs[0].douyinNumber||'未提供抖音号')+' / '+(rs[0].douyinNumber||'—')+' · '+(rs[0].campaign?.name||rs[0].advertiserId||'—'),rs));
 }else if(trafficView==='daily'){headers[0]='日期';body=[...daily].reverse().map(([d,rs])=>groupRow(d,rs))}
 else body=rank.map(([id,rs])=>groupRow((campaigns.get(id)?.name??rs[0].advertiserId??'未映射账户')+' · '+(rs[0].advertiserId??id),rs));
 $('#table-title').textContent=({account:'账户消耗汇总',creator:'抖音号消耗汇总',daily:'每日消耗汇总'})[trafficView];table(headers,body);
}
function stats(items){$('#summary').innerHTML=items.map(([label,value,note])=>`<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note??'已迁入的可验证数据')}</small></div>`).join('')}
const PAGE_SIZE=15;let page=0;
const pageSize=()=>window.innerWidth<=700?8:PAGE_SIZE;
const numericHeader=/金额|消费|消耗|投产|占比|成交|退款|可提现|待结算|可用|锁定/;
const optionalHeader=/采集时间|平台账户ID|抖音号|货品编码|仓库|锁定|待结算/;
function table(headers,items){
 $('#row-count').textContent=items.length+' 条';
 if(!items.length){$('#table').innerHTML='<div class="empty">当前范围暂无记录，请调整日期或筛选条件。</div>';return}
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
 $('#module-description').textContent=({business:'看清每一家店的成交、退款与净成交。',traffic:'围绕消耗看账户、抖音号与每日投放表现。',inventory:'按店铺、商品和仓库查看可用库存。',account:'各店铺资金一览，人民币与美元独立统计。'})[module];
 for(const id of ['traffic-filters','traffic-views','analytics'])$('#'+id).hidden=module!=='traffic';
 $('#coverage').hidden=true;
 $('#start').disabled=$('#end').disabled=['account','inventory'].includes(module);
 if(start&&end&&start>end){stats([]);table([],[]);$('#status').textContent='开始日期不能晚于结束日期';$('#analytics').hidden=true;return}

 if(module==='business'){
  const data=latestPeriods((cache.business??[]).filter(r=>allowed(r)&&(!start||r.start_date>=start)&&(!end||r.end_date<=end)));
  stats([['已采店铺',new Set(data.map(r=>r.shop_key)).size+' 家'],['成交金额',money(sum(data,r=>r.gross_cents)/100),'人民币；仅含已采期间'],['退款金额',money(sum(data,r=>r.refund_payment_cents)/100),'按支付时间/支付日口径'],['净成交（抖店）',moneyCents(sum(data.filter(r=>r.platform==='douyin'),r=>r.net_cents)),'成交金额减支付时间退款；仅已知金额']].map((r,i)=>{if(i===1&&sum(data,r=>r.gross_cents)===null)r[1]='—';if(i===2&&sum(data,r=>r.refund_payment_cents)===null)r[1]='—';return r}));
  renderCoverage(data,shops,allowed,start,end);$('#table-title').textContent='各店铺经营汇总';table(['平台','店铺','期间','成交金额','退款金额','净成交（抖店）','采集时间'],data.map(r=>[r.platform==='kuaishou'?'快手':'抖店',name(r),r.start_date+' 至 '+r.end_date,r.gross_cents===null?'—':money(r.gross_cents/100),r.refund_payment_cents===null?'—':money(r.refund_payment_cents/100),r.net_cents===null?'—':money(r.net_cents/100),stamp(r.captured_at)]));
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
  renderTraffic(start,end,search,platform);
 }
}
async function load(force=false){
 const generation=++loadGeneration;$('#status').textContent='正在读取新运营项目…';$('#refresh').disabled=true;
 try{
  if(!cache.shops||force)cache.shops=await rows('ops_shops');
  const [key,tableName,select]=({business:['business','ops_business','*'],account:['accounts','ops_accounts','*'],inventory:['inventory','ops_inventory','*'],traffic:['traffic','ops_traffic_current_rows','id,kind,payload']})[module];
  if(!cache[key]||force)cache[key]=await rows(tableName,select);
  if(generation!==loadGeneration)return;render();$('#status').textContent='已从新运营项目读取 · '+stamp(new Date().toISOString())+' · 来源采集时间见各记录';
 }catch(error){if(generation===loadGeneration)$('#status').textContent=error.message}finally{if(generation===loadGeneration)$('#refresh').disabled=false}
}
async function enter(){if(!session)return;$('#login').hidden=true;$('#workspace').hidden=false;await load()}
$('#login-form').onsubmit=async e=>{e.preventDefault();$('#login-button').disabled=true;try{const username=$('#email').value.trim(),email=username.toLowerCase()==='admin'?'ops-temp-admin@anbito.invalid':username;const result=await auth('token?grant_type=password',{email,password:$('#password').value});$('#password').value='';saveSession({...result,expires_at:Date.now()/1000+result.expires_in});$('#login-message').textContent='';await enter()}catch(error){$('#login-message').textContent=error.message}finally{$('#login-button').disabled=false}};
$('#send-link').onclick=async()=>{const email=$('#email').value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('#login-message').textContent='邮箱链接登录需要填写管理员邮箱；临时账号请填写密码后点登录';return}$('#send-link').disabled=true;try{await auth('otp?redirect_to='+encodeURIComponent(C.siteUrl),{email,create_user:true});$('#login-message').textContent='登录链接已发送，请打开邮箱中的链接完成验证。'}catch(error){$('#login-message').textContent=error.message}finally{$('#send-link').disabled=false}};
$('#logout').onclick=()=>{saveSession(null);cache={};$('#workspace').hidden=true;$('#login').hidden=false};
$('#refresh').onclick=()=>{page=0;return load(true)};
$('#table').addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(!button||button.disabled)return;const next=Number(button.dataset.page);if(!Number.isInteger(next))return;page=next;render();const wrap=$('#table').querySelector('.table-wrap');if(wrap)wrap.scrollTo({top:0,left:0})});
for(const id of ['start','end','search','platform'])$('#'+id).addEventListener(id==='search'?'input':'change',()=>{page=0;render()});
for(const id of ['traffic-account','traffic-broker'])$('#'+id).addEventListener('change',()=>{page=0;render()});
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{page=0;trafficView=button.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===button));render()};
for(const button of document.querySelectorAll('[data-range]'))button.onclick=()=>{
 page=0;const choice=button.dataset.range;
 if(choice==='all'){$('#start').value='';$('#end').value=''}
 else{let anchor=today;
  if(choice==='latest'){
   const dates=module==='traffic'?trafficRecords($('#platform').value,$('#search').value.trim().toLowerCase()).data.map(r=>r.date):(cache.business??[]).filter(r=>!$('#platform').value||r.platform===$('#platform').value).map(r=>r.end_date);
   if(dates.length)anchor=dates.sort().at(-1);
  }
  const d=new Date(anchor+'T12:00:00Z');if(choice==='previous')d.setUTCMonth(d.getUTCMonth()-1,1);
  const month=d.toISOString().slice(0,7);$('#start').value=month+'-01';$('#end').value=choice==='month'?today:choice==='latest'?anchor:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10);
 }
 render();
};
for(const button of document.querySelectorAll('[data-module]')){button.classList.toggle('active',button.dataset.module===module);button.onclick=()=>{module=button.dataset.module;page=0;history.replaceState(null,'',location.pathname+'?module='+module);document.querySelectorAll('[data-module]').forEach(b=>b.classList.toggle('active',b===button));load()}};
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('access_token')){saveSession({access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token'),expires_at:Date.now()/1000+Number(fragment.get('expires_in')??3600)});history.replaceState(null,'',location.pathname+location.search)}else session=readSession();
if(fragment.get('error_description'))$('#login-message').textContent='登录链接已失效，请重新发送。';
enter();
