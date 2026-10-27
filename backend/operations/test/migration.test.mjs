import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,canonical,timestamp,business,dailyBusiness,shop,buildAccount,buildTraffic,accountFunds} from '../src/migration.mjs';
const source='a'.repeat(64);
const metric={shopName:'测试店',startDate:'2026-10-01',endDate:'2026-10-20',grossCents:12345,refundPaymentCents:2000,netCents:10345,capturedAt:'2026-10-21 05:00:00'};
test('canonical hashes ignore property order and preserve array order',()=>{assert.equal(hash({a:1,b:null}),hash({b:null,a:1}));assert.notEqual(hash([1,2]),hash([2,1]));assert.notEqual(hash(null),hash(0))});
test('source local time is interpreted as Beijing, ambiguous timestamps are rejected',()=>{assert.equal(timestamp('2026-10-21 05:00:00'),'2026-10-20T21:00:00.000Z');assert.throws(()=>timestamp('2026-10-21T05:00:00'))});
test('platform identities never merge a same-name shop across platforms',()=>assert.notEqual(shop('douyin','测试店').shop_key,shop('kuaishou','测试店').shop_key));
test('business nulls remain null and net is never fabricated',()=>{const r=business({...metric,grossCents:null,netCents:null},'douyin',source);assert.equal(r.gross_cents,null);assert.equal(r.net_cents,null);assert.equal(business({...metric,grossCents:0,refundPaymentCents:0,netCents:0},'douyin',source).net_cents,0)});
test('requested and actual dates stay distinct',()=>{const r=business({...metric,requestedEndDate:'2026-10-21'},'douyin',source);assert.equal(r.end_date,'2026-10-20');assert.equal(r.requested_end_date,'2026-10-21');assert.throws(()=>business({...metric,requestedEndDate:'2026-10-19'},'douyin',source))});
test('invalid dates, unsafe money, undefined money and inconsistent net are rejected',()=>{for(const patch of [{endDate:'2026-10-32'},{grossCents:Number.MAX_SAFE_INTEGER+1},{grossCents:undefined},{netCents:0}])assert.throws(()=>business({...metric,...patch},'douyin',source))});
test('account capture time does not advance when business snapshot is refreshed',()=>{const result=buildAccount({updatedAt:'2026-10-21 10:00:00',stores:{测试店:{goods:{},collection:{collectedAt:'2026-10-21 05:00:00'}}}},source);assert.equal(result.accounts[0].captured_at,'2026-10-20T21:00:00.000Z')});
test('account money is null when absent and bank details stay outside financial payload',()=>{const funds=accountFunds({goods:{usd:{withdrawable:0,bankAccount:'private'}}});assert.equal(funds.goods.usd.withdrawable,0);assert.equal(funds.goods.usd.withdrawing,null);assert.ok(!canonical(funds).includes('private'))});
test('incomplete inventory and numeric long IDs cannot silently pass',()=>{const base={updatedAt:'2026-10-21 05:00:00',stores:{测试店:{inventory:{items:[],total:2,count:0}}}};assert.throws(()=>buildAccount(base,source));base.stores.测试店.inventory={items:[{cargoId:123}],total:1,count:1};assert.throws(()=>buildAccount(base,source))});
test('traffic rows retain string IDs and nulls and reject demo or duplicate identities',()=>{const d={campaigns:[{id:'1',advertiserId:'18700000000000000001'}],records:[{id:'r',revenue:null}],recharges:[]};const r=buildTraffic(d,source,'2026-10-20T00:00:00Z');assert.equal(r.rows[0].payload.advertiserId,'18700000000000000001');assert.equal(r.rows[1].payload.revenue,null);assert.throws(()=>buildTraffic({...d,demo:true},source,'2026-10-20T00:00:00Z'));assert.throws(()=>buildTraffic({...d,records:[{id:'a'},{id:'a'}]},source,'2026-10-20T00:00:00Z'))});

const dailyMetric={...metric,endDate:'2026-10-02',grossCents:123,refundPaymentCents:223,netCents:-100,sourceHash:source,sourceKind:'compass_download_all_unlimited',sourceFilter:{carrier:'全部',placement:'不限'},dailyRows:[
 {date:'2026-10-01',grossCents:123,refundPaymentCents:23,netCents:100,sourceRow:9},
 {date:'2026-10-02',grossCents:0,refundPaymentCents:200,netCents:-200,sourceRow:8}]};
test('daily ingestion retains workbook days including zero and negative net without changing monthly identities',()=>{
 const rows=dailyBusiness(dailyMetric,'douyin');assert.equal(rows.length,2);assert.equal(rows[1].netCents,-200);
 const normalized=buildAccount({updatedAt:metric.capturedAt,stores:{测试店:{business:[dailyMetric]}}},source);
 assert.equal(normalized.business[0].id,business({...dailyMetric,dailyRows:undefined},'douyin',source).id);
 assert.deepEqual(normalized.daily[0],{id:normalized.business[0].id,platform_source_hash:source,daily_rows:rows});
 assert.equal(dailyBusiness(metric,'douyin'),null);
});
test('daily ingestion rejects missing dates, duplicate dates, wrong source filters and period-total mismatches',()=>{
 for(const patch of [{dailyRows:dailyMetric.dailyRows.slice(0,1)},{dailyRows:[dailyMetric.dailyRows[0],dailyMetric.dailyRows[0]]},
  {dailyRows:[dailyMetric.dailyRows[0],{...dailyMetric.dailyRows[1],grossCents:null}]},
  {sourceKind:'page'},{sourceFilter:{carrier:'直播',placement:'不限'}},{grossCents:124},{requestedEndDate:'2026-10-03'}])
   assert.throws(()=>dailyBusiness({...dailyMetric,...patch},'douyin'));
 assert.throws(()=>dailyBusiness(dailyMetric,'kuaishou'));
});
