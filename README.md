# 安必拓运营管理系统 📊

提现管理与库存管理工具，纯前端应用，数据存储在浏览器本地 (localStorage)。

## 功能

### 💳 提现管理
- 提现记录录入（提现人、金额、日期、银行账户）
- 标记已打款/待打款状态
- 按日期筛选
- 导出 CSV

### 📦 库存管理
- 商品信息管理（名称、编码、库存量、单价、供应商、分类）
- 入库/出库操作（自动更新库存）
- 库存流水查看
- 低库存预警
- 分类筛选、搜索
- 导出 CSV

## 部署到 GitHub Pages

### 方式一：直接用这个仓库

1. Fork 这个仓库
2. 在仓库 Settings → Pages → 选择 `GitHub Actions` 作为部署源
3. 推送到 `main` 分支，自动部署

### 方式二：新建仓库

```bash
cd C:\Users\宋云杰\Documents\my-project\operation-app
git init
git add .
git commit -m "初始化"
git remote add origin https://github.com/你的用户名/operation-app.git
git branch -M main
git push -u origin main
```

推送后自动部署，地址为：`https://你的用户名.github.io/operation-app/`

## 本地运行（带 Node 后端）

```bash
npm install
node server.js
# 访问 http://localhost:3002
```
