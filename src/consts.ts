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

// ── 聯絡方式 ────────────────────────────────────────────
// 2026-08-09：聯絡方式暫時只保留 email。
// 原本頁尾與手機選單各有一組 Instagram / Facebook / YouTube / Pinterest
// 連結，但四個 href 全都是 "#"——點下去停在原地，比沒有連結更糟。
// 等社群帳號真的開好之後，把網址填進下面的 SOCIAL_LINKS 就會自動顯示，
// 不用再改版面的程式碼。
export const CONTACT_EMAIL = "explore0305@gmail.com";

// 之後要恢復社群連結：在這個陣列裡加上 { name, href }，
// 頁尾與手機選單會自動長出來。空陣列＝完全不顯示。
export const SOCIAL_LINKS: { name: string; href: string }[] = [];
