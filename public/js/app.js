// ===== 数据层 (localStorage) =====
const STORAGE_KEY = 'operation_data';

function getData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { withdraws: [], inventories: [], stockLogs: [], nextId: 1 }; }
  catch { return { withdraws: [], inventories: [], stockLogs: [], nextId: 1 }; }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function now() {
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
}

function today() {
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// ===== Toast =====
function showToast(msg, type='info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast toast-'+type+' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

function esc(s) { return String(s).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }

function formatMoney(n) { return '¥'+Number(n||0).toFixed(2); }

// ===== 标签切换 =====
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  if (tab === 'withdraw') {
    document.querySelector('.tab-btn').classList.add('active');
    document.getElementById('tabWithdraw').classList.remove('hidden');
    renderWithdraw();
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('tabInventory').classList.remove('hidden');
    renderInventory();
  }
}

// ====================================================================
// 提现管理
// ====================================================================
let wdPage = 1, wdFilterDate = '', wdPageSize = 20;

function openWithdrawModal() {
  document.getElementById('wdEditId').value = '';
  document.getElementById('wdModalTitle').textContent = '💳 新增提现';
  document.getElementById('withdrawForm').reset();
  document.getElementById('wdDate').value = today();
  document.getElementById('withdrawModal').style.display = '';
}

function closeWithdrawModal() { document.getElementById('withdrawModal').style.display = 'none'; }

function editWithdraw(id) {
  const data = getData();
  const w = data.withdraws.find(x => x.id === id);
  if (!w) return;
  document.getElementById('wdEditId').value = w.id;
  document.getElementById('wdModalTitle').textContent = '✏️ 编辑提现';
  document.getElementById('wdPerson').value = w.person || '';
  document.getElementById('wdAmount').value = w.amount || '';
  document.getElementById('wdDate').value = w.date || '';
  document.getElementById('wdAccount').value = w.account || '';
  document.getElementById('wdStatus').value = w.status || 'pending';
  document.getElementById('wdRemark').value = w.remark || '';
  document.getElementById('withdrawModal').style.display = '';
}

function saveWithdraw(e) {
  e.preventDefault();
  const data = getData();
  const editId = document.getElementById('wdEditId').value;
  const person = document.getElementById('wdPerson').value.trim();
  const amount = parseFloat(document.getElementById('wdAmount').value) || 0;
  if (!person) { showToast('请填写提现人', 'error'); return; }
  if (amount <= 0) { showToast('请填写有效金额', 'error'); return; }

  const obj = {
    person, amount,
    date: document.getElementById('wdDate').value || today(),
    account: document.getElementById('wdAccount').value.trim(),
    status: document.getElementById('wdStatus').value,
    remark: document.getElementById('wdRemark').value.trim(),
    updated_at: now()
  };

  if (editId) {
    const idx = data.withdraws.findIndex(w => w.id === parseInt(editId));
    if (idx === -1) return;
    data.withdraws[idx] = { ...data.withdraws[idx], ...obj };
    showToast('已更新', 'success');
  } else {
    obj.id = data.nextId++;
    obj.created_at = now();
    data.withdraws.unshift(obj);
    showToast('添加成功', 'success');
  }

  saveData(data);
  closeWithdrawModal();
  renderWithdraw();
}

function deleteWithdraw(id) {
  if (!confirm('确定删除这条提现记录？')) return;
  const data = getData();
  data.withdraws = data.withdraws.filter(w => w.id !== id);
  saveData(data);
  showToast('已删除', 'info');
  renderWithdraw();
}

function toggleWdStatus(id) {
  const data = getData();
  const w = data.withdraws.find(x => x.id === id);
  if (!w) return;
  w.status = w.status === 'pending' ? 'done' : 'pending';
  w.updated_at = now();
  saveData(data);
  showToast(w.status === 'done' ? '已标记为已打款' : '已标记为待打款', 'success');
  renderWithdraw();
}

function filterWithdraw() {
  wdFilterDate = document.getElementById('wdFilterDate').value;
  wdPage = 1;
  renderWithdraw();
}

function clearWdFilter() {
  wdFilterDate = '';
  document.getElementById('wdFilterDate').value = '';
  wdPage = 1;
  renderWithdraw();
}

function changeWdPage(delta) {
  wdPage = Math.max(1, wdPage + delta);
  renderWithdraw();
}

function renderWithdraw() {
  const data = getData();
  let filtered = data.withdraws;
  if (wdFilterDate) filtered = filtered.filter(w => w.date === wdFilterDate);

  // Stats
  const total = filtered.length;
  const totalAmt = filtered.reduce((s, w) => s + (w.amount || 0), 0);
  const pending = filtered.filter(w => w.status === 'pending').length;
  const done = filtered.filter(w => w.status === 'done').length;
  document.getElementById('wdTotal').textContent = total;
  document.getElementById('wdTotalAmt').textContent = formatMoney(totalAmt);
  document.getElementById('wdPending').textContent = pending;
  document.getElementById('wdDone').textContent = done;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(total / wdPageSize));
  if (wdPage > totalPages) wdPage = totalPages;
  const offset = (wdPage - 1) * wdPageSize;
  const rows = filtered.slice(offset, offset + wdPageSize);

  const list = document.getElementById('withdrawList');
  if (rows.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">💳</div><p>暂无提现记录</p></div>';
  } else {
    list.innerHTML = rows.map(w => renderWdCard(w)).join('');
  }

  document.getElementById('wdPageInfo').textContent = `第 ${wdPage} / ${totalPages} 页（共 ${total} 条）`;
  document.getElementById('wdPrevPage').disabled = wdPage <= 1;
  document.getElementById('wdNextPage').disabled = wdPage >= totalPages;
}

function renderWdCard(w) {
  const statusHtml = w.status === 'pending'
    ? '<span class="status-tag status-pending">⏳ 待打款</span>'
    : '<span class="status-tag status-done">✅ 已打款</span>';
  const amtClass = 'amount amount-positive';
  return `
    <div class="data-card">
      <div class="top-row">
        <span class="name">${esc(w.person)}</span>
        ${statusHtml}
      </div>
      <div class="info-row"><span class="icon">💰</span> <span class="${amtClass}">${formatMoney(w.amount)}</span></div>
      ${w.date ? `<div class="info-row"><span class="icon">📅</span> ${esc(w.date)}</div>` : ''}
      ${w.account ? `<div class="info-row"><span class="icon">🏦</span> ${esc(w.account)}</div>` : ''}
      ${w.remark ? `<div class="info-row"><span class="icon">📝</span> ${esc(w.remark)}</div>` : ''}
      <div class="info-row" style="font-size:11px;color:#94a3b8">🕐 ${w.created_at || ''}</div>
      <div class="actions" onclick="event.stopPropagation()">
        <button class="btn btn-sm ${w.status === 'pending' ? 'btn-success' : 'btn-outline'}" onclick="toggleWdStatus(${w.id})" style="width:auto">${w.status === 'pending' ? '✅ 标记已打款' : '↩️ 撤回'}</button>
        <button class="btn btn-sm btn-outline" onclick="editWithdraw(${w.id})" style="width:auto">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteWithdraw(${w.id})" style="width:auto">🗑️</button>
      </div>
    </div>
  `;
}

function exportWithdraw() {
  const data = getData();
  let filtered = data.withdraws;
  if (wdFilterDate) filtered = filtered.filter(w => w.date === wdFilterDate);
  if (filtered.length === 0) { showToast('没有数据可导出', 'error'); return; }

  const h = ['序号','提现人','金额','日期','银行账户','状态','备注','创建时间'];
  const rows = [h];
  filtered.forEach((w, i) => {
    rows.push([i+1, w.person, w.amount, w.date||'', w.account||'', w.status==='pending'?'待打款':'已打款', w.remark||'', w.created_at||'']);
  });

  const csv = rows.map(r => r.map(c => '"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '提现记录_'+(wdFilterDate||'全部')+'.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 '+filtered.length+' 条', 'success');
}

// ====================================================================
// 库存管理
// ====================================================================
let invPage = 1, invSearch = '', invCategory = '', invPageSize = 20, invSearchTimer;

function openInvModal() {
  document.getElementById('invEditId').value = '';
  document.getElementById('invModalTitle').textContent = '📦 新增商品';
  document.getElementById('invForm').reset();
  document.getElementById('invModal').style.display = '';
}

function closeInvModal() { document.getElementById('invModal').style.display = 'none'; }

function editInventory(id) {
  const data = getData();
  const item = data.inventories.find(x => x.id === id);
  if (!item) return;
  document.getElementById('invEditId').value = item.id;
  document.getElementById('invModalTitle').textContent = '✏️ 编辑商品';
  document.getElementById('invName').value = item.name || '';
  document.getElementById('invCode').value = item.code || '';
  document.getElementById('invUnit').value = item.unit || '';
  document.getElementById('invQty').value = item.quantity || 0;
  document.getElementById('invMinStock').value = item.minStock || 0;
  document.getElementById('invPrice').value = item.price || '';
  document.getElementById('invSupplier').value = item.supplier || '';
  document.getElementById('invCategory').value = item.category || '';
  document.getElementById('invRemark').value = item.remark || '';
  document.getElementById('invModal').style.display = '';
}

function saveInventory(e) {
  e.preventDefault();
  const data = getData();
  const editId = document.getElementById('invEditId').value;
  const name = document.getElementById('invName').value.trim();
  if (!name) { showToast('请填写商品名称', 'error'); return; }

  const obj = {
    name,
    code: document.getElementById('invCode').value.trim(),
    unit: document.getElementById('invUnit').value.trim(),
    quantity: parseInt(document.getElementById('invQty').value) || 0,
    minStock: parseInt(document.getElementById('invMinStock').value) || 0,
    price: parseFloat(document.getElementById('invPrice').value) || 0,
    supplier: document.getElementById('invSupplier').value.trim(),
    category: document.getElementById('invCategory').value.trim(),
    remark: document.getElementById('invRemark').value.trim(),
    updated_at: now()
  };

  if (editId) {
    const idx = data.inventories.findIndex(x => x.id === parseInt(editId));
    if (idx === -1) return;
    // Preserve original quantity on edit unless explicitly changed
    data.inventories[idx] = { ...data.inventories[idx], ...obj };
    showToast('已更新', 'success');
  } else {
    obj.id = data.nextId++;
    obj.created_at = now();
    data.inventories.unshift(obj);
    showToast('添加成功', 'success');
  }

  saveData(data);
  closeInvModal();
  renderInventory();
}

function deleteInventory(id) {
  if (!confirm('确定删除这个商品？')) return;
  const data = getData();
  data.inventories = data.inventories.filter(x => x.id !== id);
  saveData(data);
  showToast('已删除', 'info');
  renderInventory();
}

// 入库
function openStockInModal() {
  const data = getData();
  const sel = document.getElementById('stockInProduct');
  sel.innerHTML = '<option value="">请选择商品</option>'+data.inventories.map(x => '<option value="'+x.id+'">'+esc(x.name)+' (当前:'+x.quantity+')</option>').join('');
  document.getElementById('stockInQty').value = '';
  document.getElementById('stockInRemark').value = '';
  document.getElementById('stockInModal').style.display = '';
}

function closeStockInModal() { document.getElementById('stockInModal').style.display = 'none'; }

function doStockIn(e) {
  e.preventDefault();
  const data = getData();
  const id = parseInt(document.getElementById('stockInProduct').value);
  const qty = parseInt(document.getElementById('stockInQty').value) || 0;
  if (!id) { showToast('请选择商品', 'error'); return; }
  if (qty <= 0) { showToast('请输入有效数量', 'error'); return; }
  const item = data.inventories.find(x => x.id === id);
  if (!item) { showToast('商品不存在', 'error'); return; }
  item.quantity += qty;
  item.updated_at = now();

  data.stockLogs.unshift({
    id: data.nextId++,
    productId: id,
    productName: item.name,
    type: 'in',
    quantity: qty,
    beforeQty: item.quantity - qty,
    afterQty: item.quantity,
    remark: document.getElementById('stockInRemark').value.trim() || '入库',
    created_at: now()
  });

  saveData(data);
  closeStockInModal();
  showToast('入库成功！'+item.name+' +'+qty, 'success');
  renderInventory();
}

// 出库
function openStockOutModal() {
  const data = getData();
  const sel = document.getElementById('stockOutProduct');
  sel.innerHTML = '<option value="">请选择商品</option>'+data.inventories.map(x => '<option value="'+x.id+'">'+esc(x.name)+' (当前:'+x.quantity+')</option>').join('');
  document.getElementById('stockOutQty').value = '';
  document.getElementById('stockOutRemark').value = '';
  document.getElementById('stockOutModal').style.display = '';
}

function closeStockOutModal() { document.getElementById('stockOutModal').style.display = 'none'; }

function doStockOut(e) {
  e.preventDefault();
  const data = getData();
  const id = parseInt(document.getElementById('stockOutProduct').value);
  const qty = parseInt(document.getElementById('stockOutQty').value) || 0;
  if (!id) { showToast('请选择商品', 'error'); return; }
  if (qty <= 0) { showToast('请输入有效数量', 'error'); return; }
  const item = data.inventories.find(x => x.id === id);
  if (!item) { showToast('商品不存在', 'error'); return; }
  if (item.quantity < qty) { showToast('库存不足！当前库存:'+item.quantity, 'error'); return; }
  item.quantity -= qty;
  item.updated_at = now();

  data.stockLogs.unshift({
    id: data.nextId++,
    productId: id,
    productName: item.name,
    type: 'out',
    quantity: qty,
    beforeQty: item.quantity + qty,
    afterQty: item.quantity,
    remark: document.getElementById('stockOutRemark').value.trim() || '出库',
    created_at: now()
  });

  saveData(data);
  closeStockOutModal();
  showToast('出库成功！'+item.name+' -'+qty, 'success');
  renderInventory();
}

// 库存流水
function showStockLog(id) {
  const data = getData();
  const item = data.inventories.find(x => x.id === id);
  if (!item) { showToast('商品不存在', 'error'); return; }
  const logs = data.stockLogs.filter(l => l.productId === id);

  let html = '<div style="margin-bottom:12px"><strong>'+esc(item.name)+'</strong> 当前库存: '+item.quantity+' '+item.unit+'</div>';
  if (logs.length === 0) {
    html += '<div style="text-align:center;padding:20px;color:var(--text-secondary)">暂无流水记录</div>';
  } else {
    html += '<table class="stock-log-table"><tr><th>时间</th><th>类型</th><th>数量</th><th>变动前</th><th>变动后</th><th>备注</th></tr>';
    logs.forEach(l => {
      const typeHtml = l.type === 'in' ? '<span style="color:var(--success)">入库</span>' : '<span style="color:var(--danger)">出库</span>';
      html += '<tr><td>'+l.created_at+'</td><td>'+typeHtml+'</td><td>'+(l.type==='in'?'+':'-')+l.quantity+'</td><td>'+l.beforeQty+'</td><td>'+l.afterQty+'</td><td>'+esc(l.remark||'')+'</td></tr>';
    });
    html += '</table>';
  }

  document.getElementById('stockLogContent').innerHTML = html;
  document.getElementById('stockLogModal').style.display = '';
}

function closeStockLogModal() { document.getElementById('stockLogModal').style.display = 'none'; }

function searchInventory() {
  clearTimeout(invSearchTimer);
  invSearchTimer = setTimeout(() => {
    invSearch = document.getElementById('invSearch').value.trim().toLowerCase();
    invPage = 1;
    renderInventory();
  }, 300);
}

function filterInvCategory(cat) {
  invCategory = cat;
  invPage = 1;
  renderInventory();
}

function changeInvPage(delta) {
  invPage = Math.max(1, invPage + delta);
  renderInventory();
}

function renderInventory() {
  const data = getData();
  let filtered = data.inventories;
  if (invSearch) filtered = filtered.filter(x =>
    (x.name||'').toLowerCase().includes(invSearch) || (x.code||'').toLowerCase().includes(invSearch)
  );
  if (invCategory) filtered = filtered.filter(x => x.category === invCategory);

  // Stats
  const total = filtered.length;
  const lowStock = filtered.filter(x => x.minStock > 0 && x.quantity <= x.minStock).length;
  const totalQty = filtered.reduce((s, x) => s + (x.quantity || 0), 0);
  const totalValue = filtered.reduce((s, x) => s + ((x.quantity||0) * (x.price||0)), 0);
  document.getElementById('invTotal').textContent = total;
  document.getElementById('invLowStock').textContent = lowStock;
  document.getElementById('invTotalQty').textContent = totalQty;
  document.getElementById('invTotalValue').textContent = formatMoney(totalValue);

  // Categories
  const cats = [...new Set(data.inventories.map(x => x.category).filter(Boolean))];
  const catHtml = '<button class="filter-btn '+(invCategory===''?'active':'')+'" onclick="filterInvCategory(\'\')">全部</button>'+
    cats.map(c => '<button class="filter-btn '+(invCategory===c?'active':'')+'" onclick="filterInvCategory(\''+c+'\')">'+esc(c)+'</button>').join('');
  document.getElementById('invCategoryFilter').innerHTML = catHtml;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(total / invPageSize));
  if (invPage > totalPages) invPage = totalPages;
  const offset = (invPage - 1) * invPageSize;
  const rows = filtered.slice(offset, offset + invPageSize);

  const list = document.getElementById('inventoryList');
  if (rows.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>'+(invSearch?'没有匹配的商品':'暂无商品，点击上方"新增商品"开始')+'</p></div>';
  } else {
    list.innerHTML = rows.map(x => renderInvCard(x)).join('');
  }

  document.getElementById('invPageInfo').textContent = `第 ${invPage} / ${totalPages} 页（共 ${total} 条）`;
  document.getElementById('invPrevPage').disabled = invPage <= 1;
  document.getElementById('invNextPage').disabled = invPage >= totalPages;
}

function renderInvCard(item) {
  const isLow = item.minStock > 0 && item.quantity <= item.minStock;
  const value = (item.quantity || 0) * (item.price || 0);
  return `
    <div class="data-card">
      <div class="top-row">
        <span class="name">${esc(item.name)} ${isLow ? '<span class="status-tag status-low">⚠️ 低库存</span>' : ''}</span>
        ${item.code ? '<span style="font-size:12px;color:var(--text-secondary)">'+esc(item.code)+'</span>' : ''}
      </div>
      <div style="display:flex;gap:16px;margin:6px 0;flex-wrap:wrap">
        <span style="font-size:20px;font-weight:700;color:${isLow?'var(--danger)':'var(--text)'}">${item.quantity||0}</span>
        <span style="color:var(--text-secondary);font-size:13px;line-height:28px">${item.unit||'个'}</span>
        ${item.price ? '<span style="color:var(--text-secondary);font-size:13px;line-height:28px">单价 '+formatMoney(item.price)+'</span>' : ''}
        ${value ? '<span style="color:var(--warning);font-size:13px;line-height:28px">估值 '+formatMoney(value)+'</span>' : ''}
      </div>
      ${item.minStock ? '<div class="info-row">⚠️ 预警线: '+item.minStock+'</div>' : ''}
      ${item.supplier ? '<div class="info-row"><span class="icon">🏭</span> '+esc(item.supplier)+'</div>' : ''}
      ${item.category ? '<div class="info-row"><span class="icon">📂</span> '+esc(item.category)+'</div>' : ''}
      ${item.remark ? '<div class="info-row"><span class="icon">📝</span> '+esc(item.remark)+'</div>' : ''}
      <div class="info-row" style="font-size:11px;color:#94a3b8">🕐 ${item.updated_at||item.created_at||''}</div>
      <div class="actions" onclick="event.stopPropagation()">
        <button class="btn btn-sm btn-outline" onclick="showStockLog(${item.id})" style="width:auto">📋 流水</button>
        <button class="btn btn-sm btn-outline" onclick="editInventory(${item.id})" style="width:auto">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteInventory(${item.id})" style="width:auto">🗑️</button>
      </div>
    </div>
  `;
}

function exportInventory() {
  const data = getData();
  let filtered = data.inventories;
  if (invSearch) filtered = filtered.filter(x =>
    (x.name||'').toLowerCase().includes(invSearch) || (x.code||'').toLowerCase().includes(invSearch)
  );
  if (invCategory) filtered = filtered.filter(x => x.category === invCategory);
  if (filtered.length === 0) { showToast('没有数据可导出', 'error'); return; }

  const h = ['序号','商品名称','编码','库存数量','单位','预警线','单价','库存价值','供应商','分类','备注'];
  const rows = [h];
  filtered.forEach((x, i) => {
    rows.push([i+1, x.name, x.code||'', x.quantity||0, x.unit||'', x.minStock||0, x.price||0, ((x.quantity||0)*(x.price||0)).toFixed(2), x.supplier||'', x.category||'', x.remark||'']);
  });

  const csv = rows.map(r => r.map(c => '"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '库存_'+(invCategory||'全部')+'.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 '+filtered.length+' 条', 'success');
}

// ===== 初始化 =====
switchTab('withdraw');
