// 規則組 D-1：AIRSPACE（自建，Swiper）
// 首頁輪播：.index-swiper-banner，<picture> 裡 source(min-width:769px)=電腦版、img=手機版
// 商品連結：/product/{sku}/{color}
module.exports = {
  async banners(page) {
    return page.evaluate(() => window.__vv.banners('.index-swiper-banner', '.swiper-slide', /swiper-slide-duplicate/));
  },
  async products(page) {
    return page.evaluate(() => window.__vv.products(/\/product\/[A-Z0-9]+/, {
      idFrom: u => (u.match(/\/product\/([A-Z0-9]+)/) || [])[1],
      limit: 60,
    }));
  },
};
