# VV 競品首頁收集器

每天自動抓 10 家競品的官網首頁截圖、輪播 banner、新品，存進這個 repo，再用 GitHub Pages 的單頁介面瀏覽與標註案型。

## 架構

```
scraper/            抓取程式（Playwright）
  brands.js         競品清單與各家規則設定
  rules/            5 組抓取規則（pazzo / app91old / app91new / airspace / queenshop / uniqlo）
  capture.js        主程式
  ai.js             AI 初判（需 ANTHROPIC_API_KEY）
data/               抓取結果（由 GitHub Actions 自動 commit）
  index.json        總索引：每家每天有沒有變動
  {brand}/{date}/   有變動那天才存：home-pc.png、home-m.png、banners/、banners.json、products.json、ai.json
  products/         各家新品去重總表 + 縮圖
index.html          瀏覽介面（GitHub Pages）
.github/workflows/  每天台灣時間 09:10 自動跑
```

## 第一次設定

1. 建一個 GitHub repo（例如 `vvdouble-radar`），把這整包推上去
2. **Settings → Pages**：Source 選 `Deploy from a branch`，Branch 選 `main` / `(root)`
3. **Settings → Secrets and variables → Actions → New repository secret**：
   - Name：`ANTHROPIC_API_KEY`，Value：你的 API key（不設也能跑，只是沒有 AI 初判）
4. **Settings → Actions → General → Workflow permissions**：選 `Read and write permissions`
5. **Actions** 分頁 → 左邊「每日抓取競品首頁」→ `Run workflow` 手動跑第一次

第一次跑約 10–15 分鐘。跑完 `data/` 會出現資料，開 `https://yuu7073.github.io/vvdouble-radar/` 就看得到。

## 標註同步到 Firebase（選用）

預設案型標註只存在瀏覽器（localStorage）。要多裝置同步，把 `index.html` 最上面的 `FIREBASE_CONFIG = null` 換成 Firebase 專案設定即可，路徑是 `/radar/notes`。

## 調整

- **截圖倍率**：workflow 裡 `SCALE: '2'`，改 `'1'` 檔案會小 4 倍
- **只抓幾家**：Actions 手動跑時可以填品牌 id（空白隔開），例如 `pazzo gu`
- **大檔期加密**：把 cron 改成 `'10 1,7,13 * * *'` 就是一天三次
- **新增競品**：在 `scraper/brands.js` 加一筆，指定用哪一組 rule

## 變動偵測邏輯

每天都跑，但只有「banner 圖片／文字」或「新品頁前 40 款商品」跟前一次不同時才存截圖，其他天只在 `index.json` 記一筆「無變動」。這樣不管各家哪天換檔都抓得到，空間又不會爆。
