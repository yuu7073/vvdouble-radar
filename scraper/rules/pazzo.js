// 規則組 A：PAZZO / MEIERQ / MERCCI22（同一套自建系統）
// 首頁輪播：.sim-row-box.slick，每個 slick-slide 裡有電腦版和手機版兩張圖
// 商品連結：/market/n/{id}?c={colorId}
module.exports = {
  async banners(page) {
    return page.evaluate(() => {
      const list = window.__vv.banners('.sim-row-box.slick', '.slick-slide', /slick-cloned/);
      // 這套系統常常有兩個 slick（電腦版一個、手機版一個），第二個裡的圖寬 800
      if (list.length && !list[0].mobile) {
        const boxes = document.querySelectorAll('.sim-row-box.slick');
        if (boxes.length >= 2) {
          const m = [...boxes[1].querySelectorAll('.slick-slide:not(.slick-cloned) img')].map(i => window.__vv.imgSrc(i));
          list.forEach((b, i) => { if (m[i]) b.mobile = m[i]; });
        }
      }
      return list;
    });
  },
  async products(page) {
    return page.evaluate(() => window.__vv.products(/\/market\/n\/\d+/, {
      idFrom: u => (u.match(/\/market\/n\/(\d+)/) || [])[1],
      nameSel: '.item__name',
      limit: 80,
    }));
  },
};
