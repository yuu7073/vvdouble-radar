// AI 初判：把該次抓到的 banner 圖（最多 6 張）＋文字丟給 Claude，產出結構化摘要
// 沒設 ANTHROPIC_API_KEY 就直接跳過
const fs = require('fs');
const path = require('path');

const TAGS = ['新品上市', '滿額折扣', '件數折扣', '免運', '限時', '會員日', '週年慶', '節慶檔期', '換季出清', '聯名', '滿額贈', '抽獎', '主題專區', '會員招募'];

async function summarize(brand, dir, banners, products) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const content = [];
  const picks = banners.filter(b => b.pc || b.mobile).slice(0, 6);
  for (const b of picks) {
    const file = path.join(dir, b.pc || b.mobile);
    if (!fs.existsSync(file)) continue;
    const ext = path.extname(file).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/png';
    const buf = fs.readFileSync(file);
    if (buf.length > 4.5 * 1024 * 1024) continue;
    content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } });
    content.push({ type: 'text', text: `↑ Banner ${b.n}｜連結：${b.link || '無'}｜文字：${b.text || '無'}` });
  }
  const priceList = products.slice(0, 40).map(p => p.price).filter(Boolean).sort((a, b) => a - b);
  const mid = priceList.length ? priceList[Math.floor(priceList.length / 2)] : null;
  content.push({ type: 'text', text:
`以上是台灣女裝品牌「${brand.name}」今天官網首頁的輪播 banner。新品頁抓到 ${products.length} 款，價格中位數 ${mid ? 'NT$' + mid : '未知'}。
請以繁體中文（台灣）回傳 JSON，不要加任何說明文字：
{
  "campaign": "這檔活動的名稱（10 字內，看不出來就寫首頁主推內容）",
  "discount": "折扣結構，例如「滿 2,000 折 200」「2 件 85 折」「全館免運」；沒有就寫「無折扣資訊」",
  "tags": ["從這個清單挑 1–3 個最符合的：${TAGS.join('、')}"],
  "collab": "聯名對象名稱，沒有就空字串",
  "theme": "新品／視覺主題一句話（15 字內）",
  "summary": "一句話總結這家本週在推什麼（40 字內）"
}` });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-haiku-4-5', max_tokens: 500, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new Error('API ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  const text = (data.content || []).map(c => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  const out = JSON.parse(m[0]);
  out.tags = (out.tags || []).filter(t => TAGS.includes(t));
  out.model = data.model;
  out.at = new Date().toISOString();
  return out;
}

module.exports = { summarize, TAGS };
