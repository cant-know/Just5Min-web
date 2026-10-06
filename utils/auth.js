import { apiWxLogin, apiRegister, apiPasswordLogin } from '../apis/index.js';
import { getToken, clearToken } from './request.js';

const USER_INFO_KEY = 'userInfo';

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
}
