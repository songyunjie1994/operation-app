/* Product-first inventory, using the existing inventory-name-map.js catalogue. */
(function () {
  'use strict';
  const fields = ['available', 'allocated', 'defective'];
  const esc = value => String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const qty = value => finite(value) ? value.toLocaleString('zh-CN') : '—';
  const date = value => value ? new Date(value).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai', hour12:false}) : '—';

  function identify(item, mapping = window.STOCK_NAME_MAP) {
    const code = String(item.code ?? '').trim();
    const rawName = String(item.name ?? '').trim();
    if (code && Object.hasOwn(mapping?.codes ?? {}, code) && mapping.codes[code]) {
      return {key: 'mapped:' + mapping.codes[code], name: mapping.codes[code], matched: true, method: '编码匹配'};
    }
    for (const rule of mapping?.rules ?? []) {
      if (typeof rule.test?.test !== 'function' || !rule.name) continue;
      rule.test.lastIndex = 0;
      if (rule.test.test(rawName)) return {key: 'mapped:' + rule.name, name: rule.name, matched: true, method: '关键词匹配'};
    }
    // Unknown codes remain separate even when their original names happen to match.
    return {key: 'unmatched:' + JSON.stringify([code, code ? '' : item.cargoId ?? '', rawName]), name: rawName || code || '未命名货品', matched: false, method: '未匹配'};
  }

  function total(items, field) {
    const known = items.map(item => item[field]).filter(finite);
    return {value: known.length ? known.reduce((sum, value) => sum + value, 0) : null, missing: items.length - known.length};
  }
  function totals(items) { return Object.fromEntries(fields.map(field => [field, total(items, field)])); }
  function formatTotal(result) { return qty(result.value) + (result.missing && result.value !== null ? ' + 未知' : ''); }
  function rollup(items) {
    const groups = new Map();
    for (const item of items) {
      if (!groups.has(item.product.key)) groups.set(item.product.key, {product:item.product, items:[]});
      groups.get(item.product.key).items.push(item);
    }
    return [...groups.values()].map(group => ({...group, totals:totals(group.items), shops:new Set(group.items.map(item => item.shop_key)).size}))
      .sort((a, b) => (b.totals.available.value ?? -Infinity) - (a.totals.available.value ?? -Infinity) || a.product.name.localeCompare(b.product.name, 'zh'));
  }

  function build(snapshots, shops, options = {}) {
    const latest = new Map();
    for (const snapshot of snapshots) {
      const previous = latest.get(snapshot.shop_key);
      if (!previous || snapshot.captured_at > previous.captured_at) latest.set(snapshot.shop_key, snapshot);
    }
    const selected = [...latest.values()].filter(snapshot => shops.has(snapshot.shop_key) && (!options.platform || shops.get(snapshot.shop_key).platform === options.platform));
    const query = String(options.search ?? '').trim().toLowerCase();
    const items = selected.flatMap(snapshot => (snapshot.items ?? []).map(item => ({...item, product:identify(item, options.mapping), shop_key:snapshot.shop_key, shop:shops.get(snapshot.shop_key).shop_name, captured_at:snapshot.captured_at})))
      .filter(item => !query || [item.product.name, item.name, item.code, item.warehouse, item.shop].some(value => String(value ?? '').toLowerCase().includes(query)));
    const allGroups = rollup(items);
    const groups = options.showZero ? allGroups : allGroups.filter(group => fields.some(field => group.totals[field].missing || group.totals[field].value !== 0));
    const groupKeys = new Set(groups.map(group => group.product.key));
    const activeItems = items.filter(item => groupKeys.has(item.product.key));
    return {
      items, activeItems, groups, totals:totals(items), showZero:!!options.showZero,
      hiddenProducts:allGroups.length - groups.length,
      unmatched:allGroups.filter(group => !group.product.matched).length,
      shopCount:new Set(items.map(item => item.shop_key)).size,
      snapshotCount:selected.length,
      incomplete:selected.filter(snapshot => snapshot.summary?.truncated || snapshot.summary?.status && snapshot.summary.status !== 'success' || !Array.isArray(snapshot.items) || snapshot.summary?.total != null && snapshot.summary.total !== snapshot.items?.length).length,
      confirmedEmpty:selected.filter(snapshot => snapshot.summary?.status === 'success' && snapshot.summary?.total === 0 && snapshot.items?.length === 0).length
    };
  }

  const status = product => product.matched ? '' : '<span class="stock-unmatched">未匹配</span>';
  const cells = row => fields.map(field => '<td class="num" data-label="' + ({available:'现货',allocated:'已分配',defective:'次品'})[field] + '">' + esc(formatTotal(row.totals[field])) + '</td>').join('');
  function productTable(model, selectedKey) {
    if (!model.groups.length) return '<div class="empty">当前范围暂无可展示品名，可调整搜索或勾选「显示全零品名」。</div>';
    return '<div class="table-wrap stock-table-wrap"><table aria-label="全部店铺品名库存汇总"><thead><tr><th>品名</th><th class="num">现货</th><th class="num">已分配</th><th class="num">次品</th><th class="num">店铺数</th></tr></thead><tbody>' + model.groups.map(row => '<tr' + (selectedKey === row.product.key ? ' class="stock-selected"' : '') + '><td><button class="stock-product" data-stock-product="' + esc(encodeURIComponent(row.product.key)) + '" aria-pressed="' + (selectedKey === row.product.key) + '">' + esc(row.product.name) + '</button>' + status(row.product) + '</td>' + cells(row) + '<td class="num">' + row.shops + ' 家</td></tr>').join('') + '</tbody></table></div>';
  }

  function storeCards(model, selectedKey) {
    const chosen = model.groups.find(group => group.product.key === selectedKey);
    const items = model.activeItems.filter(item => !chosen || item.product.key === chosen.product.key);
    const stores = new Map();
    for (const item of items) {
      if (!stores.has(item.shop_key)) stores.set(item.shop_key, {name:item.shop, captured_at:item.captured_at, items:[]});
      stores.get(item.shop_key).items.push(item);
    }
    const entries = [...stores.values()].sort((a,b) => (total(b.items,'available').value ?? -Infinity) - (total(a.items,'available').value ?? -Infinity) || a.name.localeCompare(b.name,'zh'));
    const content = entries.map(store => {
      const grouped = rollup(store.items).filter(row => fields.some(field => row.totals[field].missing || row.totals[field].value !== 0) || model.showZero);
      if (!grouped.length) return '';
      const sums = totals(store.items);
      return '<details class="stock-store"' + (chosen ? ' open' : '') + '><summary><span class="stock-store-name">' + esc(store.name) + '<small>' + grouped.length + ' 个品名 · ' + esc(date(store.captured_at)) + '</small></span><span class="stock-store-totals">' + fields.map(field => '<span><small>' + ({available:'现货',allocated:'已分配',defective:'次品'})[field] + '</small><strong>' + esc(formatTotal(sums[field])) + '</strong></span>').join('') + '</span><svg class="stock-chevron" aria-hidden="true"><use href="#icon-chevron"/></svg></summary>' +
        '<div class="table-wrap stock-table-wrap"><table aria-label="' + esc(store.name) + '品名库存"><thead><tr><th>品名</th><th class="num">现货</th><th class="num">已分配</th><th class="num">次品</th></tr></thead><tbody>' + grouped.map(row => '<tr><td>' + esc(row.product.name) + status(row.product) + '</td>' + cells(row) + '</tr>').join('') + '</tbody></table></div>' +
        '<details class="stock-source"><summary>查看 ' + store.items.length + ' 条原始记录</summary><div class="table-wrap"><table><thead><tr><th>原始货品名称</th><th>货品编码</th><th>仓库</th><th class="num">现货</th><th class="num">已分配</th><th class="num">次品</th><th>品名匹配</th></tr></thead><tbody>' + store.items.map(item => '<tr><td>' + esc(item.name) + '</td><td>' + esc(item.code) + '</td><td>' + esc(item.warehouse) + '</td>' + fields.map(field => '<td class="num">' + esc(qty(item[field])) + '</td>').join('') + '<td>' + esc(item.product.method) + '</td></tr>').join('') + '</tbody></table></div></details></details>';
    }).join('');
    return '<div class="stock-section-title"><div><h2>分店铺库存' + (chosen ? ' · ' + esc(chosen.product.name) : '') + '</h2><p>展开店铺查看各品名，再展开原始记录核对编码与仓库。</p></div>' + (chosen ? '<button class="secondary" data-stock-clear>查看全部品名</button>' : '') + '</div><div class="stock-store-list">' + (content || '<div class="empty">当前范围暂无非全零的店铺库存。</div>') + '</div>';
  }

  window.OPS_INVENTORY = {identify, total, totals, formatTotal, rollup, build, productTable, storeCards};
})();
