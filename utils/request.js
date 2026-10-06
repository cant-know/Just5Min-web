// 后端接口基址
// H5：置空走同源相对路径，由 manifest.json 的 h5.devServer.proxy 把 /api
//     转发到本机 8080 —— 内网穿透（cpolar 等）访问时天然同源，不存在跨域
// 小程序：直连后端；微信开发者工具需勾选「不校验合法域名」才能访问 localhost
// 上线：改为已备案的 https 域名，并在小程序后台配置 request 合法域名
// #ifdef H5
export const BASE_URL = '';
// #endif
// #ifndef H5
export const BASE_URL = 'http://localhost:8080';
// #endif

const TOKEN_KEY = 'token';

export function getToken() {
	return uni.getStorageSync(TOKEN_KEY) || '';
}

export function clearToken() {
	uni.removeStorageSync(TOKEN_KEY);
	uni.removeStorageSync('userId');
	uni.removeStorageSync('userInfo');
}

/**
 * 统一请求封装：
 * - 自动注入 Authorization: Bearer <token>（游客时为空串，后端按游客放行只读接口）
 * - code === 0 直接 resolve(data)
 * - 401：清除本地登录态，reject 一个带 needLogin 标记的错误对象。
 *       游客模式下不再强制跳首页、也不弹 toast —— 由页面决定是否弹出登录引导。
 * - 其他错误码：统一 toast 后 reject
 */
const request = (options) => {
	return new Promise((resolve, reject) => {
		uni.request({
			url: BASE_URL + options.url,
			method: options.method || 'GET',
			data: options.data || {},
			header: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer ' + getToken()
			},
			success: (res) => {
				const body = res.data;
				if (body && body.code === 0) {
					resolve(body.data);
					return;
				}
				if (res.statusCode === 401 || (body && body.code === 401)) {
					clearToken();
					reject({
						code: 401,
						needLogin: true,
						message: (body && body.message) || '请先登录'
					});
					return;
				}
				uni.showToast({ title: (body && body.message) || '请求失败', icon: 'none' });
				reject(body || { code: -1, message: '请求失败' });
			},
			fail: (err) => {
				uni.showToast({ title: '网络异常，请检查后端是否已启动', icon: 'none' });
				reject(err);
			}
		});
	});
};

export const get = (url, data) => request({ url, data, method: 'GET' });
export const post = (url, data) => request({ url, data, method: 'POST' });
export const put = (url, data) => request({ url, data, method: 'PUT' });
export const del = (url, data) => request({ url, data, method: 'DELETE' });

export default request;
