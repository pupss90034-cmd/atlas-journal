// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

import cloudflare from "@astrojs/cloudflare";

import remarkObsidianWikilinks from "./src/remark-plugins/obsidian-wikilinks.mjs";
import remarkObsidianComments from "./src/remark-plugins/obsidian-comments.mjs";
import remarkRobustImages from "./src/remark-plugins/robust-images.mjs";
import remarkImageLayout from "./src/remark-plugins/image-layout.mjs";

// https://astro.build/config
export default defineConfig({
	site: "https://atlas-journal.pupss90034.workers.dev",
	integrations: [mdx(), sitemap()],
	// 內文照片改成「一張圖產生多種解析度」（responsive images）。
	// 2026-08-11 加。原本一張內文照片只會輸出一個檔案，而且是原始尺寸——
	// 相機直出的 6000px 照片，讀者手機上也要下載完整的 740KB～1.9MB。
	// 以前照片被鎖在 680px 欄寬裡，問題還不明顯；現在照片可以破欄、滿版，
	// 這件事就必須處理。開了之後瀏覽器會依螢幕寬度自己挑，同一張圖
	// 實際下載量大約降到 60～130KB。
	// 注意：只開 layout、不開 responsiveStyles，Astro 就不會注入它自己的
	// 圖片 CSS，版型完全由 global.css 的 .fig 系統決定。
	image: { layout: "constrained" },
	markdown: {
		// 順序有意義：先把圖片修好（含 ![[檔名.jpg]] 嵌入語法），
		// 再處理 [[筆記名稱]] 連結。
		remarkPlugins: [
			// Obsidian 的 %% 註解 %% 在網站上不顯示——排在最前面，
			// 被註解掉的內容就不會再被後面的外掛處理（例如註解裡寫的
			// [[筆記名稱]] 不該變成真的連結）。
			remarkObsidianComments,
			// 內文圖片不會因為檔案不見、路徑寫錯、或帶到 Obsidian 內部路徑
			// 就讓整站建置失敗。詳見 src/remark-plugins/robust-images.mjs。
			remarkRobustImages,
			// 讓 Obsidian 的 [[筆記名稱]] 連結在網站上變成真正可點擊的連結，
			// 詳見 src/remark-plugins/obsidian-wikilinks.mjs 開頭的說明。
			remarkObsidianWikilinks,
			// 最後才決定圖片版型：這時候路徑已經修好、壞掉的圖已經被移除，
			// 剩下的都是真的會出現在頁面上的圖。
			// 寫法（![寬|圖說](照片.jpg)）詳見 src/remark-plugins/image-layout.mjs。
			remarkImageLayout,
		],
	},
	vite: {
		plugins: [tailwindcss()],
	},
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
});
