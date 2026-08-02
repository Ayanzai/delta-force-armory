// 从 moligod.com gunsmith API 获取所有武器的真实配件兼容关系
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT = path.join(DATA_DIR, 'gun_attachments.json');

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

function get(urlPath, accept = 'application/octet-stream') {
  return new Promise((resolve, reject) => {
    https.get({ hostname: 'moligod.com', path: urlPath, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': accept } }, res => {
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

  console.log('2. 下载所有武器数据...');
  const result = {};
  let done = 0;
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

      // 提取该武器的所有可用配件 ID（遍历 slotsByHost 的所有槽位 candidateIds）
      const allowedPartIds = new Set();
      const slotInfo = [];
      for (const [hostId, slots] of Object.entries(weapon.slotsByHost || {})) {
        for (const slot of slots) {
          for (const cid of slot.candidateIds || []) allowedPartIds.add(cid);
          slotInfo.push({ slotId: slot.id, label: slot.label, hostId });
        }
      }

      // parts 详情
      const parts = weapon.parts || {};

      result[w.id] = {
        gunId: w.id,
        gunName: w.name,
        categoryCn: w.categoryCn,
        subcategory: w.subcategory,
        allowedPartIds: [...allowedPartIds],
        slots: slotInfo,
        partNames: Object.fromEntries(
          [...allowedPartIds].map(id => [id, parts[id]?.name || id])
        ),
      };
      console.log(`   ✅ ${w.name}: ${allowedPartIds.size} 个可用配件`);
    } catch (e) {
      console.log(`   ⚠️ ${w.name}: ${e.message.slice(0, 50)}`);
    }
  }

  for (let i = 0; i < weapons.length; i += concurrency) {
    const batch = weapons.slice(i, i + concurrency);
    await Promise.all(batch.map(worker));
    done += batch.length;
    console.log(`   进度 ${done}/${weapons.length}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n完成！已保存 ${Object.keys(result).length} 把武器的兼容关系到 ${OUT}`);
}

main().catch(e => console.error('Fatal:', e.message));
