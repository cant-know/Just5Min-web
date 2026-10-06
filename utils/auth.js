import { apiWxLogin, apiRegister, apiPasswordLogin } from '../apis/index.js';
import { getToken, clearToken } from './request.js';

const USER_INFO_KEY = 'userInfo';
const SAVED_ACCOUNTS_KEY = 'savedAccounts';
const ACCOUNT_TOKENS_KEY = 'accountTokens';

/**
 * 本地保存的可切换账号列表：[{ userId, nickname, phone, avatarUrl }]，最近登录的在前。
 * 只存展示信息与 token（token 失效时切换会要求重新登录），删除不会影响账号本身的数据。
 */
export function getSavedAccounts() {
	try {
		return uni.getStorageSync(SAVED_ACCOUNTS_KEY) || [];
	} catch (e) {
		return [];
	}
}

function getTokenMap() {
	try {
		return uni.getStorageSync(ACCOUNT_TOKENS_KEY) || {};
	} catch (e) {
		return {};
	}
}

/** 最多本地记住几个账号（防止 storage 无限膨胀） */
const MAX_SAVED_ACCOUNTS = 5;

/** 记住/刷新一个账号（登录成功或资料变更时调用） */
function rememberAccount(data) {
	if (!data || !data.userId) return;
	const list = getSavedAccounts().filter((a) => a.userId !== data.userId);
	list.unshift({
		userId: data.userId,
		nickname: data.nickname || '',
		phone: data.phone || '',
		avatarUrl: data.avatarUrl || ''
	});
	if (list.length > MAX_SAVED_ACCOUNTS) list.length = MAX_SAVED_ACCOUNTS;
	uni.setStorageSync(SAVED_ACCOUNTS_KEY, list);
	if (data.token) {
		const map = getTokenMap();
		map[data.userId] = data.token;
		uni.setStorageSync(ACCOUNT_TOKENS_KEY, map);
	}
}

/** 用当前登录态（token + userInfo 缓存）记住当前账号；「我的」页 load 时调用，兼容老用户 */
export function rememberCurrentAccount() {
	const token = getToken();
	const info = getUserInfo();
	if (!token || !info || !info.userId) return;
	rememberAccount({
		token,
		userId: info.userId,
		nickname: info.nickname,
		phone: info.phone,
		avatarUrl: info.avatarUrl
	});
}

/** 删除某个账号的本机记录（切换账号页「管理」里用） */
export function removeSavedAccount(userId) {
	uni.setStorageSync(SAVED_ACCOUNTS_KEY, getSavedAccounts().filter((a) => a.userId !== userId));
	const map = getTokenMap();
	delete map[userId];
	uni.setStorageSync(ACCOUNT_TOKENS_KEY, map);
}

/**
 * 切换到目标账号：本地有该账号的 token 则直接启用并返回 true；
 * 没有则清掉登录态（回到游客）并返回 false，调用方应引导重新登录。
 */
export function switchToAccount(account) {
	if (!account || !account.userId) return false;
	const token = getTokenMap()[account.userId] || '';
	if (token) {
		uni.setStorageSync('token', token);
		uni.setStorageSync('userId', account.userId);
		uni.setStorageSync(USER_INFO_KEY, {
			userId: account.userId,
			nickname: account.nickname || '',
			phone: account.phone || '',
			avatarUrl: account.avatarUrl || ''
		});
		return true;
	}
	clearToken();
	return false;
}

/** 是否已登录（本地有 token 即视为已登录；token 失效由 401 兜底清除） */
export function isLoggedIn() {
	return !!getToken();
}

/**
 * 本地缓存的用户信息：{ userId, nickname, phone, avatarUrl }，游客返回 null。
 * 注意：这里只是「首屏兜底」，「我的」页会用 /api/user/profile 的返回值覆盖它（避免缓存过期）。
 */
export function getUserInfo() {
	try {
		return uni.getStorageSync(USER_INFO_KEY) || null;
	} catch (e) {
		return null;
	}
}

/**
 * 合并更新本地用户信息缓存（编辑资料保存成功后调用）。
 * 这样从编辑页返回「我的」页时，onShow 立刻就能拿到新昵称/头像。
 * @param {{userId?:number, nickname?:string, phone?:string, avatarUrl?:string}} partial
 */
export function updateUserInfoCache(partial) {
	const current = getUserInfo() || {};
	const next = Object.assign({}, current, partial || {});
	uni.setStorageSync(USER_INFO_KEY, next);
	// 同步刷新「可切换账号」列表里的同一条目（头像/昵称编辑后保持一致）
	if (next.userId) {
		const list = getSavedAccounts();
		const idx = list.findIndex((a) => a.userId === next.userId);
		if (idx >= 0) {
			list[idx] = Object.assign({}, list[idx], {
				nickname: next.nickname || '',
				phone: next.phone || '',
				avatarUrl: next.avatarUrl || ''
			});
			uni.setStorageSync(SAVED_ACCOUNTS_KEY, list);
		}
	}
	return next;
}

/**
 * 微信一键登录（仅小程序端可用）：
 * wx.login 静默拿 code → 后端 jscode2session 换 openid → 签发 token。
 * @returns {Promise<object>} 登录返回 { token, userId, nickname, phone }
 */
export function wxLogin() {
	return new Promise((resolve, reject) => {
		uni.login({
			provider: 'weixin',
			success: async (res) => {
				if (!res.code) {
					reject(new Error('未获取到微信 code'));
					return;
				}
				try {
					const data = await apiWxLogin(res.code);
					saveLogin(data);
					resolve(data);
				} catch (e) {
					reject(e);
				}
			},
			fail: (err) => reject(err)
		});
	});
}

/** 手机号 + 密码登录 */
export function passwordLogin(phone, password) {
	return apiPasswordLogin(phone, password).then((data) => {
		saveLogin(data);
		return data;
	});
}

/** 手机号注册（成功即登录） */
export function register(phone, password, nickname) {
	return apiRegister(phone, password, nickname || '').then((data) => {
		saveLogin(data);
		return data;
	});
}

/** 退出登录：清掉本地登录态，回到游客身份 */
export function logout() {
	clearToken();
}

function saveLogin(data) {
	uni.setStorageSync('token', data.token);
	uni.setStorageSync('userId', data.userId);
	uni.setStorageSync(USER_INFO_KEY, {
		userId: data.userId,
		nickname: data.nickname || '',
		phone: data.phone || '',
		// 登录接口现在会回传头像（Base64 DataURL），没有则为空串
		avatarUrl: data.avatarUrl || ''
	});
	// 登录成功即记入「可切换账号」列表（含该账号的 token，供免密切换）
	rememberAccount(data);
}
