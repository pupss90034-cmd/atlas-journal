// ------------------------------------------------------------------
// 資料夾／檔名的「排序前綴」處理（2026-08-10 新增）
//
// 在 Obsidian 裡，資料夾與檔案是照檔名排序的，所以你會在名字前面加上
// 「A - 」「Z - 」「Ｎ13.」「01 - 」這類符號來控制它們在側邊欄的順序。
// 那是**你在寫作時要用的工具**，不是要給讀者看的東西——網站上不該出現
// 「A - 旅行隨記」這種分類名，網址裡也不該有 /blog/a-旅行隨記/。
//
// 這支檔案就是那道分隔線：Obsidian 那側愛怎麼排就怎麼排，
// 進到網站之前一律把排序前綴脫掉。
//
// 之後你想改排序方式（例如改用 01_、02_ 或 ①②③），只要那個寫法符合
// 下面 SORTING_PREFIX 的規則就會自動被脫掉，不用回來改程式。
//
// 寫成 .mjs（而不是 .ts）的原因：src/content.config.ts 與
// src/remark-plugins/obsidian-wikilinks.mjs 兩邊都要用同一套規則算網址，
// 而後者是 Astro 設定檔在 Node 裡直接載入的純 JS，載不了 TypeScript。
// 兩邊共用同一份程式碼，網址才不會有一天悄悄對不上。
// ------------------------------------------------------------------

import { slug as githubSlug } from "github-slugger";

// 開頭的排序碼＋分隔符。涵蓋目前用到的所有寫法：
//
//   A - 旅行隨記        → 旅行隨記
//   Z-(隱藏發佈)        → (隱藏發佈)
//   01 - 如何開始       → 如何開始
//   Ｎ13.米拉之家       → 米拉之家
//   Ｎ06. 阿爾罕布拉宮  → 阿爾罕布拉宮
//
// 規則：一個可有可無的字母（半形或全形）＋最多三位數字（半形或全形），
// 後面接一個分隔符號（- – — . 。 、 ． _ ）與空白。字母與數字至少要有一個，
// 否則像「｜開頭的標題」這種正常標題會被誤傷。
const SORTING_PREFIX = /^\s*(?=[0-9０-９A-Za-zＡ-Ｚａ-ｚ])[A-Za-zＡ-Ｚａ-ｚ]?[0-9０-９]{0,3}\s*[-–—.．、。]\s*/u;

// 檔名開頭連續的底線（半形 _ 或全形 ＿）。你有一批檔名長這樣：
//
//   Ｎ16. ＿＿＿＿＿台灣的住宅文化⋯⋯
//
// 那排底線是寫作時留的佔位記號，不是標題的一部分，網址裡不該出現。
const PLACEHOLDER_UNDERSCORES = /^[_＿\s]+/u;

/**
 * 脫掉單一段名稱（一個資料夾名或一個檔名）開頭的排序前綴與佔位符號。
 *
 * 會重複脫到脫不動為止，因為前綴常常是疊在一起的
 *（「Ｎ16.」＋「＿＿＿＿＿」）。
 *
 * 脫完如果變成空字串，就退回原本的名字——寧可多一點符號，
 * 也不要讓某篇文章的網址變成空的。
 *
 * @param {string} name
 * @returns {string}
 */
export function stripSortingPrefix(name) {
	let current = name.trim();

	for (let i = 0; i < 5; i++) {
		const next = current.replace(SORTING_PREFIX, "").replace(PLACEHOLDER_UNDERSCORES, "").trim();
		if (next === current) break;
		if (next === "") return current;
		current = next;
	}

	return current === "" ? name.trim() : current;
}

/**
 * 把 src/content/blog 底下的相對路徑（不含副檔名）換成網站上的網址片段。
 *
 * 每一段路徑都先脫掉排序前綴，再各自用 github-slugger 轉成網址安全的字串，
 * 最後用 "/" 接回去——這個「逐段處理」的作法跟 Astro 內建的 slug 演算法
 * 一致，所以文章網址的形狀不會因為這次改動而改變風格。
 *
 * @param {string} relativePathNoExt 例如 "A - 旅行隨記/Ｎ13.巴賽隆納｜米拉之家"
 * @returns {string} 例如 "旅行隨記/巴賽隆納米拉之家"
 */
export function toWebPath(relativePathNoExt) {
	return relativePathNoExt
		.split("/")
		.map((segment) => githubSlug(stripSortingPrefix(segment)))
		// 「冬季主管 - 莎菈」轉出來會是 冬季主管---莎菈（空格與破折號各算一個）。
		// 連續的連字號在網址裡沒有意義，收成一個就好。
		.map((segment) => segment.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, ""))
		.filter((segment) => segment !== "")
		.join("/")
		.replace(/\/index$/, "");
}
