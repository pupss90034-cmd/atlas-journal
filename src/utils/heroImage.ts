// ------------------------------------------------------------------
// 文章封面圖（heroImage）對照表
//
// 用法很簡單：把封面圖丟進 src/content/heroImage/ 資料夾（桌面上的
// heroImage 捷徑就是指到那裡），然後在 Obsidian 的文章 frontmatter 寫：
//
//     heroImage: P1090208.JPG
//
// 只要寫「檔名」就好，不用寫路徑、不用管文章放在哪一層資料夾。
// 這支檔案負責把那個檔名對應回實際的圖檔，Astro 建置時會自動幫圖片
// 壓縮、產生 webp 與多種解析度，所以直接丟相機原始檔（5～7MB）也沒問題。
// ------------------------------------------------------------------

import type { ImageMetadata } from "astro";

// Vite 會在建置時把 heroImage 資料夾裡所有圖片抓進來（eager = 直接載入，
// 不是延遲載入），每一個都會變成 Astro 可以最佳化的 ImageMetadata。
const heroImageModules = import.meta.glob<{ default: ImageMetadata }>(
	"/src/content/heroImage/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG,WEBP,AVIF,GIF}",
	{ eager: true },
);

// 用「小寫檔名」當 key，這樣 DSC_0271.JPG 和 dsc_0271.jpg 都找得到，
// 不會因為大小寫打錯就沒封面。
const heroImagesByFileName = new Map<string, ImageMetadata>();

for (const [filePath, module] of Object.entries(heroImageModules)) {
	const fileName = filePath.split("/").pop();
	if (!fileName) continue;
	heroImagesByFileName.set(fileName.toLowerCase(), module.default);
}

/**
 * 把 frontmatter 裡的 heroImage 字串換成實際圖檔。
 *
 * 為了不讓打錯字就整個網站建置失敗，這裡刻意寫得很寬容：
 * - 留空 / 沒填 → 回傳 undefined，畫面會自動用預設封面
 * - 不小心貼了完整路徑（Pic/DSC_0271.jpg、/images/foo.jpg）→ 只取最後的檔名
 * - 不小心用 Obsidian 的 [[檔名]] 或 ![[檔名]] 寫法 → 也會自動拆掉括號
 * - 檔名找不到對應圖片 → 建置時印出提醒，畫面用預設封面，但不會讓建置中斷
 */
export function resolveHeroImage(value?: string | null): ImageMetadata | undefined {
	if (typeof value !== "string") return undefined;

	let fileName = value.trim();
	if (fileName === "") return undefined;

	// 拆掉 Obsidian 的 ![[...]] / [[...]] 寫法
	fileName = fileName.replace(/^!?\[\[/, "").replace(/\]\]$/, "");
	// 拆掉 markdown 的 ![](...) 寫法
	fileName = fileName.replace(/^!?\[[^\]]*\]\(/, "").replace(/\)$/, "");
	// 只留最後一段檔名（把 Pic/、/images/、../ 這類路徑通通丟掉）
	fileName = fileName.split(/[/\\]/).pop() ?? "";
	// Obsidian 有時會在檔名後面加 |300 這種顯示寬度設定
	fileName = fileName.split("|")[0]!.trim();

	if (fileName === "") return undefined;

	const image = heroImagesByFileName.get(fileName.toLowerCase());

	if (!image) {
		console.warn(
			`[heroImage] 找不到封面圖「${value}」。請確認這個檔案有放在 src/content/heroImage/ 資料夾（桌面的 heroImage 捷徑），而且檔名拼寫一致。這篇文章會先用預設封面。`,
		);
		return undefined;
	}

	return image;
}
