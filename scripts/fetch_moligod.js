// 从 moligod.com 解密获取交易行快照数据（含所有配件价格）
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const URL = 'https://moligod.com/api/market/trade-house-snapshot';

function fetchSnapshot() {
  return new Promise((resolve, reject) => {
    https.get(URL, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const key = res.headers['x-trade-house-key'];
        const wire = res.headers['x-trade-house-wire'];
        resolve({ data: Buffer.concat(chunks), key, wire });
      });
    }).on('error', reject);
  });
}

async function decrypt(data, key) {
  // 数据格式: [1字节版本][12字节IV][密文]
  const version = data[0];
  if (version !== 1) throw new Error('Unsupported format: ' + version);
  
  const iv = data.slice(1, 13);
  const ciphertext = data.slice(13);
  
  // key = SHA-256(x-trade-house-key)
  const hash = crypto.createHash('sha256').update(key).digest();
  
  // AES-GCM 解密
  const decipher = crypto.createDecipheriv('aes-256-gcm', hash, iv, {
    authTagLength: 16
  });
  // additionalData
  decipher.setAAD(Buffer.from('trade-house-snapshot-v1', 'utf8'));
  // GCM 的 auth tag 在密文最后16字节
  const tag = ciphertext.slice(ciphertext.length - 16);
  const data2 = ciphertext.slice(0, ciphertext.length - 16);
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([decipher.update(data2), decipher.final()]);
  
  // gzip 解压
  const json = zlib.gunzipSync(decrypted);
  return JSON.parse(json.toString('utf8'));
}

async function main() {
  console.log('获取交易行快照...');
  const { data, key, wire } = await fetchSnapshot();
  console.log('数据大小:', data.length, 'bytes | 加密方式:', wire, '| key:', key);
  
  console.log('解密中...');
  const snapshot = await decrypt(data, key);
  
  // 保存原始解密数据
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'moligod_snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf8');
  
  // 输出概览
  console.log('\n=== 快照概览 ===');
  console.log('顶层 keys:', Object.keys(snapshot));
  
  // 找物品列表
  for (const [k, v] of Object.entries(snapshot)) {
    if (Array.isArray(v)) {
      console.log(`  ${k}: 数组 (${v.length} 项)`);
      if (v.length > 0) console.log('    示例:', JSON.stringify(v[0]).slice(0, 300));
    } else if (typeof v === 'object' && v !== null) {
      console.log(`  ${k}: 对象 (keys: ${Object.keys(v).slice(0,8).join(', ')})`);
    } else {
      console.log(`  ${k}: ${v}`);
    }
  }
}

main().catch(e => console.error('失败:', e.message));
