import {createHash} from 'node:crypto';

export const canonical = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
};
export const hash = value => createHash('sha256').update(typeof value==='string'?value:canonical(value)).digest('hex');
const requireValue=(condition,message)=>{if(!condition)throw new Error(message)};
export function timestamp(value) {
  requireValue(typeof value==='string' && value.length>0,'Missing source capture time');
  const input=/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)?value.replace(' ','T')+'+08:00':value;
  requireValue(/(Z|[+-]\d\d:\d\d)$/.test(input)&&Number.isFinite(Date.parse(input)),'Ambiguous or invalid capture time');
  return new Date(input).toISOString();
}
export function date(value) {
  requireValue(typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value,'Invalid business date');
  return value;
}
export const cents = value => {
  requireValue(value===null || (Number.isSafeInteger(value)&&value>=0),'Invalid source money; unknown values must be explicit null');
  return value;
};
export function shop(platform,name) {
  requireValue(['douyin','kuaishou'].includes(platform)&&typeof name==='string'&&name.trim().length>0,'Invalid shop identity');
  return {shop_key:hash(platform+'\0'+name),platform,shop_name:name,platform_shop_id:null,identity_basis:'source_shop_name_provisional'};
}
const numeric = n => typeof n==='number'&&Number.isFinite(n)?n:null;
const fields=(source,keys)=>Object.fromEntries(keys.map(k=>[k,numeric(source?.[k])]));
export function accountFunds(store) {
  const goods=Object.fromEntries(['usd','rmb'].map(currency=>[currency,store.goods?.[currency]?fields(store.goods[currency],['withdrawable','withdrawing','frozen']):null]));
  return {goods,deposit:fields(store.deposit,['baseBalance','baseDue','expBalance','expDue']),pending:fields(store.pending,['toExchange','toSettle']),supply:{masked:!!store.supply?.masked,debt:numeric(store.supply?.debt)}};
}
export function business(record,platform,sourceHash) {
  const identity=shop(platform,record.shopName),start=date(record.startDate),end=date(record.endDate);
  requireValue(end>=start&&(Date.parse(end)-Date.parse(start))<31*86400000,'Invalid business period');
  const requested=record.requestedEndDate==null?null:date(record.requestedEndDate);
  requireValue(!requested||requested>=end,'Requested end predates actual end');
  const gross=cents(record.grossCents),refund=cents(record.refundPaymentCents);
  const net=platform==='douyin'&&gross!==null&&refund!==null?gross-refund:null;
  if(platform==='douyin'&&Object.hasOwn(record,'netCents'))requireValue(record.netCents===net,'Source net does not match gross minus payment refund');
  const row={shop_key:identity.shop_key,platform,start_date:start,end_date:end,requested_end_date:requested,gross_cents:gross,refund_payment_cents:refund,net_cents:net,captured_at:timestamp(record.capturedAt),source_hash:sourceHash,platform_source_hash:record.sourceHash??null,refund_metric:platform==='kuaishou'?'refund_by_payment_day':'refund_by_payment_time'};
  return {...row,id:hash(row)};
}
export function buildAccount(snapshot,sourceHash) {
  requireValue(snapshot&&typeof snapshot.stores==='object'&&!Array.isArray(snapshot.stores),'Invalid account snapshot');
  const shops=[],accounts=[],inventories=[],metrics=[];
  for(const [name,store] of Object.entries(snapshot.stores)){
    const identity=shop('douyin',name);shops.push(identity);
    const rawCapture=store.collection?.collectedAt||snapshot.updatedAt;
    const capturedAt=timestamp(rawCapture);
    const row={shop_key:identity.shop_key,captured_at:capturedAt,capture_time_basis:store.collection?.collectedAt?'store.collection.collectedAt':'snapshot.updatedAt_fallback',funds:accountFunds(store),collection:store.collection??{},source_hash:sourceHash};
    accounts.push({...row,id:hash(row)});
    if(store.inventory){
      const inv=store.inventory;
      requireValue(Array.isArray(inv.items),'Inventory items missing; do not convert failure to empty inventory');
      const inventoryTime=store.collection?.inventoryCollectedAt||rawCapture;
      requireValue(inv.items.every(item=>!item.cargoId||typeof item.cargoId==='string'),'Cargo ID must remain a string');
      const record={shop_key:identity.shop_key,captured_at:timestamp(inventoryTime),summary:{count:inv.count??null,total:inv.total??null,truncated:!!inv.truncated,stockoutRatio:inv.stockoutRatio??null,status:store.collection?.inventoryStatus??null},items:inv.items,source_hash:sourceHash};
      requireValue(record.summary.count===null||record.summary.count===inv.items.length,'Inventory count does not match rows');
      if(!record.summary.truncated&&record.summary.total!==null)requireValue(record.summary.total===inv.items.length,'Incomplete inventory pagination');
      inventories.push({...record,id:hash(record)});
    }
    for(const r of store.business??[])metrics.push(business(r,'douyin',sourceHash));
  }
  for(const r of snapshot.platforms?.kuaishou?.business??[]){shops.push(shop('kuaishou',r.shopName));metrics.push(business(r,'kuaishou',sourceHash))}
  return {shops:[...new Map(shops.map(s=>[s.shop_key,s])).values()],accounts,inventories,business:metrics};
}
export function buildTraffic(document,sourceHash,backedUpAt) {
  let data=document.data??document;if(typeof data==='string')data=JSON.parse(data);
  requireValue(data.demo!==true&&Array.isArray(data.campaigns)&&Array.isArray(data.records)&&Array.isArray(data.recharges),'Not a production traffic snapshot');
  const collections=['campaigns','recharges','records','financeRecords','wallets','walletSnapshots'];
  const rows=[];
  for(const kind of collections){
    const items=data[kind]??[];requireValue(Array.isArray(items),'Unexpected traffic collection '+kind);
    const seen=new Set();
    for(const [ordinal,item] of items.entries()){
      if(item.advertiserId!==undefined)requireValue(typeof item.advertiserId==='string','Advertiser ID must remain a string');
      const sourceKey=String(item.id??hash(item));
      requireValue(!seen.has(sourceKey),'Duplicate traffic identity in '+kind);seen.add(sourceKey);
      rows.push({id:hash([sourceHash,kind,sourceKey]),kind,source_key:sourceKey,ordinal,payload:item,source_hash:sourceHash});
    }
  }
  return {baseline:{id:sourceHash,source_hash:sourceHash,backed_up_at:timestamp(backedUpAt),freshness:'historical_local_backup_pending_source_recovery',data},rows};
}
