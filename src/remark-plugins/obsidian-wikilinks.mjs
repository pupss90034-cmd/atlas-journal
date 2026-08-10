// Astro 不會自動解析 Obsidian 的 [[筆記名稱]] wikilink 語法。
// 這個 remark 外掛會在建置時：
//
//   1. 掃描 src/content/blog 底下所有文章，建立「檔名 -> 網址」對照表。
//      網址算法刻意跟 Astro 內建的 slug 演算法完全一致（同樣用
//      github-slugger，每段路徑分開處理再用 "/" 接回去），這樣產生出來的
//      連結才會跟文章實際網址一致，不會對不上。
//   2. 把內文裡的 [[筆記名稱]] 或 [[筆記名稱|顯示文字]] 轉成真正的
//      <a href="/blog/正確網址/">顯示文字</a>。
//   3. 如果連到的筆記目前是空的、缺必填欄位（title / description /
//      pubDate）、或放在不會被建置的資料夾（模板、(隱藏發佈)）裡，就不會
//      產生連結——只留下顯示文字，並包一層 class="wikilink-broken"，讓你在
//      網站上一眼就能看出「這裡連結還沒接好」，而不是死連結或看不出問題。
//
// 使用方式：在 Obsidian 裡繼續照平常打 [[筆記名稱]] 就好，不用改任何習慣。
//
// 注意：如果同一個檔名在不同資料夾各有一篇筆記（例如 A/筆記.md 和
// B/筆記.md 都存在），單純打 [[筆記]]（不含路徑）會判定為「無法確定」，
// 一律當作待修連結處理——這時候請改打完整路徑，例如 [[A/筆記]]。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findAndReplace } from "mdast-util-find-and-replace";
import { stripSortingPrefix, toWebPath } from "../utils/naming.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.resolve(__dirname, "../content/blog");

// 跟 src/content.config.ts 用同一套邏輯：名稱裡含有這些字的資料夾不會被
// 建置進網站，所以連到裡面的 [[連結]] 一律當成待修連結，不會產生死網址。
// 用「包含」比對而不是完整名稱，這樣加不加排序前綴都擋得住。
const EXCLUDED_DIR_KEYWORDS = ["模板", "隱藏發佈", "未歸類", "販售包", "Pic"];

function isExcludedDir(name) {
	if (name.startsWith(".")) return true;
	return EXCLUDED_DIR_KEYWORDS.some((keyword) => name.includes(keyword));
}

const AMBIGUOUS = Symbol("ambiguous");

// 網址算法跟 src/content.config.ts 的 generateId 共用同一份程式碼
// （src/utils/naming.mjs），所以這裡算出來的連結一定跟文章實際網址一致。
const pathToSlug = toWebPath;

function hasRequiredFrontmatter(raw) {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return false;
	const fm = match[1];
	const hasField = (name) => {
		const line = fm.match(new RegExp(`^${name}:\\s*(.*)$`, "m"));
		return !!line && line[1].trim().length > 0;
	};
	return hasField("title") && hasField("description") && hasField("pubDate");
}

function scanBlogNotes(dir, byBasename, byPath) {
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (isExcludedDir(entry.name)) continue;
			scanBlogNotes(fullPath, byBasename, byPath);
			continue;
		}
		if (!/\.(md|mdx)$/i.test(entry.name)) continue;

		const relPath = path.relative(BLOG_DIR, fullPath);
		const relNoExtPosix = relPath.replace(/\.(md|mdx)$/i, "").split(path.sep).join("/");
		const basename = path.basename(relNoExtPosix);

		let raw = "";
		try {
			raw = fs.readFileSync(fullPath, "utf-8");
		} catch {
			// 讀不到就當成空檔案處理
		}
		const valid = raw.trim().length > 0 && hasRequiredFrontmatter(raw);
		const slug = valid ? pathToSlug(relNoExtPosix) : null;

		byPath.set(relNoExtPosix, slug);
		// 也記一份「脫掉排序前綴」的路徑，讓 [[旅行隨記/巴賽隆納｜米拉之家]]
		// 這種比較好讀的寫法也連得到。
		const cleanPath = relNoExtPosix.split("/").map(stripSortingPrefix).join("/");
		if (!byPath.has(cleanPath)) byPath.set(cleanPath, slug);

		// 檔名別名：原始檔名（你在 Obsidian 裡按 [[ 自動補的那個）
		// 與脫掉排序前綴後的名字都能連得到。
		for (const alias of new Set([basename, stripSortingPrefix(basename)])) {
			if (!byBasename.has(alias)) {
				byBasename.set(alias, slug);
			} else if (byBasename.get(alias) !== AMBIGUOUS && byBasename.get(alias) !== slug) {
				// 同一個檔名在不同資料夾出現超過一次：標記成無法確定。
				byBasename.set(alias, AMBIGUOUS);
			}
		}
	}
}

function buildSlugMaps() {
	const byBasename = new Map();
	const byPath = new Map();
	scanBlogNotes(BLOG_DIR, byBasename, byPath);
	return { byBasename, byPath };
}

function resolveTarget(target, byBasename, byPath) {
	const clean = target.trim();
	if (clean.includes("/")) {
		if (byPath.has(clean)) return byPath.get(clean);
	}
	if (byBasename.has(clean)) {
		const value = byBasename.get(clean);
		return value === AMBIGUOUS ? null : value;
	}
	return null;
}

// 只比對 [[...]]，前面不能是 "!"（那是圖片/筆記嵌入語法，不是連結）。
const WIKILINK_RE = /(?<!!)\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;

function escapeHtml(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export default function remarkObsidianWikilinks() {
	// 整個建置過程只掃一次資料夾，不會每篇文章重掃一次。
	let slugMaps;

	return (tree) => {
		if (!slugMaps) {
			slugMaps = buildSlugMaps();
		}
		const { byBasename, byPath } = slugMaps;

		findAndReplace(tree, [
			[
				WIKILINK_RE,
				(_match, rawTarget, rawDisplay) => {
					const target = rawTarget.trim();
					const display = (rawDisplay ?? rawTarget).trim();
					const slug = resolveTarget(target, byBasename, byPath);

					if (slug !== null && slug !== undefined) {
						return {
							type: "link",
							url: `/blog/${slug}/`,
							children: [{ type: "text", value: display }],
						};
					}

					return {
						type: "html",
						value: `<span class="wikilink-broken" title="找不到對應文章：${escapeHtml(target)}">${escapeHtml(display)}</span>`,
					};
				},
			],
		]);
	};
}
