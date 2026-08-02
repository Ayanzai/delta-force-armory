// 精简 gunsmith_full.json → public/data/（运行时 fetch 加载）
const fs = require('fs');
const path = require('path');

const FULL = path.join(__dirname, '..', 'data', 'gunsmith_full.json');
const OUT_DIR = path.join(__dirname, '..', 'delta-force-app', 'public', 'data');
const OUT = path.join(OUT_DIR, 'gunsmith_full.json');

const data = JSON.parse(fs.readFileSync(FULL, 'utf8'));
const slim = {};

for (const [gunId, w] of Object.entries(data)) {
  const parts = {};
  for (const [pid, p] of Object.entries(w.parts || {})) {
    parts[pid] = {
      id: pid,
      name: p.name,
      grade: p.grade,
      iconUrl: p.iconUrl,
      isVirtual: p.isVirtual,
      // 只保留属性加成（warfare + operations）
      modifiersByMode: p.modifiersByMode,
    };
  }

  slim[gunId] = {
    gunId,
    weaponStatsById: w.weaponStatsById,
    slotsByHost: w.slotsByHost,
    parts,
    defaultPresetsByWeapon: w.defaultPresetsByWeapon,
  };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(slim));
const size = fs.statSync(OUT).size / 1024 / 1024;
console.log(`精简完成: ${size.toFixed(1)}MB → public/data/gunsmith_full.json`);
