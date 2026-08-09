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
			// 2026-08-07：這裡原本手動排除了「Ｎ02.大溪地」，因為文中引用的
			// DSC_0249.jpg 已經不在 Pic/ 資料夾裡，會讓整站建置失敗。
			// 現在改成「找不到的圖片自動略過並印出提醒」（見
			// src/remark-plugins/robust-images.mjs），一張圖不見不再需要
			// 犧牲整篇文章，所以那行排除規則移除了。
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

// 首頁「精選攝影集」區塊的文字與顯示數量
// 2026-08-07：原本標題「Work Overview」是改版時參考版型留下來的字，
// 不屬於這個網站。改成跟其他首頁區塊一樣從 Obsidian 編輯，
// 之後要換字不用再動程式碼。
const homeGallery = defineCollection({
	loader: glob({ base: "./src/content/編輯", pattern: "首頁-攝影集.md" }),
	schema: z.object({
		eyebrow: z.string(),
		heading: z.string(),
		ctaLabel: z.string(),
		// 首頁露出幾個相簿。留空或填奇怪的值都退回 6。
		featuredCount: z.preprocess(
			(val) => (val === null || val === undefined || val === "" ? 6 : val),
			z.coerce.number().int().min(1).catch(6),
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
			// 2026-08-07：相簿封面。這張只用在「相簿列表」的塊面上
			// （首頁精選攝影集），是專門挑來當門面、會被裁成塊面的那張。
			//
			//   cover: 圖片/paris-04.jpg
			//
			// 不填就自動用 images 的第一張（跟以前的行為一樣），所以舊的
			// 相簿檔不用改也能正常運作。封面圖可以是 images 裡已經有的
			// 某一張，也可以是一張只當封面、不出現在相簿內頁的照片。
			// 打錯字會讓建置失敗並印出找不到的檔名，改對即可。
			cover: z.preprocess(
				(val) => (val === null || val === undefined || val === "" ? undefined : val),
				image().optional(),
			),
			// 2026-08-07：相簿內頁（點進去之後）的版型開關。
			//
			//   layout: 鑲嵌  ← 預設，不填就是這個
			//     一般的單張照片相簿。照片依序循環套用「整幅 → 半幅 → 半幅」，
			//     半幅的第二張往下錯開，並在每張下面顯示 alt 當圖說。
			//
			//   layout: 翻頁
			//     給「已經在別的軟體排好版、連說明文字都印在圖上」的攝影集用
			//     （例如 La Grotte de Glace 那本）。這種圖不能錯落擺，也不該
			//     再加一行圖說重複說一次，所以改成一次只顯示一張、用左右箭頭
			//     ／滑動／鍵盤翻頁，圖說隱藏（alt 仍保留給搜尋引擎與報讀軟體）。
			//
			// 填錯字或留空都不會讓建置失敗，會退回「鑲嵌」。
			layout: z.preprocess(
				(val) => (val === null || val === undefined || val === "" ? "鑲嵌" : val),
				z.enum(["鑲嵌", "翻頁"]).catch("鑲嵌"),
			),
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
	homeGallery,
	aboutPage,
	albums,
};
