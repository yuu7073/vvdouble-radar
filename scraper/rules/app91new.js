// 規則組 C：OB嚴選（91APP 新版模板，React）
// 首頁：多個 .carousel-container slick，圖是 lazy 的，要先捲一遍
// 有 cookie 橫幅 + omnichat LINE 客服視窗，靠 dismiss() 清掉
// 商品連結：/SalePage/{id}；商品卡 .product-card__vertical
module.exports = {
  // 新品週次連結（• 09/21 新品）藏在「最新商品 → ɴᴇᴡ 最新商品」的第三層選單，要先點開才會出現在 DOM
  async beforeFindNewPage(page) {
    await page.evaluate(async () => {
      const clean = s => (s || '').replace(/\s+/g, ' ').trim();
      const fire = el => { el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); el.click(); };
      const top = [...document.querySelectorAll('header a, nav a')].find(a => clean(a.textContent) === '最新商品');
      if (top) { fire(top); await new Promise(r => setTimeout(r, 700)); }
      const sub = [...document.querySelectorAll('header a, nav a')].find(a => /最新商品/.test(clean(a.textContent)) && a !== top && !a.getAttribute('href'));
      if (sub) { fire(sub); await new Promise(r => setTimeout(r, 700)); }
    }).catch(() => {});
  },
  async banners(page) {
    return page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.carousel-container').forEach((box, i) => {
        if (i > 1) return; // 只取最上面兩個輪播（主 KV + 第二排）
        const list = window.__vv.banners('.carousel-container:nth-of-type(' + (i + 1) + ')', '.slick-slide', /slick-cloned/);
        out.push(...list);
      });
      if (out.length) return out;
      // 備援：所有 a.image-banner
      return [...document.querySelectorAll('a.image-banner')].slice(0, 20).map(a => ({
        pc: window.__vv.imgSrc(a.querySelector('img')), mobile: '', link: window.__vv.abs(a.getAttribute('href')), text: window.__vv.clean(a.innerText).slice(0, 120), alt: '',
      })).filter(b => b.pc);
    });
  },
  async products(page) {
    return page.evaluate(() => window.__vv.products(/\/SalePage\/\d+/, {
      idFrom: u => (u.match(/\/SalePage\/(\d+)/) || [])[1],
      nameSel: '[class*=product-card__title],[class*=name]',
      limit: 60,
    }));
  },
};
