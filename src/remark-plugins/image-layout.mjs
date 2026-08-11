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
//   ![左圖](照片.jpg)          圖在左、緊接著的那一段文字排在右邊
//   ![右圖](照片.jpg)          圖在右、緊接著的那一段文字排在左邊
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

const DIRECTIVES = new Map([
	// 破欄：比內文寬，但兩側仍留白
	["寬", "wide"],
	["破欄", "wide"],
	["wide", "wide"],
	// 滿版：貼齊螢幕左右邊緣
	["滿版", "full"],
	["满版", "full"],
	["full", "full"],
	["bleed", "full"],
	// 圖文並排：圖在左／右，相鄰段落排在另一側
	["左圖", "left"],
	["左图", "left"],
	["left", "left"],
	["右圖", "right"],
	["右图", "right"],
	["right", "right"],
	// 明確指定一般寬度（等同不寫）
	["一般", "text"],
	["normal", "text"],
]);

/**
 * 從 alt 文字裡拆出「版型指令」與「圖說」。
 * 格式：指令|圖說。第一段如果不是已知指令，就整串當 alt，不當圖說——
 * 這是為了不動到既有文章：以前寫的 ![某張照片](x.jpg) 不會突然冒出圖說。
 */
function parseAlt(rawAlt) {
	const alt = (rawAlt ?? "").trim();
	if (alt === "") return { layout: null, caption: "", alt: "" };

	const pipeAt = alt.indexOf("|");
	if (pipeAt === -1) {
		const layout = DIRECTIVES.get(alt);
		// 純指令（![寬](x.jpg)）：alt 清空，因為「寬」不是圖片的替代文字。
		if (layout) return { layout, caption: "", alt: "" };
		// 不是指令：維持原本的 alt，不產生圖說。
		return { layout: null, caption: "", alt };
	}

	const head = alt.slice(0, pipeAt).trim();
	const caption = alt.slice(pipeAt + 1).trim();
	const layout = DIRECTIVES.get(head);
	if (layout) return { layout, caption, alt: caption };
	// 第一段不是指令：整串（含 |）都是文字，不解讀。
	return { layout: null, caption: "", alt };
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
			const caption = first.caption;

			// 把指令從 alt 裡拿掉，避免「寬」被螢幕閱讀器唸出來；
			// 第二張之後的圖片也各自清掉自己的指令。
			images.forEach((img, idx) => {
				const parsed = idx === 0 ? first : parseAlt(img.alt);
				img.alt = parsed.alt;
			});

			const isPair = images.length > 1;
			const isSideBySide = layout === "left" || layout === "right";

			// ── 圖文並排：把緊接著的那一段文字併進來 ──────────────
			if (isSideBySide) {
				const next = root.children[i + 1];
				const nextIsText = next && next.type === "paragraph" && !imagesOfParagraph(next);

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

				if (!nextIsText) {
					// 後面沒有可以配對的文字段落：降級成一般的破欄圖，
					// 不留一個只有半邊有東西的兩欄版面。
					figure.data.hProperties.className = ["fig", "fig--wide", isPair ? "fig--cols-2" : "fig--cols-1"];
					out.push(figure);
					continue;
				}

				out.push({
					type: "paragraph",
					data: {
						hName: "div",
						hProperties: { className: ["figrow", `figrow--${layout}`] },
					},
					children: [figure, { ...next, data: { ...(next.data ?? {}), hProperties: { ...(next.data?.hProperties ?? {}), className: ["figrow__text"] } } }],
				});
				i += 1; // 這段文字已經被吃掉，不要再輸出一次
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
