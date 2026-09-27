// 競品清單與各家抓取規則
// rule = 規則組（對應 rules/ 底下的檔案）
// home = 首頁；newPage = 新品頁（可以是固定網址，或用 findNewPage 從首頁選單找）
module.exports = [
  {
    id: 'pazzo', name: 'PAZZO', rule: 'pazzo',
    home: 'https://www.pazzo.com.tw/',
    newPage: 'https://www.pazzo.com.tw/recent',
  },
  {
    id: 'meierq', name: 'MEIERQ', rule: 'pazzo',
    home: 'https://www.meierq.com/',
    newPage: 'https://www.meierq.com/zh-tw/tag/newin',
  },
  {
    id: 'mercci22', name: 'MERCCI22', rule: 'pazzo',
    home: 'https://www.mercci22.com/',
    newPage: 'https://www.mercci22.com/recent',
  },
  {
    id: 'airspace', name: 'AIRSPACE', rule: 'airspace',
    home: 'https://www.airspaceonline.com/tw/zh-hant',
    newPage: 'https://www.airspaceonline.com/tw/zh-hant/productlist/air-space?isnewarrival=true',
  },
  {
    id: 'polylulu', name: 'POLYLULU', rule: 'app91old',
    home: 'https://www.polylulu.com.tw/',
    // 91APP 舊版：本週新品連結每週換，從首頁選單找「本周新品」
    findNewPage: { text: /本[周週]新品/, prefer: /productlist/ },
  },
  {
    id: 'minimatters', name: 'minimatters', rule: 'app91old',
    home: 'https://www.minimatters.com.tw/',
    newPage: 'https://www.minimatters.com.tw/productlist?other=newarrival',
  },
  {
    id: 'obdesign', name: 'OB嚴選', rule: 'app91new',
    home: 'https://www.obdesign.com.tw/',
    // 每週一上新，選單裡「• 09/21 新品」這種格式，取日期最新的一個
    findNewPage: { text: /\d{2}\/\d{2}\s*新品/, prefer: /SalePageCategory/, pickLatestDate: true },
  },
  {
    id: 'queenshop', name: 'Queen Shop', rule: 'queenshop',
    home: 'https://www.queenshop.com.tw/',
    findNewPage: { text: /^NEW IN$/, prefer: /ProductList/ },
  },
  {
    id: 'uniqlo', name: 'UNIQLO', rule: 'uniqlo',
    // 全球站，新品頁是動態選單、沒有固定網址；第一版只收首頁截圖＋banner
    home: 'https://www.uniqlo.com/tw/zh_TW/women.html',
    newPage: '',
  },
  {
    id: 'gu', name: 'GU', rule: 'uniqlo',
    home: 'https://www.gu-global.com/tw/zh_TW/',
    newPage: 'https://www.gu-global.com/tw/zh_TW/women_new.html',
    retries: 2,
  },
];
