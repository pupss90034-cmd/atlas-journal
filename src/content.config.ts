import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	// Obsidian template/scratch files and empty drafts are excluded so they
	// don't break the build (they're missing required frontmatter).
	loader: glob({
		base: "./src/content/blog",
		pattern: [
			"**/*.{md,mdx}",
			"!模板/**",
			// Draft convention: put unfinished notes in a folder named with
			// half-width parentheses, e.g. "(隱藏發佈)/", to keep them out of
			// the build without editing this file each time.
			"!\\(隱藏發佈\\)/**",
			"!標題練習.md",
			// 暫時排除：文中引用的 DSC_0249.jpg 已從 Pic/ 資料夾刪除，
			// 導致 build 失敗。請在 Obsidian 補回照片，或刪除該張圖片的
			// 引用行，修好後即可移除這行排除規則。
			// （這一篇是「圖片不存在」而不是「沒填標題」，不屬於草稿機制
			// 能處理的範圍，所以還是留在這裡。）
			"!其他（未歸類）/Ｎ02.大溪地.md",
			// 2026-08-06：原本這裡還手動排除了「關於我看的第一台車」、
			// 「紐西蘭購車眉角」、「傳奇殞落」三篇沒寫完的草稿。
			// 現在改成「沒填 title 就自動當草稿略過」（見 src/utils/posts.ts），
			// 不用再每寫一篇未完成的筆記就回來加一行，所以那三行移除了。
		],
	}),
	// Type-check frontmatter using a schema.
	// 2026-08-04：封面圖改成「集中管理」——所有封面統一放在
	// src/content/heroImage/ 資料夾（桌面上的 heroImage 捷徑就是指到那裡），
	// frontmatter 只要寫檔名，例如 heroImage: P1090208.JPG，
	// 不用寫路徑、也不用管文章放在第幾層資料夾。
	// 檔名 → 實際圖檔的對應在 src/utils/heroImage.ts，圖片仍然由 Astro
	// 自動壓縮、產生 webp 與多種解析度，所以直接放相機原始檔也沒問題。
	// 2026-08-06：title／description 改為容許留空。
	// 原本留空會直接讓「整個網站」建置失敗——在 Obsidian 邊寫邊存的
	// 過程中一定會出現只有內文、還沒下標題的檔案，不該因此炸掉全站。
	// 現在留空的筆記會被當成草稿自動略過（邏輯在 src/utils/posts.ts），
	// 建置時終端機會列出被略過的篇名，補上標題就會自動上線。
	schema: () =>
		z.object({
			title: z.preprocess((val) => (val === null || val === undefined ? "" : val), z.string()),
			description: z.preprocess(
				(val) => (val === null || val === undefined ? "" : val),
				z.string(),
			),
			// Transform string to Date object.
			// 跟 title 一樣容許留空：日期沒填的筆記先當成今天，
			// 反正沒有標題的話它本來就不會被發佈出去。
			pubDate: z.preprocess(
				(val) => (val === null || val === undefined || val === "" ? new Date() : val),
				z.coerce.date(),
			),
			updatedDate: z.coerce.date().optional(),
			// 封面圖：只寫檔名，例如 heroImage: P1090208.JPG
			// 留空、沒填、打錯字都不會讓建置失敗，只會退回預設封面
			// （打錯字的話建置時會在終端機印出提醒）。
			heroImage: z.preprocess(
				(val) => (val === null || val === "" ? undefined : val),
				z.string().optional(),
			),
			// Obsidian 的 tags 欄位如果留空，YAML 會讀成 null 而不是完全省略，
			// 這裡跟 heroImage 一樣把 null／未填都轉成空陣列，才不會建置失敗。
			// 標籤是自由格式的字串陣列，之後要新增、改名、砍掉標籤都直接在
			// Obsidian 檔案的 tags 清單裡改就好，不用動這裡的程式碼——網站上
			// 的標籤列表、篩選、快速搜尋都是從文章實際的 tags 動態算出來的。
			// 同一個邏輯也套用在清單裡的每一項：Obsidian 打了「- 」卻沒接文字
			// 的空白標籤項目，YAML 會讀成清單裡的一個 null，同樣先濾掉，
			// 不然會建置失敗。
			tags: z.preprocess((val) => {
				if (val === null || val === undefined) return [];
				if (Array.isArray(val)) {
					return val.filter((item) => typeof item === "string" && item.trim() !== "");
				}
				return val;
			}, z.array(z.string()).default([])),
		}),
});

// ------------------------------------------------------------------
// 以下 collections 對應「src/content/編輯」資料夾裡的檔案。
// 這個資料夾就是給你在 Obsidian 打開編輯用的：文字改 frontmatter 或內文，
// 圖片直接在 Obsidian 裡拖拉置換同名/同路徑的檔案即可。
// 圖片一律用 image() 宣告，Astro 建置網站時會自動依實際顯示尺寸重新
// 壓縮、產生多種解析度與新格式（webp），所以不用擔心原始照片檔案太大，
// 直接把手機或相機拍出來的原始檔放進去也沒問題。
// ------------------------------------------------------------------

// 網站基本設定：標題、標語、簡介（頁首、頁尾、RSS、SEO 都會用到）
const siteSettings = defineCollection({
	loader: glob({ base: "./src/content/編輯", pattern: "網站設定.md" }),
	schema: z.object({
		title: z.string(),
		tagline: z.string(),
		description: z.string(),
	}),
});

// 首頁最上方的 Hero 大圖區塊
const homeHero = defineCollection({
	loader: glob({ base: "./src/content/編輯", pattern: "首頁-Hero.md" }),
	schema: ({ image }) =>
		z.object({
			eyebrow: z.string(),
			subtitle: z.string(),
			primaryButtonLabel: z.string(),
			secondaryButtonLabel: z.string(),
			backgroundImage: image(),
			backgroundImageAlt: z.string(),
		}),
});

// 首頁「關於我」區塊
const homeAbout = defineCollection({
	loader: glob({ base: "./src/content/編輯", pattern: "首頁-關於我.md" }),
	schema: ({ image }) =>
		z.object({
			eyebrow: z.string(),
			heading: z.string(),
			portrait: image(),
			portraitAlt: z.string(),
			ctaLabel: z.string(),
			stats: z.array(
				z.object({
					value: z.string(),
					label: z.string(),
				}),
			),
		}),
	// 內文（Markdown body）＝「關於我」的段落文字
});

// 首頁「顧問諮詢服務」區塊
const homeConsulting = defineCollection({
	loader: glob({ base: "./src/content/編輯", pattern: "首頁-顧問服務.md" }),
	schema: z.object({
		eyebrow: z.string(),
		heading: z.string(),
		description: z.string(),
		ctaText: z.string(),
		ctaButtonLabel: z.string(),
		services: z.array(
			z.object({
				title: z.string(),
				description: z.string(),
			}),
		),
	}),
});

// About 頁面（/about）
// 2026-07-30 修正：實際檔名是「About頁面（about 頁面的完整內文）.md」，跟原本
// 寫死的 "About頁面.md" 對不上，導致 /about 完全建置失敗、整個網站建置中斷。
// 改用萬用字元，之後檔名後面多加註解文字也不會再壞掉。
const aboutPage = defineCollection({
	loader: glob({ base: "./src/content/編輯", pattern: "About頁面*.md" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
	}),
	// 內文（Markdown body）＝ About 頁面正文
});

// 首頁「精選攝影集」的各個相簿，一個檔案就是一個相簿
const albums = defineCollection({
	loader: glob({ base: "./src/content/編輯/攝影集", pattern: "*.md" }),
	schema: ({ image }) =>
		z.object({
			label: z.string(),
			order: z.number(),
			images: z.array(
				z.object({
					src: image(),
					alt: z.string(),
				}),
			),
		}),
});

export const collections = {
	blog,
	siteSettings,
	homeHero,
	homeAbout,
	homeConsulting,
	aboutPage,
	albums,
};
