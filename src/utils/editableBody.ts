// ------------------------------------------------------------------
// 「用 Obsidian 的內文直接編輯網站區塊」的解析工具（2026-08-10 新增）
//
// 為什麼要有這支檔案：
//
// 以前首頁那三張顧問服務卡片是寫在 frontmatter 裡的巢狀清單——
//
//     services:
//       - title: 露營車生活諮詢
//         description: 從選車、改裝到⋯⋯
//
// 這種寫法在 Obsidian 裡是「唯讀的屬性面板」：點不進去、也沒辦法像打字
// 一樣直接改，要動它就得切到原始碼模式跟 YAML 的縮排搏鬥，縮排少一格
// 整個網站就建不起來。這不是你該承受的成本。
//
// 現在改成：**可以重複的項目一律寫在內文裡，用標題與段落表示。**
//
//     ## 露營車生活諮詢
//     從選車、改裝到長途生活的日常安排。
//
// 在 Obsidian 裡這就是普通的打字，所見即所得，也不會因為打錯符號而壞掉。
// frontmatter 只留「一個蘿蔔一個坑」的單行文字（標題、按鈕字樣那類）。
//
// 三個共通規則（整個 編輯/ 資料夾都適用）：
//
//   1. `## 標題` 開一個項目，底下的段落就是它的說明文字。
//   2. 第一個 `##` 之前的段落，是這個區塊的開場說明文字（會顯示在網站上）。
//   3. `%% 這樣包起來的文字 %%` 是 Obsidian 原生的註解語法，
//      在 Obsidian 的預覽與網站上都不會出現——寫給自己看的備忘就放這裡。
// ------------------------------------------------------------------

/** 拿掉 Obsidian 的 `%% 註解 %%`（可跨行）。 */
export function stripComments(body: string): string {
	return body.replace(/%%[\s\S]*?%%/g, "");
}

export interface EditableItem {
	/** `## ` 後面那行字 */
	title: string;
	/** 標題底下的段落，多段會用換行接起來 */
	description: string;
}

export interface EditableBlock {
	/** 第一個 `##` 之前的段落（區塊的開場說明），沒寫就是空字串 */
	intro: string;
	/** `## 標題` ＋ 底下段落構成的項目清單，照檔案裡的順序 */
	items: EditableItem[];
}

/**
 * 把一份 Markdown 內文拆成「開場說明 ＋ 一串項目」。
 *
 * 刻意寫得很寬容：`#`、`##`、`###` 都算項目標題（在 Obsidian 裡你可能
 * 隨手打了不同層數），空白行多寡不影響，項目底下沒寫說明也不會出錯。
 */
export function parseEditableBlock(body: string | undefined): EditableBlock {
	const clean = stripComments(body ?? "");
	const lines = clean.split(/\r?\n/);

	const introLines: string[] = [];
	const items: EditableItem[] = [];
	let current: { title: string; lines: string[] } | null = null;

	const flush = () => {
		if (!current) return;
		items.push({
			title: current.title,
			description: joinParagraphs(current.lines),
		});
		current = null;
	};

	for (const line of lines) {
		const heading = line.match(/^\s{0,3}#{1,4}\s+(.*\S)\s*$/);
		if (heading) {
			flush();
			current = { title: heading[1]!.trim(), lines: [] };
			continue;
		}
		if (current) current.lines.push(line);
		else introLines.push(line);
	}
	flush();

	return { intro: joinParagraphs(introLines), items };
}

/** 把一疊行合併成文字：連續的行接成同一段，空行分段，段與段之間留一個換行。 */
function joinParagraphs(lines: string[]): string {
	const paragraphs: string[] = [];
	let buffer: string[] = [];

	for (const raw of lines) {
		const line = raw.trim();
		if (line === "") {
			if (buffer.length > 0) paragraphs.push(buffer.join(""));
			buffer = [];
			continue;
		}
		buffer.push(line);
	}
	if (buffer.length > 0) paragraphs.push(buffer.join(""));

	return paragraphs.join("\n");
}

/**
 * 讀取內文裡的第一個 Markdown 表格，回傳每一列的資料。
 *
 * 表格在 Obsidian 裡有專門的編輯介面（可以像 Excel 一樣按 Tab 換格），
 * 所以「一列一筆、每筆有好幾個欄位」的資料（例如標籤的經緯度）
 * 用表格會比用 YAML 清單好編輯得多。
 *
 * 回傳的每一列是「欄位標題 → 該格文字」的對照表，欄位標題直接用你在
 * 表格第一行寫的中文，所以之後要加欄位不用改程式。
 */
export function parseMarkdownTable(body: string | undefined): Record<string, string>[] {
	const clean = stripComments(body ?? "");
	const lines = clean.split(/\r?\n/);

	let headers: string[] | null = null;
	const rows: Record<string, string>[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("|")) {
			// 表格結束了就停手，只讀第一個表格
			if (headers && rows.length > 0) break;
			continue;
		}

		const cells = splitTableRow(trimmed);

		// 分隔列（|---|---|）：跳過
		if (cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s/g, "")))) continue;

		if (!headers) {
			headers = cells;
			continue;
		}

		const row: Record<string, string> = {};
		headers.forEach((header, i) => {
			row[header] = cells[i]?.trim() ?? "";
		});
		rows.push(row);
	}

	return rows;
}

function splitTableRow(line: string): string[] {
	return line
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((cell) => cell.trim());
}
