import {buildProviderSummary,renderProviderSummary,summaryStyles} from './reconciliation-summary.mjs?v=20261026-estimated-arrival';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export const DEFAULT_TRAFFIC_START='2026-09-01';
export function cents(value){
 if(finite(value))return Number.isSafeInteger(Math.round(value*100))?Math.round(value*100):null;
 if(typeof value!=='string')return null;
 const s=value.trim().replace(/[,，¥￥\s元]/g,'');
 return /^[+-]?\d+(?:\.\d{1,2})?$/.test(s)&&Number.isSafeInteger(Math.round(Number(s)*100))?Math.round(Number(s)*100):null;
}
const add=values=>values.length&&values.every(Number.isSafeInteger)?values.reduce((a,b)=>a+b,0):null;
const known=values=>values.filter(Number.isSafeInteger).reduce((a,b)=>a+b,0);
const col=(r,...names)=>{for(const n of names)if(Object.hasOwn(r?.columns||{},n))return cents(r.columns[n]);return null};
const field=(r,name,...names)=>Object.hasOwn(r||{},name)?cents(r[name]):col(r,...names);
const stamp=r=>r.updatedAt||r.capturedAt||r.createdAt||'';
const iso=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const text=v=>String(v??'');
const inRange=(r,start,end)=>iso(r.date)&&(!start||r.date>=start)&&r.date<=end;
const group=(rows,key)=>{const map=new Map();for(const r of rows){const k=key(r);if(!map.has(k))map.set(k,[]);map.get(k).push(r)}return map};
export function financeAmounts(row){
 const local=field(row,'balanceTotalSpend','余额总消耗(元)'),shared=col(row,'共享钱包消耗(元)');
 const extra=[col(row,'共享赠款消耗','共享赠款消耗(元)'),col(row,'消返红包消耗(元)'),col(row,'立减红包消耗(元)')];
 // Shared grant/red-packet funding is displayed separately until its overlap
 // with the source total is established. Never count the same funding twice.
 const uncertainFunding=extra.some(v=>v!==0);
 return {local,shared,extra,uncertainFunding,comparable:uncertainFunding?null:add([local,shared]),
  nonGrant:field(row,'nonGrantSpend','非赠款消耗(元)'),gift:field(row,'giftSpend','赠款消耗(元)'),
  closing:col(row,'总余额(元)','期末总余额(元)'),deposit:col(row,'总存入(元)'),
  cash:col(row,'现金存入(元)','现金充值(元)'),giftDeposit:col(row,'赠款存入(元)'),
  transferIn:col(row,'总转入(元)'),transferOut:col(row,'总转出(元)')};
}
function financePick(rows){
 const sorted=[...rows].sort((a,b)=>stamp(b).localeCompare(stamp(a))),row=sorted[0];
 const signature=r=>JSON.stringify(financeAmounts(r));
 return {row,conflict:new Set(rows.map(signature)).size>1};
}
export function buildReconciliation(source,options={}){
 const generatedAt=options.generatedAt||new Date().toISOString(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date(generatedAt));
 const end=options.end||today,start=options.start||DEFAULT_TRAFFIC_START;
 if(!iso(start)||!iso(end)||start>end)throw Error('请设置有效的对账起止日期');
 const raw=source.map(r=>r.payload?{...r.payload,entityKind:r.payload.kind,kind:r.kind}:{...r});
 const campaigns=raw.filter(r=>r.kind==='campaigns'),byCampaign=new Map(campaigns.map(c=>[c.id,c]));
 const accountKey=r=>r.advertiserId?String(r.advertiserId):byCampaign.get(r.campaignId)?.advertiserId||r.campaignId||'unmapped:'+r.id;
 const campaignKey=c=>String(c.advertiserId||c.id);
 const matchesPlatform=c=>!options.platform||(options.platform==='kuaishou'?c?.platform==='快手':['千川','巨量引擎','抖音','抖店'].includes(c?.platform));
 const search=text(options.search).trim().toLowerCase();
 let scope=campaigns.filter(c=>matchesPlatform(c)&&(!options.broker||c.broker===options.broker)&&(!options.account||c.id===options.account));
 if(search){const hits=new Set(raw.filter(r=>r.kind==='records'&&[r.douyinName,r.douyinNumber].some(v=>text(v).toLowerCase().includes(search))).map(accountKey));scope=scope.filter(c=>hits.has(campaignKey(c))||[c.name,c.account,c.advertiserId,c.broker].some(v=>text(v).toLowerCase().includes(search)));}
 const selected=new Set(scope.map(campaignKey)),byAccount=new Map(scope.map(c=>[campaignKey(c),c]));
 const records=raw.filter(r=>r.kind==='records'&&selected.has(accountKey(r))&&inRange(r,start,end));
 const finances=raw.filter(r=>r.kind==='financeRecords'&&selected.has(accountKey(r))&&iso(r.date)&&r.date<=end);
 const daily=[],accounts=[];
 for(const id of selected){
  const campaign=byAccount.get(id),ads=records.filter(r=>accountKey(r)===id),allFinance=finances.filter(r=>accountKey(r)===id);
  const fByDate=new Map([...group(allFinance,r=>r.date)].map(([day,rs])=>[day,financePick(rs)]));
  const fSelected=[...fByDate].filter(([d])=>d>=start).sort(([a],[b])=>a.localeCompare(b));
  const adByDate=group(ads,r=>r.date),days=[...new Set([...adByDate.keys(),...fSelected.map(([d])=>d)])].sort();
  const items=[];
  for(const day of days){
   const ad=adByDate.get(day)||[],f=fByDate.get(day),amount=f?financeAmounts(f.row):null;
   const spend=add(ad.map(r=>cents(r.spend))),issues=[];
   if(!ad.length)issues.push('无对应消耗明细，不能推定为零');else if(spend===null)issues.push('消耗金额缺失');
   if(!f)issues.push('暂无对应日结，待过账或核验采集');
   if(f?.conflict)issues.push('同日财务存在金额冲突');
   if(amount?.uncertainFunding)issues.push('共享赠款或红包口径待核验');
   if(amount&&amount.comparable===null&&!amount.uncertainFunding)issues.push('财务消耗分项缺失');
   if(amount&&add([amount.nonGrant,amount.gift])!==null&&add([amount.nonGrant,amount.gift])!==amount.local)issues.push('本账户现金与赠款消耗分项不符');
   const difference=spend!==null&&amount?.comparable!==null&&amount?.comparable!==undefined?spend-amount.comparable:null;
   const row={accountId:id,account:campaign.name,broker:campaign.broker||'未归属服务商',date:day,spend,finance:amount?.comparable??null,local:amount?.local??null,shared:amount?.shared??null,difference,
    status:difference!==null&&difference!==0?'差额':issues.length?'待核验':'已核对',issues,sourceRunIds:[...new Set([...ad,f?.row].filter(Boolean).map(r=>r.sourceRunId).filter(Boolean))],sourceAt:[...ad,f?.row].filter(Boolean).map(stamp).sort().at(-1)||null};
   items.push(row);daily.push(row);
  }
  const selectedFinance=fSelected.map(([,p])=>p.row),first=selectedFinance[0],last=selectedFinance.at(-1),amounts=selectedFinance.map(financeAmounts),warnings=[];
  const previous=[...fByDate].filter(([d])=>d<start).sort(([a],[b])=>b.localeCompare(a)).at(0);
  let opening=null,openingBasis='缺少期初余额',openingDate=null;
  if(previous){opening=financeAmounts(previous[1].row).closing;openingDate=previous[0];openingBasis='前一条已采日结余额';
   if(previous[1].conflict)warnings.push('期初参考日结有冲突');
   const dayBefore=new Date(start+'T00:00:00Z');dayBefore.setUTCDate(dayBefore.getUTCDate()-1);
   if(openingDate!==dayBefore.toISOString().slice(0,10))warnings.push('期初使用较早日结，间隔内无流水尚待核验');
  }else if(first){const a=financeAmounts(first);if([a.closing,a.local,a.deposit,a.transferIn,a.transferOut].every(Number.isSafeInteger)){opening=a.closing+a.local-a.deposit-a.transferIn+a.transferOut;openingDate=first.date;openingBasis='首日期初反推';warnings.push('期初为首日反推，不能视为独立余额验证');}}
  const total=get=>add(amounts.map(get)),closing=amounts.at(-1)?.closing??null,deposit=total(a=>a.deposit),local=total(a=>a.local),transferIn=total(a=>a.transferIn),transferOut=total(a=>a.transferOut);
  const expectedClosing=[opening,deposit,local,transferIn,transferOut].every(Number.isSafeInteger)?opening+deposit+transferIn-transferOut-local:null;
  const balanceDifference=expectedClosing!==null&&closing!==null?closing-expectedClosing:null;
  if(!first)warnings.push('没有可用日结');else{if(first.date!==start)warnings.push('首条日结晚于对账开始日');if(last.date!==end)warnings.push('期末日结未到对账截止日，不能当作实时余额');}
  if(opening===null||closing===null)warnings.push('期初或期末余额缺失');
  if(total(a=>a.cash)===null||total(a=>a.giftDeposit)===null)warnings.push('总存入未拆分现金与赠款，不把总存入当作现金');
  if(fSelected.some(([,v])=>v.conflict))warnings.push('财务冲突');
  const spend=add(ads.map(r=>cents(r.spend))),finance=add(amounts.map(a=>a.comparable));
  accounts.push({id,name:campaign.name,broker:campaign.broker||'未归属服务商',spend,finance,difference:spend!==null&&finance!==null?spend-finance:null,
   opening,openingDate,openingBasis,closing,closingDate:last?.date||null,cash:total(a=>a.cash),giftDeposit:total(a=>a.giftDeposit),deposit,local,shared:total(a=>a.shared),transferIn,transferOut,expectedClosing,balanceDifference,
   warnings,status:balanceDifference!==null&&balanceDifference!==0||items.some(r=>r.status==='差额')?'差额':warnings.length||items.some(r=>r.status==='待核验')?'待核验':'已核对',days:items.length});
 }
 const allowedBrokers=new Set(scope.map(c=>c.broker).filter(Boolean));
 const ledger=raw.filter(r=>r.kind==='recharges'&&inRange(r,start,end)&&(!options.broker||r.broker===options.broker)&&(!options.platform||!r.campaignId||matchesPlatform(byCampaign.get(r.campaignId)))&&(!r.campaignId||selected.has(accountKey(r)))&&(!search||allowedBrokers.has(r.broker)||r.campaignId&&selected.has(accountKey(r))));
 const credits=ledger.filter(r=>r.recordType!=='payment'),payments=ledger.filter(r=>r.recordType==='payment'),creditPayments=new Set(credits.map(r=>r.sourcePaymentId).filter(Boolean));
 const rechargeRows=ledger.map(r=>({id:r.id,date:r.date,broker:r.broker||'未归属服务商',accountId:r.campaignId?accountKey(r):null,account:byCampaign.get(r.campaignId)?.name||'未分配账户',type:r.recordType==='payment'?'银行付款':'充值台账',amount:cents(r.amount),cash:cents(r.baseAmount),gift:cents(r.rebateAmount),
  status:r.status||'未提供状态',source:r.source||'未提供来源',paymentId:r.sourcePaymentId||null,issues:[...(!r.campaignId?['尚未分配账户，不参与单户余额核验']:[]),...(r.source==='auto-balance-jump'?['余额跳变推测，不作为已验证充值']:[]),...(r.source==='auto-from-payment'?['由付款生成，待核验平台实际入账']:[]),...(r.recordType==='payment'&&creditPayments.has(r.id)?['已关联充值记录，付款与充值不重复相加']:[])]}));
 for(const account of accounts){
  const bound=rechargeRows.filter(r=>r.type==='充值台账'&&r.accountId===account.id&&r.source!=='auto-balance-jump'&&r.status==='已充值');
  account.rechargeCash=add(bound.map(r=>r.cash));account.rechargeGift=add(bound.map(r=>r.gift));
  account.cashDifference=account.rechargeCash!==null&&account.cash!==null?account.rechargeCash-account.cash:null;
  account.giftDifference=account.rechargeGift!==null&&account.giftDeposit!==null?account.rechargeGift-account.giftDeposit:null;
  account.rechargeStatus=account.cashDifference!==null&&account.giftDifference!==null?(account.cashDifference||account.giftDifference?'差额':'已知台账金额一致'):'待核验';
  if(account.rechargeStatus==='差额'){account.status='差额';account.warnings.push('充值台账与日结现金/赠款存入不同，需核验归属及到账日期');}
  else if(account.rechargeStatus==='待核验'){if(account.status!=='差额')account.status='待核验';account.warnings.push(bound.length?'充值现金或赠款缺少独立对照字段':'没有已归属账户的充值台账，不能猜测分配');}
 }
 const wallets=raw.filter(r=>r.kind==='wallets'&&r.entityKind!=='self'&&(!options.broker||r.broker===options.broker)&&(!options.account||r.accounts?.some(a=>scope.some(c=>c.advertiserId===a.advertiserId)))&&(!options.platform||r.accounts?.some(a=>scope.some(c=>c.advertiserId===a.advertiserId)))&&(!search||allowedBrokers.has(r.broker)));
 const walletRows=wallets.map(w=>{
  const snapshots=raw.filter(r=>r.kind==='walletSnapshots'&&[w.id,w.walletId].includes(r.walletId)&&iso(r.date));
  const before=snapshots.filter(r=>r.date<start).sort((a,b)=>b.date.localeCompare(a.date)).at(0),last=snapshots.filter(r=>r.date<=end).sort((a,b)=>b.date.localeCompare(a.date)).at(0);
  const live=scope.map(c=>c.sharedWalletObservation).filter(o=>o&&String(o.id)===String(w.walletId||w.id)&&o.identity!=='unverified'&&o.observedAt&&iso(o.observedAt.slice(0,10))).sort((a,b)=>b.observedAt.localeCompare(a.observedAt)).at(0);
  return {id:w.id,name:w.name,broker:w.broker||'未归属服务商',opening:before?cents(before.balance):null,openingDate:before?.date||null,closing:last?cents(last.balance):null,closingDate:last?.date||null,observedBalance:live?cents(live.balance):null,observedAt:live?.observedAt||null,
   status:'待核验',reason:'共享钱包只列一次；当前台账缺少按钱包归属的完整入出账，不能按账户重复累计或强行配平'};
 });
 const brokers=[...group(accounts,a=>a.broker)].map(([broker,rows])=>({broker,accounts:rows.length,spend:add(rows.map(a=>a.spend)),finance:add(rows.map(a=>a.finance)),difference:add(rows.map(a=>a.difference)),balanceDifference:add(rows.map(a=>a.balanceDifference)),status:rows.some(a=>a.status==='差额')?'差额':rows.some(a=>a.status==='待核验')?'待核验':'已核对'}));
 const knownAccounts=new Set(campaigns.map(campaignKey));
 const unmapped=raw.filter(r=>['records','financeRecords'].includes(r.kind)&&inRange(r,start,end)&&!knownAccounts.has(accountKey(r))).map(r=>({id:r.id,date:r.date,kind:r.kind,advertiserId:r.advertiserId||null,reason:'未映射账户，不参与合计，待确认归属'}));
 const model={generatedAt,fetchedAt:options.fetchedAt||generatedAt,version:options.version||null,start,end,unmapped,filters:{platform:options.platform||'全部平台',broker:options.broker||'全部服务商',search:search||null},searchExpandedToAccount:!!search,
  accounts,daily,brokers,recharges:rechargeRows,wallets:walletRows,
  summary:{accounts:accounts.length,days:daily.length,matched:daily.filter(r=>r.status==='已核对').length,differences:daily.filter(r=>r.status==='差额').length,pending:daily.filter(r=>r.status==='待核验').length,spend:known(records.map(r=>cents(r.spend))),bankPayments:known(payments.map(r=>cents(r.amount))),rechargeCash:known(credits.filter(r=>r.source!=='auto-balance-jump').map(r=>cents(r.baseAmount))),rechargeGift:known(credits.filter(r=>r.source!=='auto-balance-jump').map(r=>cents(r.rebateAmount))),unassigned:rechargeRows.filter(r=>r.account==='未分配账户').length},
  latestAdDate:records.map(r=>r.date).sort().at(-1)||null,latestFinanceDate:finances.map(r=>r.date).sort().at(-1)||null,
  notes:['实时指点击时读取最新已回传数据，不代表尚未采集或未出日结的数据已经齐全。','账户余额公式：期末 = 期初 + 总存入（现金 + 赠款）+ 总转入 − 总转出 − 本账户余额总消耗。共享钱包独立核验，避免重复累计。','消耗核对：广告消耗与本账户余额消耗 + 共享钱包消耗对比；出现共享赠款或红包时保留分项，口径未确认不强算。','银行付款、充值台账、日结存入分别列示，付款生成的充值不重复相加；未分配记录不猜测归属。','缺少记录、金额、独立期初或当前日结均为待核验；差额使用整数分计算，不把缺失补零。']};
 model.providers=buildProviderSummary(raw,model,options,cents);return model;
}

export async function consistentSnapshot(getVersion,getRows){
 for(let attempt=0;attempt<2;attempt++){const before=await getVersion(),rows=await getRows(),after=await getVersion();if(JSON.stringify(before)===JSON.stringify(after))return {rows,version:after,fetchedAt:new Date().toISOString()};}
 throw Error('数据正在回传，两次读取版本均有变化，请稍后重新生成；未使用旧缓存生成报告');
}
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number.isSafeInteger(v)?new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(v/100):'—';
const localTime=t=>t?new Date(t).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'—';
const table=(headers,rows)=>`<div class="recon-table"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">当前范围没有对应记录</td></tr>`}</tbody></table></div>`;
export function renderReconciliation(m){return renderProviderSummary(m,{esc,money,localTime,table});}
const legacyReportStyles=`.recon-dialog{width:min(1450px,96vw);max-height:94dvh;padding:0;border:1px solid #e5e7ee;border-radius:16px;color:#242733;background:#f6f7fa}.recon-dialog::backdrop{background:rgb(24 20 35 / .48)}.recon-toolbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid #e5e7ee;background:white}.recon-toolbar>div{display:flex;gap:8px;flex-wrap:wrap}.recon-body{padding:24px}.recon-document{font:14px/1.6 'Segoe UI','Microsoft YaHei',sans-serif;color:#242733}.recon-heading h2{font-size:28px;margin:4px 0}.recon-heading p{margin:4px 0;color:#626878}.recon-eyebrow{font-size:12px;color:#7546d9!important;font-weight:700;letter-spacing:.08em}.recon-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:22px 0}.recon-kpis>div{padding:18px;border:1px solid #e5e7ee;border-radius:12px;background:white}.recon-kpis span{display:block;color:#626878;font-size:12px}.recon-kpis strong{display:block;margin-top:10px;font-size:25px;overflow-wrap:anywhere}.recon-notice{padding:18px;border:1px solid #d9ccf1;border-radius:12px;background:#f5f0fd;margin-bottom:18px}.recon-notice p{margin:8px 0 0}.recon-document details{margin:14px 0;border:1px solid #e5e7ee;border-radius:12px;background:white;overflow:hidden}.recon-document summary{padding:16px 18px;font-weight:650;cursor:pointer}.recon-document details>p,.recon-document details>ul{margin:0;padding:0 24px 20px}.recon-table{max-height:460px;overflow:auto}.recon-table table{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap}.recon-table th{position:sticky;top:0;background:#f5f6fa;text-align:left;font-weight:600}.recon-table th,.recon-table td{padding:12px 14px;border-bottom:1px solid #eef0f5}.recon-table td:last-child{max-width:480px;white-space:normal;min-width:160px}.recon-table tbody tr:hover{background:#fbf9ff}@media(max-width:700px){.recon-body{padding:14px}.recon-toolbar{padding:12px;align-items:flex-start}.recon-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.recon-kpis strong{font-size:20px}.recon-heading h2{font-size:24px}}@media print{body>:not(.recon-dialog[open]){display:none!important}.recon-dialog[open]{position:static;width:100%;max-width:none;max-height:none;border:0;overflow:visible}.recon-toolbar{display:none}.recon-body{padding:0}.recon-table{max-height:none;overflow:visible}.recon-document details{break-inside:auto}.recon-document details:not([open])>:not(summary){display:block}.recon-table th{position:static}.recon-table table{white-space:normal;font-size:9px}.recon-table td:last-child{min-width:0}.recon-kpis{grid-template-columns:repeat(4,1fr)}}`;
export const reportStyles=legacyReportStyles+summaryStyles;
export function reportDocument(model){return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>实时投流对账报告</title><style>body{margin:0;padding:24px;background:#f6f7fa}'+reportStyles+'@media print{body.standalone-report>.recon-document{display:block!important}}</style><body class="standalone-report">'+renderReconciliation(model)+'</body></html>'}
