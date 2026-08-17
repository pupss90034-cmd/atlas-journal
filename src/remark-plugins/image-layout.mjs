// 內文圖片的「版型指令」層。
//
// 為什麼需要這個外掛：
// 攝影集式的內頁，照片不能全部鎖在內文欄寬裡。一篇文章的節奏是
// 「文字（窄）→ 照片破欄（寬）→ 文字（窄）」——鬆緊交替才有呼吸。
// 但 Markdown 本身沒有「這張圖要放多大」的語法，Obsidian 也沒有。
//
// 這支外掛的做法：把版型指令寫在圖片的 alt 文字裡。
// 在 Obsidian 裡，alt 是本來就存在的欄位，不需要裝外掛、不需要學新語法，
// 而且 Obsidian 的預覽模式不會因此壞掉（它只會把指令當成 alt 文字）。
//
// ── 寫法 ────────────────────────────────────────────────────
//
//   標準 Markdown：      ![指令|圖說](照片.jpg)
//   Obsidian 嵌入語法：  ![[照片.jpg|指令|圖說]]
//
//   兩種寫法效果完全一樣。指令與圖說都可以省略：
//
//   ![](照片.jpg)              一般寬度（跟內文同寬，維持原本行為）
//   ![寬](照片.jpg)            破欄：比內文欄寬，左右超出文字
//   ![滿版](照片.jpg)          滿版：貼齊螢幕左右兩邊
//   ![|清晨六點的營地](照片.jpg)      一般寬度 ＋ 圖說
//   ![寬|清晨六點的營地](照片.jpg)    破欄 ＋ 圖說
//   ![左圖](照片.jpg)          圖在左、緊接著的那段文字排在右邊
//   ![右圖](照片.jpg)          圖在右、緊接著的那段文字排在左邊
//   ![左圖大](照片.jpg)        同上，但照片佔的欄寬比文字大（1.4 : 1）
//   ![右圖小](照片.jpg)        同上，但照片讓位給文字（1 : 1.4）
//
// ── 圖文並排時，旁邊那一欄可以放多少（2026-08-17 擴充）──────
//
//   以前只吃「緊接著的一個段落」，所以「照片＋小標題＋兩段說明」
//   這種很常見的排法做不到。現在的規則是：
//
//     1. 照片後面如果緊接著一個標題（###），它會變成那一欄的小標題。
//     2. 接著把後面的段落／清單一起放進同一欄，最多三段。
//     3. 遇到下一張照片、下一個標題、或 `---` 分隔線就停。
//
//   所以想結束並排、回到正常的滿寬段落，只要在中間放一個標題、
//   一張照片，或一條 `---`。
//
// ── 兩張照片並排 ────────────────────────────────────────────
//
//   不需要指令。規則是「空行」：
//
//     ![](A.jpg)
//     ![](B.jpg)          ← 中間沒有空行 = 這兩張並排成一組
//
//     ![](A.jpg)
//                         ← 中間有空行 = 上下排，各自獨立一張
//     ![](B.jpg)
//
//   這正好是在 Obsidian 裡連續拖兩張照片進來的自然結果。
//   整組的寬度看第一張圖的指令：![寬](A.jpg) 就是整組一起破欄。
//
// ── 相容性 ──────────────────────────────────────────────────
//
// 沒有寫指令的圖片，行為跟改版前完全一樣（單欄、置中、鎖在內文寬）。
// 所以既有文章不需要回頭改任何一行。
//
// 這支外掛只改「段落的包裝」，不碰 image 節點本身的 url，
// 因此 Astro 的圖片最佳化（自動轉 webp、產生多種解析度）照常運作。
// 排在 robust-images 之後執行，拿到的已經是修好路徑的圖片。

// 指令 → { layout, size }
//   layout: text（同內文寬）/ wide（破欄）/ full（滿版）/ left / right
//   size:   只在 left / right 有意義，決定照片欄與文字欄的寬度比
//           md（1:1，預設）、lg（照片 1.4 : 文字 1）、sm（照片 1 : 文字 1.4）
const DIRECTIVES = new Map([
	// 破欄：比內文寬，但兩側仍留白
	["寬", { layout: "wide" }],
	["破欄", { layout: "wide" }],
	["wide", { layout: "wide" }],
	// 滿版：貼齊螢幕左右邊緣
	["滿版", { layout: "full" }],
	["满版", { layout: "full" }],
	["full", { layout: "full" }],
	["bleed", { layout: "full" }],
	// 圖文並排：圖在左／右，相鄰的文字排在另一側
	["左圖", { layout: "left", size: "md" }],
	["左图", { layout: "left", size: "md" }],
	["left", { layout: "left", size: "md" }],
	["右圖", { layout: "right", size: "md" }],
	["右图", { layout: "right", size: "md" }],
	["right", { layout: "right", size: "md" }],
	// 並排＋照片佔多一點（照片是主角，文字只是一句註解）
	["左圖大", { layout: "left", size: "lg" }],
	["左大圖", { layout: "left", size: "lg" }],
	["left-lg", { layout: "left", size: "lg" }],
	["右圖大", { layout: "right", size: "lg" }],
	["右大圖", { layout: "right", size: "lg" }],
	["right-lg", { layout: "right", size: "lg" }],
	// 並排＋照片讓位（文字是主角，照片只是佐證）
	["左圖小", { layout: "left", size: "sm" }],
	["左小圖", { layout: "left", size: "sm" }],
	["left-sm", { layout: "left", size: "sm" }],
	["右圖小", { layout: "right", size: "sm" }],
	["右小圖", { layout: "right", size: "sm" }],
	["right-sm", { layout: "right", size: "sm" }],
	// 明確指定一般寬度（等同不寫）
	["一般", { layout: "text" }],
	["normal", { layout: "text" }],
]);

/**
 * 從 alt 文字裡拆出「版型指令」與「圖說」。
 * 格式：指令|圖說。第一段如果不是已知指令，就整串當 alt，不當圖說——
 * 這是為了不動到既有文章：以前寫的 ![某張照片](x.jpg) 不會突然冒出圖說。
 */
function parseAlt(rawAlt) {
	const alt = (rawAlt ?? "").trim();
	if (alt === "") return { layout: null, size: "md", caption: "", alt: "" };

	const pipeAt = alt.indexOf("|");
	if (pipeAt === -1) {
		const directive = DIRECTIVES.get(alt);
		// 純指令（![寬](x.jpg)）：alt 清空，因為「寬」不是圖片的替代文字。
		if (directive)
			return { layout: directive.layout, size: directive.size ?? "md", caption: "", alt: "" };
		// 不是指令：維持原本的 alt，不產生圖說。
		return { layout: null, size: "md", caption: "", alt };
	}

	const head = alt.slice(0, pipeAt).trim();
	const caption = alt.slice(pipeAt + 1).trim();
	const directive = DIRECTIVES.get(head);
	if (directive)
		return { layout: directive.layout, size: directive.size ?? "md", caption, alt: caption };
	// 第一段不是指令：整串（含 |）都是文字，不解讀。
	return { layout: null, size: "md", caption: "", alt };
}

/** 這個段落是不是「只有圖片」的段落？（允許夾雜空白與換行） */
function imagesOfParagraph(node) {
	if (!node || node.type !== "paragraph") return null;
	const images = [];
	for (const child of node.children) {
		if (child.type === "image") {
			images.push(child);
			continue;
		}
		if (child.type === "break") continue;
		if (child.type === "text" && child.value.trim() === "") continue;
		// 有圖片以外的實質內容（例如圖片後面接了一句話），
		// 這種段落不當成版型區塊處理，維持原樣。
		return null;
	}
	return images.length > 0 ? images : null;
}

function figcaptionNode(text) {
	return {
		type: "paragraph",
		data: { hName: "figcaption", hProperties: { className: ["fig__caption"] } },
		children: [{ type: "text", value: text }],
	};
}

export default function remarkImageLayout() {
	return (tree) => {
		const root = tree;
		if (!root || !Array.isArray(root.children)) return;

		const out = [];

		for (let i = 0; i < root.children.length; i += 1) {
			const node = root.children[i];
			const images = imagesOfParagraph(node);

			if (!images) {
				out.push(node);
				continue;
			}

			// 版型與圖說一律看「第一張圖」，整段共用。
			// 一組並排的照片是一個視覺單位，不該一張寬一張窄。
			const first = parseAlt(images[0].alt);
			const layout = first.layout ?? "text";
			const size = first.size ?? "md";
			const caption = first.caption;

			// 把指令從 alt 裡拿掉，避免「寬」被螢幕閱讀器唸出來；
			// 第二張之後的圖片也各自清掉自己的指令。
			images.forEach((img, idx) => {
				const parsed = idx === 0 ? first : parseAlt(img.alt);
				img.alt = parsed.alt;
			});

			const isPair = images.length > 1;
			const isSideBySide = layout === "left" || layout === "right";

			// ── 圖文並排：把緊接著的那一塊文字併進來 ──────────────
			if (isSideBySide) {
				// 2026-08-17：從「只吃一個段落」改成「吃一小塊內容」。
				// 規則見檔案開頭：可選的小標題 ＋ 最多三段文字，
				// 遇到下一張照片／下一個標題／`---` 就停。
				const paired = [];
				let cursor = i + 1;
				let bodyBlocks = 0;

				// 1) 緊接著的標題（如果有）＝ 這一欄的小標題
				const maybeHeading = root.children[cursor];
				if (maybeHeading && maybeHeading.type === "heading") {
					paired.push(maybeHeading);
					cursor += 1;
				}

				// 2) 後面的段落與清單，最多三塊
				while (cursor < root.children.length && bodyBlocks < 3) {
					const candidate = root.children[cursor];
					if (!candidate) break;
					const isPlainParagraph =
						candidate.type === "paragraph" && !imagesOfParagraph(candidate);
					const isList = candidate.type === "list";
					if (!isPlainParagraph && !isList) break; // 標題、照片、---、表格都在這裡停下
					paired.push(candidate);
					bodyBlocks += 1;
					cursor += 1;
				}

				const figure = {
					type: "paragraph",
					data: {
						hName: "figure",
						hProperties: {
							className: ["fig", "fig--inrow", isPair ? "fig--cols-2" : "fig--cols-1"],
						},
					},
					children: caption ? [...images, figcaptionNode(caption)] : [...images],
				};

				// 一段可以配對的文字都沒有（後面接的是另一張照片、標題或分隔線）：
				// 降級成一般的破欄圖，不留一個只有半邊有東西的兩欄版面。
				if (bodyBlocks === 0) {
					figure.data.hProperties.className = [
						"fig",
						"fig--wide",
						isPair ? "fig--cols-2" : "fig--cols-1",
					];
					out.push(figure);
					continue;
				}

				out.push({
					type: "paragraph",
					data: {
						hName: "div",
						hProperties: {
							className: ["figrow", `figrow--${layout}`, `figrow--size-${size}`],
						},
					},
					children: [
						figure,
						{
							type: "paragraph",
							data: { hName: "div", hProperties: { className: ["figrow__text"] } },
							children: paired,
						},
					],
				});
				i = cursor - 1; // 併進去的那幾塊不要再輸出一次
				continue;
			}

			// ── 一般 / 破欄 / 滿版 ────────────────────────────────
			out.push({
				type: "paragraph",
				data: {
					hName: "figure",
					hProperties: {
						className: ["fig", `fig--${layout}`, isPair ? "fig--cols-2" : "fig--cols-1"],
					},
				},
				children: caption ? [...images, figcaptionNode(caption)] : [...images],
			});
		}

		root.children = out;
	};
}
