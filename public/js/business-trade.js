/* 罗盘交易：只读取成交和支付时间退款，净成交统一用两项相减。金额以分计算。 */
(() => {
 'use strict';
 const API='https://mabxdkjqilulkrmqrrgo.supabase.co/functions/v1/business-center';
 const periods=[['2026-09-01','2026-10-15','9月1日—10月15日'],['2026-09-01','2026-09-30','9月1日—9月30日'],['2026-10-01','2026-10-15','10月1日—10月15日']];
 let data=null,period=0,query='',loading=null;
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 const money=n=>n==null?'—':'¥'+(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const time=s=>s?new Date(s).toLocaleString('zh-CN',{hour12:false}):'—';
 const valid=n=>Number.isSafeInteger(n);
 function report(shop){
  const [start,end]=periods[period];
  const needed=period===0?[[start,'2026-09-30'],['2026-10-01',end]]:[[start,end]];
  const rows=needed.map(([a,b])=>data.records.find(r=>r.shopName===shop&&r.startDate===a&&r.endDate===b));
  const complete=rows.every(r=>r&&valid(r.grossCents)&&valid(r.refundPaymentCents));
  const sum=key=>rows.every(r=>r&&valid(r[key]))?rows.reduce((n,r)=>n+r[key],0):null;
  const gross=sum('grossCents'),refund=sum('refundPaymentCents');
  return {shop,complete,gross,refund,net:gross!==null&&refund!==null?gross-refund:null,rows,stamp:rows.filter(Boolean).map(r=>r.capturedAt).sort().at(-1)};
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
   const coverage=el('p','data-caption',`当前筛选 ${filtered.length} 家 · 三项已齐 ${complete.length} 家 · 待补充 ${filtered.length-complete.length} 家`);
   const totals=key=>complete.length?complete.reduce((n,r)=>n+r[key],0):null;
   content.append(coverage,metrics([['成交金额 · 已齐店铺合计',totals('gross')],['成交退款金额（支付时间） · 已齐店铺合计',totals('refund')],['净成交金额 · 已齐店铺合计',totals('net')]],'board-metrics trade-metrics'));
   content.append(el('p','detail-note','以上合计仅含当前筛选中三项数据完整的店铺。未读取的金额显示为 —。10月16日离线数据暂不可选，当前统计截止10月15日。'));
   const grid=el('div','account-card-grid');content.append(grid);
   for(const r of filtered){
    const card=el('article','shop-account-card trade-shop-card'),top=el('div','card-top');
    top.append(el('h3',null,r.shop),el('span','data-badge '+(r.complete?'good':'warning'),r.complete?'已采集':r.rows.some(Boolean)?'待补充':'待采集'));card.append(top,el('p','card-timestamp',periods[period][0]+' — '+periods[period][1]));
    const fields=el('dl','trade-fields');
    for(const [label,value] of [['成交金额',r.gross],['成交退款金额（支付时间）',r.refund],['净成交金额',r.net]]){const row=el('div');row.append(el('dt',null,label),el('dd',null,money(value)));fields.append(row)}
    card.append(fields,el('p','card-timestamp','采集时间：'+time(r.stamp)));
    if(!r.complete)card.append(el('p','detail-note',r.rows.some(x=>x&&x.refundPaymentCents===null)?'来源退款指标显示 —，净成交待核验。':'该期间数据尚未齐全。'));
    grid.append(card);
   }
   if(!filtered.length)grid.append(el('div','board-empty','没有匹配的店铺'));
  };
  select.onchange=()=>{period=Number(select.value);render()};search.oninput=()=>{query=search.value;render()};render();
 }
 async function load(force=false){
  if(data&&!force){draw();return}if(loading)return loading;draw();
  loading=(async()=>{try{const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'public_business'}),signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);const body=await response.json();if(!body.ok||!Array.isArray(body.shops)||!Array.isArray(body.records))throw Error('Invalid response');data=body;draw()}
  catch{const root=document.getElementById('businessTradeApp');if(data){draw();root.prepend(el('p','detail-note','刷新失败，暂显示本次已读取的数据。'))}else{root.replaceChildren(el('div','board-empty','经营数据读取失败'));const retry=el('button','board-button','重试');retry.onclick=()=>load(true);root.append(retry)}}finally{loading=null}})();return loading;
 }
 window.renderBusinessTrade=()=>load();
 switchBoard(new URL(location.href).searchParams.get('board')||'business','trade');
})();
