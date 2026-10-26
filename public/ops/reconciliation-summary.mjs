export const PROVIDERS=['李杨','惠和','域见未来','刘鹏鸿'];
export function providerName(value){
 const name=String(value??'').replace(/\s/g,'').toLowerCase();
 if(/^李杨(?:tina|tes|赫丝)?$/.test(name))return '李杨';
 if(name==='惠和')return '惠和';
 if(/^域见未来\d*$/.test(name))return '域见未来';
 if(/^刘鹏鸿(?:6608)?$/.test(name))return '刘鹏鸿';
 return null;
}
const dateAt=t=>t&&Number.isFinite(Date.parse(t))?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date(t)):null;
const metric=(values,expected=values.length)=>{const known=values.filter(Number.isSafeInteger);return {value:known.length?known.reduce((a,b)=>a+b,0):null,known:known.length,total:expected,complete:known.length===expected&&expected>0};};
const between=(r,m)=>r.date>=m.start&&r.date<=m.end;
export function buildProviderSummary(raw,m,options,cents){
 const campaigns=raw.filter(r=>r.kind==='campaigns'),byId=new Map(campaigns.map(c=>[c.id,c]));
 const selected=new Set(m.accounts.map(a=>a.id));
 const chosen=campaigns.filter(c=>selected.has(String(c.advertiserId||c.id)));
 const allLedger=raw.filter(r=>r.kind==='recharges');
 const scopedLedger=new Set(m.recharges.map(r=>r.id));
 const rows=PROVIDERS.map(name=>{
  const accounts=m.accounts.filter(a=>providerName(a.broker)===name),cs=chosen.filter(c=>providerName(c.broker)===name);
  const fullGroup=!options.account&&!options.platform&&!options.search&&!options.broker;
  const ledger=allLedger.filter(r=>providerName(r.broker||byId.get(r.campaignId)?.broker)===name&&between(r,m)&&(scopedLedger.has(r.id)||fullGroup));
  const payments=ledger.filter(r=>r.recordType==='payment'&&r.status==='已付款');
  const recharge=metric(payments.map(r=>!r.amountCurrency||r.amountCurrency==='CNY'||r.amountCurrency==='RMB'?cents(r.amount):null));
  // Daily deposits include funding adjustments and grants; they alone cannot
  // identify payment principal or prove a bank-payment-linked actual arrival.
  const spend=metric(accounts.map(a=>a.spend));
  const balances=cs.map(c=>{
   const candidates=[c.accountHomeBalances,c.accountFinanceBalances].filter(o=>o&&o.identity==='verified'&&!o.conflict&&String(o.advertiserId)===String(c.advertiserId)&&dateAt(o.readAt)<=m.end&&cents(o.accountBalance)!==null).sort((a,b)=>Date.parse(b.readAt)-Date.parse(a.readAt));
   if(candidates.length)return {account:c.name,value:cents(candidates[0].accountBalance),at:candidates[0].readAt,basis:'页面余额'};
   const a=accounts.find(a=>a.id===String(c.advertiserId||c.id));return {account:c.name,value:a?.closing??null,at:a?.closingDate||null,basis:'日结余额参考'};
  });
  const balance=metric(balances.map(b=>b.value));
  if(balances.some(b=>b.value!==null&&b.basis==='日结余额参考'))balance.note='含日结余额参考';
  // One wallet ID contributes only once, even when many accounts share it.
  const walletMap=new Map();
  const configured=raw.filter(r=>r.kind==='wallets'&&r.entityKind!=='self'&&r.entityKind!=='代理自身'&&providerName(r.broker)===name&&(r.accounts?.some(a=>cs.some(c=>String(c.advertiserId)===String(a.advertiserId)))||!options.account&&!options.platform&&!options.search&&(!options.broker||providerName(options.broker)===name)));
  for(const w of configured){const id=String(w.walletId||w.id);if(!walletMap.has(id))walletMap.set(id,{id,name:w.name,value:null,at:null});}
  for(const c of cs){const o=c.sharedWalletObservation;if(!o?.id||o.identity==='unverified'||o.conflict||cents(o.balance)===null||!dateAt(o.observedAt)||dateAt(o.observedAt)>m.end)continue;const id=String(o.id),old=walletMap.get(id);if(!old||!old.at||Date.parse(o.observedAt)>Date.parse(old.at))walletMap.set(id,{id,name:o.name||old?.name||'共享钱包',value:cents(o.balance),at:o.observedAt});}
  const wallets=[...walletMap.values()],sharedBalance=metric(wallets.map(w=>w.value));
  if(!wallets.length)sharedBalance.note='未登记共享钱包';
  const actualCredits=ledger.filter(r=>(r.recordType||'recharge')==='recharge'&&r.status==='已充值'&&r.source!=='auto-balance-jump'&&(r.creditVerified===true||r.platformCreditVerified===true||r.arrivalVerified===true||(cents(r.cashCreditAmount)!==null&&cents(r.giftCreditAmount)!==null)));
  const principal=metric(actualCredits.map(r=>!r.amountCurrency||r.amountCurrency==='CNY'||r.amountCurrency==='RMB'?cents(r.baseAmount):null));
  const creditCandidates=ledger.filter(r=>(r.recordType||'recharge')==='recharge'&&r.source!=='auto-balance-jump');
  const arrived=metric(actualCredits.map(r=>!r.amountCurrency||r.amountCurrency==='CNY'||r.amountCurrency==='RMB'?cents(r.amount):null),creditCandidates.length);
  if(!arrived.complete)arrived.note=arrived.value===null?'实际到账待核验':'已确认到账小计，待补齐';
  const creditsComplete=principal.complete&&creditCandidates.length===actualCredits.length;
  const debt={value:creditsComplete&&recharge.complete?Math.max(0,principal.value-recharge.value):null,complete:creditsComplete&&recharge.complete,known:creditsComplete&&recharge.complete?1:0,total:1};
  const pending=accounts.filter(a=>a.status!=='已核对').length;
  return {name,accountCount:accounts.length,recharge,arrived,spend,balance,sharedBalance,debt,balances,wallets,pending,principal,unverifiedCredits:creditCandidates.length-actualCredits.length};
 });
 return {rows,unmappedProviders:[...new Set(m.accounts.filter(a=>!providerName(a.broker)).map(a=>a.broker))]};
}

export function renderProviderSummary(m,{esc,money,localTime,table}){
 const labels=[['recharge','充值'],['arrived','到账'],['spend','消耗'],['balance','余额'],['sharedBalance','共享钱包余额'],['debt','欠款']];
 const cell=(r,[key,label])=>{const metric=r[key];const note=metric.note||(metric.value===null?'待核验':!metric.complete?'已知金额，待补齐':'');return `<td data-label="${esc(label)}"><strong>${money(metric.value)}</strong>${note?`<small>${esc(note)}</small>`:''}</td>`;};
 const details=m.providers.rows.filter(r=>r.accountCount||r.recharge.value!==null).map(r=>`<section class="recon-provider-detail"><h3>${esc(r.name)}</h3><p>${r.accountCount} 个账户${r.unverifiedCredits?'；'+r.unverifiedCredits+' 笔到账台账尚缺平台确认，欠款暂不推算。':'。'}</p>${r.balances.length?table(['账户','余额','来源','来源时间'],r.balances.map(b=>[b.account,money(b.value),b.basis,b.at?.includes('T')?localTime(b.at):b.at])):''}${r.wallets.length?table(['共享钱包','余额','来源时间'],r.wallets.map(w=>[w.name,money(w.value),localTime(w.at)])):''}</section>`).join('');
 return `<article class="recon-document recon-simple"><div class="recon-heading"><h2>投流对账报告</h2><p>${esc(m.start)} 至 ${esc(m.end)} · ${esc(m.filters.platform)} · ${esc(m.filters.broker)}</p><p>生成时间 ${esc(localTime(m.generatedAt))} · 金额单位：元</p></div>
 <section class="recon-provider-summary" aria-label="四组投流对账汇总"><table><thead><tr><th scope="col">服务商</th>${labels.map(([,label])=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${m.providers.rows.map(r=>`<tr><th scope="row">${esc(r.name)}</th>${labels.map(label=>cell(r,label)).join('')}</tr>`).join('')}</tbody></table></section>
 <p class="recon-simple-note">充值、到账、消耗按所选日期统计；余额显示最新已采值，共享钱包按钱包去重。缺少依据显示“—”，部分已知金额会单独标注。</p>
 <details class="recon-source-details"><summary>查看金额来源与待核验项</summary><p>充值＝已付款金额；到账＝已确认的平台实际到账（含返点）；欠款＝已确认到账本金−已付款，预付款不计欠款。自动从付款生成的预计到账、余额跳变和未区分资金来源的日结存入不作为实际到账凭据。余额来自已核验账户页面，缺少页面余额时仅列日结参考；来源时间见下表。</p>${details}${m.unmapped.length||m.providers.unmappedProviders.length?`<p>未映射源记录：${m.unmapped.length} 条；未归入四组的服务商：${esc(m.providers.unmappedProviders.join('、')||'无')}。未纳入四组金额。</p>${table(['未归属账户','原服务商'],m.accounts.filter(a=>!providerName(a.broker)).map(a=>[a.name,a.broker]))}`:''}<p>广告数据至 ${esc(m.latestAdDate)}；财务至 ${esc(m.latestFinanceDate)}。报告读取最新回传数据，不自动启动采集。</p></details></article>`;
}

export const summaryStyles=`.recon-simple{max-width:1240px;margin:auto}.recon-simple .recon-heading{margin-bottom:24px}.recon-provider-summary{background:#fff;border:1px solid #e5e7ee;border-radius:14px;overflow:hidden}.recon-provider-summary table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}.recon-provider-summary thead{background:#f4f2f9}.recon-provider-summary th,.recon-provider-summary td{padding:21px 14px;text-align:right;border-bottom:1px solid #eef0f5;vertical-align:top}.recon-provider-summary thead th{font-size:13px;color:#626878;font-weight:500}.recon-provider-summary th:first-child{text-align:left;padding-left:22px}.recon-provider-summary tbody th{font-size:16px;font-weight:650;white-space:nowrap}.recon-provider-summary td strong{font-weight:600;font-size:16px;white-space:nowrap}.recon-provider-summary td small{white-space:normal;overflow-wrap:anywhere;display:block;font-size:12px;color:#846222;margin-top:4px;max-width:145px;margin-left:auto}.recon-provider-summary tr:last-child>*{border-bottom:0}.recon-simple-note{font-size:13px;color:#626878;margin:16px 2px 22px}.recon-provider-detail{padding:0 22px 18px}.recon-provider-detail h3{margin:6px 0;font-size:16px}.recon-provider-detail>p{margin:0 0 12px;color:#626878}.recon-source-details summary{min-height:44px;box-sizing:border-box}.recon-source-details summary:focus-visible{outline:2px solid #7546d9;outline-offset:-3px}.recon-source-details .recon-table{max-height:320px;border:1px solid #eef0f5;margin-bottom:12px}.recon-simple .recon-source-details{background:transparent}.recon-simple .recon-source-details[open]{background:#fff}@media(max-width:1100px){.recon-provider-summary th,.recon-provider-summary td{padding:18px 10px}.recon-provider-summary td strong{font-size:14px}}@media(max-width:850px){.recon-toolbar{flex-direction:column;align-items:stretch}.recon-toolbar>strong{white-space:nowrap}.recon-toolbar>div{justify-content:flex-end}.recon-provider-summary{border:0;background:transparent;overflow:visible}.recon-provider-summary table,.recon-provider-summary tbody{display:block}.recon-provider-summary thead{display:none}.recon-provider-summary tbody tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid #e5e7ee;border-radius:12px;background:white;margin-bottom:14px;overflow:hidden}.recon-provider-summary tbody th{grid-column:1/-1;background:#f4f2f9;padding:14px 18px!important}.recon-provider-summary tbody td{display:block;padding:14px 18px!important;text-align:left;border-bottom:1px solid #eef0f5;min-width:0}.recon-provider-summary td:before{content:attr(data-label);display:block;font-size:12px;color:#626878;margin-bottom:6px}.recon-provider-summary td small{margin-left:0;max-width:none}.recon-provider-summary td strong{font-size:16px}.recon-provider-summary tbody tr:last-child>*{border-bottom:1px solid #eef0f5}.recon-provider-summary tbody td:nth-last-child(-n+2){border-bottom:0}.recon-provider-detail{padding:0 14px 16px}}@media print{.recon-document details:not([open])>:not(summary){display:none!important}.recon-simple .recon-provider-summary table{display:table}.recon-simple .recon-provider-summary thead{display:table-header-group}.recon-simple .recon-provider-summary tbody{display:table-row-group}.recon-simple .recon-provider-summary tr{display:table-row}.recon-simple .recon-provider-summary th,.recon-simple .recon-provider-summary td{display:table-cell;border-radius:0;font-size:11px;padding:12px 8px!important}.recon-provider-summary td:before{display:none}.recon-provider-summary td strong{font-size:12px}}`;
