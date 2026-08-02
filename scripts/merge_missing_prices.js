// 补全缺失的配件价格：从 moligod snapshot + gunsmith 数据合并进 delta_force_data.json
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data', 'delta_force_data.json');
const SNAPSHOT = path.join(__dirname, '..', 'data', 'moligod_snapshot.json');
const GUNSMITH = path.join(__dirname, '..', 'delta-force-app', 'public', 'data', 'gunsmith_full.json');

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
const gunsmith = JSON.parse(fs.readFileSync(GUNSMITH, 'utf8'));

// snapshot 价格映射（object_id → item）
const snapMap = {};
for (const item of snapshot.items) {
  const id = String(item.object_id).split('-')[0];
  if (!snapMap[id]) snapMap[id] = item;
}

// gunsmith 配件信息映射（id → {name, grade, iconUrl, modifiers}）
const partInfo = {};
for (const [gid, w] of Object.entries(gunsmith)) {
  for (const [pid, p] of Object.entries(w.parts || {})) {
    if (p.isVirtual) continue;
    if (!partInfo[pid]) partInfo[pid] = p;
  }
}

// snapshot subcategory → 我们的分类 key
const SUB_TO_KEY = {
  accMuzzle: 'accMuzzle', accForeGrip: 'accForeGrip', accBackGrip: 'accBackGrip',
  accBarrel: 'accBarrel', accHandGuard: 'accHandGuard', accMagazine: 'accMagazine',
  accScope: 'accScope', accStock: 'accStock', accFunctional: 'accFunctional',
};

// 属性转换：modifiersByMode[warfare] → stats
const ATTR_MAP = {
  '10001': 'shotDistancePercent', // 有效射程（Mult_A 百分比）
  '10005': 'recoil',
  '10006': 'controlSpeed',
  '10007': 'controlStable',
  '10008': 'hipShot',
};

function toStats(modifiers) {
  const stats = {};
  const mods = modifiers?.warfare || [];
  for (const m of mods) {
    if (m.conditionId) continue;
    const key = ATTR_MAP[m.attributeId];
    if (!key) continue;
    if (m.modifierType === 'Addend' && m.delta != null && m.delta !== 0) {
      stats[key] = (stats[key] || 0) + m.delta;
    } else if (m.modifierType === 'Mult_A' && m.param1 != null) {
      // 射程百分比乘算
      stats[key] = Math.round(m.param1 * 100);
    }
  }
  return stats;
}

// 我们已有的配件 ID
const ourIds = new Set();
for (const cat of Object.values(data.attachments)) {
  for (const a of cat.items) ourIds.add(String(a.id));
}

// 找出缺失配件并合并
const missing = Object.keys(partInfo).filter((id) => !ourIds.has(id));
let added = 0;
const noSnap = [];

for (const pid of missing) {
  const snap = snapMap[pid];
  const info = partInfo[pid];
  if (!snap) { noSnap.push(pid); continue; }

  const subKey = SUB_TO_KEY[snap.subcategory];
  if (!subKey) { noSnap.push(pid); continue; }

  const cat = data.attachments[subKey];
  if (!cat) { noSnap.push(pid); continue; }

  const effectText = {
    advantage: [],
    disadvantage: [],
  };
  const stats = toStats(info.modifiersByMode);

  cat.items.push({
    id: Number(pid),
    name: info.name || snap.display_name || snap.name,
    type: cat.name,
    typeKey: subKey,
    grade: Number(snap.grade) || Number(info.grade) || 0,
    weight: snap.width ? String(snap.width) : '0',
    pic: info.iconUrl || snap.icon_url || '',
    price: snap.current_price ?? (snap.base_price ? Number(snap.base_price) : null),
    priceInfo: {
      basePrice: snap.base_price ? Number(snap.base_price) : null,
      yesterdayAvg: snap.yesterday_avg_price ?? null,
      sevenDayLow: snap.seven_day_low ?? null,
      sevenDayHigh: snap.seven_day_high ?? null,
      updatedAt: snap.last_update ?? null,
    },
    stats,
    effectText,
  });
  added++;
}

console.log(`补全配件: ${added} 个`);
console.log(`仍缺失(无快照或无分类): ${noSnap.length} 个`);

// 统计各分类数量
for (const [k, cat] of Object.entries(data.attachments)) {
  console.log(`  ${cat.name}: ${cat.items.length} 个`);
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2), 'utf8');
console.log('\n已保存到 data/delta_force_data.json');
