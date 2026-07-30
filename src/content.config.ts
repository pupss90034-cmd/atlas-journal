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
			// 這兩篇目前還是空檔案（被「露營車系列指南/01」那篇用 [[筆記名稱]]
			// 連結引用）。等你在 Obsidian 補上內文和 title/description/pubDate
			// 之後，記得把下面這兩行刪掉，文章才會真的被建置進網站、連結才會生效。
			"!露營車系列指南/關於我看的第一台車.md",
			"!露營車系列指南/紐西蘭購車眉角.md",
			// 暫時排除：文中引用的 DSC_0249.jpg 已從 Pic/ 資料夾刪除，
			// 導致 build 失敗。請在 Obsidian 補回照片，或刪除該張圖片的
			// 引用行，修好後即可移除這行排除規則。
			// （2026-07-30 修正：這篇筆記的實際檔名是「Ｎ02.大溪地.md」，
			// 原本這裡打的檔名對不上，導致這行規則其實沒有真的排除到它，
			// 網站建置目前仍會因為這篇筆記而失敗。）
			"!其他（未歸類）/Ｎ02.大溪地.md",
		],
	}),
	// Type-check frontmatter using a schema.
	// heroImage uses the `image()` helper so the cover photo works exactly
	// like any other photo dragged into Obsidian: a relative path (e.g.
	// "Pic/my-photo.jpg") next to the note, not a separate public/ upload.
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			// 2026-07-30：使用說明裡教的「留空即可」在 YAML 裡其實會被讀成
			// null，而不是完全省略這個欄位，原本的 image().optional() 只接受
			// undefined，遇到 null 會建置失敗。這裡先把 null／空字串都轉成
			// undefined，才會真的如使用說明所說的「留空不會壞掉」。
			heroImage: z.preprocess(
				(val) => (val === null || val === "" ? undefined : val),
				image().optional(),
			),
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
