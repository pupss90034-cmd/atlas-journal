// 產生 src/data/world-map.ts。
//
// 這支程式**不是**網站的一部分，網站建置時不會跑到它。它是拿來「一次性」
// 把世界地圖的形狀壓成一個純文字檔的工具：跑完之後 src/data/world-map.ts
// 裡就是寫死的 SVG 路徑字串，網站執行時不需要任何地圖套件。
//
// 什麼時候需要重跑：幾乎不會。除非要換投影方式、換緯度範圍，或要提高精度。
//
// 怎麼重跑：
//   npm i -D world-atlas@2 topojson-client@3 d3-geo@3
//   node scripts/build-world-map.mjs
//   npm uninstall world-atlas topojson-client d3-geo        ← 跑完就可以移掉
//
// 資料來源：Natural Earth 110m（public domain），經 world-atlas 轉成 TopoJSON。

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const topology = require('world-atlas/countries-110m.json');
const { feature } = require('topojson-client');
const { geoEquirectangular, geoPath } = require('d3-geo');

// ── 投影參數 ──────────────────────────────────────────────
// 等距圓柱投影（把經緯度直接當成 x/y）。它會把高緯度拉寬，
// 但這張圖的用途是「認得出是哪個國家」，不是量距離，所以夠用，
// 而且網站端只需要換算一次點的位置，一行乘法就夠（見輸出檔的 project()）。
const MAP_WIDTH = 1000;
const LAT_TOP = 84;
const LAT_BOTTOM = -56;
const SCALE = MAP_WIDTH / 360;
const MAP_HEIGHT = +((LAT_TOP - LAT_BOTTOM) * SCALE).toFixed(1);

// 南極洲：這個網站不會有南極的內容，畫出來只是在底部壓一條白帶。
const SKIP = new Set(['Antarctica']);

// 為什麼要用 d3-geo 而不是自己乘一乘：兩件麻煩事它會處理好——
//
//  1. 跨換日線。俄羅斯的東端跨過經度 180°，土法煉鋼會讓座標從畫布最右邊
//     跳到最左邊，畫出一條橫貫整張地圖的直線。d3 會在換日線上把形狀切開。
//  2. 上下裁切。只取 84°N ~ 56°S 的話，加拿大、格陵蘭、俄羅斯是被切斷的，
//     必須沿著切線把多邊形補起來，不然填色會漏出去。clipExtent 做的就是這件事。
const projection = geoEquirectangular()
	.scale(MAP_WIDTH / (2 * Math.PI))
	.translate([MAP_WIDTH / 2, LAT_TOP * SCALE])
	.clipExtent([
		[0, 0],
		[MAP_WIDTH, MAP_HEIGHT],
	]);

// digits(1)：小數點後留一位。這張圖最寬 1000 單位、實際顯示約 600px，
// 0.1 單位遠小於一個像素，再多的位數只是讓檔案變大。
const toPath = geoPath(projection).digits(1);

const countries = feature(topology, topology.objects.countries).features;

const entries = countries
	.filter((f) => !SKIP.has(f.properties.name))
	.map((f) => {
		const [[x0, y0], [x1, y1]] = toPath.bounds(f);
		return {
			name: f.properties.name,
			path: toPath(f) ?? '',
			// 外接框：拿來判斷「這一國在地圖上小到看不見嗎」（台灣、新加坡這種）。
			// 太小的國家單靠填色是看不出來的，網站那邊會另外幫它加一個圈。
			box: [x0, y0, x1, y1].map((n) => +n.toFixed(1)),
		};
	})
	.filter((c) => c.name && c.path)
	.sort((a, b) => a.name.localeCompare(b.name));

const body = entries.map((c) => `\t${JSON.stringify(c.name)}: ${JSON.stringify(c.path)},`).join('\n');
const boxes = entries.map((c) => `\t${JSON.stringify(c.name)}: [${c.box.join(', ')}],`).join('\n');

const output = `// 自動產生，請勿手改。改的方式是跑 scripts/build-world-map.mjs。
// 資料來源：Natural Earth（public domain）經 world-atlas 110m 轉出。
// 等距圓柱投影，只取緯度 ${LAT_TOP}° ~ ${LAT_BOTTOM}°（南極與北極冰帽對這個網站沒有意義，砍掉可以省版面）。
// 座標換算：x = (經度 + 180) × ${SCALE}，y = (${LAT_TOP} − 緯度) × ${SCALE}
export const MAP_WIDTH = ${MAP_WIDTH};
export const MAP_HEIGHT = ${MAP_HEIGHT};
export const MAP_LAT_TOP = ${LAT_TOP};
export const MAP_LAT_BOTTOM = ${LAT_BOTTOM};
export const MAP_SCALE = ${SCALE};

/** 把經緯度換成地圖畫布上的座標。超出上下範圍的會被夾在邊界上。 */
export function project(lat: number, lon: number): { x: number; y: number } {
	const clampedLat = Math.max(MAP_LAT_BOTTOM, Math.min(MAP_LAT_TOP, lat));
	return {
		x: +(((lon + 180) * MAP_SCALE).toFixed(2)),
		y: +(((MAP_LAT_TOP - clampedLat) * MAP_SCALE).toFixed(2)),
	};
}

/**
 * 每個國家一條獨立路徑，key 是 Natural Earth 的英文國名。
 * 分開存是為了讓「某一國單獨填色」變成可能——合成一條路徑就只能整張一起上色。
 */
export const COUNTRY_PATHS: Record<string, string> = {
${body}
};

/** 每個國家在地圖上的外接框 [左, 上, 右, 下]，用來判斷它小到需不需要加圈提示。 */
export const COUNTRY_BOXES: Record<string, [number, number, number, number]> = {
${boxes}
};

/** 全世界的輪廓（所有國家串在一起），拿來畫底圖用。 */
export const WORLD_PATH = Object.values(COUNTRY_PATHS).join('');
`;

writeFileSync(new URL('../src/data/world-map.ts', import.meta.url), output);
console.log(`已寫出 ${entries.length} 個國家，${(output.length / 1024).toFixed(0)} KB`);
