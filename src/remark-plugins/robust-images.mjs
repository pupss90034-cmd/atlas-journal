// 內文圖片的「不會壞掉」處理層。
//
// 為什麼需要這個外掛：
// Astro 對內文圖片的預設行為是「找不到檔案就讓整個網站建置失敗」。
// 在 Obsidian 裡寫作時，圖片失效是常態而不是意外——把照片搬到別的資料夾、
// 在 Finder 裡刪掉一張、複製貼上時帶進 Obsidian 的內部路徑，都會踩到。
// 一張圖不見就讓「整個網站」上不了線，代價和錯誤完全不成比例。
//
// 這支外掛沿用 heroImage 的同一套哲學（見 src/utils/heroImage.ts）：
// 寬容地修，修不好就跳過，並在建置訊息裡明確告訴你哪一篇的哪一張有問題。
//
// 具體會處理四種情況：
//
//   1. Obsidian 的 ![[檔名.jpg]] 嵌入語法
//      → 轉成標準的 markdown 圖片。（在 Obsidian 裡拖拉圖片進來，
//        預設就是產生這種寫法；原本網站上會直接印出 ![[檔名.jpg]] 這串字。）
//
//   2. Obsidian 內部路徑 app://<一串雜湊>/Users/.../圖片.jpg?12345
//      → 只取檔名，重新在圖庫裡找。（貼上圖片時偶爾會帶進來，
//        這種路徑只在你自己的電腦上有效，放到網站上必定失效。）
//
//   3. 相對路徑寫錯、或圖片被搬到別的資料夾
//      → 用檔名在 src/content/blog 底下全域搜尋，找到唯一一張就自動改寫路徑。
//        （所以「把圖片整理到別的資料夾」不再需要回頭改文章。）
//
//   4. 整個 blog 資料夾都找不到這張圖
//      → 把該張圖從文章裡移除，建置照常完成，並印出提醒：
//        [圖片] 哪一篇、哪一個檔名、找不到。
//        文章的其他內容照常上線，不會因為一張圖而整篇消失。
//
// 不會碰的：http/https 外部圖片、以 / 開頭的 public 資料夾圖片、data: 內嵌圖。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { visit } from "unist-util-visit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.resolve(__dirname, "../content/blog");

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif|gif|svg)$/i;
const EXCLUDED_DIR_NAMES = new Set(["模板", "(隱藏發佈)", ".obsidian"]);

const AMBIGUOUS = Symbol("ambiguous");

/** 掃出 src/content/blog 底下所有圖檔，建立「小寫檔名 → 絕對路徑」對照表。 */
function scanImages(dir, byName) {
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;
		if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			scanImages(fullPath, byName);
			continue;
		}
		if (!IMAGE_EXT_RE.test(entry.name)) continue;

		// 大小寫不敏感：DSC_0271.JPG 和 dsc_0271.jpg 視為同一個檔名，
		// 免得打字大小寫不同就找不到。
		const key = entry.name.toLowerCase();
		if (!byName.has(key)) byName.set(key, fullPath);
		else if (byName.get(key) !== fullPath) byName.set(key, AMBIGUOUS);
	}
}

/** 從各種寫法裡把「檔名」挖出來。 */
function fileNameOf(rawUrl) {
	let url = rawUrl.trim();
	// 去掉 ?12345 這種 Obsidian 加在後面的時間戳與 #錨點
	url = url.split(/[?#]/)[0];
	// %20 之類的百分比編碼還原成一般字元
	try {
		url = decodeURIComponent(url);
	} catch {
		// 編碼壞掉就用原字串，不要因此中斷
	}
	// Obsidian 顯示寬度設定：![[圖.jpg|300]]
	url = url.split("|")[0];
	return path.basename(url.split(/[/\\]/).join("/")).trim();
}

/** 這個網址要不要交給我們處理？外部圖與 public 圖一律放行。 */
function isLocalReference(url) {
	if (!url) return false;
	const trimmed = url.trim();
	if (trimmed === "") return false;
	if (/^(https?:|data:|mailto:)/i.test(trimmed)) return false;
	// 以 / 開頭 = public 資料夾，Astro 直接照搬，不需要解析
	if (trimmed.startsWith("/")) return false;
	return true;
}

export default function remarkRobustImages() {
	// 整個建置只掃一次圖庫，不是每篇文章重掃一次。
	let imageIndex;

	return (tree, file) => {
		if (!imageIndex) {
			imageIndex = new Map();
			scanImages(BLOG_DIR, imageIndex);
		}

		const notePath = file?.history?.[0] ?? file?.path ?? "";
		const noteDir = notePath ? path.dirname(notePath) : BLOG_DIR;
		// 印在提醒訊息裡的篇名，用相對路徑比絕對路徑好認
		const noteLabel = notePath ? path.relative(BLOG_DIR, notePath) : "（未知檔案）";

		// ── 1. 先把 Obsidian 的 ![[檔名.jpg]] 轉成標準圖片節點 ──────────
		visit(tree, "paragraph", (paragraph) => {
			const children = [];
			let changed = false;

			for (const child of paragraph.children) {
				if (child.type !== "text" || !child.value.includes("![[")) {
					children.push(child);
					continue;
				}

				const parts = child.value.split(/!\[\[([^\]]+)\]\]/g);
				// split 後，奇數 index 就是括號裡的內容
				for (let i = 0; i < parts.length; i += 1) {
					const part = parts[i];
					if (i % 2 === 0) {
						if (part !== "") children.push({ type: "text", value: part });
						continue;
					}
					const segments = part.split("|");
					const target = segments[0].trim();
					if (!IMAGE_EXT_RE.test(target)) {
						// 不是圖片（例如 ![[某篇筆記]] 的內容嵌入），原樣留著，
						// 交給 wikilink 外掛或當成純文字處理。
						children.push({ type: "text", value: `![[${part}]]` });
						continue;
					}
					// ![[照片.jpg|寬|圖說]]：| 後面的東西原封不動搬到 alt 上，
					// 交給 image-layout 外掛去解讀版型指令與圖說。
					// 例外：![[照片.jpg|300]] 是 Obsidian 內建的「顯示寬度」語法，
					// 那是給 Obsidian 預覽用的，不是要給網站的文字，直接丟掉。
					let alt = segments.slice(1).join("|").trim();
					if (/^\d+(x\d+)?$/i.test(alt)) alt = "";
					children.push({ type: "image", url: target, alt, title: null });
					changed = true;
				}
			}

			if (changed) paragraph.children = children;
		});

		// ── 2~4. 逐一檢查圖片節點，能修就修，修不了就移除 ──────────────
		const doomed = [];

		visit(tree, "image", (node, index, parent) => {
			if (!isLocalReference(node.url)) return;

			// app:// 是 Obsidian 的內部路徑，只在本機有效，一律當成「只知道檔名」
			const isObsidianInternal = /^app:\/\//i.test(node.url.trim());

			if (!isObsidianInternal) {
				// 先照原本的相對路徑找找看，找得到就什麼都不用改
				let candidate = node.url.split(/[?#]/)[0];
				try {
					candidate = decodeURIComponent(candidate);
				} catch {
					// 忽略壞掉的編碼
				}
				const resolved = path.resolve(noteDir, candidate);
				if (fs.existsSync(resolved)) return;
			}

			// 用檔名在整個 blog 圖庫裡找
			const fileName = fileNameOf(node.url);
			const found = fileName ? imageIndex.get(fileName.toLowerCase()) : undefined;

			if (found && found !== AMBIGUOUS) {
				let rel = path.relative(noteDir, found).split(path.sep).join("/");
				if (!rel.startsWith(".")) rel = `./${rel}`;
				node.url = rel;
				console.info(`[圖片] ${noteLabel}：「${fileName}」路徑對不上，已自動改指到 ${rel}`);
				return;
			}

			if (found === AMBIGUOUS) {
				console.warn(
					`[圖片] ${noteLabel}：有多個資料夾都存在「${fileName}」，無法判斷是哪一張，這張圖先略過。請在文章裡改成完整相對路徑。`,
				);
			} else {
				console.warn(
					`[圖片] ${noteLabel}：找不到「${fileName}」，這張圖先略過（文章其他內容照常發佈）。請把照片放回 src/content/blog 底下，或在 Obsidian 裡刪掉這一行。`,
				);
			}

			if (parent && typeof index === "number") doomed.push({ parent, node });
		});

		// visit 進行中直接改陣列會打亂走訪順序，統一走完再刪。
		for (const { parent, node } of doomed) {
			const at = parent.children.indexOf(node);
			if (at > -1) parent.children.splice(at, 1);
		}

		// 圖片被移掉之後可能留下空段落，一併清掉，免得版面多出空行。
		visit(tree, "root", (root) => {
			root.children = root.children.filter(
				(child) => !(child.type === "paragraph" && child.children.length === 0),
			);
		});
	};
}
