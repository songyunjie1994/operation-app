/* 罗盘交易：只读取成交和支付时间退款，净成交统一用两项相减。金额以分计算。 */
(() => {
 'use strict';
 const API='https://mabxdkjqilulkrmqrrgo.supabase.co/functions/v1/business-center';
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}),thisMonth=today.slice(0,7);
 const lastDay=new Date(thisMonth+'-01T00:00:00Z');lastDay.setUTCDate(0);
 const lastEnd=lastDay.toISOString().slice(0,10),lastStart=lastEnd.slice(0,7)+'-01';
 const yesterday=new Date(today+'T00:00:00Z');yesterday.setUTCDate(yesterday.getUTCDate()-1);
 const monthEnd=yesterday.toISOString().slice(0,10).startsWith(thisMonth)?yesterday.toISOString().slice(0,10):thisMonth+'-01';
 const periods=[[lastStart,monthEnd,'上月＋本月'],[lastStart,lastEnd,'上月'],[thisMonth+'-01',monthEnd,'本月']];
 let data=null,period=2,query='',loading=null;
 function updatePeriods(){
  const ends=data.records.filter(r=>r.startDate===thisMonth+'-01').map(r=>r.endDate).filter(d=>d<today).sort();
  if(ends.length)periods[0][1]=periods[2][1]=ends.at(-1);
  for(const p of periods)p[2]=`${p[2].split('（')[0]}（${p[0].slice(5).replace('-','月')}日—${p[1].slice(5).replace('-','月')}日）`;
 }
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 const money=n=>n==null?'—':'¥'+(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const time=s=>s?new Date(s).toLocaleString('zh-CN',{hour12:false}):'—';
 const valid=n=>Number.isSafeInteger(n);
 function report(shop){
  const [start,end]=periods[period];
  const needed=period===0?[[start,lastEnd],[thisMonth+'-01',end]]:[[start,end]];
  const rows=needed.map(([a,b])=>data.records.find(r=>r.shopName===shop&&r.startDate===a&&r.endDate===b));
  const complete=rows.every(r=>r&&valid(r.grossCents)&&valid(r.refundPaymentCents));
  const sum=key=>rows.every(r=>r&&valid(r[key]))?rows.reduce((n,r)=>n+r[key],0):null;
  const gross=sum('grossCents'),refund=sum('refundPaymentCents');
  return {shop,complete,received:rows.every(Boolean),gross,refund,net:gross!==null&&refund!==null?gross-refund:null,rows,stamp:rows.filter(Boolean).map(r=>r.capturedAt).sort().at(-1)};
 }
 function metrics(values,cls='board-metrics'){
  const grid=el('div',cls);
  for(const [label,value] of values){const card=el('div','metric-card');card.append(el('p','metric-caption',label),el('strong','metric-value',money(value)));grid.append(card)}return grid;
 }
 function draw(){
  const root=document.getElementById('businessTradeApp');if(!root)return;
  root.replaceChildren();
  const head=el('div','data-heading'),copy=el('div'),refresh=el('button','board-button','刷新数据');refresh.type='button';refresh.onclick=()=>load(true);
  copy.append(el('p','section-kicker','抖店 · 电商罗盘'),el('h2',null,'店铺经营'),el('p','data-caption','净成交金额 = 成交金额 − 成交退款金额（支付时间）'));
  head.append(copy,refresh);root.append(head);
  if(!data){root.append(el('div','board-empty','正在读取经营数据…'));return}
  const tools=el('div','board-toolbar'),select=el('select','board-select'),search=el('input','board-search');
  select.setAttribute('aria-label','经营统计期间');periods.forEach((p,i)=>{const o=el('option',null,p[2]);o.value=i;select.append(o)});select.value=period;
  search.type='search';search.placeholder='搜索店铺名称';search.setAttribute('aria-label','搜索经营店铺');search.value=query;
  tools.append(select,search);root.append(tools);
  const content=el('div');root.append(content);
  const render=()=>{
   content.replaceChildren();const all=data.shops.map(report),filtered=all.filter(r=>r.shop.toLowerCase().includes(query.toLowerCase())),complete=filtered.filter(r=>r.complete);
   const received=filtered.filter(r=>r.received).length;
   const coverage=el('p','data-caption',`当前筛选 ${filtered.length} 家 · 已采集 ${received} 家${received<filtered.length?` · 尚未全部采集 ${filtered.length-received} 家`:''}`);
   const totals=key=>complete.length?complete.reduce((n,r)=>n+r[key],0):null;
   const overview=el('section','summary-section');overview.append(el('h3','summary-title','经营汇总'),coverage,metrics([['成交金额 · 可计算店铺合计',totals('gross')],['成交退款金额（支付时间） · 可计算店铺合计',totals('refund')],['净成交金额 · 可计算店铺合计',totals('net')]],'board-metrics trade-metrics'));
   overview.append(el('p','detail-note',`统计区间：${periods[period][0]} — ${periods[period][1]}。— 按罗盘来源正常显示；合计仅含三项金额均可计算的店铺。`));content.append(overview);
   const storeSummary=el('section','summary-section'),summaryHead=el('div','summary-section-head');
   const jump=el('a','summary-jump','向下查看店铺明细 ↓');jump.href='#tradeShopDetails';summaryHead.append(el('h3','summary-title','各店铺汇总'),jump);storeSummary.append(summaryHead);
   const wrap=el('div','shop-summary-wrap'),table=el('table','shop-summary-table');table.setAttribute('aria-label','经营各店铺汇总');
   const thead=el('thead'),tr=el('tr');for(const text of ['店铺','成交金额','成交退款金额（支付时间）','净成交金额','状态'])tr.append(el('th',null,text));thead.append(tr);table.append(thead);
   const tbody=el('tbody');for(const r of filtered){const row=el('tr');for(const value of [r.shop,money(r.gross),money(r.refund),money(r.net),r.received?'已采集':r.rows.some(Boolean)?'部分采集':'待采集'])row.append(el('td',null,value));tbody.append(row)}table.append(tbody);wrap.append(table);storeSummary.append(wrap);content.append(storeSummary);
   const details=el('section','summary-section');details.id='tradeShopDetails';details.append(el('h3','summary-title','各店铺明细'));
   const grid=el('div','account-card-grid');details.append(grid);content.append(details);
   for(const r of filtered){
    const card=el('article','shop-account-card trade-shop-card'),top=el('div','card-top');
    top.append(el('h3',null,r.shop),el('span','data-badge '+(r.received?'good':'warning'),r.received?'已采集':r.rows.some(Boolean)?'部分采集':'待采集'));card.append(top,el('p','card-timestamp',periods[period][0]+' — '+periods[period][1]));
    const fields=el('dl','trade-fields');
    for(const [label,value] of [['成交金额',r.gross],['成交退款金额（支付时间）',r.refund],['净成交金额',r.net]]){const row=el('div');row.append(el('dt',null,label),el('dd',null,money(value)));fields.append(row)}
    card.append(fields,el('p','card-timestamp','采集时间：'+time(r.stamp)));
    if(!r.received)card.append(el('p','detail-note','该期间尚未全部采集。'));
    grid.append(card);
   }
   if(!filtered.length)grid.append(el('div','board-empty','没有匹配的店铺'));
  };
  select.onchange=()=>{period=Number(select.value);render()};search.oninput=()=>{query=search.value;render()};render();
 }
 async function load(force=false){
  if(data&&!force){draw();return}if(loading)return loading;draw();
  loading=(async()=>{try{const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'public_business'}),signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);const body=await response.json();if(!body.ok||!Array.isArray(body.shops)||!Array.isArray(body.records))throw Error('Invalid response');data=body;updatePeriods();draw()}
  catch{const root=document.getElementById('businessTradeApp');if(data){draw();root.prepend(el('p','detail-note','刷新失败，暂显示本次已读取的数据。'))}else{root.replaceChildren(el('div','board-empty','经营数据读取失败'));const retry=el('button','board-button','重试');retry.onclick=()=>load(true);root.append(retry)}}finally{loading=null}})();return loading;
 }
 window.renderBusinessTrade=()=>load();
 switchBoard(new URL(location.href).searchParams.get('board')||'business','trade');
})();
