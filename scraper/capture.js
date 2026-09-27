// 主程式：每天跑一次
// 1. 每家開電腦版＋手機版，關彈窗、捲到底、截整頁
// 2. 抓輪播 banner 圖與連結
// 3. 開新品頁，擷取商品（去重後只留沒見過的）
// 4. 跟前一次比對指紋，沒變就不存截圖，只在 index.json 記一筆
//
// 用法：node scraper/capture.js            → 全部品牌
//       node scraper/capture.js pazzo gu   → 指定品牌
// 環境變數：SCALE=2（截圖倍率）  ANTHROPIC_API_KEY（有才跑 AI 初判）

const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const brands = require(process.env.BRANDS_FILE ? path.resolve(process.env.BRANDS_FILE) : './brands');
const helpers = require('./lib/browser-helpers');
const { DATA, todayTW, sha1, readJson, writeJson, extOf, download, log } = require('./lib/util');
const ai = require('./ai');

const SCALE = Number(process.env.SCALE || 2);
const ONLY = process.argv.slice(2);
const DATE = process.env.CAPTURE_DATE || todayTW();
const FORCE = process.env.FORCE === '1'; // 手動重跑時強制重存截圖（忽略指紋比對）

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: SCALE, locale: 'zh-TW', timezoneId: 'Asia/Taipei',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' };
const MOBILE = { ...devices['iPhone 13'], deviceScaleFactor: SCALE, locale: 'zh-TW', timezoneId: 'Asia/Taipei' };

async function openPage(ctx, url, retries = 1) {
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);
  for (let i = 0; ; i++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded' }); break; }
    catch (e) { if (i >= retries) throw e; log('retry', url, e.message.split('\n')[0]); await page.waitForTimeout(3000); }
  }
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.addScriptTag({ content: helpers });
  await page.evaluate(() => window.__vv.dismiss());
  await page.waitForTimeout(800);
  // 捲兩輪：第一輪觸發 lazy，第二輪讓後補進來的區塊也載到
  await page.evaluate(() => window.__vv.scrollAll());
  await page.evaluate(() => window.__vv.dismiss());
  await page.evaluate(() => window.__vv.scrollAll(900, 150, 60));
  page.__pendingImgs = await page.evaluate(() => window.__vv.waitImages(15000)).catch(() => -1);
  await page.evaluate(() => window.__vv.dismiss());
  await page.waitForTimeout(600);
  return page;
}

async function fullShot(page, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // 有些站（UNIQLO）整頁是內層捲動容器，fullPage 抓不到；先試 fullPage，太矮就把容器撐開
  await page.evaluate(() => {
    const sc = [...document.querySelectorAll('*')].find(e => e.scrollHeight > 3000 && e.clientHeight < e.scrollHeight - 500 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    if (sc) { sc.style.height = sc.scrollHeight + 'px'; sc.style.overflow = 'visible'; }
  }).catch(() => {});
  // 截圖前最後一次：關彈窗、確認圖片載完；還有沒載完的就再給一次機會
  let pending = await page.evaluate(() => { window.__vv.dismiss(); return window.__vv.waitImages(8000); }).catch(() => -1);
  if (pending > 3) {
    log('  仍有', pending, '張圖未載入，捲一次再等');
    await page.evaluate(() => window.__vv.scrollAll(700, 250, 80));
    pending = await page.evaluate(() => { window.__vv.dismiss(); return window.__vv.waitImages(12000); }).catch(() => -1);
  }
  await page.screenshot({ path: dest, fullPage: true, type: 'png' });
  // 列表卡片用的縮圖：只截最上面一段、JPEG 壓縮，約 100–200 KB
  const vw = page.viewportSize().width;
  await page.screenshot({ path: dest.replace(/\.png$/, '-thumb.jpg'), type: 'jpeg', quality: 62, clip: { x: 0, y: 0, width: vw, height: Math.round(vw * 1.9) }, fullPage: true }).catch(() => {});
  return { pendingImages: Math.max(0, pending) };
}

async function resolveNewPage(page, brand, rule) {
  if (brand.newPage) return brand.newPage;
  const f = brand.findNewPage;
  if (!f) return '';
  if (rule.beforeFindNewPage) await rule.beforeFindNewPage(page);
  const href = await page.evaluate(([t, p, latest]) => window.__vv.findLink(new RegExp(t.source, t.flags), p ? new RegExp(p.source, p.flags) : null, latest),
    [{ source: f.text.source, flags: f.text.flags }, f.prefer ? { source: f.prefer.source, flags: f.prefer.flags } : null, !!f.pickLatestDate]);
  return href || '';
}

async function captureBrand(browser, brand, index) {
  const rule = require('./rules/' + brand.rule);
  const dir = path.join(DATA, brand.id, DATE);
  const tmp = path.join(DATA, brand.id, '_tmp');
  fs.rmSync(tmp, { recursive: true, force: true });
  const entry = { date: DATE, changed: false };

  // ---- 電腦版首頁 ----
  const dctx = await browser.newContext(DESKTOP);
  const dpage = await openPage(dctx, brand.home, brand.retries || 1);
  const banners = await rule.banners(dpage).catch(e => { log(brand.id, 'banners error', e.message); return []; });
  const pageTitle = await dpage.title();
  const qPc = await fullShot(dpage, path.join(tmp, 'home-pc.png'));
  const newPageUrl = await resolveNewPage(dpage, brand, rule).catch(() => '');
  log(brand.id, 'banners', banners.length, '| new page', newPageUrl || '(none)');

  // ---- 新品頁 ----
  let products = [];
  if (newPageUrl) {
    try {
      const npage = await openPage(dctx, newPageUrl);
      products = await rule.products(npage);
      if (!products.length && brand.fallbackNewPage) {
        const fp = await openPage(dctx, brand.fallbackNewPage);
        products = await rule.products(fp);
      }
      await fullShot(npage, path.join(tmp, 'new-pc.png'));
    } catch (e) { log(brand.id, 'new page error', e.message); }
  }
  log(brand.id, 'products', products.length);
  await dctx.close();

  // ---- 手機版首頁 ----
  const mctx = await browser.newContext(MOBILE);
  try {
    const mpage = await openPage(mctx, brand.home, brand.retries || 1);
    entry.qM = (await fullShot(mpage, path.join(tmp, 'home-m.png'))).pendingImages;
    // 手機版有自己的 banner 圖的站（Queen Shop、OB），補抓
    if (banners.length && !banners.some(b => b.mobile)) {
      const mb = await rule.banners(mpage).catch(() => []);
      banners.forEach((b, i) => { if (mb[i] && mb[i].pc && mb[i].pc !== b.pc) b.mobile = mb[i].pc; });
    }
  } catch (e) { log(brand.id, 'mobile error', e.message); }
  await mctx.close();

  if (entry.qPc > 3 || entry.qM > 3) { entry.incomplete = true; log(brand.id, '⚠ 截圖可能不完整 pc:' + entry.qPc + ' m:' + entry.qM); }

  // ---- 新品去重 ----
  const masterPath = path.join(DATA, 'products', brand.id + '.json');
  const master = readJson(masterPath, { items: {} });
  const fresh = products.filter(p => p.id && !master.items[p.id]);
  for (const p of fresh) master.items[p.id] = { ...p, firstSeen: DATE };
  // 已存在的商品：更新價格（觀察降價）
  for (const p of products) { if (p.id && master.items[p.id] && master.items[p.id].price !== p.price) { master.items[p.id].price = p.price; master.items[p.id].priceChanged = DATE; } }

  // ---- 指紋比對 ----
  const fp = sha1(JSON.stringify({ b: banners.map(b => b.pc || b.mobile).sort(), t: banners.map(b => b.text).sort(), p: products.slice(0, 40).map(p => p.id).sort() }));
  const prev = (index.brands[brand.id]?.captures || []).slice().reverse().find(c => c.fingerprint);
  const changed = FORCE || !prev || prev.fingerprint !== fp || fresh.length > 0;
  entry.fingerprint = fp;
  entry.changed = changed;
  entry.newProducts = fresh.length;
  entry.bannerCount = banners.length;
  entry.title = pageTitle;
  entry.newPageUrl = newPageUrl;
  entry.qPc = qPc.pendingImages;

  if (!changed) {
    // 沒變動，但上一版缺縮圖（舊版程式抓的）→ 把這次的縮圖補進去
    if (prev && prev.dir) {
      for (const f of ['home-pc-thumb.jpg', 'home-m-thumb.jpg']) {
        const src = path.join(tmp, f), dst = path.join(DATA, prev.dir, f);
        if (fs.existsSync(src) && !fs.existsSync(dst)) fs.copyFileSync(src, dst);
      }
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    // 同一天重跑：今天稍早已存過截圖的話，保留那筆（不能把 dir 蓋掉）
    const sameDay = (index.brands[brand.id]?.captures || []).find(c => c.date === DATE && c.dir);
    if (sameDay) { log(brand.id, '沒變動（今天已有截圖，沿用）'); return { ...sameDay, fingerprint: fp }; }
    log(brand.id, '沒變動，不存截圖');
    return entry;
  }

  // ---- 存檔 ----
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(tmp, dir);
  const bannerMeta = [];
  for (let i = 0; i < banners.length; i++) {
    const b = banners[i];
    const n = String(i + 1).padStart(2, '0');
    const pcFile = b.pc ? `banners/${n}-pc.${extOf(b.pc)}` : '';
    const mFile = b.mobile ? `banners/${n}-m.${extOf(b.mobile)}` : '';
    const okPc = pcFile && await download(b.pc, path.join(dir, pcFile), brand.home);
    const okM = mFile && await download(b.mobile, path.join(dir, mFile), brand.home);
    bannerMeta.push({ n: i + 1, pc: okPc ? pcFile : '', mobile: okM ? mFile : '', pcUrl: b.pc, mobileUrl: b.mobile, link: b.link, text: b.text, alt: b.alt });
  }
  writeJson(path.join(dir, 'banners.json'), bannerMeta);
  writeJson(path.join(dir, 'products.json'), { url: newPageUrl, count: products.length, fresh: fresh.map(p => p.id), items: products });

  // 新品縮圖只存沒見過的
  for (const p of fresh) {
    const f = `img/${brand.id}/${String(p.id).replace(/[^\w-]/g, '_')}.${extOf(p.img)}`;
    if (await download(p.img, path.join(DATA, 'products', f), brand.home)) master.items[p.id].thumb = f;
  }
  master.updatedAt = DATE;
  writeJson(masterPath, master);

  writeJson(path.join(dir, 'meta.json'), { brand: brand.id, name: brand.name, date: DATE, home: brand.home, newPageUrl, title: pageTitle, scale: SCALE, pendingImages: { pc: entry.qPc, m: entry.qM }, capturedAt: new Date().toISOString() });
  entry.dir = `${brand.id}/${DATE}`;
  log(brand.id, `已存：banner ${bannerMeta.filter(b => b.pc).length} 張，新品 ${fresh.length} 款`);

  // ---- AI 初判 ----
  try {
    const summary = await ai.summarize(brand, dir, bannerMeta, products);
    if (summary) { writeJson(path.join(dir, 'ai.json'), summary); entry.ai = { campaign: summary.campaign, tags: summary.tags }; }
  } catch (e) { log(brand.id, 'AI error', e.message); }

  return entry;
}

(async () => {
  const indexPath = path.join(DATA, 'index.json');
  const index = readJson(indexPath, { brands: {} });
  const list = brands.filter(b => !ONLY.length || ONLY.includes(b.id));
  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled', '--lang=zh-TW', '--disable-http2'], executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const brand of list) {
    log('==== ', brand.name);
    let entry;
    try { entry = await captureBrand(browser, brand, index); }
    catch (e) { log(brand.id, 'FAILED', e.message); entry = { date: DATE, changed: false, error: e.message.slice(0, 200) }; }
    const rec = index.brands[brand.id] || (index.brands[brand.id] = { name: brand.name, home: brand.home, captures: [] });
    rec.name = brand.name; rec.home = brand.home;
    rec.captures = rec.captures.filter(c => c.date !== DATE);
    rec.captures.push(entry);
    rec.captures.sort((a, b) => a.date.localeCompare(b.date));
    index.updatedAt = new Date().toISOString();
    writeJson(indexPath, index);
  }
  await browser.close();
  log('done');
})();
