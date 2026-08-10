// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

import cloudflare from "@astrojs/cloudflare";

import remarkObsidianWikilinks from "./src/remark-plugins/obsidian-wikilinks.mjs";
import remarkObsidianComments from "./src/remark-plugins/obsidian-comments.mjs";
import remarkRobustImages from "./src/remark-plugins/robust-images.mjs";

// https://astro.build/config
export default defineConfig({
	site: "https://atlas-journal.pupss90034.workers.dev",
	integrations: [mdx(), sitemap()],
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
