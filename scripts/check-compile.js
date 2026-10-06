/*
 * 前端无头编译校验（不依赖 HBuilderX 正在跑 watcher）。
 * 用 HBuilderX 自带的 @vue/compiler-sfc 依次 parse → compileScript → compileTemplate，
 * .js 用 acorn 解析 —— 能抓住语法错误 / 模板编译错误 / 未定义引用等编译期问题。
 *
 * 用法：node scripts/check-compile.js [文件路径...]
 * 不带参数时校验本次改动涉及的全部文件。
 */
const path = require('path');
const fs = require('fs');

const HBX = 'D:/HBuilderX/plugins/uniapp-cli-vite/node_modules';
const compilerSfcPath = path.join(HBX, '@vue/compiler-sfc');
const acornPath = path.join(HBX, 'acorn');

const { parse, compileScript, compileTemplate } = require(compilerSfcPath);
const acorn = require(acornPath);

const ROOT = path.resolve(__dirname, '..');

/**
 * 模拟 H5 构建的条件编译：保留 #ifdef H5 与 #ifndef MP-WEIXIN 的内容，丢掉其它分支。
 * 否则 request.js 里 BASE_URL 的双分支会被当成「重复声明」误报。
 */
function stripConditionalCompilation(src) {
	const lines = src.split('\n');
	const out = [];
	let hide = false;
	for (const line of lines) {
		const def = line.match(/^\s*\/\/\s*#(ifdef|ifndef|endif)\s*(\S+)?/);
		if (def) {
			const kind = def[1];
			const cond = def[2] || '';
			if (kind === 'endif') {
				hide = false;
				continue;
			}
			if (!hide) {
				// 以「目标平台是 H5」为前提判断该分支是否生效
				const isH5Branch =
					(kind === 'ifdef' && cond === 'H5') ||
					(kind === 'ifndef' && cond === 'MP-WEIXIN');
				hide = !isH5Branch;
			}
			continue;
		}
		if (!hide) out.push(line);
	}
	return out.join('\n');
}

/** 去掉 JSON 里的 // 注释（uni-app 的 pages.json 允许注释） */
function stripJsonComments(src) {
	let out = '';
	let inStr = false;
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (inStr) {
			out += c;
			if (c === '\\') {
				out += src[i + 1] || '';
				i++;
			} else if (c === '"') {
				inStr = false;
			}
			continue;
		}
		if (c === '"') {
			inStr = true;
			out += c;
			continue;
		}
		if (c === '/' && src[i + 1] === '/') {
			while (i < src.length && src[i] !== '\n') i++;
			continue;
		}
		out += c;
	}
	return out;
}

const DEFAULT_FILES = [
	'pages/mine/mine.vue',
	'pages/profile/profile.vue',
	'pages/friend/friend.vue',
	'pages/friend-search/friend-search.vue',
	'pages/friend-requests/friend-requests.vue',
	'App.vue',
	'apis/index.js',
	'utils/request.js',
	'utils/auth.js',
	'utils/avatar.js',
];

const targets = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_FILES;

let failed = 0;

for (const rel of targets) {
	const abs = path.resolve(ROOT, rel);
	let src;
	try {
		src = fs.readFileSync(abs, 'utf8');
	} catch (e) {
		console.log('[FAIL] ' + rel + ' -> 读取失败: ' + e.message);
		failed++;
		continue;
	}

	try {
		if (rel.endsWith('.vue')) {
			const { descriptor, errors } = parse(src, { filename: abs });
			if (errors && errors.length) {
				throw new Error(errors.map((e) => e.message).join('; '));
			}
			if (descriptor.scriptSetup || descriptor.script) {
				compileScript(descriptor, { id: 'check' });
			}
			if (descriptor.template) {
				const tpl = compileTemplate({
					id: 'check',
					filename: abs,
					source: descriptor.template.content,
					compilerOptions: { mode: 'module' },
				});
				if (tpl.errors && tpl.errors.length) {
					throw new Error(tpl.errors.map((e) => (e.message || e)).join('; '));
				}
			}
		} else {
			acorn.parse(stripConditionalCompilation(src), {
				ecmaVersion: 'latest',
				sourceType: 'module',
			});
		}
		console.log('[OK]   ' + rel);
	} catch (e) {
		console.log('[FAIL] ' + rel + ' -> ' + e.message);
		failed++;
	}
}

// 顺带校验 pages.json（uni-app 允许 // 注释，去掉后再按严格 JSON 解析）
try {
	const raw = fs.readFileSync(path.join(ROOT, 'pages.json'), 'utf8');
	JSON.parse(stripJsonComments(raw));
	console.log('[OK]   pages.json (去注释后为合法 JSON)');
} catch (e) {
	console.log('[FAIL] pages.json -> ' + e.message);
	failed++;
}

console.log(failed === 0 ? '\n全部通过' : '\n有 ' + failed + ' 个文件未通过');
process.exit(failed === 0 ? 0 : 1);
