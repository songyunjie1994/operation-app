// Owner-authorized name-based defaults. These are group numbers, not platform wallet IDs.
const rules=[['tina','01',/^xr-天门优赫生物科技有限公司-雪碧\d*$/,'雪碧XR'],['tina','02',/^YD-优赫生物源头好货站-LZP(?:-\d+)?$/,'LZP'],['tina','03',/^新雪碧\d*$/,'新雪碧'],['tina','04',/^最最最新户-GZ\d*$/,'GZ'],['tes','01',/^ISA MORVAN PTY LTD(?:雪碧)?-聚星\d+$/i,'ISA聚星'],['tes','02',/^TESSMEL ISA海外专卖店-\d+$/,'TESSMEL ISA'],['赫丝','01',/^xr-杭州赫丝提亚国际贸易有限公司\d*$/,'赫丝XR'],['赫丝','02',/^(?:.*\/)?杭州赫丝提亚严选店(?:-cygx\d*)?$/,'赫丝严选店']];
export function defaultWalletGroup(c){const broker=String(c.broker||'').replace(/\s/g,'').toLowerCase(),sub=broker.includes('tina')?'tina':broker.includes('tes')?'tes':broker.includes('赫丝')?'赫丝':null;if(!sub)return null;const n=String(c.name||'').trim(),rule=rules.find(r=>r[0]===sub&&r[2].test(n));if(rule)return {id:'LY-'+(sub==='赫丝'?'HESI':sub.toUpperCase())+'-'+rule[1],name:rule[3],basis:'名称相似默认分组'};return {id:'LY-ACCOUNT-'+String(c.advertiserId||c.id),name:n,basis:'未匹配默认规则，单户待确认'};}
export function walletAccountDetails(c,end,cents){
 const day=t=>t&&Number.isFinite(Date.parse(t))?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date(t)):null;
 const eligible=(o,t)=>o&&day(t)&&day(t)<=end;
 const pages=[c.accountHomeBalances,c.accountFinanceBalances].filter(o=>eligible(o,o?.readAt)&&o.identity==='verified'&&!o.conflict&&String(o.advertiserId)===String(c.advertiserId));
 const account=pages.filter(o=>cents(o.accountBalance)!==null).sort((a,b)=>Date.parse(b.readAt)-Date.parse(a.readAt))[0];
 const shared=pages.filter(o=>cents(o.sharedWalletBalance)!==null).map(o=>({value:cents(o.sharedWalletBalance),at:o.readAt,source:o.sourceKind||'账户页面',walletId:o.sharedWalletId||null}));
 const o=c.sharedWalletObservation;if(eligible(o,o?.observedAt)&&o.identity!=='unverified'&&!o.conflict&&cents(o.balance)!==null)shared.push({value:cents(o.balance),at:o.observedAt,source:o.sourceKind||'历史采集记录',walletId:(o.bindingSource==='page-wallet-id'||!o.bindingSource&&!o.sourceKind&&defaultWalletGroup(c)?.basis!=='名称相似默认分组')?o.id:null});
 shared.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));const latest=shared[0],group=defaultWalletGroup(c);return {accountId:String(c.advertiserId||c.id),accountName:c.name,broker:c.broker,group,accountBalance:account?cents(account.accountBalance):null,sharedBalance:latest?.value??null,at:latest?.at||null,source:latest?.source||'无共享余额记录',verifiedWalletId:latest?.walletId||null};
}
export function groupedWallets(cs,end,cents){const rows=cs.map(c=>walletAccountDetails(c,end,cents)),groups=new Map();for(const row of rows){const id=row.verifiedWalletId?'platform:'+row.verifiedWalletId:row.group?.id;if(!id)continue;const g=groups.get(id)||{id,name:row.group?.name||id,basis:row.verifiedWalletId?'页面钱包ID':'名称相似默认分组',members:[],value:null,at:null};g.members.push(row);groups.set(id,g);}for(const g of groups.values()){const values=[...new Set(g.members.map(x=>x.sharedBalance).filter(Number.isSafeInteger))];g.conflict=!g.id.startsWith('platform:')&&values.length>1;g.value=g.id.startsWith('platform:')?g.members.filter(x=>x.sharedBalance!==null).sort((a,b)=>String(b.at).localeCompare(String(a.at)))[0]?.sharedBalance??null:values.length===1?values[0]:null;g.at=g.members.map(x=>x.at).filter(Boolean).sort().at(-1)||null;g.incomplete=g.members.some(x=>x.sharedBalance===null);}return {rows,wallets:[...groups.values()]};}
export function reverseYesterdayWallet(current,members,finances,today,cents,missingAsZero=false,records=[]){
 if(!Number.isSafeInteger(current?.value)||!members.length)return {value:null,reason:'缺少当前共享余额'};
 if(!current.at||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date(current.at))!==today)return {value:null,reason:'当前共享余额不是当天快照'};
 const sums=[];let defaulted=false,estimated=false;for(const id of members){const rows=finances.filter(f=>String(f.advertiserId)===String(id)&&f.date===today);const values=[...new Set(rows.map(f=>cents(f.columns?.['共享钱包消耗(元)'])))];if(values.length>1)return {value:null,reason:'当天共享消耗记录冲突'};if(values.length===1&&values[0]!==null){sums.push(values[0]);continue;}
  // 当天财务日结尚未生成时，用当天全域投流消耗暂估共享钱包消耗；只取全域，不把乘方计入共享钱包。
  const sameDay=records.filter(r=>String(r.advertiserId)===String(id)&&r.date===today),globals=sameDay.map(r=>cents(r.spendBreakdown?.global)).filter(Number.isSafeInteger);
  if(globals.length){sums.push(globals.reduce((a,b)=>a+b,0));estimated=true;continue;}
  if(!missingAsZero)return {value:null,reason:'缺少当天共享钱包消耗，不能用投流总消耗代替'};
  sums.push(0);defaulted=true;}
 const spent=sums.reduce((a,b)=>a+b,0);return {value:current.value+spent,current:current.value,todaySharedSpend:spent,defaulted,estimated,reason:defaulted?'反推昨日余额：缺少当天共享消耗暂按0（用户指定）':estimated?'反推昨日余额：当天财务未出，暂用当天全域投流消耗':'当前余额＋当天共享消耗反推；当天资金变动待核验'};
}
