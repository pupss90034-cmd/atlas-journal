// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

// 網站標題／標語／簡介已經搬到 src/content/編輯/網站設定.md，
// 用 Obsidian 打開就能改，不用再動這個檔案。
// （程式碼裡要讀取時用：const { title, tagline, description } =
// (await getEntry('siteSettings', '網站設定'))!.data;）

// 網站尚未準備好給搜尋引擎收錄時設為 false（會在所有頁面加上 noindex）。
// 準備好要公開被 Google 搜尋到時，把這個改成 true 即可。
//
// 待辦（跟這個開關一起上線）：首頁「精選攝影集」目前是依相簿檔案裡的
// order 欄位手動排序（src/components/home/PhotoGallery.astro）。之後要
// 改成依訪客的點擊率／停留時間等瀏覽數據自動排序，讓表現好的主題排前面。
// 這需要先接分析工具收集數據，屬於「開放 Google 搜尋」之後才會做的
// 功能，先把 SITE_IS_PUBLISHED 改成 true 時一併評估、開發、上線。
export const SITE_IS_PUBLISHED = false;
