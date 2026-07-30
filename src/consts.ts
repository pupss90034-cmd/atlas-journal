// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

// 網站標題／標語／簡介已經搬到 src/content/編輯/網站設定.md，
// 用 Obsidian 打開就能改，不用再動這個檔案。
// （程式碼裡要讀取時用：const { title, tagline, description } =
// (await getEntry('siteSettings', '網站設定'))!.data;）

// 網站尚未準備好給搜尋引擎收錄時設為 false（會在所有頁面加上 noindex）。
// 準備好要公開被 Google 搜尋到時，把這個改成 true 即可。
export const SITE_IS_PUBLISHED = false;
