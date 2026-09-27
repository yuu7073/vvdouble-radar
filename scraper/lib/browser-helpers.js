// 這些函式會被注入到網頁裡執行（page.evaluate），所以只能用瀏覽器端的 API
// 用字串包起來方便注入

const helpers = `
window.__vv = {
  abs(u) { try { return new URL(u, location.href).href; } catch { return ''; } },
  clean(s) { return (s || '').replace(/\\s+/g, ' ').trim(); },
  // 從一段文字抓出價格數字（NT$ 690 / NT.690 / $690 / 690元）
  prices(text) {
    const m = [...(text || '').matchAll(/(?:NT\\$?\\.?|\\$|NTD\\.?)\\s*([\\d,]{2,7})|([\\d,]{3,7})\\s*元/g)];
    return m.map(x => parseInt((x[1] || x[2]).replace(/,/g, ''), 10)).filter(n => n >= 50 && n < 100000);
  },
  // 圖片實際網址（處理 lazy / srcset）
  imgSrc(img) {
    if (!img) return '';
    const ss = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    if (ss) { const first = ss.split(',')[0].trim().split(' ')[0]; if (first) return this.abs(first); }
    return this.abs(img.currentSrc || img.getAttribute('src') || img.dataset.src || img.dataset.original || img.dataset.lazy || '');
  },
  // 通用商品擷取：找符合 linkPattern 的 <a>，往上找到含價格的卡片
  products(linkPattern, opts = {}) {
    const seen = new Map();
    // 用解析後的完整網址比對，相對路徑（Product?SaleID=…）也抓得到
    const links = [...document.querySelectorAll('a[href]')].filter(a => linkPattern.test(this.abs(a.getAttribute('href') || '')));
    for (const a of links) {
      let card = a;
      for (let k = 0; k < 7 && card; k++) {
        if (card.querySelector('img') && this.prices(card.innerText).length) break;
        card = card.parentElement;
      }
      if (!card || card === document.body) continue;
      const url = this.abs(a.getAttribute('href'));
      const id = (opts.idFrom ? opts.idFrom(url) : null) || url.replace(/[?#].*$/, '');
      if (seen.has(id)) continue;
      const img = card.querySelector('img');
      const ps = this.prices(card.innerText);
      const nameEl = card.querySelector(opts.nameSel || '[class*=name],[class*=title],h3,h4,p') ;
      let name = this.clean(nameEl?.innerText || img?.alt || a.title || '');
      if (!name || name.length < 2) name = this.clean(card.innerText.split('\\n').find(l => l.length > 3 && !/NT|\\$/.test(l)) || '');
      seen.set(id, {
        id, name: name.slice(0, 60), url,
        price: Math.min(...ps), origPrice: ps.length > 1 ? Math.max(...ps) : null,
        img: this.imgSrc(img),
        sold: (card.innerText.match(/已銷售\\s*([\\d,]+)/) || [])[1] || null,
      });
      if (seen.size >= (opts.limit || 60)) break;
    }
    return [...seen.values()];
  },
  // 通用 banner 擷取：給一個容器選擇器和 slide 選擇器
  banners(containerSel, slideSel, skipCloned) {
    const box = document.querySelector(containerSel);
    if (!box) return [];
    const out = [];
    for (const s of box.querySelectorAll(slideSel)) {
      if (skipCloned && skipCloned.test(s.className)) continue;
      const imgs = [...s.querySelectorAll('img')].map(i => this.imgSrc(i)).filter(Boolean);
      const srcs = [...s.querySelectorAll('source')].map(el => ({ media: el.media || '', src: this.abs((el.getAttribute('srcset') || '').split(',')[0].trim().split(' ')[0]) }));
      let pc = '', mobile = '';
      const pcSrc = srcs.find(x => /min-width/.test(x.media));
      if (pcSrc) { pc = pcSrc.src; mobile = imgs[0] || ''; }
      else if (imgs.length >= 2) { pc = imgs[0]; mobile = imgs[1]; }
      else { pc = imgs[0] || ''; }
      if (!pc && !mobile) continue;
      const a = s.querySelector('a[href]');
      out.push({ pc, mobile, link: a ? this.abs(a.getAttribute('href')) : '', text: this.clean(s.innerText).slice(0, 120), alt: this.clean(s.querySelector('img')?.alt || '').slice(0, 80) });
    }
    // 去重（同一張圖出現兩次）
    const seen = new Set();
    return out.filter(b => { const k = b.pc || b.mobile; if (seen.has(k)) return false; seen.add(k); return true; });
  },
  // 找連結：依文字比對，回傳 href
  findLink(textRe, preferRe, pickLatestDate) {
    let cands = [...document.querySelectorAll('a[href]')].filter(a => textRe.test(this.clean(a.innerText)));
    if (preferRe) { const p = cands.filter(a => preferRe.test(a.href)); if (p.length) cands = p; }
    if (!cands.length) return '';
    if (pickLatestDate) {
      cands.sort((a, b) => {
        const d = s => { const m = this.clean(s.innerText).match(/(\\d{1,2})\\/(\\d{1,2})/); return m ? +m[1] * 100 + +m[2] : -1; };
        return d(b) - d(a);
      });
    }
    return cands[0].href;
  },
  async scrollAll(step = 900, pause = 250, max = 40) {
    for (let i = 0, y = 0; i < max && y < document.body.scrollHeight; i++, y += step) {
      window.scrollTo(0, y); await new Promise(r => setTimeout(r, pause));
    }
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 400));
  },
  // 關掉常見彈窗、cookie 橫幅、客服浮動視窗
  dismiss() {
    const kill = (sel) => document.querySelectorAll(sel).forEach(e => e.remove());
    // 有「知道了 / 同意 / 關閉」的按鈕先按一下
    for (const b of document.querySelectorAll('button, a, div[role=button]')) {
      const t = this.clean(b.innerText);
      if (/^(我知道了|知道了|同意|接受|關閉|Close|Accept|OK|Got it|×|X)$/i.test(t) && b.offsetHeight > 0 && b.offsetHeight < 80) { try { b.click(); } catch {} }
    }
    kill('#onetrust-consent-sdk, .onetrust-pc-dark-filter, [id*=cookie-banner], [class*=cookie-banner], [class*=cookieConsent], [class*=cookie-consent]');
    kill('iframe[src*=omnichat], [id*=omnichat], [class*=omnichat], iframe[src*=crisp], iframe[src*=tawk], iframe[src*=intercom], [id*=chatwoot]');
    kill('[class*=optimonk], [id*=optimonk], .om-holder');
    kill('[class*=popup-overlay], [class*=modal-backdrop]');
    document.querySelectorAll('[role=dialog], [class*=popup], [class*=modal], [class*=lightbox]').forEach(e => {
      const cs = getComputedStyle(e);
      if ((cs.position === 'fixed') && e.offsetHeight > 150 && e.offsetWidth > 150) e.remove();
    });
    document.body.style.overflow = 'auto';
  }
};
`;

module.exports = helpers;
