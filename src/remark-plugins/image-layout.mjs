// 內文圖片的「版型指令」層。
//
// ══════════════════════════════════════════════════════════════
// 版面只有一種欄寬（2026-08-19 重訂）
// ══════════════════════════════════════════════════════════════
//
// **文字與照片的左右邊界永遠對齊。** 整篇文章只有一條基準線，
// 唯一的例外是明確寫了 `滿版` 的照片。
//
// 這條規則取代了 2026-08-11～18 之間的「三種寬度」（736 / 1152 / 滿版）。
// 那一版的立意是「窄文字 → 寬照片 → 窄文字」的呼吸感，實際讀起來卻是
// 版面忽寬忽窄、對不齊。參考版型（blog-starter.thebcms.com）的作法
// 正好相反：一種欄寬到底，節奏靠「照片前後的留白」做，不靠寬度變化。
//
// `寬`／`破欄` 保留成預設的別名，既有文章不用回頭改，
// 但它不再讓照片跳出欄寬。
//
// ── 寫法 ────────────────────────────────────────────────────
//
//   標準 Markdown：      ![指令|圖說](照片.jpg)
//   Obsidian 嵌入語法：  ![[照片.jpg|指令|圖說]]
//
//   兩種寫法效果完全一樣。指令與圖說都可以省略：
//
//   ![[照片.jpg]]                    跟文字同寬（預設）
//   ![[照片.jpg|滿版]]               貼齊螢幕左右兩邊（唯一的例外）
//   ![[照片.jpg||清晨六點的營地]]     同寬 ＋ 圖說（指令留空，兩個 |）
//   ![[照片.jpg|左圖]]               照片靠左，文字排在右邊並環繞
//   ![[照片.jpg|右圖]]               照片靠右，文字排在左邊並環繞
//   ![[照片.jpg|左圖大]]             同上，照片佔比較寬（56%）
//   ![[照片.jpg|右圖小]]             同上，照片讓位給文字（34%）
//
// ── 圖文並排怎麼運作 ────────────────────────────────────────
//
//   1. 照片後面如果緊接著一個標題（###），它會變成那一欄的小標題。
//   2. 接著把後面的段落／清單一起放進同一塊，最多三段。
//   3. 遇到下一張照片、下一個標題、或 `---` 分隔線就停。
//   4. 後面完全沒有文字可以配對時，往前拿一段——寫作時很自然會
//      先寫完一句話、再把照片拖到它後面。
//
//   網站端用的是 float，所以文字比照片長的時候會自然環繞到照片下方，
//   不會在照片底下留一塊空白。這也讓 Obsidian 的 CSS 片段可以做出
//   一模一樣的效果（見 blog vault 的 .obsidian/snippets/atlas-journal.css）。
//
// ── 不需要在圖片前後空一行 ──────────────────────────────────
//
//   在 Obsidian 裡邊寫邊拖照片，最自然的結果是中間沒有空行：
//
//       聖家堂就是其中之一。
//       ![[P1060560.jpg]]
//       有別於桂爾公園的流線設計⋯
//
//   Markdown 會把這三行讀成同一個段落、照片變成行內小圖，指令全部失效。
//   現在改成：**只要圖片自己佔一行，就當成獨立的圖片區塊**，
//   跟 Obsidian 預覽看到的一樣。真正夾在句子中間的行內圖不受影響。
//
// ── 兩張照片並排 ────────────────────────────────────────────
//
//   不需要指令，規則是「中間有沒有空行」：
//
//     ![[A.jpg]]
//     ![[B.jpg]]          ← 沒空行 ＝ 兩張並排成一組
//
//     ![[A.jpg]]
//                         ← 有空行 ＝ 上下排，各自獨立一張
//     ![[B.jpg]]
//
// ── 相容性 ──────────────────────────────────────────────────
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
	// 置中：唯一會離開左基準線的一般照片，給刻意留白的直幅用
	["置中", { layout: "center" }],
	["center", { layout: "center" }],
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

/** 只有空白的節點？（拆行時要忽略掉） */
function isBlankNode(node) {
	return node.type === "text" && node.value.trim() === "";
}

/**
 * 把一個段落依「換行」拆成一行一行。
 * Markdown 的軟換行在 AST 裡有兩種形式：text 節點裡的 \n，
 * 以及行尾兩個空格產生的 break 節點，兩種都要處理。
 */
function linesOfParagraph(paragraph) {
	const lines = [[]];
	const push = (node) => lines[lines.length - 1].push(node);

	for (const child of paragraph.children) {
		if (child.type === "break") {
			lines.push([]);
			continue;
		}
		if (child.type === "text" && child.value.includes("\n")) {
			const parts = child.value.split("\n");
			parts.forEach((part, index) => {
				if (index > 0) lines.push([]);
				if (part !== "") push({ ...child, value: part });
			});
			continue;
		}
		push(child);
	}

	return lines;
}

/** 這一行是不是「只有圖片」？是的話回傳那些圖片。 */
function imagesOfLine(nodes) {
	const images = [];
	for (const node of nodes) {
		if (node.type === "image") {
			images.push(node);
			continue;
		}
		if (isBlankNode(node)) continue;
		return null; // 這一行還有別的東西，是行內圖，不動它
	}
	return images.length > 0 ? images : null;
}

/**
 * 前置處理：把「段落裡自成一行的圖片」提升成獨立的圖片段落。
 *
 * 這一步讓後面所有的版型判斷都能運作，不必要求作者在圖片前後空一行。
 * 連續的圖片行會合併成同一個段落，維持原本「中間沒有空行 ＝ 並排一組」
 * 的規則（見檔案開頭）。
 */
function liftImageLines(root) {
	const out = [];

	for (const node of root.children) {
		const hasImage =
			node.type === "paragraph" && node.children.some((child) => child.type === "image");
		if (!hasImage) {
			out.push(node);
			continue;
		}

		const lines = linesOfParagraph(node);
		let textLines = [];
		let imageRun = [];

		const flushText = () => {
			if (textLines.length === 0) return;
			const children = [];
			textLines.forEach((line, index) => {
				if (index > 0) children.push({ type: "text", value: "\n" });
				children.push(...line);
			});
			if (children.length > 0) out.push({ ...node, children });
			textLines = [];
		};
		const flushImages = () => {
			if (imageRun.length === 0) return;
			out.push({ type: "paragraph", children: imageRun });
			imageRun = [];
		};

		for (const line of lines) {
			if (line.length === 0 || line.every(isBlankNode)) continue;
			const images = imagesOfLine(line);
			if (images) {
				flushText();
				imageRun.push(...images);
			} else {
				flushImages();
				textLines.push(line);
			}
		}

		flushImages();
		flushText();
	}

	root.children = out;
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

		// 先把「夾在段落裡、但自己佔一行」的圖片提升成獨立段落，
		// 後面的版型判斷才有東西可以判斷。（2026-08-18）
		liftImageLines(root);

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
			// 預設 ＝ 跟文字同寬（左右邊界對齊）。2026-08-19 改回來：
			// 前一版把預設改成破欄，結果是文字與照片的邊界對不齊，
			// 整篇看起來忽寬忽窄。版面只留一種欄寬，`滿版` 是唯一例外。
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

				// 後面沒有文字可以配對時，往前找一段（2026-08-18 新增）。
				//
				// 寫作時很自然會先寫完一句話、再把照片拖到它後面：
				//
				//     Ps. 教堂一共四面，目前還剩一面未完成。
				//     ![[P1060594.jpg|右圖]]
				//
				// 照嚴格的規則這裡會找不到「後面那段文字」而降級成破欄圖，
				// 於是寫了指令卻看不出效果。所以改成：後面沒有就往前拿一段。
				// 只拿普通段落——前面是標題或另一張照片時不動它。
				let borrowedBefore = null;
				if (bodyBlocks === 0) {
					const previous = out[out.length - 1];
					const isPlainParagraph =
						previous && previous.type === "paragraph" && !previous.data?.hName;
					if (isPlainParagraph) {
						borrowedBefore = out.pop();
						paired.push(borrowedBefore);
						bodyBlocks = 1;
					}
				}

				// 前後都沒有可以配對的文字（前面是標題／照片，後面是分隔線之類）：
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
