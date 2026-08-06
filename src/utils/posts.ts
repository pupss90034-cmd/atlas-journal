import { getCollection, type CollectionEntry } from "astro:content";

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
