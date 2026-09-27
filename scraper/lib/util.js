const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA = path.join(ROOT, 'data');

function todayTW() {
  // 以台灣時間為準
  // 不管機器在哪個時區都正確：先取 UTC 再加 8 小時
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

function sha1(s) { return crypto.createHash('sha1').update(s).digest('hex').slice(0, 16); }

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function extOf(url, fallback = 'jpg') {
  const m = (url || '').replace(/[?#].*$/, '').match(/\.(jpe?g|png|gif|webp|avif)$/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : fallback;
}

// 下載圖片（帶 referer，很多 CDN 會擋沒 referer 的請求）
async function download(url, dest, referer, timeoutMs = 20000) {
  if (!url) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { referer, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' }, signal: ctrl.signal });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return false;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    return true;
  } catch { return false; }
  finally { clearTimeout(t); }
}

function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

module.exports = { ROOT, DATA, todayTW, sha1, readJson, writeJson, extOf, download, log };
