'use strict';
const BASE='https://mabxdkjqilulkrmqrrgo.supabase.co',KEY='sb_publishable_lfHpd1y1gCaQIDXfRkD_8w_O1bPMWGx',STORAGE='acct-console-session';
const $=id=>document.getElementById(id),label={success:'成功',partial:'部分失败',failed:'失败',skipped:'已跳过',stale:'过期，保留上次数据',queued:'排队中',running:'运行中',done:'完成'};
let session=null,busy=false;
try{session=JSON.parse(localStorage.getItem(STORAGE)||localStorage.getItem('qca-console-session')||'null')}catch{}
function message(s){$('notice').textContent=s||''}
function el(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;return e}
function date(v){if(!v)return '—';if(/Z$|\+\d\d:\d\d$/.test(v))return new Date(v).toLocaleString('zh-CN',{hour12:false});return v}
function num(v){return v==null?'—':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:2})}
async function auth(path,body){const r=await fetch(BASE+'/auth/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.msg||data.error_description||'登录失败');session=data;localStorage.setItem(STORAGE,JSON.stringify(data));return data}
async function api(action,body={}){
 if(!session?.access_token)throw new Error('请先登录');
 if(session.expires_at && session.expires_at*1000<Date.now()+60000)await auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token});
 const r=await fetch(BASE+'/functions/v1/acct-center',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,apikey:KEY},body:JSON.stringify({action,...body})});const data=await r.json();if(!r.ok||!data.ok)throw new Error(r.status===403?'账号未获管理员授权，或登录已失效':data.message||data.error||'请求失败');return data
}
function cells(tr,values){for(const v of values)tr.append(el('td',v));return tr}
function draw(data){
 $('login').classList.add('hidden');$('dashboard').classList.remove('hidden');$('devices').replaceChildren();
 for(const d of data.devices){
  const card=el('section',null,'card'),st=d.status||{},snapshot=data.snapshots.find(s=>s.device_id===d.id),online=d.last_seen_at&&Date.now()-Date.parse(d.last_seen_at)<90000;
  card.append(el('h2',d.name),el('p',`${online?'在线':'离线'} · 版本 ${st.version||'—'} · 心跳 ${date(d.last_seen_at)} · ${st.running?'正在采集':'空闲'} · ${st.sessionPresent?'已保存登录态':'待登录'}`,online?'good':'error'));
  const config=el('div',null,'row'),enabled=el('input');enabled.type='checkbox';enabled.checked=d.enabled;const enableLabel=el('label','开启定时采集 ');enableLabel.append(enabled);
  const interval=el('input');interval.type='number';interval.min=1;interval.max=168;interval.value=d.interval_hours;
  const save=el('button','保存计划'),run=el('button','立即采集');config.append(enableLabel,el('span','每'),interval,el('span','小时'),save,run);card.append(config);
  const applied=d.applied_version===d.config_version;card.append(el('p',`${applied?'计划已应用到采集机':'计划等待采集机应用'} · 下一轮 ${date(st.schedule?.nextRunAt)}${st.schedule?.paused?' · 连续失败，已暂停，请处理后重新保存计划':''}`,'muted'));
  for(const error of [st.lastError,st.cloudError])if(error)card.append(el('p',error,'error'));
  const pending=data.commands.find(c=>c.device_id===d.id&&['queued','running'].includes(c.status));if(pending)card.append(el('p',`远程任务：${label[pending.status]}`,'muted'));
  save.onclick=()=>act(save,()=>api('save_config',{deviceId:d.id,enabled:enabled.checked,intervalHours:Number(interval.value)}));run.onclick=()=>act(run,()=>api('run_now',{deviceId:d.id}));
  card.append(el('p',snapshot?`最近数据回传：${date(snapshot.updated_at)} · ${snapshot.data.storeCount} 家店铺`:'尚无真实采集数据','muted'));
  if(snapshot){
   const table=el('table'),head=el('thead'),tr=el('tr');for(const h of ['店铺','数据状态','采集时间','可提现 USD','可提现 RMB','待结算','基础保证金','库存总数'])tr.append(el('th',h));head.append(tr);table.append(head);const tbody=el('tbody');
   for(const [name,v] of Object.entries(snapshot.data.stores||{}))tbody.append(cells(el('tr'),[name,label[v.collection?.status]||'状态待核验',date(v.collection?.collectedAt),num(v.goods?.usd?.withdrawable),num(v.goods?.rmb?.withdrawable),num(v.pending?.toSettle),num(v.deposit?.baseBalance),num(v.inventory?.total)]));table.append(tbody);const scroll=el('div',null,'scroll');scroll.append(table);card.append(scroll);
   for(const [name,v] of Object.entries(snapshot.data.stores||{})){if(v.inventory?.items?.length){const details=el('details');details.append(el('summary',`${name} · 库存明细 ${v.inventory.items.length} 条${v.collection?.inventoryStatus==='stale'?'（保留旧库存）':''}`));const t=el('table'),th=el('thead');const row=el('tr');for(const h of ['货品','编码','仓库','现货可分配','预售可分配'])row.append(el('th',h));th.append(row);t.append(th);const body=el('tbody');for(const it of v.inventory.items)body.append(cells(el('tr'),[it.name||it.cargoId,it.code||'—',it.warehouse||'—',num(it.available),num(it.preAvailable)]));t.append(body);const div=el('div',null,'scroll');div.append(t);details.append(div);card.append(details)}}
  }
  $('devices').append(card);
 }
 $('runs').replaceChildren();for(const r of data.runs){const s=r.summary||{};$('runs').append(cells(el('tr'),[date(r.finished_at),s.trigger||'—',label[r.status]||r.status,`${s.ok??s.okCount??'—'} / ${s.total??'—'}`,s.error||(s.failed||[]).join('、')||'—']))}
 $('loaded').textContent='页面更新于 '+new Date().toLocaleTimeString('zh-CN');
}
async function load(){if(busy||!session)return;busy=true;try{draw(await api('overview'));message('')}catch(e){message(e.message)}finally{busy=false}}
async function act(button,fn){button.disabled=true;try{await fn();await load()}catch(e){message(e.message)}finally{button.disabled=false}}
$('loginForm').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{await auth('token?grant_type=password',{email:$('email').value.trim(),password:$('password').value});$('password').value='';await load()}catch(e){message(e.message)}finally{button.disabled=false}};
$('refresh').onclick=load;$('logout').onclick=()=>{session=null;localStorage.removeItem(STORAGE);$('login').classList.remove('hidden');$('dashboard').classList.add('hidden');message('')};
load();setInterval(load,20000);
