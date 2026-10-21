import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const local = new URL('../public/inventory.js', import.meta.url);
const script = fs.existsSync(local) ? local : new URL('../../../public/ops/inventory.js', import.meta.url);
const context = {window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('inventory-name-map.js',script),'utf8'), context);
vm.runInContext(fs.readFileSync(script,'utf8'), context);
const stock = context.window.OPS_INVENTORY;
const shops = new Map([['a',{shop_name:'甲店',platform:'douyin'}],['b',{shop_name:'乙店',platform:'douyin'}],['k',{shop_name:'快手店',platform:'kuaishou'}]]);
const item = (code,available,extra={}) => ({name:'原始货品 '+code,code,available,allocated:2,defective:1,warehouse:'保税仓',...extra});
const snapshot = (shop_key,items,extra={}) => ({shop_key,captured_at:'2026-10-21T00:00:00Z',items,summary:{total:items.length,status:'success',truncated:false},...extra});

test('existing product code map wins over keywords and known codes share a product',()=>{
  assert.equal(stock.identify({code:'MBWNEW',name:'麦角硫因'}).name,'美白');
  assert.equal(stock.identify({code:'NEW',name:'麦角硫因胶囊'}).name,'麦角');
  const model=stock.build([snapshot('a',[item('BEERGO30',10),item('BEERGO30-02',20)]),snapshot('b',[item('BEERGO30-03',7)])],shops);
  assert.equal(model.groups.length,1);
  assert.equal(model.groups[0].product.name,'麦角');
  assert.equal(model.groups[0].totals.available.value,37);
  assert.equal(model.groups[0].totals.allocated.value,6);
  assert.equal(model.groups[0].totals.defective.value,3);
  assert.equal(model.groups[0].shops,2);
});

test('latest snapshot per shop is counted once; platform and mapped product searches apply before summing',()=>{
  const snapshots=[snapshot('a',[item('BEERGO30',999)],{captured_at:'2026-10-19T00:00:00Z'}),snapshot('a',[item('BEERGO30',10)]),snapshot('b',[item('MBWNEW',20)]),snapshot('k',[item('BEERGO30',300)])];
  const model=stock.build(snapshots,shops,{platform:'douyin',search:'麦角'});
  assert.equal(model.items.length,1);
  assert.equal(model.totals.available.value,10);
  assert.equal(stock.build(snapshots,shops,{search:'乙店'}).totals.available.value,20);
});

test('unknown quantities stay unknown and partial sums disclose missing records',()=>{
  const model=stock.build([snapshot('a',[item('BEERGO30',null),item('BEERGO30-02',8)])],shops);
  assert.equal(model.totals.available.value,8);
  assert.equal(model.totals.available.missing,1);
  assert.equal(stock.formatTotal(model.totals.available),'8 + 未知');
  const unknown=stock.total([{available:null},{available:undefined}],'available');
  assert.equal(unknown.value,null);
  assert.equal(stock.formatTotal(unknown),'—');
});

test('unknown codes keep source names and separate identities; no guessed product match',()=>{
  const model=stock.build([snapshot('a',[item('unknown-1',3,{name:'待确认原名 30粒/盒'}),item('unknown-2',5,{name:'待确认原名 30粒/盒'})])],shops);
  assert.equal(model.groups.length,2);
  assert.equal(model.unmatched,2);
  assert.ok(model.groups.every(group=>!group.product.matched&&group.product.name==='待确认原名 30粒/盒'));
});

test('only confirmed all-zero products are hidden; allocated, defective and unknown values remain visible',()=>{
  const snapshots=[snapshot('a',[item('BEERGO30',0,{allocated:0,defective:0}),item('MBWNEW',0,{allocated:3,defective:0}),item('VFLB90NEW0112',0,{allocated:0,defective:2}),item('VFCC300222',null,{allocated:0,defective:0})])];
  const model=stock.build(snapshots,shops);
  assert.equal(model.hiddenProducts,1);
  assert.equal(model.groups.length,3);
  assert.equal(stock.build(snapshots,shops,{showZero:true}).groups.length,4);
});

test('incomplete snapshots and confirmed-empty shops have distinct coverage',()=>{
  const model=stock.build([snapshot('a',[],{summary:{total:0,status:'success',truncated:false}}),snapshot('b',[item('BEERGO30',1)],{summary:{total:10,status:'success',truncated:true}})],shops);
  assert.equal(model.confirmedEmpty,1);
  assert.equal(model.incomplete,1);
  assert.equal(model.snapshotCount,2);
});

test('product drilldown restricts store data and escapes names, codes and original source fields',()=>{
  const snapshots=[snapshot('a',[item('BEERGO30',10,{name:'<script>unsafe</script>'}),item('MBWNEW',30)]),snapshot('b',[item('BEERGO30',8)])];
  const model=stock.build(snapshots,shops),chosen='mapped:麦角';
  const html=stock.storeCards(model,chosen);
  assert.match(html,/分店铺库存 · 麦角/);
  assert.match(html,/甲店/);assert.match(html,/乙店/);
  assert.ok(!html.includes('美白'));
  assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
  assert.ok(!html.includes('<script>unsafe</script>'));
  assert.match(html,/class="stock-store" open/);
  assert.match(stock.productTable(model,chosen),/aria-pressed="true"/);
});
