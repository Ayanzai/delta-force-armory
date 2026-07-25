// 从 kkrb.net 批量采集配件价格，断点续传，慢速防限速
const https = require('https');
const fs = require('fs');
const path = require('path');

const COOKIE = 'PHPSESSID=jsnv1oiqcg4muklijm9955uol7; csrf_token=9faf9b30239e855a1f6c021d47785898';

function post(hostname, urlPath, data) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(data).toString();
    const req = https.request({ hostname, path: urlPath, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'http://www.kkrb.net/', 'Cookie': COOKIE }
    }, res => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { reject(e); } }); });
    req.on('error', reject);
    req.write(qs);
    req.end();
  });
}

async function getPrice(itemName) {
  try {
    const r = await post('www.kkrb.net', '/getQueryItemPriceCurveData', {
      type: 'query_all_item_curve', time: '72', itemName, itemInfo: 'true', globalData: 'false'
    });
    if (r.code === 1 && r.data && r.data[0]) {
      const prices = r.data[0].prices || {};
      const vals = Object.values(prices).filter(v => v !== null);
      return vals.length > 0 ? vals[vals.length - 1] : null;
    }
  } catch (e) {}
  return null;
}

async function main() {
  const dataPath = path.join(__dirname, '..', 'data', 'delta_force_data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // 收集所有无价格的配件
  const todo = [];
  for (const [tk, cat] of Object.entries(data.attachments)) {
    for (const acc of cat.items) {
      if (acc.price === null || acc.price === undefined) {
        todo.push({ name: acc.name, id: acc.id, tk });
      }
    }
  }
  
  console.log(`需要采集价格的配件: ${todo.length} 个`);
  
  let done = 0, found = 0;
  for (const item of todo) {
    // 先通过搜索找正确的名称
    const prefix = item.name.slice(0, 2);
    await new Promise(r => setTimeout(r, 500));
    
    try {
      const suggest = await post('www.kkrb.net', '/getIPCSuggestions', { itemName: prefix });
      if (suggest.data) {
        const match = suggest.data.find(i => i.objectName === item.name);
        if (match) {
          // 找到了，查价格
          await new Promise(r => setTimeout(r, 1500));
          const price = await getPrice(match.objectName);
          if (price) {
            // 写入数据
            for (const [tk2, cat2] of Object.entries(data.attachments)) {
              for (const acc2 of cat2.items) {
                if (acc2.id === item.id) {
                  acc2.price = price;
                  found++;
                  break;
                }
              }
            }
            console.log(`[${++done}/${todo.length}] ✅ ${item.name}: ${price}`);
          } else {
            console.log(`[${++done}/${todo.length}] ❌ ${item.name}: 无价格数据`);
          }
        } else {
          console.log(`[${++done}/${todo.length}] ⚠️ ${item.name}: 名称未匹配`);
        }
      } else {
        console.log(`[${++done}/${todo.length}] ⚠️ ${item.name}: 搜索失败`);
      }
    } catch(e) {
      console.log(`[${++done}/${todo.length}] ⚠️ ${item.name}: 请求错误`);
    }
    
    // 每 10 个保存一次
    if (done % 10 === 0) {
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`  -> 已保存，当前进度 ${done}/${todo.length}`);
    }
  }
  
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n完成！共采集到 ${found} 个配件价格`);
}

main().catch(e => console.error('Fatal:', e.message));
