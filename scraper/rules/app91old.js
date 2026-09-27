// 規則組 B：POLYLULU / minimatters（91APP 舊版模板）
// 首頁輪播：.indexTopBN.slick 或 .slider.slick，每個 slide 有 pc / m 兩張圖
// 商品連結：/product?...（用 query 裡的商品編號當 id）；商品列表 div.pd_items ul li
module.exports = {
  async banners(page) {
    return page.evaluate(() => {
      for (const sel of ['.indexTopBN', '.slider.slick-slider', '.df_slider']) {
        const list = window.__vv.banners(sel, '.slick-slide', /slick-cloned/);
        if (list.length) return list;
      }
      return [];
    });
  },
  async products(page) {
    return page.evaluate(() => window.__vv.products(/\/product(\?|\/)/i, {
      // 91APP 舊版商品連結是 /product?xxx=...，query 參數名每家不同；
      // 直接用完整網址（含 query）當 id，再從縮圖路徑 app_img/{商品編號}/ 補抓編號
      idFrom: u => { const m = u.match(/[?&]SaleID=(\d+)/i); return m ? m[1] : u.replace(/#.*$/, ''); },
      limit: 60,
    }).map(p => { const m = (p.img || '').match(/(?:app_img|Photo)\/(\d{6,})\//); if (m && !/^\d+$/.test(p.id)) p.id = m[1]; return p; }));
  },
};
