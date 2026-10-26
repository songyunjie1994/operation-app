import {groupedWallets,reverseYesterdayWallet} from './wallet-groups.mjs?v=20261026-reverse-shared-zero';
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
 const excludedPayments=new Set(allLedger.filter(r=>r.excludeFromRecharge===true).map(r=>r.id));
 const scopedLedger=new Set(m.recharges.map(r=>r.id));
 const rows=PROVIDERS.map(name=>{
  const accounts=m.accounts.filter(a=>providerName(a.broker)===name),cs=chosen.filter(c=>providerName(c.broker)===name);
  const fullGroup=!options.account&&!options.platform&&!options.search&&!options.broker;
  const ledger=allLedger.filter(r=>!excludedPayments.has(r.id)&&!excludedPayments.has(r.sourcePaymentId)&&providerName(r.broker||byId.get(r.campaignId)?.broker)===name&&between(r,m)&&(scopedLedger.has(r.id)||fullGroup));
  const payments=ledger.filter(r=>r.recordType==='payment'&&r.status==='已付款');
  const recharge=metric(payments.map(r=>!r.amountCurrency||['CNY','RMB','CNH'].includes(r.amountCurrency)?cents(r.amount):null));
  // User requested estimated arrivals; actual finance/collection data stays intact.
  const spend=metric(accounts.map(a=>a.spend));
  const balances=cs.map(c=>{
   if(options.settled){const a=accounts.find(a=>a.id===String(c.advertiserId||c.id));return {account:c.name,value:a?.closingDate===m.end?a.closing:null,at:a?.closingDate||null,basis:a?.closingDate===m.end?'截止日日结余额':'缺少截止日日结余额'};}
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
  const namedGroups=name==='李杨'?groupedWallets(cs,m.end,cents):null;
  const wallets=namedGroups?namedGroups.wallets:[...walletMap.values()],sharedBalance=metric(wallets.map(w=>w.value));
  if(options.settled){for(const w of wallets){const snaps=raw.filter(s=>s.kind==='walletSnapshots'&&s.date===m.end&&(s.walletGroupId===w.id||!namedGroups&&String(s.walletId)===String(w.id)));const values=[...new Set(snaps.map(s=>cents(s.balance)).filter(Number.isSafeInteger))];w.value=values.length===1?values[0]:null;w.at=values.length===1?m.end:null;w.conflict=values.length>1;w.basis=values.length?'截止日钱包快照':'缺少截止日钱包快照';}Object.assign(sharedBalance,metric(wallets.map(w=>w.value)));}
  if(options.settled){const today=dateAt(m.generatedAt),dayBefore=new Date(today+'T00:00:00Z');dayBefore.setUTCDate(dayBefore.getUTCDate()-1);if(m.end===dayBefore.toISOString().slice(0,10)){const currentGroups=namedGroups?groupedWallets(cs,today,cents).wallets:null;for(const w of wallets){if(w.value!==null||w.conflict)continue;const members=namedGroups?w.members.map(a=>a.accountId):cs.filter(c=>String(c.sharedWalletObservation?.id)===String(w.id)).map(c=>String(c.advertiserId));const observation=cs.map(c=>c.sharedWalletObservation).filter(o=>String(o?.id)===String(w.id)&&dateAt(o?.observedAt)===today&&!o.conflict).sort((a,b)=>String(b.observedAt).localeCompare(String(a.observedAt)))[0];const current=currentGroups?currentGroups.find(g=>g.id===w.id):{value:observation?cents(observation.balance):null,at:observation?.observedAt};const reversed=reverseYesterdayWallet(current,members,raw.filter(r=>r.kind==='financeRecords'),today,cents,true);w.value=reversed.value;w.basis=reversed.reason;w.reconstructed=reversed.value!==null;w.todaySharedSpendDefaulted=!!reversed.defaulted;w.at=w.reconstructed?m.end:null;}Object.assign(sharedBalance,metric(wallets.map(w=>w.value)));if(wallets.some(w=>w.reconstructed)){sharedBalance.complete=false;sharedBalance.note='含当前余额＋当天共享消耗反推值';}}}
  if(options.settled&&wallets.some(w=>w.value===null))sharedBalance.note='缺少截止日钱包快照';
  else if(wallets.some(w=>w.conflict))sharedBalance.note='同组余额冲突，待核验';
  else if(wallets.some(w=>w.todaySharedSpendDefaulted))sharedBalance.note='反推昨日余额；当天共享消耗缺失暂按0';
  else if(wallets.some(w=>w.reconstructed))sharedBalance.note='含反推昨日余额，待核验资金变动';
  else if(namedGroups)sharedBalance.note=sharedBalance.complete?'按默认钱包组去重':'已知钱包组小计，待补齐';
  if(!wallets.length&&['惠和','域见未来'].includes(name)){Object.assign(sharedBalance,{value:0,known:0,total:0,complete:true,note:'无共享钱包'});}
  else if(!wallets.length)sharedBalance.note='未登记共享钱包';
  const creditCandidates=ledger.filter(r=>(r.recordType||'recharge')==='recharge'&&r.status==='已充值'&&r.source!=='auto-balance-jump');
  const paidIds=new Set(payments.map(r=>r.id));
  const entries=[...payments,...creditCandidates.filter(r=>!r.sourcePaymentId||!paidIds.has(r.sourcePaymentId))];
  const fixedRates={'惠和':0.01,'刘鹏鸿':0.055,'域见未来':0};
  const principalOf=r=>!r.amountCurrency||['CNY','RMB','CNH'].includes(r.amountCurrency)?cents(r.recordType==='payment'?r.amount:r.baseAmount):null;
  const projected=entries.map(r=>{
   const base=principalOf(r);if(base===null)return null;
   if(Object.hasOwn(fixedRates,name))return Math.round(base*(1+fixedRates[name]));
   // Li Yang combines multiple existing rates: keep the stored transaction's
   // estimate/rate, then the existing wallet rule; never apply TES to Tina.
   const stored=cents(r.recordType==='payment'?r.expectedCreditAmount:r.amount);if(stored!==null)return stored;
   const broker=String(r.broker||byId.get(r.campaignId)?.broker||'').replace(/\s/g,'').toLowerCase();
   const wallet=raw.find(w=>w.kind==='wallets'&&String(w.broker||'').replace(/\s/g,'').toLowerCase()===broker&&typeof w.rebate==='number');
   const rate=typeof r.rebateRate==='number'?r.rebateRate:wallet?.rebate??(broker==='李杨tes'?0.03:['李杨tina','李杨赫丝'].includes(broker)?0:null);
   return typeof rate==='number'&&Number.isFinite(rate)&&rate>=0&&rate<=1?Math.round(base*(1+rate)):null;
  });
  const arrivalAdjustments=ledger.filter(r=>r.recordType==='arrival_adjustment'&&r.status==='已确认');
  const principal=metric(entries.map(principalOf)),arrived=metric([...projected,...arrivalAdjustments.map(r=>cents(r.amount))]);
  arrived.note=arrived.value===null?'预计值缺少金额或规则':arrived.complete?'预计到账':'预计到账小计，待补齐';
  if(arrivalAdjustments.length)arrived.note+='（含用户确认到账调整）';
  const prior=new Date(m.start+'T00:00:00Z');prior.setUTCDate(prior.getUTCDate()-1);const openingDate=prior.toISOString().slice(0,10);
  const openingSources=raw.filter(w=>w.kind==='wallets'&&providerName(w.broker)===name);
  const opening=metric(openingSources.map(w=>w.openingDate===openingDate?cents(w.openingBalance):null));
  if(options.account||options.platform||options.search){opening.value=null;opening.complete=false;opening.note='局部筛选无法分摊期初';}
  else opening.note=opening.value===null?'缺少'+openingDate+'期初':opening.complete?'已存'+openingDate+'期初':'已登记期初小计，待补齐';
  if(opening.value!==null&&openingSources.some(w=>w.openingDebtAdjustment))opening.note+='（已扣旧欠款）';
  const totalDeposit=metric(accounts.map(a=>a.deposit));
  totalDeposit.note='日结总存入；不含总转入，未拆现金/赠款';
  const expectedBalance=balanceFormula(opening,arrived,spend,'expected',totalDeposit);
  const actualBalance=balanceFormula(balance,sharedBalance,null,'actual');
  if(balance.note&&actualBalance.value!==null){actualBalance.note='含日结余额参考，待核验';actualBalance.complete=false;}
  const debt=balanceFormula(actualBalance,expectedBalance,null,'difference');
  if((balance.note||!actualBalance.complete||!expectedBalance.complete)&&debt.value!==null)debt.note='暂算差额，待补齐';
  const pending=accounts.filter(a=>a.status!=='已核对').length;
  return {name,accountCount:accounts.length,opening,openingDate,totalDeposit,expectedBalance,actualBalance,recharge,arrived,spend,balance,sharedBalance,debt,balances,wallets,walletAccounts:namedGroups?.rows||[],pending,principal,estimatedEntries:entries.length};
 });
 return {rows,unmappedProviders:[...new Set(m.accounts.filter(a=>!providerName(a.broker)).map(a=>a.broker))]};
}

export function balanceFormula(a,b,c,kind,deposit){const values=[a,b,...(c?[c]:[]),...(deposit?[deposit]:[])];const known=values.every(x=>Number.isSafeInteger(x?.value)),complete=known&&values.every(x=>x.complete);const value=!known?null:kind==='expected'?a.value+b.value+(deposit?.value||0)-c.value:kind==='actual'?a.value+b.value:a.value-b.value;return {value,complete,known:known?values.length:0,total:values.length,note:!known?'缺少计算依据':!complete?'已知金额暂算，待补齐':kind==='difference'?'实际余额－预计余额':''};}
export function renderProviderSummary(m,{esc,money,localTime,table}){
 const labels=[['opening','期初'],['recharge','充值'],['arrived','到账'],['totalDeposit','总存入'],['spend','消耗'],['expectedBalance','预计余额'],['balance','账户余额'],['sharedBalance','共享钱包余额'],['actualBalance','实际余额'],['debt','欠款']];
 const cell=(r,[key,label])=>{const metric=r[key];const note=metric.note||(metric.value===null?'待核验':!metric.complete?'已知金额，待补齐':'');return `<td data-label="${esc(label)}"><strong>${money(metric.value)}</strong>${note?`<small>${esc(note)}</small>`:''}</td>`;};
 const details=m.providers.rows.filter(r=>r.accountCount||r.recharge.value!==null).map(r=>`<section class="recon-provider-detail"><h3>${esc(r.name)}</h3><p>${r.accountCount} 个账户，按 ${r.estimatedEntries} 笔去重后的付款/充值台账预计。</p>${r.balances.length?table(['账户','余额','来源','来源时间'],r.balances.map(b=>[b.account,money(b.value),b.basis,b.at?.includes('T')?localTime(b.at):b.at])):''}${r.wallets.length?table(['钱包组编号','钱包组','余额','依据/状态','来源时间'],r.wallets.map(w=>[w.id,w.name,money(w.value),w.conflict?'余额冲突':w.basis||'已登记钱包',localTime(w.at)])):''}${r.walletAccounts?.length?table(['账户','默认钱包组','账户余额','采到的共享余额','来源','采集时间'],r.walletAccounts.map(a=>[a.accountName,a.group?.id||'未分组',money(a.accountBalance),money(a.sharedBalance),a.source,localTime(a.at)])):''}</section>`).join('');
 return `<article class="recon-document recon-simple"><div class="recon-heading"><h2>投流对账报告</h2><p>${esc(m.start)} 至 ${esc(m.end)} · ${esc(m.filters.platform)} · ${esc(m.filters.broker)}</p><p>生成时间 ${esc(localTime(m.generatedAt))} · 金额单位：元</p></div>
 <section class="recon-provider-summary" aria-label="四组投流对账汇总"><table><thead><tr><th scope="col">服务商</th>${labels.map(([,label])=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${m.providers.rows.map(r=>`<tr><th scope="row">${esc(r.name)}</th>${labels.map(label=>cell(r,label)).join('')}</tr>`).join('')}</tbody></table></section>
 <p class="recon-simple-note">充值、到账、消耗按所选日期统计；${m.settled?"按截止日日结和钱包快照对账，不使用今天余额。":"余额显示最新已采值。"}共享钱包按钱包去重。缺少依据显示“—”，部分已知金额会单独标注。</p>
 <details class="recon-source-details"><summary>查看金额来源与待核验项</summary><p>充值＝已付款的人民币收款金额（含按用户确认票面统计的CNH）；美元扣款和手续费不重复计入。到账按预计值：惠和本金×1.01、刘鹏鸿本金×1.055、域见未来本金×1，李杨沿用交易或钱包已有返点规则。关联同一付款的充值记录不重复计算，余额跳变不当充值。预计余额＝期初＋到账＋总存入−消耗；总存入仅取日结原列，不将总转入重复加入；实际余额＝账户余额＋共享钱包余额；欠款＝实际余额−预计余额，保留正负值。缺少依据不补零，部分数据仅暂算；预计到账不代表平台到账确认。余额来自已核验账户页面，缺少页面余额时仅列日结参考；来源时间见下表。</p>${details}${m.unmapped.length||m.providers.unmappedProviders.length?`<p>未映射源记录：${m.unmapped.length} 条；未归入四组的服务商：${esc(m.providers.unmappedProviders.join('、')||'无')}。未纳入四组金额。</p>${table(['未归属账户','原服务商'],m.accounts.filter(a=>!providerName(a.broker)).map(a=>[a.name,a.broker]))}`:''}<p>广告数据至 ${esc(m.latestAdDate)}；财务至 ${esc(m.latestFinanceDate)}。${m.settled?"已排除今天的消耗、到账和总存入；余额取截止日日结，共享钱包按当前余额加当天共享消耗反推；缺少当天共享消耗按用户指定暂计0，保留反推标记。":"报告读取最新回传数据，不自动启动采集。"}</p></details></article>`;
}

export const summaryStyles=`.recon-simple{max-width:1600px;margin:auto}.recon-simple .recon-heading{margin-bottom:24px}.recon-provider-summary{background:#fff;border:1px solid #e5e7ee;border-radius:14px;overflow:hidden}.recon-provider-summary table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}.recon-provider-summary thead{background:#f4f2f9}.recon-provider-summary th,.recon-provider-summary td{padding:21px 14px;text-align:right;border-bottom:1px solid #eef0f5;vertical-align:top}.recon-provider-summary thead th{font-size:13px;color:#626878;font-weight:500}.recon-provider-summary th:first-child{text-align:left;padding-left:22px}.recon-provider-summary tbody th{font-size:16px;font-weight:650;white-space:nowrap}.recon-provider-summary td strong{font-weight:600;font-size:16px;white-space:nowrap}.recon-provider-summary td small{white-space:normal;overflow-wrap:anywhere;display:block;font-size:12px;color:#846222;margin-top:4px;max-width:145px;margin-left:auto}.recon-provider-summary tr:last-child>*{border-bottom:0}.recon-simple-note{font-size:13px;color:#626878;margin:16px 2px 22px}.recon-provider-detail{padding:0 22px 18px}.recon-provider-detail h3{margin:6px 0;font-size:16px}.recon-provider-detail>p{margin:0 0 12px;color:#626878}.recon-source-details summary{min-height:44px;box-sizing:border-box}.recon-source-details summary:focus-visible{outline:2px solid #7546d9;outline-offset:-3px}.recon-source-details .recon-table{max-height:320px;border:1px solid #eef0f5;margin-bottom:12px}.recon-simple .recon-source-details{background:transparent}.recon-simple .recon-source-details[open]{background:#fff}@media(max-width:1100px){.recon-provider-summary th,.recon-provider-summary td{padding:18px 10px}.recon-provider-summary td strong{font-size:14px}}@media(max-width:850px){.recon-toolbar{flex-direction:column;align-items:stretch}.recon-toolbar>strong{white-space:nowrap}.recon-toolbar>div{justify-content:flex-end}.recon-provider-summary{border:0;background:transparent;overflow:visible}.recon-provider-summary table,.recon-provider-summary tbody{display:block}.recon-provider-summary thead{display:none}.recon-provider-summary tbody tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid #e5e7ee;border-radius:12px;background:white;margin-bottom:14px;overflow:hidden}.recon-provider-summary tbody th{grid-column:1/-1;background:#f4f2f9;padding:14px 18px!important}.recon-provider-summary tbody td{display:block;padding:14px 18px!important;text-align:left;border-bottom:1px solid #eef0f5;min-width:0}.recon-provider-summary td:before{content:attr(data-label);display:block;font-size:12px;color:#626878;margin-bottom:6px}.recon-provider-summary td small{margin-left:0;max-width:none}.recon-provider-summary td strong{font-size:16px}.recon-provider-summary tbody tr:last-child>*{border-bottom:1px solid #eef0f5}.recon-provider-summary tbody td:nth-last-child(-n+2){border-bottom:0}.recon-provider-detail{padding:0 14px 16px}}@media print{.recon-document details:not([open])>:not(summary){display:none!important}.recon-simple .recon-provider-summary table{display:table}.recon-simple .recon-provider-summary thead{display:table-header-group}.recon-simple .recon-provider-summary tbody{display:table-row-group}.recon-simple .recon-provider-summary tr{display:table-row}.recon-simple .recon-provider-summary th,.recon-simple .recon-provider-summary td{display:table-cell;border-radius:0;font-size:11px;padding:12px 8px!important}.recon-provider-summary td:before{display:none}.recon-provider-summary td strong{font-size:12px}}`;

