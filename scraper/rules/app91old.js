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
      idFrom: u => { const m = u.match(/[?&](?:pid|id|productid|salepageid|itemid)=([^&]+)/i); if (m) return m[1]; const m2 = u.match(/\/product\/([^/?]+)/); return m2 ? m2[1] : null; },
      limit: 60,
    }));
  },
};
