/* 三板块卡片视图：复用经营数据与操作，账户和供应链库存读取同一云端快照。 */
(() => {
  'use strict';
  const monthKey = value => {
    if(!value)return '';
    if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2} /.test(value))return value.slice(0,7);
    const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}).slice(0,7);
  };
  const currentMonth=monthKey(new Date());
  const ui = { accountQuery:'', accountStatus:'', accountMonth:currentMonth, stockQuery:'', stockShop:'', stockStatus:'', stockPage:1 };
  const node = (tag, cls, text) => {
    const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e;
  };
  const num = value => value == null ? '—' : Number(value).toLocaleString('zh-CN',{maximumFractionDigits:2});
  const money = (value, unit='¥') => value == null ? '—' : unit+Number(value).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const stateLabel = value => ({success:'采集完整',partial:'部分采集',stale:'保留旧数据',missing:'未采到',not_requested:'本轮未采集'}[value] || '待核验');
  function button(text, callback, cls='board-button') {
    const b=node('button',cls,text);b.type='button';b.onclick=callback;return b;
  }
  function badge(text, tone='neutral') { return node('span','data-badge '+tone,text); }
  function fields(entries) {
    const dl=node('dl','card-fields');
    for(const [label,value] of entries) {const pair=node('div');pair.append(node('dt',null,label),node('dd',null,value??'—'));dl.append(pair)}
    return dl;
  }
  function stats(entries) {
    const grid=node('div','board-metrics');
    for(const [label,value,note] of entries) {
      const card=node('section','metric-card');card.append(node('p','metric-caption',label),node('strong','metric-value',value));
      if(note)card.append(node('p','metric-note',note));grid.append(card);
    }
    return grid;
  }
  function empty(text, hint='') {
    const box=node('div','board-empty');box.append(node('strong',null,text));
    if(hint)box.append(node('p',null,hint));return box;
  }
  function sourceHeader(title, data, cloud, refresh) {
    const section=node('div','data-heading'),copy=node('div');
    copy.append(node('p','section-kicker','抖店 · '+(cloud?'云端快照':'缓存数据')),node('h2',null,title));
    copy.append(node('p','data-caption','采集于 '+acctTime(data.updatedAt)+(data.uploadedAt?' · 上传于 '+acctTime(data.uploadedAt):'')));
    const actions=node('div','heading-actions');actions.append(badge(cloud?'云端已同步':'显示旧缓存',cloud?'good':'warning'),button('刷新数据',refresh));
    section.append(copy,actions);return section;
  }
  const sum = (stores, getter) => {
    const values=stores.map(getter).filter(v=>typeof v==='number'&&Number.isFinite(v));
    return values.length?values.reduce((a,b)=>a+b,0):null;
  };
  function accountView(data, cloud) {
    const root=document.getElementById('acctApp');if(!root)return;
    root.replaceChildren(sourceHeader('店铺账户',data,cloud,()=>loadAccounts(true)));
    const names=Object.keys(data.stores||{}).sort(), stores=names.map(name=>data.stores[name]);
    if(!names.length){root.append(empty('暂无账户数据','采集并同步后即可查看。'));return}
    const tools=node('div','board-toolbar'),search=node('input','board-search'),select=node('select','board-select'),count=node('span','result-count'),month=node('select','board-select');
    month.setAttribute('aria-label','账户采集月份');
    const months=[...new Set([currentMonth,...stores.map(s=>monthKey(s.collection?.collectedAt||data.updatedAt)).filter(Boolean)])].sort().reverse();
    for(const value of months){const option=node('option',null,(value===currentMonth?'本月':value.replace('-','年')+'月')+'（'+value+'）');option.value=value;month.append(option)}
    const allMonths=node('option',null,'全部采集月份');allMonths.value='';month.append(allMonths);month.value=ui.accountMonth;
    search.type='search';search.placeholder='搜索店铺名称';search.setAttribute('aria-label','搜索账户店铺');search.value=ui.accountQuery;
    for(const [value,text] of [['','全部状态'],['success','采集完整'],['abnormal','需核验']]) {const opt=node('option',null,text);opt.value=value;select.append(opt)}
    select.value=ui.accountStatus;select.setAttribute('aria-label','筛选账户状态');tools.append(month,search,select,count);root.append(tools);
    const overview=node('section','summary-section'),summary=node('section','summary-section'),details=node('section','summary-section');details.id='accountShopDetails';
    const grid=node('div','account-card-grid');details.append(node('h3','summary-title','各店铺账户明细'),grid);root.append(overview,summary,details);
    const draw=()=>{
      grid.replaceChildren();
      const filtered=names.filter(name=>!ui.accountMonth||monthKey(data.stores[name].collection?.collectedAt||data.updatedAt)===ui.accountMonth).filter(name=>name.toLowerCase().includes(ui.accountQuery.toLowerCase())).filter(name=>!ui.accountStatus||(ui.accountStatus==='success'?data.stores[name].collection?.status==='success':data.stores[name].collection?.status!=='success'));
      count.textContent=filtered.length+' / '+names.length+' 家';
      const selectedStores=filtered.map(name=>data.stores[name]);
      overview.replaceChildren(node('h3','summary-title','账户汇总'),stats([
        ['可提现 · USD',money(sum(selectedStores,s=>s.goods?.usd?.withdrawable),'$')],
        ['提现中 · USD',money(sum(selectedStores,s=>s.goods?.usd?.withdrawing),'$')],
        ['冻结款 · USD',money(sum(selectedStores,s=>s.goods?.usd?.frozen),'$')],
        ['可提现 · RMB',money(sum(selectedStores,s=>s.goods?.rmb?.withdrawable))],
        ['待结算 · RMB',money(sum(selectedStores,s=>s.pending?.toSettle))],
        ['基础保证金 · RMB',money(sum(selectedStores,s=>s.deposit?.baseBalance))]
      ]),node('p','detail-note',`当前范围 ${filtered.length} 家。按采集月份筛选，每家店显示最新余额快照；不同日期的余额不累加，美元与人民币分开汇总。`));
      const summaryHead=node('div','summary-section-head'),jump=node('a','summary-jump','向下查看账户明细 ↓');jump.href='#accountShopDetails';summaryHead.append(node('h3','summary-title','各店铺账户汇总'),jump);
      const wrap=node('div','shop-summary-wrap'),table=node('table','shop-summary-table');table.setAttribute('aria-label','账户各店铺汇总');
      const thead=node('thead'),tr=node('tr');for(const text of ['店铺','可提现 USD','可提现 RMB','待结算 RMB','基础保证金 RMB','采集状态'])tr.append(node('th',null,text));thead.append(tr);table.append(thead);
      const tbody=node('tbody');for(const name of filtered){const s=data.stores[name],row=node('tr');for(const value of [name,money(s.goods?.usd?.withdrawable,'$'),money(s.goods?.rmb?.withdrawable),money(s.pending?.toSettle),money(s.deposit?.baseBalance),stateLabel(s.collection?.status)])row.append(node('td',null,value));tbody.append(row)}table.append(tbody);wrap.append(table);summary.replaceChildren(summaryHead,wrap);
      for(const name of filtered) {
        const s=data.stores[name],card=node('article','shop-account-card'),head=node('div','card-top');
        head.append(node('h3',null,name),badge(stateLabel(s.collection?.status),s.collection?.status==='success'?'good':'warning'));card.append(head);
        card.append(node('p','card-timestamp','采集 '+acctTime(s.collection?.collectedAt||data.updatedAt)));
        const balances=node('div','balance-pair');
        for(const [label,value,unit] of [['美元可提现',s.goods?.usd?.withdrawable,'$'],['人民币可提现',s.goods?.rmb?.withdrawable,'¥']]) {
          const cell=node('div');cell.append(node('span',null,label),node('strong',null,money(value,unit)));balances.append(cell);
        }
        card.append(balances,fields([['待结算',money(s.pending?.toSettle)],['基础保证金',money(s.deposit?.baseBalance)],['库存条目',s.inventory?.total==null?'未读取':num(s.inventory.total)+' 条'],['库存状态',s.inventory?.total===0&&s.collection?.inventoryStatus==='success'?'确认空库存':stateLabel(s.collection?.inventoryStatus)]]));
        card.append(button('查看账户明细',()=>accountDetail(name,data,cloud),'board-button card-open'));
        grid.append(card);
      }
      if(!filtered.length)grid.append(empty('没有匹配的店铺','可以修改搜索关键词或筛选条件。'));
    };
    search.oninput=()=>{ui.accountQuery=search.value;draw()};select.onchange=()=>{ui.accountStatus=select.value;draw()};month.onchange=()=>{ui.accountMonth=month.value;draw()};draw();
  }
  async function loadAccounts(force=false) {
    const root=document.getElementById('acctApp');
    if(!ACCT_CLOUD.data)root.replaceChildren(empty('正在读取账户快照…'));
    const data=await loadAcctCloud(force);accountView(data||acctData(),!!data);
  }
  function accountDetail(name,data,cloud) {
    const s=data.stores[name],root=document.getElementById('acctApp');if(!s)return;
    root.replaceChildren(button('← 返回店铺账户',()=>accountView(data,cloud)),sourceHeader(name,data,cloud,()=>loadAccounts(true)));
    root.append(node('p','detail-note','本店账户采集于 '+acctTime(s.collection?.collectedAt)+' · '+stateLabel(s.collection?.status)));
    const grid=node('div','detail-card-grid');root.append(grid);
    const panel=(title,rows)=>{const card=node('section','detail-card');card.append(node('h3',null,title),fields(rows));grid.append(card)};
    for(const [key,label,unit] of [['usd','美元货款账户','$'],['rmb','人民币货款账户','¥']]) {
      const g=s.goods?.[key];if(g)panel(label,[['可提现',money(g.withdrawable,unit)],['提现中',money(g.withdrawing,unit)],['冻结款',money(g.frozen,unit)]]);
    }
    panel('保证金',[['基础保证金',money(s.deposit?.baseBalance)],['基础应缴',money(s.deposit?.baseDue)],['体验保证金',money(s.deposit?.expBalance)],['体验应缴',money(s.deposit?.expDue)]]);
    panel('待结算',[['待换汇',money(s.pending?.toExchange)],['待结算',money(s.pending?.toSettle)]]);
    panel('供应链与库存',[['供应链欠费',s.supply?.debt==null?'未读取':money(s.supply.debt)],['库存条目',s.inventory?.total==null?'未读取':num(s.inventory.total)+' 条'],['库存采集时间',acctTime(s.collection?.inventoryCollectedAt||s.collection?.collectedAt)]]);
    root.append(node('p','detail-note','银行账户信息在此页面隐藏，可在账户中心管理台核对。'));
  }
  function inventoryView(data,cloud) {
    const root=document.getElementById('supplyInvApp');if(!root)return;
    root.replaceChildren(sourceHeader('抖店货品库存',data,cloud,()=>loadStock(true)));
    const names=Object.keys(data.stores||{}).sort();
    const all=names.flatMap(shop=>(data.stores[shop].inventory?.items||[]).map(item=>({...item,shop})));
    const confirmedEmpty=names.filter(shop=>data.stores[shop].inventory?.total===0&&data.stores[shop].collection?.inventoryStatus==='success');
    const unready=names.filter(shop=>data.stores[shop].inventory?.total>0&&!Array.isArray(data.stores[shop].inventory?.items));
    root.append(stats([
      ['货品库存明细',all.length+' 条','按货品与仓库组合统计'],
      ['店铺覆盖',names.length+' 家',confirmedEmpty.length+' 家确认暂无库存'],
      ['现货可分配',num(sum(all,item=>item.available)),'以采集时库存为准'],
      ['现货为零',all.filter(item=>item.available===0).length+' 条','可展开查看预售与在途']
    ]));
    if(unready.length)root.append(empty('部分库存明细未接通','请刷新数据后重试，不将未读取明细当作零库存。'));
    const tools=node('div','board-toolbar'),search=node('input','board-search'),shopSelect=node('select','board-select'),status=node('select','board-select');
    search.type='search';search.placeholder='搜索货品名称、编码或仓库';search.value=ui.stockQuery;search.setAttribute('aria-label','搜索抖店货品');
    for(const [value,text] of [['','全部店铺 · '+names.length+' 家'],...names.map(name=>[name,name+(confirmedEmpty.includes(name)?' · 空库存':'')])]) {const opt=node('option',null,text);opt.value=value;shopSelect.append(opt)}
    shopSelect.value=ui.stockShop;shopSelect.setAttribute('aria-label','筛选库存店铺');
    for(const [value,text] of [['','全部现货状态'],['positive','有现货'],['zero','现货为零']]){const opt=node('option',null,text);opt.value=value;status.append(opt)}
    status.value=ui.stockStatus;status.setAttribute('aria-label','筛选现货状态');
    tools.append(search,shopSelect,status);root.append(tools);
    const pager=node('div','card-pagination'),grid=node('div','supply-card-grid');root.append(pager,grid);
    const draw=()=>{
      const query=ui.stockQuery.toLowerCase();
      const items=all.filter(it=>(!ui.stockShop||it.shop===ui.stockShop)&&(!query||[it.name,it.code,it.cargoId,it.warehouse].some(v=>String(v||'').toLowerCase().includes(query))))
        .filter(it=>!ui.stockStatus||(ui.stockStatus==='positive'?it.available>0:it.available===0));
      const pages=Math.max(1,Math.ceil(items.length/24));ui.stockPage=Math.min(ui.stockPage,pages);
      pager.replaceChildren(node('span','result-count','匹配 '+items.length+' 条 · 第 '+ui.stockPage+' / '+pages+' 页'));
      const prev=button('上一页',()=>{ui.stockPage--;draw()}),next=button('下一页',()=>{ui.stockPage++;draw()});
      prev.disabled=ui.stockPage<=1;next.disabled=ui.stockPage>=pages;pager.append(prev,next);grid.replaceChildren();
      for(const it of items.slice((ui.stockPage-1)*24,ui.stockPage*24)) {
        const card=node('article','stock-product-card'),head=node('div','card-top');
        head.append(badge(it.shop),badge(it.available==null?'未读取':it.available===0?'现货为零':'有现货',it.available==null||it.available===0?'warning':'good'));card.append(head,node('h3',null,it.name||it.cargoId||'未命名货品'));
        card.append(node('p','card-caption','编码 '+(it.code||'—')+' · '+(it.warehouse||it.warehouseType||'仓库未读取')));
        const balances=node('div','balance-pair');
        for(const [label,value] of [['现货可分配',it.available],['预售可分配',it.preAvailable]]) {const cell=node('div');cell.append(node('span',null,label),node('strong',null,num(value)));balances.append(cell)}
        card.append(balances);
        const detail=node('details','stock-more');detail.append(node('summary',null,'仓库与库存明细'),fields([['货品 ID',it.cargoId||'—'],['仓库',it.warehouse||'—'],['服务商',it.serviceProvider||'—'],['现货已分配',num(it.allocated)],['预售已分配',num(it.preAllocated)],['预售发货预留',num(it.preReserve)],['调拨在途',num(it.transferInTransit)],['提货占用',num(it.pickupOccupy)],['次品库存',num(it.defective)]]));card.append(detail);
        const collection=data.stores[it.shop].collection;card.append(node('p','card-timestamp','库存采集 '+acctTime(collection?.inventoryCollectedAt||collection?.collectedAt)));grid.append(card);
      }
      if(!items.length) {
        const isEmpty=confirmedEmpty.includes(ui.stockShop);
        grid.append(empty(isEmpty?'本次采集确认：该店暂无货品库存':'没有匹配的货品',isEmpty?'账户数据已采集，可切换到账户板块查看。':'可以修改店铺、现货状态或搜索条件。'));
      }
    };
    const update=()=>{ui.stockQuery=search.value;ui.stockShop=shopSelect.value;ui.stockStatus=status.value;ui.stockPage=1;draw()};
    search.oninput=update;shopSelect.onchange=update;status.onchange=update;draw();
  }
  async function loadStock(force=false) {
    const root=document.getElementById('supplyInvApp');if(!ACCT_CLOUD.data)root.replaceChildren(empty('正在读取库存快照…'));
    const data=await loadAcctCloud(force);inventoryView(data||acctData(),!!data);
  }
  // 将原业务表格的字段与操作节点移入卡片，保留原有编辑、状态和分页行为。
  function tableCards(root) {
    if(!root)return;
    for(const table of [...root.querySelectorAll('table')]) {
      const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
      if(!headers.length)continue;
      const grid=node('div','record-card-grid');
      const primary=Math.max(0,headers.findIndex(h=>/^(提现人|商品名称|店铺|日期|时间)$/.test(h)));
      const hero=headers.findIndex(h=>/金额|^(合计|库存|数量)$/.test(h)),state=headers.indexOf('状态'),action=headers.indexOf('操作');
      for(const row of [...table.tBodies].flatMap(body=>[...body.rows])) {
        const cells=[...row.cells];if(cells.length!==headers.length)continue;
        const card=node('article','record-card'),head=node('div','card-top'),title=node('h3');
        title.append(...cells[primary].childNodes);head.append(title);
        if(state>=0)head.append(...cells[state].childNodes);card.append(head);
        if(hero>=0&&hero!==primary){const value=node('div','record-hero');value.append(node('span',null,headers[hero]));const strong=node('strong');strong.append(...cells[hero].childNodes);value.append(strong);card.append(value)}
        const dl=node('dl','card-fields'),detail=node('details','stock-more'),more=node('dl','card-fields');
        detail.append(node('summary',null,'更多信息'),more);
        for(let i=0;i<cells.length;i++) {
          if([primary,hero,state,action].includes(i)||headers[i]==='#')continue;
          const field=node('div'),dd=node('dd');dd.append(...cells[i].childNodes);field.append(node('dt',null,headers[i]),dd);
          (/银行|备注|预警|单价|估值/.test(headers[i])?more:dl).append(field);
        }
        if(dl.children.length)card.append(dl);if(more.children.length)card.append(detail);
        if(action>=0) {const actions=node('div','record-actions');actions.append(...cells[action].childNodes);for(const b of actions.querySelectorAll('button')){if(b.title)b.textContent=b.title}card.append(actions)}
        grid.append(card);
      }
      table.replaceWith(grid);
    }
  }
  function businessCards(root) {
    for(const grid of root.querySelectorAll('#ksStoreCards,#ddStoreCards')) {
      grid.classList.add('record-card-grid');grid.style.removeProperty('grid-template-columns');
      for(const card of grid.children) {
        card.classList.add('business-shop-card');card.tabIndex=0;card.setAttribute('role','button');
        card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click()}};
      }
    }
  }
  const wrappers=[['renderWithdraw','withdrawList'],['renderInventory','inventoryList'],['renderKsOverview','ksWithdrawApp'],['renderKsDaysView','ksWithdrawApp'],['renderKsAllView','ksWithdrawApp'],['renderKsStoreDetail','ksWithdrawApp'],['renderDdOverview','ddOrderApp'],['renderDdDaysView','ddOrderApp'],['renderDdAllView','ddOrderApp'],['renderDdStoreDetail','ddOrderApp']];
  for(const [name,id] of wrappers) {const original=window[name];window[name]=function(...args){const result=original.apply(this,args);const root=document.getElementById(id);tableCards(root);businessCards(root);return result}}
  window.renderAcctOverview=()=>loadAccounts();
  window.renderAcctOverviewWith=accountView;
  window.renderSupplyInventory=()=>loadStock();
  const inventory=document.getElementById('tabInventory'),supply=document.getElementById('supplyInvApp'),own=node('div');
  own.id='selfInventoryPanel';for(const child of [...inventory.children])if(child!==supply)own.append(child);
  const tabs=node('div','sub-nav inventory-subnav');
  const choose=value=>{supply.classList.toggle('hidden',value!=='supply');own.classList.toggle('hidden',value!=='self');for(const b of tabs.children)b.classList.toggle('active',b.dataset.view===value)};
  for(const [value,label] of [['supply','抖店货品库存'],['self','自营库存']]) {const b=button(label,()=>choose(value),'sub-btn');b.dataset.view=value;tabs.append(b)}
  inventory.replaceChildren(tabs,supply,own);choose('supply');
  const originalSwitch=window.switchBoard;
  window.switchBoard=function(board,sub){const result=originalSwitch(board,sub);try{const u=new URL(location.href);u.searchParams.set('board',board);history.replaceState(null,'',u)}catch{}return result};
  const initial=new URLSearchParams(location.search).get('board');
  switchBoard(['business','inventory','account'].includes(initial)?initial:'business','withdraw');
})();
