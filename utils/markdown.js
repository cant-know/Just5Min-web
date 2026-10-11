/* 轻量 Markdown 渲染：只支持资料正文实际用到的语法，产物可控、零依赖。
 * 支持：# 标题（1~4 级）、- 无序列表、1. 有序列表、> 引用、| 表格 |、
 *       **粗体**、`行内代码`、--- 分隔线、空行分段。
 * 注意：所有文本都经 escapeHtml 转义后再拼标签，不会引入 HTML 注入。
 */

/** HTML 转义，正文全部走这里，避免内容里的 < > 破坏结构 */
function escapeHtml(text) {
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/** 行内标记：先转义，再替换 **粗体** 与 `代码` */
function inline(text) {
	let out = escapeHtml(text);
	out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
	return out;
}

function isTableRow(line) {
	return line.trim().startsWith('|') && line.trim().endsWith('|');
}

/** 表格分隔行，如 |---|---| */
function isTableDivider(line) {
	return /^\s*\|[\s:|-]+\|\s*$/.test(line);
}

function splitCells(line) {
	const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
	return trimmed.split('|').map((c) => c.trim());
}

/**
 * 把 Markdown 文本转成可放进 rich-text 的 HTML 字符串。
 * @param {string} markdown
 * @returns {string}
 */
export function renderMarkdown(markdown) {
	if (!markdown) return '';
	const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
	const html = [];

	let listType = ''; // 'ul' | 'ol' | ''
	let inTable = false;
	let tableHead = false;

	function closeList() {
		if (listType) {
			html.push('</' + listType + '>');
			listType = '';
		}
	}

	function closeTable() {
		if (inTable) {
			html.push('</tbody></table>');
			inTable = false;
			tableHead = false;
		}
	}

	for (const raw of lines) {
		const line = raw.replace(/\s+$/, '');

		// 空行：结束列表与表格
		if (line.trim() === '') {
			closeList();
			closeTable();
			continue;
		}

		// 分隔线
		if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
			closeList();
			closeTable();
			html.push('<hr/>');
			continue;
		}

		// 标题
		const heading = line.match(/^\s*(#{1,4})\s+(.*)$/);
		if (heading) {
			closeList();
			closeTable();
			const level = heading[1].length;
			html.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
			continue;
		}

		// 表格
		if (isTableRow(line)) {
			closeList();
			if (isTableDivider(line)) {
				// 分隔行：标记表头结束，交由后续行继续填充 tbody
				tableHead = false;
				continue;
			}
			const cells = splitCells(line);
			if (!inTable) {
				html.push('<table><thead><tr>');
				cells.forEach((c) => html.push('<th>' + inline(c) + '</th>'));
				html.push('</tr></thead><tbody>');
				inTable = true;
				tableHead = true;
				continue;
			}
			if (tableHead) {
				// 兜底：没有分隔行时，首行按表头、后续按表体
				tableHead = false;
			}
			html.push('<tr>');
			cells.forEach((c) => html.push('<td>' + inline(c) + '</td>'));
			html.push('</tr>');
			continue;
		}
		closeTable();

		// 引用
		const quote = line.match(/^\s*>\s?(.*)$/);
		if (quote) {
			closeList();
			html.push('<blockquote>' + inline(quote[1]) + '</blockquote>');
			continue;
		}

		// 无序列表
		const ul = line.match(/^\s*[-*+]\s+(.*)$/);
		if (ul) {
			if (listType !== 'ul') {
				closeList();
				html.push('<ul>');
				listType = 'ul';
			}
			html.push('<li>' + inline(ul[1]) + '</li>');
			continue;
		}

		// 有序列表
		const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
		if (ol) {
			if (listType !== 'ol') {
				closeList();
				html.push('<ol>');
				listType = 'ol';
			}
			html.push('<li>' + inline(ol[1]) + '</li>');
			continue;
		}

		// 普通段落
		closeList();
		html.push('<p>' + inline(line) + '</p>');
	}

	closeList();
	closeTable();
	return html.join('');
}
