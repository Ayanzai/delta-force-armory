// 批量获取三角洲行动配件价格
const https = require('https');
const fs = require('fs');
const path = require('path');

const COOKIE = 'PHPSESSID=jsnv1oiqcg4muklijm9955uol7; csrf_token=9faf9b30239e855a1f6c021d47785898';

function post(hostname, urlPath, data) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(data).toString();
    const req = https.request({
      hostname, path: urlPath, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'http://www.kkrb.net/',
        'Cookie': COOKIE
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(qs);
    req.end();
  });
}

async function getItemPrice(itemName) {
  try {
    const result = await post('www.kkrb.net', '/getQueryItemPriceCurveData', {
      type: 'query_all_item_curve',
      time: '72',
      itemName: itemName,
      itemInfo: 'true',
      globalData: 'false'
    });
    if (result.code === 1 && result.data && result.data[0]) {
      const prices = result.data[0].prices || {};
      const vals = Object.values(prices).filter(v => v !== null);
      return vals.length > 0 ? vals[vals.length - 1] : null;
    }
  } catch(e) {}
  return null;
}

async function main() {
  // Load data
  const dataPath = path.join(__dirname, '..', 'data', 'delta_force_data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Get all attachment names
  const allNames = [];
  for (const [typeKey, cat] of Object.entries(data.attachments)) {
    for (const acc of cat.items) {
      allNames.push({ name: acc.name, type: typeKey, id: acc.id });
    }
  }
  
  console.log(`Total attachments: ${allNames.length}`);
  
  // Batch query prices
  const results = {};
  let done = 0;
  const BATCH_SIZE = 3; // 并发数
  
  for (let i = 0; i < allNames.length; i += BATCH_SIZE) {
    const batch = allNames.slice(i, i + BATCH_SIZE);
    const prices = await Promise.all(batch.map(item => getItemPrice(item.name)));
    
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      results[item.id] = prices[j];
      done++;
      if (prices[j] !== null) {
        console.log(`[${done}/${allNames.length}] ${item.name}: ${prices[j]}`);
      } else {
        console.log(`[${done}/${allNames.length}] ${item.name}: 未找到`);
      }
    }
    
    // 稍微延迟避免触发限流
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Save prices to data
  let priceCount = 0;
  for (const [typeKey, cat] of Object.entries(data.attachments)) {
    for (const acc of cat.items) {
      if (results[acc.id] !== undefined && results[acc.id] !== null) {
        acc.price = results[acc.id];
        priceCount++;
      } else {
        acc.price = null;
      }
    }
  }
  
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nDone! Found prices for ${priceCount}/${allNames.length} attachments`);
}

main().catch(e => console.error('Error:', e.message));
