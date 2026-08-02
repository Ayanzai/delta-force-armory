// 从 moligod.com gunsmith API 下载所有武器的完整改枪数据（属性+配件+槽位）
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT = path.join(DATA_DIR, 'gunsmith_full.json');

function decrypt(data, key, ad) {
  const iv = data.slice(1, 13);
  const ct = data.slice(13);
  const hash = crypto.createHash('sha256').update(key).digest();
  const d = crypto.createDecipheriv('aes-256-gcm', hash, iv);
  d.setAAD(Buffer.from(ad));
  d.setAuthTag(ct.slice(-16));
  const out = Buffer.concat([d.update(ct.slice(0, -16)), d.final()]);
  return JSON.parse(zlib.gunzipSync(out).toString());
}

function get(urlPath) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: 'moligod.com', path: urlPath, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/octet-stream' } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('1. 获取 manifest...');
  const mres = await get('/api/gunsmith/manifest');
  const manifest = decrypt(mres.body, mres.headers['x-gunsmith-key'], 'gunsmith-manifest-v1');
  console.log('   dataVersion:', manifest.dataVersion, '| weapons:', manifest.weapons.length);

  console.log('2. 下载所有武器完整数据...');
  const result = {};
  const concurrency = 5;
  const weapons = manifest.weapons;

  async function worker(w) {
    try {
      const url = `/api/gunsmith/versions/${encodeURIComponent(manifest.dataVersion)}/weapons/${encodeURIComponent(w.id)}`;
      const res = await get(url);
      if (res.status !== 200) {
        console.log(`   ⚠️ ${w.name}: HTTP ${res.status}`);
        return;
      }
      const weapon = decrypt(res.body, res.headers['x-gunsmith-key'], 'gunsmith-weapon-v1');
      result[w.id] = weapon;
      console.log(`   ✅ ${w.name}`);
    } catch (e) {
      console.log(`   ⚠️ ${w.name}: ${e.message.slice(0, 50)}`);
    }
  }

  for (let i = 0; i < weapons.length; i += concurrency) {
    const batch = weapons.slice(i, i + concurrency);
    await Promise.all(batch.map(worker));
    console.log(`   进度 ${Math.min(i + concurrency, weapons.length)}/${weapons.length}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8');
  const size = fs.statSync(OUT).size / 1024 / 1024;
  console.log(`\n完成！已保存 ${Object.keys(result).length} 把武器完整数据到 ${OUT} (${size.toFixed(1)}MB)`);
}

main().catch(e => console.error('Fatal:', e.message));
