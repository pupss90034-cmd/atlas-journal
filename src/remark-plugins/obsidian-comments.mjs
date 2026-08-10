// Obsidian 的「註解」語法：%% 這樣包起來的文字 %%
//
// 在 Obsidian 裡，%% 包起來的內容在預覽模式看不到，只有你在編輯時看得到。
// 它是拿來寫給自己看的備忘的——「這段之後要補資料」「這裡的字數上限是 20」。
//
// 但 Astro 不認得這個語法，會把它當普通文字原封不動印在網站上。
// 這個外掛負責在建置時把它拿掉，讓「Obsidian 裡看不到 ＝ 網站上也看不到」
// 這件事成立。
//
// 兩種寫法都支援：
//
//   句子裡的：這段文字 %% 這裡是備忘 %% 會繼續。
//   整塊的：
//     %%
//     好幾行的備忘，
//     中間可以空行。
//     %%
//
// 沒有正確關閉（只有開頭的 %% 沒有結尾）的情況，會從那裡一路吃到文件結尾，
// 這跟 Obsidian 的行為一致。

import { visit } from "unist-util-visit";

/** 取出一個節點底下所有的純文字，用來判斷它是不是註解的開頭／結尾。 */
function textOf(node) {
	if (typeof node.value === "string") return node.value;
	if (!Array.isArray(node.children)) return "";
	return node.children.map(textOf).join("");
}

export default function remarkObsidianComments() {
	return (tree) => {
		// 第一輪：處理「同一段文字裡開始也結束」的行內註解。
		visit(tree, "text", (node) => {
			if (node.value.includes("%%")) {
				node.value = node.value.replace(/%%[\s\S]*?%%/g, "");
			}
		});

		// 第二輪：處理跨段落的整塊註解。
		// 邏輯：從上往下掃最外層的節點，遇到「以 %% 開頭」的就進入註解狀態，
		// 一路丟掉，直到遇到「以 %% 結尾」的節點為止（含該節點）。
		const kept = [];
		let inComment = false;

		for (const node of tree.children ?? []) {
			const text = textOf(node).trim();

			if (!inComment) {
				if (text.startsWith("%%")) {
					// 同一個節點內就結束了（例如只有 "%% 一句話 %%"）就不進入狀態
					const closesHere = text.length > 2 && text.endsWith("%%");
					if (!closesHere) inComment = true;
					continue;
				}
				kept.push(node);
				continue;
			}

			// 註解進行中：這個節點一律丟掉，順便看看是不是結尾
			if (text.endsWith("%%")) inComment = false;
		}

		if (Array.isArray(tree.children)) tree.children = kept;
	};
}
