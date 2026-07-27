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

// ===== 快手提现报表（结算=提现） =====
function renderKsWithdrawSummary() {
  const stores = [
    { name: 'MaxHealthy海外官方旗舰店', amount: 2012080.90, count: 161423 },
    { name: 'VITAFOLKS海外官方旗舰店', amount: 884300.66, count: 31229 },
    { name: 'BioEllis海外官方旗舰店', amount: 220293.19, count: 11537 },
    { name: 'TESSMEL海外官方旗舰店', amount: 19436.36, count: 602 },
  ];

  // ---- 按店铺汇总 ----
  const total = stores.reduce((s, x) => s + x.amount, 0);
  const totalCount = stores.reduce((s, x) => s + x.count, 0);
  document.getElementById('storeSummaryBody').innerHTML = stores.map(s => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:10px 12px">${s.name}</td>
      <td style="text-align:right;padding:10px 12px;font-weight:600">$${s.amount.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
      <td style="text-align:right;padding:10px 12px">${s.count.toLocaleString()}</td>
    </tr>
  `).join('') + `
    <tr style="border-top:2px solid var(--primary);font-weight:700">
      <td style="padding:10px 12px">合计</td>
      <td style="text-align:right;padding:10px 12px;color:var(--primary)">$${total.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
      <td style="text-align:right;padding:10px 12px">${totalCount.toLocaleString()}</td>
    </tr>
  `;

  // ---- 按年度汇总 ----
  const yearlyData = [
    { store: 'MaxHealthy海外官方旗舰店', '2024': 52293.48, '2025': 1401267.83, '2026': 558519.59 },
    { store: 'VITAFOLKS海外官方旗舰店', '2024': 423360.08, '2025': 398536.78, '2026': 62403.80 },
    { store: 'BioEllis海外官方旗舰店', '2024': 0, '2025': 15399.64, '2026': 204893.55 },
    { store: 'TESSMEL海外官方旗舰店', '2024': 0, '2025': 0, '2026': 19436.36 },
  ];
  document.getElementById('yearlySummaryBody').innerHTML = yearlyData.map(s => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 12px">${s.store}</td>
      <td style="text-align:right;padding:8px 12px">${s['2024'] ? '$'+s['2024'].toLocaleString('en-US',{minimumFractionDigits:2}) : '-'}</td>
      <td style="text-align:right;padding:8px 12px">${s['2025'] ? '$'+s['2025'].toLocaleString('en-US',{minimumFractionDigits:2}) : '-'}</td>
      <td style="text-align:right;padding:8px 12px">${s['2026'] ? '$'+s['2026'].toLocaleString('en-US',{minimumFractionDigits:2}) : '-'}</td>
      <td style="text-align:right;padding:8px 12px;font-weight:600;color:var(--primary)">$${(s['2024']+s['2025']+s['2026']).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
    </tr>
  `).join('');

  // ---- 按月度汇总 ----
  const monthlyData = [
    // MaxHealthy
    { store: 'MaxHealthy', ym: '2024-10', amount: 1005.06 },
    { store: 'MaxHealthy', ym: '2024-11', amount: 10531.96 },
    { store: 'MaxHealthy', ym: '2024-12', amount: 40756.46 },
    { store: 'MaxHealthy', ym: '2025-01', amount: 89986.83 },
    { store: 'MaxHealthy', ym: '2025-02', amount: 97271.77 },
    { store: 'MaxHealthy', ym: '2025-03', amount: 279387.89 },
    { store: 'MaxHealthy', ym: '2025-04', amount: 140504.63 },
    { store: 'MaxHealthy', ym: '2025-05', amount: 61841.57 },
    { store: 'MaxHealthy', ym: '2025-06', amount: 188211.21 },
    { store: 'MaxHealthy', ym: '2025-07', amount: 189255.95 },
    { store: 'MaxHealthy', ym: '2025-08', amount: 44807.95 },
    { store: 'MaxHealthy', ym: '2025-11', amount: 1042.97 },
    { store: 'MaxHealthy', ym: '2025-12', amount: 31260.43 },
    { store: 'MaxHealthy', ym: '2026-01', amount: 85111.82 },
    { store: 'MaxHealthy', ym: '2026-02', amount: 96727.23 },
    { store: 'MaxHealthy', ym: '2026-03', amount: 77962.45 },
    { store: 'MaxHealthy', ym: '2026-04', amount: 71182.81 },
    { store: 'MaxHealthy', ym: '2026-05', amount: 52129.15 },
    { store: 'MaxHealthy', ym: '2026-06', amount: 22200.79 },
    { store: 'MaxHealthy', ym: '2026-07', amount: 51350.34 },
    // VITAFOLKS
    { store: 'VITAFOLKS', ym: '2024-01', amount: 17562.60 },
    { store: 'VITAFOLKS', ym: '2024-03', amount: 40438.12 },
    { store: 'VITAFOLKS', ym: '2024-04', amount: 14034.09 },
    { store: 'VITAFOLKS', ym: '2024-05', amount: 26001.27 },
    { store: 'VITAFOLKS', ym: '2024-06', amount: 30871.42 },
    { store: 'VITAFOLKS', ym: '2024-07', amount: 11021.65 },
    { store: 'VITAFOLKS', ym: '2024-08', amount: 41186.80 },
    { store: 'VITAFOLKS', ym: '2024-09', amount: 41248.81 },
    { store: 'VITAFOLKS', ym: '2024-10', amount: 48297.11 },
    { store: 'VITAFOLKS', ym: '2024-11', amount: 54457.49 },
    { store: 'VITAFOLKS', ym: '2024-12', amount: 97940.72 },
    { store: 'VITAFOLKS', ym: '2025-01', amount: 96560.92 },
    { store: 'VITAFOLKS', ym: '2025-02', amount: 48882.51 },
    { store: 'VITAFOLKS', ym: '2025-03', amount: 62161.27 },
    { store: 'VITAFOLKS', ym: '2025-04', amount: 51990.17 },
    { store: 'VITAFOLKS', ym: '2025-05', amount: 20380.89 },
    { store: 'VITAFOLKS', ym: '2025-06', amount: 25007.80 },
    { store: 'VITAFOLKS', ym: '2025-07', amount: 45581.83 },
    { store: 'VITAFOLKS', ym: '2025-08', amount: 10221.70 },
    { store: 'VITAFOLKS', ym: '2025-12', amount: 27749.69 },
    { store: 'VITAFOLKS', ym: '2026-02', amount: 18061.91 },
    { store: 'VITAFOLKS', ym: '2026-04', amount: 7572.21 },
    { store: 'VITAFOLKS', ym: '2026-05', amount: 7663.96 },
    { store: 'VITAFOLKS', ym: '2026-07', amount: 29105.72 },
    // BioEllis
    { store: 'BioEllis', ym: '2025-11', amount: 2997.26 },
    { store: 'BioEllis', ym: '2025-12', amount: 12402.38 },
    { store: 'BioEllis', ym: '2026-01', amount: 76051.41 },
    { store: 'BioEllis', ym: '2026-02', amount: 45969.36 },
    { store: 'BioEllis', ym: '2026-03', amount: 29521.99 },
    { store: 'BioEllis', ym: '2026-04', amount: 49055.01 },
    { store: 'BioEllis', ym: '2026-05', amount: 32918.59 },
    { store: 'BioEllis', ym: '2026-06', amount: 10410.86 },
    { store: 'BioEllis', ym: '2026-07', amount: 5081.11 },
    // TESSMEL
    { store: 'TESSMEL', ym: '2026-04', amount: 11364.68 },
    { store: 'TESSMEL', ym: '2026-05', amount: 8071.68 },
  ];

  const storeOrder = ['MaxHealthy', 'VITAFOLKS', 'BioEllis', 'TESSMEL'];
  const container = document.getElementById('monthlySummaryContainer');
  let html = '';
  for (const storeName of storeOrder) {
    const items = monthlyData.filter(d => d.store === storeName).sort((a, b) => a.ym.localeCompare(b.ym));
    const totalAmt = items.reduce((s, x) => s + x.amount, 0);
    html += '<div style="margin-bottom:16px">';
    html += '<div style="font-weight:600;margin-bottom:6px;font-size:14px">' + storeName + '海外官方旗舰店 <span style="color:var(--text-secondary);font-weight:400">合计: $' + totalAmt.toLocaleString('en-US',{minimumFractionDigits:2}) + '</span></div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    html += '<thead><tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:6px 10px">月份</th><th style="text-align:right;padding:6px 10px">提现金额（USD）</th></tr></thead><tbody>';
    for (const item of items) {
      const [y, m] = item.ym.split('-');
      html += '<tr style="border-bottom:1px solid #eee"><td style="padding:5px 10px">' + y + '年' + parseInt(m) + '月</td><td style="text-align:right;padding:5px 10px">$' + item.amount.toLocaleString('en-US',{minimumFractionDigits:2}) + '</td></tr>';
    }
    html += '</tbody></table></div>';
  }
  container.innerHTML = html;
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
    return;
  }

  // Build report table
  const thead = `
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>提现人</th>
        <th style="width:120px">日期</th>
        <th class="num" style="width:120px">金额</th>
        <th style="width:100px">状态</th>
        <th>银行账户</th>
        <th>备注</th>
        <th class="center" style="width:140px">操作</th>
      </tr>
    </thead>`;

  const tbody = rows.map((w, i) => {
    const statusHtml = w.status === 'pending'
      ? '<span class="status-tag status-pending">⏳ 待打款</span>'
      : '<span class="status-tag status-done">✅ 已打款</span>';
    return `<tr>
      <td>${offset + i + 1}</td>
      <td class="name-cell">${esc(w.person)}</td>
      <td>${esc(w.date || '-')}</td>
      <td class="num"><span class="amount amount-positive">${formatMoney(w.amount)}</span></td>
      <td>${statusHtml}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis" title="${esc(w.account||'')}">${esc(w.account) || '-'}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${esc(w.remark||'')}">${esc(w.remark) || '-'}</td>
      <td class="center">
        <div class="actions-cell">
          <button class="btn-icon text-green" onclick="toggleWdStatus(${w.id})" title="${w.status === 'pending' ? '标记已打款' : '撤回'}">${w.status === 'pending' ? '✅' : '↩️'}</button>
          <button class="btn-icon text-primary" onclick="editWithdraw(${w.id})" title="编辑">✏️</button>
          <button class="btn-icon text-red" onclick="deleteWithdraw(${w.id})" title="删除">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Summary footer
  const pageAmt = rows.reduce((s, w) => s + (w.amount || 0), 0);
  const summary = `<div class="report-summary">
    本页金额: <strong class="total-amt">${formatMoney(pageAmt)}</strong>
    &nbsp;|&nbsp; 待打款: <strong class="pending-count">${pending}</strong>
    &nbsp;|&nbsp; 已打款: <strong class="done-count">${done}</strong>
  </div>`;

  list.innerHTML = `
    <div class="report-container">
      <div class="report-header">
        <div class="report-title">💳 提现明细报表 <span class="sub">${wdFilterDate ? '筛选日期: '+wdFilterDate : '全部记录'}</span></div>
        <div style="font-size:12px;color:var(--text-secondary)">共 ${total} 笔 / 合计 ${formatMoney(totalAmt)}</div>
      </div>
      <div class="report-table-wrap">
        <table class="report-table">
          ${thead}
          <tbody>${tbody}</tbody>
        </table>
      </div>
      <div class="report-footer">${summary}</div>
    </div>`;

  document.getElementById('wdPageInfo').textContent = `第 ${wdPage} / ${totalPages} 页（共 ${total} 条）`;
  document.getElementById('wdPrevPage').disabled = wdPage <= 1;
  document.getElementById('wdNextPage').disabled = wdPage >= totalPages;

  // 同步渲染快手提现汇总
  renderKsWithdrawSummary();
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

  const info = '<div style="padding:12px 16px;background:#f8fafc;border-bottom:2px solid var(--border);font-size:14px"><strong>'+esc(item.name)+'</strong> 当前库存: <strong style="color:var(--primary)">'+item.quantity+'</strong> '+item.unit+'</div>';

  if (logs.length === 0) {
    document.getElementById('stockLogContent').innerHTML = info + '<div style="text-align:center;padding:24px;color:var(--text-secondary)">暂无流水记录</div>';
  } else {
    const rows = logs.map(l => {
      const isIn = l.type === 'in';
      return '<tr>'+
        '<td>'+l.created_at+'</td>'+
        '<td><span style="color:'+(isIn?'var(--success)':'var(--danger)')+';font-weight:600">'+(isIn?'📥 入库':'📤 出库')+'</span></td>'+
        '<td class="num"><strong style="color:'+(isIn?'var(--success)':'var(--danger)')+'">'+(isIn?'+':'-')+l.quantity+'</strong></td>'+
        '<td class="num">'+l.beforeQty+'</td>'+
        '<td class="num">'+l.afterQty+'</td>'+
        '<td>'+esc(l.remark||'')+'</td>'+
        '</tr>';
    }).join('');

    document.getElementById('stockLogContent').innerHTML = info + `
      <div class="report-table-wrap">
        <table class="report-table">
          <thead><tr><th>时间</th><th>类型</th><th class="num">数量</th><th class="num">变动前</th><th class="num">变动后</th><th>备注</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="report-footer" style="font-size:12px;color:var(--text-secondary)">
        共 ${logs.length} 条流水记录
      </div>`;
  }

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
    return;
  }

  // Build report table
  const thead = `
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>商品名称</th>
        <th style="width:80px">编码</th>
        <th class="num" style="width:70px">库存</th>
        <th style="width:50px">单位</th>
        <th class="num" style="width:70px">预警线</th>
        <th class="num" style="width:90px">单价</th>
        <th class="num" style="width:100px">估值</th>
        <th style="width:80px">分类</th>
        <th style="width:120px">备注</th>
        <th class="center" style="width:120px">操作</th>
      </tr>
    </thead>`;

  const tbody = rows.map((x, i) => {
    const isLow = x.minStock > 0 && x.quantity <= x.minStock;
    const value = (x.quantity || 0) * (x.price || 0);
    const lowBadge = isLow ? ' <span class="status-tag status-low">⚠️ 低</span>' : '';
    return `<tr${isLow ? ' style="background:#fffbf5"' : ''}>
      <td>${offset + i + 1}</td>
      <td class="name-cell">${esc(x.name)}${lowBadge}</td>
      <td>${esc(x.code) || '-'}</td>
      <td class="num"><strong style="color:${isLow?'var(--danger)':'var(--text)'}">${x.quantity||0}</strong></td>
      <td>${esc(x.unit) || '-'}</td>
      <td class="num">${x.minStock || '-'}</td>
      <td class="num">${x.price ? formatMoney(x.price) : '-'}</td>
      <td class="num">${value ? formatMoney(value) : '-'}</td>
      <td>${esc(x.category) || '-'}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${esc(x.remark||'')}">${esc(x.remark) || '-'}</td>
      <td class="center">
        <div class="actions-cell">
          <button class="btn-icon text-primary" onclick="showStockLog(${x.id})" title="流水">📋</button>
          <button class="btn-icon text-primary" onclick="editInventory(${x.id})" title="编辑">✏️</button>
          <button class="btn-icon text-red" onclick="deleteInventory(${x.id})" title="删除">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Summary footer
  const pageValue = rows.reduce((s, x) => s + ((x.quantity||0) * (x.price||0)), 0);
  const pageQty = rows.reduce((s, x) => s + (x.quantity || 0), 0);
  const summary = `<div class="report-summary">
    本页数量: <strong>${pageQty}</strong>
    &nbsp;|&nbsp; 本页估值: <strong class="total-amt">${formatMoney(pageValue)}</strong>
    &nbsp;|&nbsp; 低库存预警: <strong class="${lowStock > 0 ? 'pending-count' : 'done-count'}">${lowStock}</strong>
    &nbsp;|&nbsp; 总库存价值: <strong class="total-amt">${formatMoney(totalValue)}</strong>
  </div>`;

  list.innerHTML = `
    <div class="report-container">
      <div class="report-header">
        <div class="report-title">📦 库存报表 <span class="sub">${invCategory ? '分类: '+invCategory : '全部商品'}</span></div>
        <div style="font-size:12px;color:var(--text-secondary)">共 ${total} 种商品 / 总库存 ${totalQty} ${rows[0]?.unit||'件'}</div>
      </div>
      <div class="report-table-wrap">
        <table class="report-table">
          ${thead}
          <tbody>${tbody}</tbody>
        </table>
      </div>
      <div class="report-footer">${summary}</div>
    </div>`;

  document.getElementById('invPageInfo').textContent = `第 ${invPage} / ${totalPages} 页（共 ${total} 条）`;
  document.getElementById('invPrevPage').disabled = invPage <= 1;
  document.getElementById('invNextPage').disabled = invPage >= totalPages;
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
