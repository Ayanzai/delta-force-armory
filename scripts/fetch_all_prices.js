// 从 kkrb.net 批量采集配件价格
// 用法: node scripts/fetch_all_prices.js
// 特性: 自动获取cookie / 限流自动等待重试 / 断点续传
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'delta_force_data.json');
const COOKIE_PATH = path.join(__dirname, '..', 'data', '.kkrb_cookies.txt');

// 请求延迟（毫秒），遇到限流时自动加长
let delay = 1200;
let cookie = '';

// ---- HTTP 工具 ----
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36' } }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    req.on('error', reject);
  });
}

function httpPost(urlPath, data) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(data).toString();
    const req = https.request({ hostname: 'www.kkrb.net', path: urlPath, method: 'POST', timeout: 15000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'http://www.kkrb.net/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
        'Cookie': cookie
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (e) { reject(new Error('解析失败: ' + b.slice(0, 80))); }
      });
    });
    req.on('error', reject);
    req.write(qs);
    req.end();
  });
}

// ---- 获取有效 cookie ----
async function refreshCookie() {
  console.log('正在获取 cookie...');
  // 尝试读取已有 cookie 文件
  if (fs.existsSync(COOKIE_PATH)) {
    cookie = fs.readFileSync(COOKIE_PATH, 'utf8').trim();
    console.log('使用已保存的 cookie');
    return;
  }
  // 获取新的 PHPSESSID
  const res = await httpGet('http://www.kkrb.net/');
  const setCookies = (res.headers['set-cookie'] || [])
    .map(c => c.split(';')[0])
    .filter(Boolean);
  cookie = setCookies.join('; ');
  if (cookie) {
    fs.writeFileSync(COOKIE_PATH, cookie, 'utf8');
    console.log('已获取新 cookie: ' + cookie);
  } else {
    console.log('警告: 未能获取 cookie，将继续尝试');
  }
}

// ---- 查询单个配件价格（带限流重试）----
async function getPrice(itemName) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await httpPost('/getQueryItemPriceCurveData', {
        type: 'query_all_item_curve', time: '72', itemName, itemInfo: 'true', globalData: 'false'
      });
      if (r.code === 1 && r.data && r.data[0]) {
        const prices = r.data[0].prices || {};
        const vals = Object.values(prices).filter(v => v !== null);
        return vals.length > 0 ? vals[vals.length - 1] : null;
      }
      if (r.code === -101 || (r.msg || '').includes('频繁')) {
        // 限流，等待后重试
        console.log(`  ⏳ 限流，等待 ${delay / 1000}s 后重试...`);
        await new Promise(r2 => setTimeout(r2, delay));
        delay = Math.min(delay * 2, 15000); // 逐步加长
        continue;
      }
      return null; // 名称找不到等情况
    } catch (e) {
      await new Promise(r2 => setTimeout(r2, 2000));
    }
  }
  return null;
}

// ---- 主流程 ----
async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  await refreshCookie();

  // 收集无价格的配件
  const todo = [];
  for (const [tk, cat] of Object.entries(data.attachments)) {
    for (const acc of cat.items) {
      if (acc.price === null || acc.price === undefined) {
        todo.push({ name: acc.name, id: acc.id, tk });
      }
    }
  }

  console.log(`\n需要采集价格的配件: ${todo.length} 个`);
  console.log('开始采集（Ctrl+C 可随时中断，已采集的会自动保存）...\n');

  let done = 0, found = 0;
  const startTime = Date.now();

  for (const item of todo) {
    await new Promise(r => setTimeout(r, delay));

    try {
      const price = await getPrice(item.name);
      if (price) {
        // 写入数据
        for (const cat2 of Object.values(data.attachments)) {
          const acc2 = cat2.items.find(a => a.id === item.id);
          if (acc2) { acc2.price = price; break; }
        }
        found++;
        console.log(`[${++done}/${todo.length}] ✅ ${item.name}: ${price}`);
      } else {
        console.log(`[${++done}/${todo.length}] ❌ ${item.name}`);
      }
    } catch (e) {
      console.log(`[${++done}/${todo.length}] ⚠️ ${item.name}: ${e.message.slice(0, 40)}`);
    }

    // 每 5 个保存一次（断点续传）
    if (done % 5 === 0) {
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  -> 已保存进度 ${done}/${todo.length}（已用时 ${elapsed}s）`);
    }
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  const total = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n✅ 完成！共采集到 ${found} 个配件价格，用时 ${total}s`);
  console.log('数据已写入 data/delta_force_data.json');
  console.log('重启前端即可看到新价格: cd delta-force-app && npm run dev');
}

main().catch(e => console.error('Fatal:', e.message));
