// 規則組 E：UNIQLO / GU（Fast Retailing 全球站）
// 首頁是全螢幕垂直輪播 .h-fullscreen-carousels，圖多半是 <picture>/<source> 或 background-image
// 新品頁結構未探勘，用通用擷取；商品連結通常是 /products/E{id}-000 或 /product/...
module.exports = {
  async banners(page) {
    return page.evaluate(() => {
      const list = window.__vv.banners('.h-fullscreen-carousels', '.swiper-slide', /swiper-slide-duplicate/);
      // 補抓 background-image
      const box = document.querySelector('.h-fullscreen-carousels');
      if (box) {
        const seen = new Set(list.map(b => b.pc));
        box.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)').forEach(s => {
          const bg = [...s.querySelectorAll('*')].map(e => getComputedStyle(e).backgroundImage).find(b => /url\(/.test(b) && !/gradient/.test(b));
          if (bg) {
            const u = window.__vv.abs(bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, ''));
            if (u && !seen.has(u)) { seen.add(u); const a = s.querySelector('a[href]'); list.push({ pc: u, mobile: '', link: a ? window.__vv.abs(a.getAttribute('href')) : '', text: window.__vv.clean(s.innerText).slice(0, 120), alt: '' }); }
          }
        });
      }
      return list.slice(0, 20);
    });
  },
  async products(page) {
    return page.evaluate(() => window.__vv.products(/\/products?\/[A-Z]?\d{5,}/i, {
      idFrom: u => (u.match(/\/products?\/([A-Z]?\d{5,}[-\d]*)/i) || [])[1],
      limit: 60,
    }));
  },
};
