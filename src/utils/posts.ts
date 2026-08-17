import { getCollection, type CollectionEntry } from "astro:content";
import { stripSortingPrefix } from "./naming.mjs";

/**
 * 取得「可以發佈」的文章。
 *
 * 為什麼需要這個函式：
 * 在 Obsidian 裡寫作是邊寫邊存的，一定會出現「內文寫了一半、標題還沒下」
 * 的檔案。以前這種檔案會讓整個網站建置失敗，得手動跑到 content.config.ts
 * 加一行排除規則才能繼續——寫一篇卡一次，非常不合理。
 *
 * 現在的規則很單純：**標題留空 ＝ 草稿，自動不發佈**。
 * 補上 title 之後它就會自己出現在網站上，不用改任何程式碼。
 *
 * 網站上所有讀取文章的地方（文章列表、首頁最新文章、文章內頁、
 * 上一篇／下一篇、RSS、搜尋標籤）都應該呼叫這個函式，
 * 而不是直接呼叫 getCollection('blog')，否則草稿會從那個缺口漏出去。
 */
export async function getPublishedPosts(): Promise<CollectionEntry<"blog">[]> {
	const all = await getCollection("blog");

	const published: CollectionEntry<"blog">[] = [];
	const drafts: string[] = [];

	for (const post of all) {
		if (post.data.title.trim() === "") drafts.push(post.id);
		else published.push(post);
	}

	// 建置時在終端機列出被略過的草稿，避免「寫完了卻沒出現在網站上」
	// 卻完全沒有線索可查。
	if (drafts.length > 0) {
		console.info(
			`\n[草稿] 以下 ${drafts.length} 篇因為沒有填 title，這次不會發佈到網站上：\n` +
				drafts.map((id) => `  · ${id}`).join("\n") +
				`\n  補上標題之後就會自動出現，不用改程式。\n`,
		);
	}

	return published;
}

/** 依發佈日期由新到舊排序的已發佈文章。 */
export async function getSortedPosts(): Promise<CollectionEntry<"blog">[]> {
	const posts = await getPublishedPosts();
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * 一篇文章的「分類」＝它在 Obsidian 裡所在的資料夾名稱，
 * 但**脫掉排序前綴**：資料夾叫「A - 旅行隨記」，網站上顯示「旅行隨記」。
 *
 * 2026-08-10 之前這裡是拿網址的第一段來當分類名，所以側邊欄用來排序的
 * 「A - 」「Z - 」會一路跟到讀者眼前。現在改成讀實際的檔案路徑再處理，
 * 你在 Obsidian 怎麼排序都不會漏到網站上。
 *
 * 放在最外層（沒有資料夾）的文章回傳空字串，代表「不分類」。
 */
export function getCategory(post: CollectionEntry<"blog">): string {
	// filePath 例如 "src/content/blog/A - 旅行隨記/Ｎ13.巴賽隆納｜米拉之家.md"
	const filePath = post.filePath ?? "";
	const match = filePath.split("src/content/blog/")[1];
	if (!match) return "";

	const segments = match.split("/");
	if (segments.length < 2) return ""; // 沒有資料夾，直接放在 blog 底下

	return stripSortingPrefix(segments[0]!);
}

/** 目前所有文章用到的分類，依中文筆劃排序。 */
export function getCategories(posts: CollectionEntry<"blog">[]): string[] {
	const set = new Set(posts.map(getCategory).filter((c) => c !== ""));
	return [...set].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

/**
 * 估算閱讀時間（分鐘）。
 *
 * 2026-08-17 新增，給首頁頭條與 /blog 列表的 meta 那一行用。
 *
 * 中文與英文的閱讀速度差很多，所以分開算再相加：
 *   中日韓文字：每分鐘 400 字
 *   英文單字：  每分鐘 220 字
 * 圖片語法、程式碼區塊、`%% 註解 %%` 都不算。最少顯示 1 分鐘。
 *
 * 這個數字只是「這篇要花多久」的粗略提示，不需要精準——
 * 讀者在意的是 3 分鐘跟 15 分鐘的差別，不是 3 跟 4 的差別。
 * 不想在網站上顯示它：把「編輯/頁面-文章總覽.md」與
 * 「編輯/首頁-最新文章.md」的 showReadingTime 改成 false。
 */
export function getReadingMinutes(post: CollectionEntry<"blog">): number {
	const text = (post.body ?? "")
		.replace(/```[\s\S]*?```/g, "") // 程式碼區塊
		.replace(/%%[\s\S]*?%%/g, "") // Obsidian 註解
		.replace(/!?\[\[[^\]]*\]\]/g, "") // ![[照片.jpg]] / [[筆記]]
		.replace(/!?\[[^\]]*\]\([^)]*\)/g, ""); // ![圖說](路徑)

	const cjk = (text.match(/[㐀-䶿一-鿿豈-﫿぀-ヿ]/g) ?? []).length;
	const words = (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;

	return Math.max(1, Math.round(cjk / 400 + words / 220));
}
