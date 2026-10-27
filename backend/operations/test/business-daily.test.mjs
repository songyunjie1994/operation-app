import test from 'node:test';
import assert from 'node:assert/strict';
import {shopDailyDetails} from '../../../public/ops/business-daily.mjs';
const base={shop_key:'s',start_date:'2026-10-01',end_date:'2026-10-02',captured_at:'2026-10-27T13:00:00Z',gross_cents:100,refund_payment_cents:200};
const downloaded={...base,daily_rows:[{date:'2026-10-01',grossCents:100,refundPaymentCents:0},{date:'2026-10-02',grossCents:0,refundPaymentCents:200}]};
test('downloaded real days replace historical cumulative differences and same-day retransmissions do not duplicate',()=>{
 const result=shopDailyDetails([{...base,end_date:'2026-10-01',gross_cents:99999},downloaded,{...downloaded,id:'duplicate'}],'s',base.start_date,base.end_date);
 assert.equal(result.mode,'download');assert.equal(result.rows.length,2);assert.deepEqual(result.rows.map(r=>[r.date,r.gross,r.refund,r.net]),[['2026-10-01',100,0,100],['2026-10-02',0,200,-200]]);assert.deepEqual(result.missing,[]);
});
test('selected period and shop restrict exact daily rows; newer collection wins per date',()=>{
 const result=shopDailyDetails([downloaded,{...downloaded,shop_key:'other'}, {...downloaded,captured_at:'2026-10-27T14:00:00Z',daily_rows:[{date:'2026-10-01',grossCents:300,refundPaymentCents:0}]}],'s',base.start_date,'2026-10-01');
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].gross,300);
});
test('missing actual dates stay missing instead of using cumulative estimates or inventing zeros',()=>{
 const result=shopDailyDetails([{...base,end_date:'2026-10-03'},downloaded],'s',base.start_date,'2026-10-03');
 assert.equal(result.rows.length,2);assert.deepEqual(result.missing,['2026-10-03']);
 const nulls=shopDailyDetails([{...downloaded,daily_rows:[{date:'2026-10-01',grossCents:null,refundPaymentCents:0}]}],'s',base.start_date,base.end_date);
 assert.equal(nulls.rows[0].gross,null);assert.equal(nulls.rows[0].net,null);
});
test('shops without downloads retain explicitly identified historical period differences',()=>{
 const result=shopDailyDetails([base],'s',base.start_date,base.end_date);
 assert.equal(result.mode,'snapshot');assert.equal(result.rows[0].date,'2026-10-01 ~ 2026-10-02');assert.equal(result.rows[0].net,-100);
});
