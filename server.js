const express = require('express');
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('读取数据文件失败:', e.message);
  }
  return { withdraws: [], inventories: [], stockLogs: [], nextId: 1 };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

let data = loadData();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== 提现管理 API =====

app.get('/api/withdraws', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const status = req.query.status || '';
  const date = req.query.date || '';
  const person = req.query.person || '';

  let filtered = data.withdraws;
  if (status) filtered = filtered.filter(w => w.status === status);
  if (date) filtered = filtered.filter(w => w.date === date);
  if (person) filtered = filtered.filter(w => (w.person||'').includes(person));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const rows = filtered.slice(offset, offset + limit);

  res.json({ ok: true, data: rows, total, page, totalPages });
});

app.post('/api/withdraws', (req, res) => {
  const { person, amount, date, account, status, remark } = req.body;
  if (!person || !amount) {
    return res.status(400).json({ ok: false, msg: '请填写提现人和金额' });
  }

  const now = new Date();
  const ts = now.toISOString().replace('T', ' ').slice(0, 19);
  const w = {
    id: data.nextId++,
    person: person.trim(),
    amount: parseFloat(amount) || 0,
    date: date || '',
    account: (account || '').trim(),
    status: status || 'pending',
    remark: (remark || '').trim(),
    created_at: ts,
    updated_at: ts,
  };

  data.withdraws.unshift(w);
  saveData(data);
  res.json({ ok: true, msg: '添加成功', data: w });
});

app.put('/api/withdraws/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = data.withdraws.findIndex(w => w.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, msg: '未找到' });

  const { person, amount, date, account, status, remark } = req.body;
  if (person !== undefined) data.withdraws[idx].person = person.trim();
  if (amount !== undefined) data.withdraws[idx].amount = parseFloat(amount) || 0;
  if (date !== undefined) data.withdraws[idx].date = date;
  if (account !== undefined) data.withdraws[idx].account = account.trim();
  if (status !== undefined) data.withdraws[idx].status = status;
  if (remark !== undefined) data.withdraws[idx].remark = remark.trim();
  data.withdraws[idx].updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

  saveData(data);
  res.json({ ok: true, msg: '已更新' });
});

app.delete('/api/withdraws/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = data.withdraws.findIndex(w => w.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, msg: '未找到' });
  data.withdraws.splice(idx, 1);
  saveData(data);
  res.json({ ok: true, msg: '已删除' });
});

// ===== 库存管理 API =====

app.get('/api/inventory', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const keyword = (req.query.keyword || '').trim().toLowerCase();
  const category = req.query.category || '';

  let filtered = data.inventories;
  if (keyword) filtered = filtered.filter(x =>
    (x.name||'').toLowerCase().includes(keyword) || (x.code||'').toLowerCase().includes(keyword)
  );
  if (category) filtered = filtered.filter(x => x.category === category);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const rows = filtered.slice(offset, offset + limit);

  res.json({ ok: true, data: rows, total, page, totalPages });
});

app.post('/api/inventory', (req, res) => {
  const { name, code, unit, quantity, minStock, price, supplier, category, remark } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, msg: '请填写商品名称' });
  }

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const item = {
    id: data.nextId++,
    name: name.trim(),
    code: (code || '').trim(),
    unit: (unit || '').trim(),
    quantity: parseInt(quantity) || 0,
    minStock: parseInt(minStock) || 0,
    price: parseFloat(price) || 0,
    supplier: (supplier || '').trim(),
    category: (category || '').trim(),
    remark: (remark || '').trim(),
    created_at: ts,
    updated_at: ts,
  };

  data.inventories.unshift(item);
  saveData(data);
  res.json({ ok: true, msg: '添加成功', data: item });
});

app.put('/api/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = data.inventories.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, msg: '未找到' });

  const { name, code, unit, quantity, minStock, price, supplier, category, remark } = req.body;
  if (name !== undefined) data.inventories[idx].name = name.trim();
  if (code !== undefined) data.inventories[idx].code = code.trim();
  if (unit !== undefined) data.inventories[idx].unit = unit.trim();
  if (quantity !== undefined) data.inventories[idx].quantity = parseInt(quantity) || 0;
  if (minStock !== undefined) data.inventories[idx].minStock = parseInt(minStock) || 0;
  if (price !== undefined) data.inventories[idx].price = parseFloat(price) || 0;
  if (supplier !== undefined) data.inventories[idx].supplier = supplier.trim();
  if (category !== undefined) data.inventories[idx].category = category.trim();
  if (remark !== undefined) data.inventories[idx].remark = remark.trim();
  data.inventories[idx].updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

  saveData(data);
  res.json({ ok: true, msg: '已更新' });
});

app.delete('/api/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = data.inventories.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, msg: '未找到' });
  data.inventories.splice(idx, 1);
  saveData(data);
  res.json({ ok: true, msg: '已删除' });
});

// ===== 入库/出库 =====
app.post('/api/inventory/:id/stock-in', (req, res) => {
  const id = parseInt(req.params.id);
  const item = data.inventories.find(x => x.id === id);
  if (!item) return res.status(404).json({ ok: false, msg: '未找到' });

  const quantity = parseInt(req.body.quantity) || 0;
  if (quantity <= 0) return res.status(400).json({ ok: false, msg: '数量无效' });

  const beforeQty = item.quantity;
  item.quantity += quantity;
  item.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

  data.stockLogs.unshift({
    id: data.nextId++,
    productId: id,
    productName: item.name,
    type: 'in',
    quantity,
    beforeQty,
    afterQty: item.quantity,
    remark: (req.body.remark || '入库').trim(),
    created_at: item.updated_at,
  });

  saveData(data);
  res.json({ ok: true, msg: '入库成功', data: item });
});

app.post('/api/inventory/:id/stock-out', (req, res) => {
  const id = parseInt(req.params.id);
  const item = data.inventories.find(x => x.id === id);
  if (!item) return res.status(404).json({ ok: false, msg: '未找到' });

  const quantity = parseInt(req.body.quantity) || 0;
  if (quantity <= 0) return res.status(400).json({ ok: false, msg: '数量无效' });
  if (item.quantity < quantity) return res.status(400).json({ ok: false, msg: '库存不足' });

  const beforeQty = item.quantity;
  item.quantity -= quantity;
  item.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

  data.stockLogs.unshift({
    id: data.nextId++,
    productId: id,
    productName: item.name,
    type: 'out',
    quantity,
    beforeQty,
    afterQty: item.quantity,
    remark: (req.body.remark || '出库').trim(),
    created_at: item.updated_at,
  });

  saveData(data);
  res.json({ ok: true, msg: '出库成功', data: item });
});

// ===== 库存流水 =====
app.get('/api/inventory/:id/logs', (req, res) => {
  const id = parseInt(req.params.id);
  const logs = data.stockLogs.filter(l => l.productId === id).slice(0, 200);
  res.json({ ok: true, data: logs });
});

// ===== 统计 =====
app.get('/api/stats', (req, res) => {
  const wdTotal = data.withdraws.length;
  const wdAmt = data.withdraws.reduce((s, w) => s + (w.amount || 0), 0);
  const wdPending = data.withdraws.filter(w => w.status === 'pending').length;
  const invTotal = data.inventories.length;
  const invLow = data.inventories.filter(x => x.minStock > 0 && x.quantity <= x.minStock).length;
  const invValue = data.inventories.reduce((s, x) => s + ((x.quantity||0) * (x.price||0)), 0);

  res.json({ ok: true, data: { wdTotal, wdAmt, wdPending, invTotal, invLow, invValue } });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`安必拓运营管理系统已启动 http://localhost:${PORT}`);
});
