import test from 'node:test';
import assert from 'node:assert/strict';
import {cents,buildReconciliation,consistentSnapshot,renderReconciliation,reportDocument} from '../public/ops/reconciliation.mjs';
const campaign=(id='a',broker='服务商甲')=>({kind:'campaigns',id,advertiserId:id,name:'账户'+id,broker,platform:'千川'});
const ad=(date='2026-10-01',spend=15,extra={})=>({kind:'records',id:'ad-'+date,campaignId:'a',advertiserId:'a',date,spend,douyinName:'达人甲',douyinNumber:'123',...extra});
const fin=(date='2026-10-01',extra={})=>({kind:'financeRecords',id:'fin-'+date,campaignId:'a',advertiserId:'a',date,balanceTotalSpend:10,nonGrantSpend:8,giftSpend:2,columns:{'总余额(元)':'140.00','总存入(元)':'50.00','现金存入(元)':'50.00','赠款存入(元)':'0.00','总转入(元)':'0.00','总转出(元)':'0.00','共享钱包消耗(元)':'5.00','共享赠款消耗':'0.00','消返红包消耗(元)':'0.00','立减红包消耗(元)':'0.00'},...extra});
const opts={start:'2026-10-01',end:'2026-10-01',generatedAt:'2026-10-25T02:00:00Z'};
test('amount parsing preserves missing fields and exact integer cents',()=>{
 assert.equal(cents('￥1,234.56'),123456);assert.equal(cents('-10.01'),-1001);assert.equal(cents(0.1+0.2),30);
 for(const v of [null,undefined,'','—','--',false,NaN,'12abc','0.001'])assert.equal(cents(v),null);
});
test('own balance spend includes gift only once and shared spending stays independent',()=>{
 const m=buildReconciliation([campaign(),ad(),fin()],opts);assert.equal(m.daily[0].finance,1500);assert.equal(m.daily[0].difference,0);assert.equal(m.daily[0].status,'已核对');
});
test('known daily mismatch is reported to the cent, not hidden by rounding',()=>{
 const m=buildReconciliation([campaign(),ad(undefined,14.79),fin()],opts);assert.equal(m.daily[0].difference,-21);assert.equal(m.daily[0].status,'差额');
});
test('missing daily finance is pending rather than a zero or an assumed collection failure',()=>{
 const m=buildReconciliation([campaign(),ad(undefined,0)],opts);assert.equal(m.daily[0].finance,null);assert.equal(m.daily[0].status,'待核验');assert.match(m.daily[0].issues.join(),/待过账或核验采集/);
});
test('a missing shared field or alternative funding prevents a false match',()=>{
 const f=fin();delete f.columns['共享钱包消耗(元)'];let m=buildReconciliation([campaign(),ad(),f],opts);assert.equal(m.daily[0].finance,null);
 f.columns['共享钱包消耗(元)']='5.00';f.columns['共享赠款消耗']='1.00';m=buildReconciliation([campaign(),ad(),f],opts);assert.equal(m.daily[0].status,'待核验');assert.equal(m.daily[0].finance,null);
});
test('balance formula uses own spend, not the shared amount; independent prior close can verify it',()=>{
 const p=fin('2026-09-30');p.columns['总余额(元)']='100.00';
 const credit={kind:'recharges',id:'deposit1',date:'2026-10-01',campaignId:'a',advertiserId:'a',recordType:'recharge',status:'已充值',baseAmount:50,rebateAmount:0,amount:50};
 const m=buildReconciliation([campaign(),ad(),p,fin(),credit],opts),r=m.accounts[0];
 assert.equal(r.opening,10000);assert.equal(r.expectedClosing,14000);assert.equal(r.balanceDifference,0);assert.equal(r.status,'已核对');
});
test('reverse calculated opening is disclosed and never becomes independent verification',()=>{
 const r=buildReconciliation([campaign(),ad(),fin()],opts).accounts[0];assert.equal(r.opening,10000);assert.equal(r.balanceDifference,0);assert.equal(r.openingBasis,'首日期初反推');assert.equal(r.status,'待核验');
});
test('total deposits are not silently labelled cash or grants',()=>{
 const f=fin();delete f.columns['现金存入(元)'];delete f.columns['赠款存入(元)'];const r=buildReconciliation([campaign(),ad(),f],opts).accounts[0];assert.equal(r.deposit,5000);assert.equal(r.cash,null);assert.equal(r.giftDeposit,null);assert.match(r.warnings.join(),/不把总存入当作现金/);
});
test('real-time default includes today while unposted closing dates stay pending',()=>{
 const m=buildReconciliation([campaign(),ad('2026-10-24'),fin('2026-10-24')],{generatedAt:opts.generatedAt});assert.equal(m.start,'2026-09-01');assert.equal(m.end,'2026-10-25');assert.equal(m.accounts[0].closingDate,'2026-10-24');assert.match(m.accounts[0].warnings.join(),/不能当作实时余额/);
});
test('September report default is fixed while explicit user dates remain respected',()=>{assert.equal(buildReconciliation([],{generatedAt:'2026-11-02T00:00:00Z'}).start,'2026-09-01');assert.equal(buildReconciliation([],{start:'2026-10-03',generatedAt:opts.generatedAt}).start,'2026-10-03');});
test('payment and its generated recharge are separate ledgers; balance jumps are not verified cash',()=>{
 const rows=[campaign(),{kind:'recharges',id:'pay1',date:'2026-10-01',recordType:'payment',amount:100,broker:'服务商甲'},{kind:'recharges',id:'chg1',date:'2026-10-01',recordType:'recharge',amount:101,baseAmount:100,rebateAmount:1,sourcePaymentId:'pay1',source:'auto-from-payment',broker:'服务商甲'},{kind:'recharges',id:'guess',date:'2026-10-01',amount:500,baseAmount:500,source:'auto-balance-jump',broker:'服务商甲'}];
 const m=buildReconciliation(rows,opts);assert.equal(m.summary.bankPayments,10000);assert.equal(m.summary.rechargeCash,10000);assert.equal(m.summary.rechargeGift,100);assert.equal(m.summary.unassigned,3);assert.match(m.recharges[0].issues.join(),/不重复相加/);assert.match(m.recharges[2].issues.join(),/推测/);
});
test('bound cash/grant recharge amounts compare independently with actual finance fields',()=>{
 const credit={kind:'recharges',id:'deposit1',date:'2026-10-01',campaignId:'a',advertiserId:'a',recordType:'recharge',status:'已充值',baseAmount:49,rebateAmount:1,amount:50};
 const r=buildReconciliation([campaign(),ad(),fin(),credit],opts).accounts[0];assert.equal(r.cashDifference,-100);assert.equal(r.giftDifference,100);assert.equal(r.rechargeStatus,'差额');assert.equal(r.status,'差额');
});
test('creator search expands to the whole matching account before finance comparison',()=>{
 const m=buildReconciliation([campaign(),ad(undefined,5),ad(undefined,10,{id:'ad2',douyinName:'达人乙',douyinNumber:'456'}),fin()],{...opts,search:'达人甲'});assert.equal(m.accounts.length,1);assert.equal(m.accounts[0].spend,1500);assert.equal(m.daily[0].difference,0);assert.equal(m.searchExpandedToAccount,true);
});
test('offsetting differences do not make a broker appear reconciled',()=>{
 const f2=fin('2026-10-02'),m=buildReconciliation([campaign(),ad(undefined,16),ad('2026-10-02',14),fin(),f2],{...opts,end:'2026-10-02'});assert.equal(m.brokers[0].difference,0);assert.equal(m.brokers[0].status,'差额');assert.equal(m.summary.differences,2);
});
test('unmapped records are disclosed instead of silently disappearing',()=>{
 const m=buildReconciliation([campaign(),ad(undefined,10,{advertiserId:'unknown',campaignId:'unknown'})],opts);assert.equal(m.unmapped.length,1);assert.match(renderReconciliation(m),/未映射源记录/);
});
test('conflicting finance rows and unsafe text stay visible without executing HTML',()=>{
 const f2=fin(undefined,{id:'other',balanceTotalSpend:11,updatedAt:'2026-10-25T00:00:00Z'}),m=buildReconciliation([{...campaign(),name:'<img src=x onerror=alert(1)>'},ad(),fin(),f2],opts);assert.match(m.daily[0].issues.join(),/冲突/);const html=reportDocument(m);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.match(html,/standalone-report/);
});
test('version bracketing retries one changed read and rejects a continuously changing source',async()=>{
 let reads=0,n=0;const versions=[1,2,2,2];const r=await consistentSnapshot(async()=>versions[n++],async()=>{reads++;return [reads]});assert.equal(reads,2);assert.deepEqual(r.rows,[2]);
 n=0;await assert.rejects(consistentSnapshot(async()=>++n,async()=>[]),/两次读取版本均有变化/);
 await assert.rejects(consistentSnapshot(async()=>1,async()=>{throw Error('offline')}),/offline/);
});
