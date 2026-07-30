// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

import cloudflare from "@astrojs/cloudflare";

import remarkObsidianWikilinks from "./src/remark-plugins/obsidian-wikilinks.mjs";

// https://astro.build/config
export default defineConfig({
	site: "https://atlas-journal.pupss90034.workers.dev",
	integrations: [mdx(), sitemap()],
	markdown: {
		// 讓 Obsidian 的 [[筆記名稱]] 連結在網站上變成真正可點擊的連結，
		// 詳見 src/remark-plugins/obsidian-wikilinks.mjs 開頭的說明。
		remarkPlugins: [remarkObsidianWikilinks],
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
