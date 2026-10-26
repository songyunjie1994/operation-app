const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>'¥'+new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const stamp=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value));

export function consumptionPreviews(campaigns,{start,end,selected,broker,search='',matchesPlatform=()=>true,now=new Date().toISOString()}={}){
 const today=day(now),out=[];
 for(const campaign of campaigns){
  if(!matchesPlatform(campaign)||(selected&&campaign.id!==selected)||(broker&&campaign.broker!==broker))continue;
  for(const preview of campaign.consumptionPreviews??[]){
   if(preview.status!=='provisional'||preview.scope!=='global-product'||(start&&preview.date<start)||(end&&preview.date>end))continue;
   if(![preview.spend,preview.productSpend,preview.douyinSpend,preview.difference].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)
     ||!Number.isFinite(Date.parse(preview.observedAt))||![preview.productReadAt,preview.douyinReadAt].every(t=>Number.isFinite(Date.parse(t))))continue;
   const identities=(preview.sources?.douyin?.details??[]).map(r=>r.douyinName+' '+r.douyinNumber).join(' ');
   if(search&&![campaign.name,campaign.broker,campaign.advertiserId,identities].join(' ').toLowerCase().includes(search.toLowerCase()))continue;
   out.push({campaign,preview,expired:preview.date!==today});
  }
 }
 return out.sort((a,b)=>b.preview.date.localeCompare(a.preview.date)||String(a.campaign.id).localeCompare(String(b.campaign.id)));
}

export function renderConsumptionPreviews(rows){
 if(!rows.length)return '';
 return `<div class="preview-heading"><strong>暂估消耗 · 待复核</strong><span>${rows.length} 个账户日期</span></div><p>以下仅为推商品消耗暂估，未计入正式消耗、成交金额及 ROI。后续采集核验通过后更新正式数据。</p>${rows.map(({campaign,preview:p,expired})=>`<details><summary><span class="preview-state">${expired?'暂估已过期 · 待复核':'当日暂估 · 待复核'}</span> ${escape(p.date)} · ${escape(campaign.name||campaign.advertiserId)} · 推商品 ${escape(money(p.spend))}</summary><dl><div><dt>商品报表</dt><dd>${escape(money(p.productSpend))} <small>${escape(stamp(p.productReadAt))}</small></dd></div><div><dt>抖音号报表</dt><dd>${escape(money(p.douyinSpend))} <small>${escape(stamp(p.douyinReadAt))}</small></dd></div><div><dt>差额</dt><dd>${escape(money(p.difference))}</dd></div></dl><p>${expired?'这是之前保存的暂估值，仍待复核，不能作为最终消耗。':'两份完整报表重读后仍有小差额，暂取较高消耗供参考。'} 两边原始数据和读取时间已保留。</p></details>`).join('')}`;
}
