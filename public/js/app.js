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
// 快手提现数据（2024-01 ~ 2026-07）
// ====================================================================

// 每日提现数据（按店铺分组）
const KS_DAILY_DATA = {
  'BioEllis海外官方旗舰店': [
    {d:"2025-11-22",a:989.54},{d:"2025-11-25",a:1064.68},{d:"2025-12-06",a:943.04},{d:"2025-12-16",a:2186.94},{d:"2025-12-17",a:6031.53},{d:"2025-12-23",a:940.18},{d:"2025-12-30",a:3243.73},{d:"2026-01-06",a:1522.3},{d:"2026-01-07",a:10697.83},{d:"2026-01-16",a:6103.22},{d:"2026-01-21",a:5183.33},{d:"2026-01-22",a:7001.2},{d:"2026-01-24",a:1657.61},{d:"2026-01-27",a:4227.04},{d:"2026-01-28",a:13093.03},{d:"2026-01-29",a:3842.11},{d:"2026-01-30",a:7280.62},{d:"2026-01-31",a:1114.45},{d:"2026-02-03",a:3544.52},{d:"2026-02-04",a:1744.56},{d:"2026-02-05",a:6840.35},{d:"2026-02-06",a:2000.59},{d:"2026-02-07",a:903.94},{d:"2026-02-10",a:5331.19},{d:"2026-02-11",a:11129.97},{d:"2026-02-12",a:1039.25},{d:"2026-02-14",a:1641.72},{d:"2026-02-25",a:5312.53},{d:"2026-02-26",a:8849.45},{d:"2026-03-06",a:985.66},{d:"2026-03-10",a:1172.76},{d:"2026-03-17",a:3060.34},{d:"2026-03-18",a:6179.69},{d:"2026-03-20",a:1253.95},{d:"2026-03-24",a:1229.71},{d:"2026-03-25",a:3609.42},{d:"2026-03-26",a:5530.1},{d:"2026-04-09",a:2140.38},{d:"2026-04-14",a:2597.62},{d:"2026-04-15",a:5065.56},{d:"2026-04-25",a:9776.84},{d:"2026-04-26",a:9100.25},{d:"2026-05-07",a:7018.79},{d:"2026-05-08",a:7074.48},{d:"2026-05-09",a:1085.3},{d:"2026-05-13",a:4834.6},{d:"2026-05-20",a:987.71},{d:"2026-05-22",a:5094.25},{d:"2026-05-27",a:1543.36},{d:"2026-06-28",a:10410.86},{d:"2026-07-06",a:5081.11},
  ],
  'MaxHealthy海外官方旗舰店': [
    {d:"2024-10-09",a:1005.06},{d:"2024-11-09",a:959.24},{d:"2024-11-15",a:868.09},{d:"2024-11-19",a:2045.75},{d:"2024-11-20",a:5160.63},{d:"2024-11-27",a:1497.25},{d:"2024-12-03",a:1394.3},{d:"2024-12-10",a:3804.76},{d:"2024-12-11",a:6958.78},{d:"2024-12-13",a:886.84},{d:"2024-12-14",a:886.13},{d:"2024-12-17",a:1711.21},{d:"2024-12-18",a:1356.14},{d:"2024-12-20",a:1505.77},{d:"2024-12-21",a:5685.99},{d:"2024-12-24",a:3380.51},{d:"2024-12-28",a:2444.54},{d:"2024-12-29",a:5362.28},{d:"2024-12-31",a:5380.21},{d:"2025-01-01",a:5125.27},{d:"2025-01-08",a:12160.17},{d:"2025-01-09",a:10507.35},{d:"2025-01-10",a:1659.5},{d:"2025-01-11",a:928.27},{d:"2025-01-14",a:8284.9},{d:"2025-01-15",a:10079.04},{d:"2025-01-16",a:3900.63},{d:"2025-01-17",a:2250.97},{d:"2025-01-18",a:19167.09},{d:"2025-01-19",a:10048.22},{d:"2025-01-22",a:3951.56},{d:"2025-01-23",a:1206.94},{d:"2025-01-24",a:17943.8},{d:"2025-01-25",a:21037.78},{d:"2025-01-28",a:4953.79},{d:"2025-01-29",a:6599.33},{d:"2025-02-06",a:32142.6},{d:"2025-02-07",a:30381.18},{d:"2025-02-12",a:5315.89},{d:"2025-02-13",a:6927.3},{d:"2025-02-19",a:1230.44},{d:"2025-02-20",a:15136.22},{d:"2025-02-21",a:14755.31},{d:"2025-02-22",a:1800.71},{d:"2025-02-25",a:3441.73},{d:"2025-02-26",a:9654.22},{d:"2025-02-27",a:1579.5},{d:"2025-03-12",a:66770.6},{d:"2025-03-14",a:83077.98},{d:"2025-03-15",a:20657.17},{d:"2025-03-16",a:14448.52},{d:"2025-03-21",a:17605.64},{d:"2025-03-22",a:14041.97},{d:"2025-03-26",a:19529.2},{d:"2025-03-27",a:18204.32},{d:"2025-03-28",a:1712.61},{d:"2025-03-29",a:7143.95},{d:"2025-03-30",a:7343.08},{d:"2025-04-01",a:8287.94},{d:"2025-04-03",a:12560.76},{d:"2025-04-04",a:15412.79},{d:"2025-04-08",a:4000.02},{d:"2025-04-12",a:30367.45},{d:"2025-04-13",a:19787.37},{d:"2025-04-15",a:11586.09},{d:"2025-04-16",a:6548.07},{d:"2025-04-24",a:26551.35},{d:"2025-04-25",a:17992.2},{d:"2025-04-26",a:1286.35},{d:"2025-04-29",a:2662.35},{d:"2025-04-30",a:1198.4},{d:"2025-05-07",a:6916.52},{d:"2025-05-08",a:9721.39},{d:"2025-05-10",a:1500.82},{d:"2025-05-13",a:7292.19},{d:"2025-05-14",a:6562.84},{d:"2025-05-16",a:1116.16},{d:"2025-05-17",a:2103.51},{d:"2025-05-20",a:3487.48},{d:"2025-05-21",a:8207.25},{d:"2025-05-22",a:1335.41},{d:"2025-05-23",a:944.07},{d:"2025-05-24",a:6124.11},{d:"2025-05-25",a:9627.58},{d:"2025-05-28",a:11115.91},{d:"2025-05-29",a:13267.79},{d:"2025-05-31",a:8209.54},{d:"2025-06-01",a:11300.48},{d:"2025-06-04",a:22526.13},{d:"2025-06-05",a:24440.58},{d:"2025-06-06",a:3627.21},{d:"2025-06-07",a:5920.7},{d:"2025-06-10",a:17395.19},{d:"2025-06-11",a:17761.7},{d:"2025-06-17",a:15338.31},{d:"2025-06-18",a:35365.51},{d:"2025-06-21",a:16967.86},{d:"2025-06-22",a:17816.01},{d:"2025-06-24",a:7275.5},{d:"2025-06-25",a:5649.77},{d:"2025-06-27",a:17644.33},{d:"2025-06-28",a:17751.62},{d:"2025-07-01",a:4967.39},{d:"2025-07-03",a:23600.74},{d:"2025-07-04",a:25153.89},{d:"2025-07-10",a:37532.12},{d:"2025-07-11",a:39954.32},{d:"2025-07-12",a:4828.43},{d:"2025-07-13",a:7899.12},{d:"2025-07-15",a:17009.57},{d:"2025-07-16",a:18975.42},{d:"2025-07-17",a:6083.69},{d:"2025-07-18",a:8294.95},{d:"2025-07-19",a:11391.58},{d:"2025-07-20",a:10172.65},{d:"2025-07-22",a:3656.13},{d:"2025-07-23",a:15345.1},{d:"2025-07-24",a:15813.72},{d:"2025-07-25",a:6740.97},{d:"2025-07-26",a:9250.15},{d:"2025-07-29",a:14260.12},{d:"2025-07-30",a:19530.83},{d:"2025-07-31",a:2509.6},{d:"2025-08-01",a:2820.14},{d:"2025-08-02",a:10400.36},{d:"2025-08-05",a:8930.43},{d:"2025-08-06",a:11418.06},{d:"2025-11-29",a:1042.97},{d:"2025-12-03",a:914.17},{d:"2025-12-05",a:2270.1},{d:"2025-12-06",a:933.34},{d:"2025-12-07",a:5375.42},{d:"2025-12-09",a:2307.5},{d:"2025-12-12",a:1676.27},{d:"2025-12-16",a:1764.09},{d:"2025-12-17",a:6402.35},{d:"2025-12-19",a:1076.33},{d:"2025-12-20",a:3111.71},{d:"2025-12-23",a:2067.49},{d:"2025-12-24",a:5933.42},{d:"2025-12-25",a:1229.93},{d:"2025-12-30",a:3363.9},{d:"2026-01-06",a:10886.91},{d:"2026-01-07",a:15332.91},{d:"2026-01-08",a:1240.5},{d:"2026-01-09",a:1254.5},{d:"2026-01-10",a:1070.01},{d:"2026-01-13",a:9598.23},{d:"2026-01-14",a:18491.12},{d:"2026-01-15",a:2688.03},{d:"2026-01-16",a:10385.28},{d:"2026-01-17",a:2449.38},{d:"2026-01-18",a:5993.54},{d:"2026-01-21",a:13259.54},{d:"2026-01-22",a:1542.85},{d:"2026-01-27",a:2500.22},{d:"2026-01-28",a:6037.48},{d:"2026-02-03",a:8615.4},{d:"2026-02-04",a:7493.78},{d:"2026-02-06",a:929.98},{d:"2026-02-07",a:8136.22},{d:"2026-02-08",a:10761.14},{d:"2026-02-10",a:2036.42},{d:"2026-02-26",a:59618.43},{d:"2026-02-27",a:7560.06},{d:"2026-02-28",a:2202.93},{d:"2026-03-03",a:1028.25},{d:"2026-03-05",a:1481.82},{d:"2026-03-06",a:3539.98},{d:"2026-03-07",a:10149.62},{d:"2026-03-10",a:6192.17},{d:"2026-03-11",a:9702.89},{d:"2026-03-12",a:1471.78},{d:"2026-03-13",a:1476.81},{d:"2026-03-14",a:7103.68},{d:"2026-03-18",a:8257.48},{d:"2026-03-19",a:14865.45},{d:"2026-03-20",a:5070.08},{d:"2026-03-21",a:13989.4},{d:"2026-03-22",a:5408.17},{d:"2026-03-24",a:6567.54},{d:"2026-03-25",a:11148.12},{d:"2026-03-26",a:7311.94},{d:"2026-03-27",a:1784.97},{d:"2026-03-28",a:1657.4},{d:"2026-03-29",a:5641.79},{d:"2026-03-31",a:5032.91},{d:"2026-04-01",a:1740.62},{d:"2026-04-02",a:5888.12},{d:"2026-04-09",a:13107.67},{d:"2026-04-10",a:14191.85},{d:"2026-04-11",a:1572.39},{d:"2026-04-14",a:4158.74},{d:"2026-04-15",a:8276.05},{d:"2026-04-16",a:1001.25},{d:"2026-04-17",a:1727.21},{d:"2026-04-18",a:1368.09},{d:"2026-04-19",a:5166.81},{d:"2026-04-21",a:3754.4},{d:"2026-04-22",a:1105.14},{d:"2026-04-23",a:1074.15},{d:"2026-04-24",a:5748.52},{d:"2026-04-25",a:2424.26},{d:"2026-04-28",a:4427.01},{d:"2026-04-29",a:6696.92},{d:"2026-04-30",a:976.06},{d:"2026-05-01",a:1094.76},{d:"2026-05-07",a:6774.7},{d:"2026-05-08",a:8695.71},{d:"2026-05-09",a:2114.98},{d:"2026-05-12",a:3591.96},{d:"2026-05-14",a:7537.67},{d:"2026-05-15",a:994.21},{d:"2026-05-16",a:1105.52},{d:"2026-05-19",a:3325.55},{d:"2026-05-20",a:6790.5},{d:"2026-05-21",a:1129.22},{d:"2026-05-22",a:1001.8},{d:"2026-05-23",a:1064.2},{d:"2026-05-24",a:5324.56},{d:"2026-05-27",a:2425.63},{d:"2026-05-29",a:6902.54},{d:"2026-06-04",a:5689.49},{d:"2026-06-10",a:5408.95},{d:"2026-06-13",a:5119.31},{d:"2026-06-17",a:6502.04},{d:"2026-06-28",a:17652.71},{d:"2026-07-06",a:9245.05},{d:"2026-07-09",a:5145.44},{d:"2026-07-16",a:8577.08},{d:"2026-07-22",a:6879.23},{d:"2026-07-26",a:5054.41},
  ],
  'TESSMEL海外官方旗舰店': [
    {d:"2026-04-14",a:1050.21},{d:"2026-04-21",a:2280.74},{d:"2026-04-22",a:8033.73},{d:"2026-05-14",a:1026.24},{d:"2026-05-19",a:1163.89},{d:"2026-05-20",a:5881.55},
  ],
  'VITAFOLKS海外官方旗舰店': [
    {d:"2024-01-03",a:1947.22},{d:"2024-01-04",a:5668.8},{d:"2024-01-05",a:2409.1},{d:"2024-01-07",a:5303.59},{d:"2024-01-17",a:1355.38},{d:"2024-01-30",a:878.51},{d:"2024-03-15",a:1125.56},{d:"2024-03-17",a:5390.57},{d:"2024-03-19",a:2464.9},{d:"2024-03-21",a:6766.95},{d:"2024-03-23",a:2708.93},{d:"2024-03-24",a:5660.84},{d:"2024-03-26",a:1354.87},{d:"2024-03-27",a:4921.3},{d:"2024-03-28",a:11918.45},{d:"2024-04-10",a:4488.74},{d:"2024-04-11",a:9329.84},{d:"2024-04-23",a:1625.33},{d:"2024-04-25",a:926.21},{d:"2024-04-30",a:1665.97},{d:"2024-05-01",a:7927.59},{d:"2024-05-11",a:2367.96},{d:"2024-05-15",a:1395.54},{d:"2024-05-22",a:4113},{d:"2024-05-23",a:6678.36},{d:"2024-05-31",a:865.79},{d:"2024-06-04",a:1485.39},{d:"2024-06-05",a:6105.39},{d:"2024-06-07",a:1066.58},{d:"2024-06-12",a:1515.12},{d:"2024-06-15",a:4041.16},{d:"2024-06-16",a:10308.06},{d:"2024-06-19",a:3255.35},{d:"2024-06-22",a:1815.73},{d:"2024-06-23",a:6819.46},{d:"2024-07-03",a:2950.4},{d:"2024-07-10",a:1642},{d:"2024-07-11",a:5459.86},{d:"2024-07-23",a:969.39},{d:"2024-08-03",a:3003.65},{d:"2024-08-04",a:5185.61},{d:"2024-08-06",a:899.08},{d:"2024-08-13",a:5802.59},{d:"2024-08-14",a:14974.62},{d:"2024-08-20",a:2931.74},{d:"2024-08-21",a:8422.88},{d:"2024-08-31",a:1905.06},{d:"2024-09-13",a:4286.54},{d:"2024-09-14",a:12272.91},{d:"2024-09-20",a:4196.85},{d:"2024-09-21",a:7020.5},{d:"2024-09-24",a:4643.67},{d:"2024-09-25",a:8828.37},{d:"2024-10-01",a:1349.51},{d:"2024-10-09",a:936.85},{d:"2024-10-16",a:1184.56},{d:"2024-10-17",a:5546.71},{d:"2024-10-23",a:4594.95},{d:"2024-10-24",a:7987.37},{d:"2024-10-29",a:7737.22},{d:"2024-10-30",a:14474.72},{d:"2024-10-31",a:1040.2},{d:"2024-11-05",a:2282.57},{d:"2024-11-06",a:5830.96},{d:"2024-11-13",a:2338.63},{d:"2024-11-14",a:6155.32},{d:"2024-11-15",a:939.16},{d:"2024-11-19",a:4702.65},{d:"2024-11-20",a:8445.04},{d:"2024-11-23",a:3075.78},{d:"2024-11-24",a:5603.82},{d:"2024-11-26",a:2376.11},{d:"2024-11-28",a:5925.52},{d:"2024-11-30",a:14303.25},{d:"2024-12-06",a:21539.41},{d:"2024-12-07",a:32474.11},{d:"2024-12-10",a:2206.21},{d:"2024-12-12",a:1296.49},{d:"2024-12-13",a:5254.72},{d:"2024-12-17",a:851.81},{d:"2024-12-19",a:1219.13},{d:"2024-12-24",a:966.24},{d:"2024-12-28",a:3806.26},{d:"2024-12-29",a:9164.11},{d:"2024-12-31",a:4683.43},{d:"2025-01-01",a:9013.07},{d:"2025-01-03",a:1215.74},{d:"2025-01-07",a:18140.07},{d:"2025-01-08",a:35168.43},{d:"2025-01-10",a:1018.05},{d:"2025-01-14",a:5077.76},{d:"2025-01-15",a:15738.87},{d:"2025-01-22",a:12088.73},{d:"2025-02-08",a:13334.78},{d:"2025-02-09",a:23962.47},{d:"2025-02-19",a:954.01},{d:"2025-02-27",a:3863.16},{d:"2025-02-28",a:7111.51},{d:"2025-03-04",a:6244.47},{d:"2025-03-05",a:8632.03},{d:"2025-03-06",a:5097.83},{d:"2025-03-07",a:5340.86},{d:"2025-03-15",a:13697.44},{d:"2025-03-16",a:15275.79},{d:"2025-03-19",a:1007.9},{d:"2025-03-25",a:1042.59},{d:"2025-03-27",a:1386.36},{d:"2025-04-01",a:2707.18},{d:"2025-04-02",a:6020.14},{d:"2025-04-03",a:1107.27},{d:"2025-04-09",a:7768.29},{d:"2025-04-10",a:9614.7},{d:"2025-04-11",a:1299.18},{d:"2025-04-12",a:1494.82},{d:"2025-04-15",a:1753.28},{d:"2025-04-16",a:6143.08},{d:"2025-04-23",a:11233.55},{d:"2025-04-24",a:10512.39},{d:"2025-04-26",a:2172.03},{d:"2025-04-29",a:1204.41},{d:"2025-05-07",a:1771.91},{d:"2025-05-08",a:6737.65},{d:"2025-05-10",a:1032.4},{d:"2025-05-14",a:1386.47},{d:"2025-05-18",a:5200.34},{d:"2025-05-20",a:1140.14},{d:"2025-05-28",a:1006.84},{d:"2025-05-29",a:1831.71},{d:"2025-05-31",a:1598.36},{d:"2025-06-01",a:5226.52},{d:"2025-06-04",a:1783.74},{d:"2025-06-06",a:966.42},{d:"2025-06-10",a:1084.07},{d:"2025-06-14",a:882.53},{d:"2025-06-15",a:5091.74},{d:"2025-06-19",a:843.92},{d:"2025-06-21",a:1733.44},{d:"2025-06-24",a:2898.42},{d:"2025-06-25",a:7407.73},{d:"2025-06-26",a:1372.77},{d:"2025-06-28",a:949.06},{d:"2025-07-01",a:11506.22},{d:"2025-07-02",a:18275.05},{d:"2025-07-03",a:1653.86},{d:"2025-07-08",a:1621.66},{d:"2025-07-15",a:1632.53},{d:"2025-07-18",a:6117.45},{d:"2025-07-22",a:1319.71},{d:"2025-07-24",a:950.39},{d:"2025-08-09",a:2884.4},{d:"2025-08-10",a:6451.24},{d:"2025-08-16",a:886.06},{d:"2025-12-10",a:2009.28},{d:"2025-12-11",a:5576.28},{d:"2025-12-13",a:1005.86},{d:"2025-12-17",a:6065.22},{d:"2025-12-20",a:2983.84},{d:"2025-12-21",a:7006.69},{d:"2025-12-24",a:1202.62},{d:"2026-02-07",a:4568.8},{d:"2026-02-08",a:12591.35},{d:"2026-02-25",a:901.76},{d:"2026-04-01",a:940.15},{d:"2026-04-03",a:5140.86},{d:"2026-04-09",a:1491.2},{d:"2026-05-15",a:1005.33},{d:"2026-05-20",a:5704.58},{d:"2026-05-23",a:954.05},{d:"2026-07-16",a:8149.65},{d:"2026-07-18",a:7003.04},{d:"2026-07-24",a:13953.03},
  ],
};

function fmtUSD(n) {
  return '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: 2});
}

function getLastNDays(data, n) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - n);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return data.filter(d => d.d >= cutoffStr);
}

function renderKsWithdrawSummary() {
  renderKsOverview();
}

function renderKsOverview() {
  const stores = Object.keys(KS_DAILY_DATA).sort();
  const last30Data = {};
  let total30 = 0;

  for (const store of stores) {
    const recent = getLastNDays(KS_DAILY_DATA[store], 30);
    const amt = recent.reduce((s, d) => s + d.a, 0);
    last30Data[store] = { amount: amt, count: recent.length };
    total30 += amt;
  }

  const container = document.getElementById('ksWithdrawApp');

  // 最近的提现日期
  const allDates = Object.values(KS_DAILY_DATA).flat().map(d => d.d).filter(Boolean).sort();
  const lastDate = allDates[allDates.length - 1] || '';

  container.innerHTML = `
    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
      <div class="stat-card" style="cursor:pointer" onclick="renderKsOverview()">
        <div class="num" style="color:var(--primary)">${fmtUSD(total30)}</div>
        <div class="label">最近30天提现</div>
      </div>
      <div class="stat-card">
        <div class="num" style="color:var(--primary)">${fmtUSD(Object.values(KS_DAILY_DATA).flat().reduce((s,d)=>s+d.a,0))}</div>
        <div class="label">历史累计（截至${lastDate}）</div>
      </div>
    </div>

    <!-- Time filter -->
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn btn-sm ${'btn-primary'}" style="width:auto" onclick="renderKsDaysView(30)">📅 最近30天</button>
      <button class="btn btn-sm btn-outline" style="width:auto" onclick="renderKsDaysView(90)">最近90天</button>
      <button class="btn btn-sm btn-outline" style="width:auto" onclick="renderKsDaysView(365)">今年</button>
      <button class="btn btn-sm btn-outline" style="width:auto" onclick="renderKsAllView()">全部</button>
      <span style="flex:1"></span>
      <a href="快手提现汇总_年度月度每日_2024-01-01~2026-07-26.xlsx" class="btn btn-sm btn-outline" style="text-decoration:none;width:auto" download>📥 下载Excel</a>
    </div>

    <!-- Store cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px" id="ksStoreCards">
      ${stores.map(store => {
        const all = KS_DAILY_DATA[store];
        const total = all.reduce((s, d) => s + d.a, 0);
        const count = all.length;
        const recent = last30Data[store];
        return `
          <div class="stat-card" style="cursor:pointer;transition:transform .15s;padding:16px" onclick="renderKsStoreDetail('${esc(store)}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px">${esc(store.replace('海外官方旗舰店',''))}</div>
            <div style="display:flex;justify-content:space-between;margin-top:8px">
              <div><div style="font-size:18px;font-weight:700;color:var(--primary)">${fmtUSD(recent.amount)}</div><div style="font-size:11px;color:var(--text-secondary)">最近30天</div></div>
              <div style="text-align:right"><div style="font-size:18px;font-weight:700">${fmtUSD(total)}</div><div style="font-size:11px;color:var(--text-secondary)">全部 (${count}笔)</div></div>
            </div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:6px">点击查看明细 →</div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- 年度汇总表 -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-top:20px">
      <h3 style="margin-bottom:10px;font-size:14px">📅 年度汇总</h3>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="border-bottom:2px solid var(--border)">
            <th style="text-align:left;padding:6px 10px">店铺</th>
            <th style="text-align:right;padding:6px 10px">2024</th>
            <th style="text-align:right;padding:6px 10px">2025</th>
            <th style="text-align:right;padding:6px 10px">2026</th>
            <th style="text-align:right;padding:6px 10px;color:var(--primary)">合计</th>
          </tr></thead>
          <tbody id="ksYearlyBody"></tbody>
        </table>
      </div>
    </div>
  `;

  // 年度汇总数据
  const yearly = {};
  for (const [store, days] of Object.entries(KS_DAILY_DATA)) {
    for (const d of days) {
      const y = d.d.split('-')[0];
      const key = store + '|' + y;
      yearly[key] = (yearly[key] || 0) + d.a;
    }
  }
  const storeNames = Object.keys(KS_DAILY_DATA).sort();
  document.getElementById('ksYearlyBody').innerHTML = storeNames.map(s => {
    const y2024 = yearly[s+'|2024'] || 0;
    const y2025 = yearly[s+'|2025'] || 0;
    const y2026 = yearly[s+'|2026'] || 0;
    const total = y2024 + y2025 + y2026;
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px 10px">${s.replace('海外官方旗舰店','')}</td>
      <td style="text-align:right;padding:6px 10px">${y2024 ? fmtUSD(y2024) : '-'}</td>
      <td style="text-align:right;padding:6px 10px">${y2025 ? fmtUSD(y2025) : '-'}</td>
      <td style="text-align:right;padding:6px 10px">${y2026 ? fmtUSD(y2026) : '-'}</td>
      <td style="text-align:right;padding:6px 10px;font-weight:600;color:var(--primary)">${fmtUSD(total)}</td>
    </tr>`;
  }).join('');
}

function renderKsDaysView(days) {
  const stores = Object.keys(KS_DAILY_DATA).sort();
  const container = document.getElementById('ksStoreCards');

  container.innerHTML = stores.map(store => {
    const filtered = getLastNDays(KS_DAILY_DATA[store], days);
    const total = filtered.reduce((s, d) => s + d.a, 0);
    const count = filtered.length;
    return `
      <div class="stat-card" style="cursor:pointer;transition:transform .15s;padding:16px" onclick="renderKsStoreDetail('${esc(store)}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
        <div style="font-weight:600;font-size:14px;margin-bottom:4px">${esc(store.replace('海外官方旗舰店',''))}</div>
        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <div><div style="font-size:18px;font-weight:700;color:var(--primary)">${fmtUSD(total)}</div><div style="font-size:11px;color:var(--text-secondary)">最近${days}天</div></div>
          <div style="text-align:right"><div style="font-size:13px;color:var(--text-secondary)">${count} 笔</div></div>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:6px">点击查看明细 →</div>
      </div>
    `;
  }).join('');
}

function renderKsAllView() {
  const stores = Object.keys(KS_DAILY_DATA).sort();
  const container = document.getElementById('ksStoreCards');

  container.innerHTML = stores.map(store => {
    const all = KS_DAILY_DATA[store];
    const total = all.reduce((s, d) => s + d.a, 0);
    const count = all.length;
    return `
      <div class="stat-card" style="cursor:pointer;transition:transform .15s;padding:16px" onclick="renderKsStoreDetail('${esc(store)}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
        <div style="font-weight:600;font-size:14px;margin-bottom:4px">${esc(store.replace('海外官方旗舰店',''))}</div>
        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <div><div style="font-size:18px;font-weight:700;color:var(--primary)">${fmtUSD(total)}</div><div style="font-size:11px;color:var(--text-secondary)">全部</div></div>
          <div style="text-align:right"><div style="font-size:13px;color:var(--text-secondary)">${count} 笔</div></div>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:6px">点击查看明细 →</div>
      </div>
    `;
  }).join('');
}

function renderKsStoreDetail(storeName) {
  const days = KS_DAILY_DATA[storeName] || [];
  const total = days.reduce((s, d) => s + d.a, 0);
  const shortName = storeName.replace('海外官方旗舰店', '');
  const container = document.getElementById('ksWithdrawApp');

  // 按月分组
  const byMonth = {};
  for (const d of days) {
    const ym = d.d.substring(0, 7);
    if (!byMonth[ym]) byMonth[ym] = [];
    byMonth[ym].push(d);
  }
  const months = Object.keys(byMonth).sort().reverse();

  container.innerHTML = `
    <div style="margin-bottom:12px">
      <button class="btn btn-sm btn-outline" style="width:auto" onclick="renderKsOverview()">← 返回总览</button>
    </div>

    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="margin:0;font-size:18px">${esc(shortName)}</h3>
          <div style="font-size:12px;color:var(--text-secondary)">${days.length} 笔提现记录</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:24px;font-weight:700;color:var(--primary)">${fmtUSD(total)}</div>
          <div style="font-size:12px;color:var(--text-secondary)">累计提现（USD）</div>
        </div>
      </div>
    </div>

    <div id="ksStoreDetailContent">
      ${months.map(ym => {
        const items = byMonth[ym].sort((a,b) => b.d.localeCompare(a.d));
        const monthTotal = items.reduce((s, d) => s + d.a, 0);
        const [y, m] = ym.split('-');
        return `
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden">
            <div style="padding:10px 16px;background:var(--bg-secondary);display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:14px;cursor:pointer" onclick="toggleKsMonth('${ym}')">
              <span>${y}年${parseInt(m)}月</span>
              <span style="color:var(--primary)">${fmtUSD(monthTotal)}</span>
            </div>
            <div id="ksMonth_${ym}" style="display:${months.indexOf(ym) < 3 ? 'block' : 'none'}">
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="border-bottom:1px solid var(--border)">
                  <th style="text-align:left;padding:8px 16px">日期</th>
                  <th style="text-align:right;padding:8px 16px">提现金额（USD）</th>
                </tr></thead>
                <tbody>
                  ${items.map(d => `
                    <tr style="border-bottom:1px solid #eee">
                      <td style="padding:6px 16px">${d.d}</td>
                      <td style="text-align:right;padding:6px 16px;font-weight:500">${fmtUSD(d.a)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function toggleKsMonth(ym) {
  const el = document.getElementById('ksMonth_' + ym);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
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
