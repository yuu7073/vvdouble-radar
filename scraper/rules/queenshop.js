// 規則組 D-2：Queen Shop（自建，owl-carousel）
// 首頁輪播：.home-section-slider .owl-item（cloned 要跳過）
// 商品連結：/zh-TW/QueenShop/Product?...；商品卡有「已銷售 N 件」
module.exports = {
  async banners(page) {
    return page.evaluate(() => {
      const list = window.__vv.banners('.home-section-slider', '.owl-item', /cloned/);
      // 手機版 KV 是另一組圖（檔名 m 開頭），不在同一個 slide 裡；先只存電腦版
      return list;
    });
  },
  async products(page) {
    return page.evaluate(() => window.__vv.products(/\/QueenShop\/Product\?/, {
      idFrom: u => { const m = u.match(/[?&](?:id|ProductId|pid|item)=([^&]+)/i); return m ? m[1] : u; },
      limit: 60,
    }));
  },
};
