export function shopDailyDetails(records,shopKey,startDate,endDate){
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const nextDay=d=>new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 const source=records.filter(r=>r.shop_key===shopKey&&r.start_date===startDate);
 const end=endDate||source.map(r=>r.end_date).sort().at(-1);
 const downloads=source.filter(r=>Array.isArray(r.daily_rows)&&r.daily_rows.length);
 if(downloads.length){
  const days=new Map();
  for(const r of downloads)for(const d of r.daily_rows){
   if(!/^\d{4}-\d\d-\d\d$/.test(d.date)||d.date<startDate||d.date>end||d.date<r.start_date||d.date>r.end_date)continue;
   const old=days.get(d.date);if(old&&old.captured>=r.captured_at)continue;
   const gross=finite(d.grossCents)?d.grossCents:null,refund=finite(d.refundPaymentCents)?d.refundPaymentCents:null;
   days.set(d.date,{date:d.date,gross,refund,net:gross!==null&&refund!==null?gross-refund:null,captured:r.captured_at});
  }
  const missing=[];for(let d=startDate;d&&end&&d<=end;d=nextDay(d))if(!days.has(d))missing.push(d);
  return {mode:'download',rows:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),missing};
 }
 const byEnd=new Map();
 for(const r of source.filter(r=>!end||r.end_date<=end)){const old=byEnd.get(r.end_date);if(!old||r.captured_at>old.captured_at)byEnd.set(r.end_date,r);}
 const out=[];let prev=null;
 for(const r of [...byEnd.values()].sort((a,b)=>a.end_date.localeCompare(b.end_date))){
  const from=prev?nextDay(prev.end_date):r.start_date;
  if(from<=r.end_date){
   const gross=finite(r.gross_cents)&&(!prev||finite(prev.gross_cents))?r.gross_cents-(prev?.gross_cents??0):null;
   const refund=finite(r.refund_payment_cents)&&(!prev||finite(prev.refund_payment_cents))?r.refund_payment_cents-(prev?.refund_payment_cents??0):null;
   out.push({date:from===r.end_date?from:from+' ~ '+r.end_date,gross,refund,net:gross!==null&&refund!==null?gross-refund:null,captured:r.captured_at});
  }
  prev=r;
 }
 return {mode:'snapshot',rows:out,missing:[]};
}
