// 从 moligod 快照合并配件价格到 delta_force_data.json
const fs = require('fs');
const path = require('path');

const SNAPSHOT = path.join(__dirname, '..', 'data', 'moligod_snapshot.json');
const DATA = path.join(__dirname, '..', 'data', 'delta_force_data.json');

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));

// 构建 object_id -> item 映射
const priceMap = {};
for (const item of snapshot.items) {
  // object_id 可能带后缀（-1 全新 -2 破损），取纯数字部分
  const objId = String(item.object_id).split('-')[0];
  priceMap[objId] = item;
}

// 匹配配件
let matched = 0;
let missing = [];
for (const [tk, cat] of Object.entries(data.attachments)) {
  for (const acc of cat.items) {
    const item = priceMap[String(acc.id)];
    if (item) {
      acc.price = item.current_price ?? parseInt(item.base_price) ?? null;
      acc.priceInfo = {
        basePrice: item.base_price ? parseInt(item.base_price) : null,
        yesterdayAvg: item.yesterday_avg_price ?? null,
        sevenDayLow: item.seven_day_low ?? null,
        sevenDayHigh: item.seven_day_high ?? null,
        updatedAt: item.last_update ?? null,
      };
      matched++;
    } else {
      missing.push({ name: acc.name, id: acc.id, type: cat.name });
    }
  }
}

// 匹配枪械
let gunMatched = 0;
for (const gun of data.guns) {
  const item = priceMap[String(gun.id)];
  if (item) {
    gun.price = item.current_price ?? parseInt(item.base_price) ?? null;
    gunMatched++;
  }
}

console.log(`配件价格匹配: ${matched}/${392}`);
console.log(`枪械价格匹配: ${gunMatched}/${data.guns.length}`);
console.log(`未匹配配件: ${missing.length} 个`);
if (missing.length > 0) {
  console.log('未匹配示例:', missing.slice(0, 10).map(m => m.name).join(', '));
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2), 'utf8');
console.log('\n已保存到 data/delta_force_data.json');
