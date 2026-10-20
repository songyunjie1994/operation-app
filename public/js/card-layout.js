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
    const tools=node('div','board-toolbar account-filters'),search=node('input','board-search'),select=node('select','board-select'),count=node('span','result-count'),month=node('select','board-select');
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
      const columns=['店铺','可提现 USD','可提现 RMB','待结算 RMB','基础保证金 RMB','采集状态'];
      const thead=node('thead'),tr=node('tr');for(const text of columns)tr.append(node('th',null,text));thead.append(tr);table.append(thead);
      const tbody=node('tbody');for(const name of filtered){const s=data.stores[name],row=node('tr');for(const [i,value] of [name,money(s.goods?.usd?.withdrawable,'$'),money(s.goods?.rmb?.withdrawable),money(s.pending?.toSettle),money(s.deposit?.baseBalance),stateLabel(s.collection?.status)].entries()){const cell=node('td',null,value);cell.dataset.label=columns[i];row.append(cell)}tbody.append(row)}table.append(tbody);wrap.append(table);summary.replaceChildren(summaryHead,wrap);
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
  const STOCK_UNIT='(?:粒|片|袋|瓶|盒|支|条|包|套|罐|枚|件|箱)';
  const STOCK_TAIL=new RegExp('(?:\\s*[*x×]?\\s*\\d+(?:\\.\\d+)?\\s*(?:g|kg|ml|l|mg)?\\s*(?:[*x×]\\s*\\d+(?:\\.\\d+)?\\s*(?:g|ml|mg)?\\s*)?'+STOCK_UNIT+'(?:装|套盒|套组)?(?:\\s*\\/\\s*(?:盒|瓶|袋|箱|件|套))?)\\s*$','i');
  // 抖店货品名常重复写规格（如「30粒/盒 30粒/盒」），拆成「品名 + 规格」，保留规格用于追溯。
  function splitStockName(value) {
    let name=String(value||'').replace(/\s+/g,' ').trim();
    if(!name)return {base:'未命名货品',spec:''};
    const seen=new Set();
    name=name.split(' ').filter(token=>{const key=token.replace(/\s/g,'');if(seen.has(key))return false;seen.add(key);return true}).join(' ');
    let spec='';
    for(let i=0;i<8;i++){
      let next=name.replace(STOCK_TAIL,'').trim();
      if(next===name)next=name.replace(/\s+\d{1,5}$/,'').trim();
      if(!next||next===name)break;
      const removed=name.slice(next.length).replace(/^[\s/*x×]+/,'').trim();
      if(removed)spec=removed;
      name=next;
    }
    return {base:name||String(value),spec};
  }
  const STOCK_NAME_MAP=(typeof window!=='undefined'&&window.STOCK_NAME_MAP)||{codes:{},rules:[]};
  // 内置匹配：先按货品编码，再按名称关键词，最后回退到去掉规格后的货品名。
  function stockProductName(item) {
    const code=String(item&&item.code||'').trim();
    const mapped=STOCK_NAME_MAP.codes&&STOCK_NAME_MAP.codes[code];
    if(mapped)return mapped;
    const raw=String(item&&item.name||'');
    for(const rule of STOCK_NAME_MAP.rules||[]) {
      try { if(rule&&rule.test&&rule.test.test(raw))return rule.name } catch {}
    }
    return splitStockName(raw).base||'未命名货品';
  }
  // 按品名汇总：同一品名下的不同店铺、规格、编码合并统计。
  function stockRollup(items) {
    const map=new Map();
    for(const item of items) {
      const name=item.product;
      let row=map.get(name);
      if(!row){row={name,codes:new Set(),shops:new Set(),available:0,allocated:0,defective:0};map.set(name,row)}
      if(item.code)row.codes.add(item.code);
      row.shops.add(item.shop);
      row.available+=Number(item.available)||0;
      row.allocated+=Number(item.allocated)||0;
      row.defective+=Number(item.defective)||0;
    }
    return [...map.values()].sort((a,b)=>b.available-a.available||a.name.localeCompare(b.name,'zh'));
  }
  function inventoryView(data,cloud) {
    const root=document.getElementById('supplyInvApp');if(!root)return;
    root.replaceChildren(sourceHeader('抖店货品库存',data,cloud,()=>loadStock(true)));
    const shops=Object.keys(data.stores||{}).sort((a,b)=>a.localeCompare(b,'zh'));
    const all=shops.flatMap(shop=>(data.stores[shop].inventory?.items||[]).map(item=>({...item,shop,product:stockProductName(item)})));
    const confirmedEmpty=shops.filter(shop=>data.stores[shop].inventory?.total===0&&data.stores[shop].collection?.inventoryStatus==='success');
    const unready=shops.filter(shop=>data.stores[shop].inventory?.total>0&&!Array.isArray(data.stores[shop].inventory?.items));
    const totalRows=stockRollup(all);
    const total=field=>all.reduce((acc,item)=>acc+(Number(item[field])||0),0);
    const overview=node('section','summary-section');
    const overviewMetrics=stats([
      ['品名',totalRows.length+' 个',shops.length+' 家店铺'],
      ['现货可分配',num(total('available')),'采集时库存'],
      ['已分配',num(total('allocated')),'待出库与已占用'],
      ['次品库存',num(total('defective')),'需单独处理']
    ]);
    overviewMetrics.classList.add('stock-metrics','stock-metrics-4');
    overview.append(node('h3','summary-title','库存总览'),overviewMetrics);
    const zeroItems=all.filter(item=>!(item.available>0));
    const occupied=zeroItems.filter(item=>Number(item.allocated)>0);
    if(occupied.length) {
      const riskNames=[...new Set(occupied.map(item=>item.product))];
      const risk=node('p','stock-risk-note');
      risk.append(node('strong',null,'零现货仍有分配 '+occupied.length+' 条'),node('span',null,'可搜索品名核对：'+riskNames.slice(0,4).join('、')+(riskNames.length>4?' 等':'')));
      overview.append(risk);
    }
    overview.append(node('p','detail-note','品名由内置匹配表自动归并：同一品名下的不同店铺、规格和编码会合并统计。'));
    root.append(overview);
    if(unready.length)root.append(empty('部分库存明细未接通','请刷新数据后重试，不将未读取明细当作零库存。'));

    const totalSection=node('section','summary-section');
    const totalHead=node('div','summary-section-head'),totalCount=node('span','result-count'),totalJump=node('a','summary-jump','查看分店铺 ↓');
    totalJump.href='#stockStoreDetails';
    const totalActions=node('div','heading-actions');totalActions.append(totalCount,totalJump);
    totalHead.append(node('h3','summary-title','全部店铺 · 品名库存'),totalActions);totalSection.append(totalHead);
    const totalTools=node('div','board-toolbar stock-search-bar'),search=node('input','board-search');
    search.type='search';search.placeholder='搜索品名或店铺';search.setAttribute('aria-label','搜索品名或店铺');
    totalTools.append(search);totalSection.append(totalTools);
    const totalWrap=node('div','shop-summary-wrap stock-table-wrap'),totalTable=node('table','shop-summary-table stock-rollup-table');
    totalTable.setAttribute('aria-label','全部店铺品名库存汇总');
    const totalThead=node('thead'),totalTr=node('tr');
    for(const text of ['品名','现货','已分配','次品'])totalTr.append(node('th',null,text));
    totalThead.append(totalTr);totalTable.append(totalThead);
    const totalBody=node('tbody');totalTable.append(totalBody);totalWrap.append(totalTable);totalSection.append(totalWrap);root.append(totalSection);

    const storeSection=node('section','summary-section');storeSection.id='stockStoreDetails';
    storeSection.append(node('h3','summary-title','分店铺 · 各品名库存'));
    const storeList=node('div','stock-store-list');storeSection.append(storeList);root.append(storeSection);

    const fillRollup=(body,rows)=>{
      body.replaceChildren();
      for(const row of rows) {
        const tr=node('tr'),nameCell=node('td');
        nameCell.dataset.label='品名';nameCell.append(node('strong',null,row.name));
        nameCell.title=row.name+(row.codes.size?' · 编码 '+[...row.codes].join('、'):'');
        tr.append(nameCell);
        for(const [label,value] of [['现货',row.available],['已分配',row.allocated],['次品',row.defective]]) {
          const cell=node('td',null,num(value));cell.dataset.label=label;tr.append(cell);
        }
        body.append(tr);
      }
    };
    const storeCards=shops.map(shop=>{
      const store=data.stores[shop],items=store.inventory?.items||[],collection=store.collection;
      const rows=stockRollup(items.map(item=>({...item,shop,product:stockProductName(item)})));
      const card=node('article','stock-store-card');card.dataset.shop=shop;
      const head=node('header','stock-store-head'),title=node('div','stock-store-title');
      title.append(node('h4',null,shop));
      title.append(node('p','stock-store-meta',[rows.length+' 个品名',items.length+' 条明细',acctTime(collection?.inventoryCollectedAt||collection?.collectedAt)].join(' · ')));
      const sum=field=>items.reduce((acc,item)=>acc+(Number(item[field])||0),0);
      const sums=node('div','stock-store-sums'),sumEls=[];
      for(const [label,value] of [['现货',sum('available')],['已分配',sum('allocated')],['次品',sum('defective')]]) {
        const cell=node('div'),strong=node('strong',null,num(value));cell.append(node('span',null,label),strong);sums.append(cell);sumEls.push(strong);
      }
      head.append(title,sums);card.append(head);
      if(rows.length) {
        const wrap=node('div','shop-summary-wrap stock-table-wrap'),table=node('table','shop-summary-table stock-rollup-table');
        table.setAttribute('aria-label',shop+' 各品名库存');
        const thead=node('thead'),tr=node('tr');
        for(const text of ['品名','现货','已分配','次品'])tr.append(node('th',null,text));
        thead.append(tr);table.append(thead);
        const body=node('tbody');fillRollup(body,rows);table.append(body);wrap.append(table);card.append(wrap);
      } else {
        card.append(node('p','stock-store-empty',confirmedEmpty.includes(shop)?'本次采集确认该店暂无货品库存。':'库存明细未读取，请刷新数据后重试。'));
      }
      return {shop,card,rows,sumEls};
    });
    storeCards.forEach(entry=>storeList.append(entry.card));

    const draw=()=>{
      const query=search.value.trim().toLowerCase();
      const match=text=>!query||String(text||'').toLowerCase().includes(query);
      const visibleTotal=totalRows.filter(row=>match(row.name));
      fillRollup(totalBody,visibleTotal);
      if(!visibleTotal.length) {
        const tr=node('tr'),cell=node('td');cell.colSpan=4;cell.append(empty('没有匹配的品名','可以换个关键词试试。'));tr.append(cell);totalBody.append(tr);
      }
      let visibleStores=0;
      for(const {shop,card,rows,sumEls} of storeCards) {
        const shopHit=match(shop),rowHits=rows.filter(row=>match(row.name));
        const show=!query||shopHit||rowHits.length>0;
        card.hidden=!show;
        if(!show)continue;
        visibleStores++;
        const shown=shopHit&&query?rows:rowHits;
        const table=card.querySelector('.stock-rollup-table');
        if(table)fillRollup(table.querySelector('tbody'),shown);
        const fields=['available','allocated','defective'];
        sumEls.forEach((el,index)=>el.textContent=num(shown.reduce((acc,row)=>acc+row[fields[index]],0)));
      }
      totalCount.textContent=query?'匹配 '+visibleTotal.length+' 个品名 · '+visibleStores+' 家店铺':'共 '+totalRows.length+' 个品名 · '+shops.length+' 家店铺';
    };
    search.oninput=draw;draw();
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
