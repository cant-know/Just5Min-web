/**
 * 头像选择 + 压缩 + 转 Base64 DataURL。
 *
 * 为什么这么做：后端把头像直接以 Base64 存进 user.avatar_url（MEDIUMTEXT），
 * 所以前端必须在本地压到足够小（160x160 JPEG q0.75，通常 5~10KB，
 * 远低于后端 200KB 上限），否则请求体太大会被拒（错误码 1010）。
 *
 * ⚠️ 小程序端需要页面模板里放一个离屏画布（原生的 canvas 必须写在 WXML 里）：
 *     <!-- #ifdef MP-WEIXIN -->
 *     <canvas canvas-id="avatarCanvas" class="hidden-canvas"></canvas>
 *     <!-- #endif -->
 *   配合样式 .hidden-canvas { position: fixed; left: -9999px; top: -9999px; width: 160px; height: 160px; }
 *   H5 端不需要，走浏览器 canvas。
 */

const TARGET_SIZE = 160;
const QUALITY = 0.75;
const CANVAS_ID = 'avatarCanvas';

/** 用户取消选择时 reject 的错误标记，调用方可据此静默忽略 */
export const AVATAR_CANCELLED = 'avatar-cancelled';

/**
 * 打开相册/相机选一张图，返回压缩后的 Base64 DataURL。
 * @returns {Promise<string>} 例如 data:image/jpeg;base64,/9j/4AAQ...
 */
export function chooseAvatarBase64() {
	return new Promise((resolve, reject) => {
		uni.chooseImage({
			count: 1,
			sizeType: ['compressed'],
			sourceType: ['album', 'camera'],
			success: (res) => {
				const src = res.tempFilePaths && res.tempFilePaths[0];
				if (!src) {
					reject(new Error('未选择图片'));
					return;
				}
				compressToBase64(src).then(resolve).catch(reject);
			},
			fail: (err) => {
				// 用户主动取消：抛一个可识别的标记，页面里静默处理
				const e = new Error(AVATAR_CANCELLED);
				e.cancelled = true;
				reject(e);
			}
		});
	});
}

function compressToBase64(src) {
	// #ifdef H5
	return compressByBrowserCanvas(src);
	// #endif
	// #ifndef H5
	return compressByUniCanvas(src);
	// #endif
}

/* ------------------------------------------------------------------ 小程序 */

function compressByUniCanvas(src) {
	return new Promise((resolve, reject) => {
		const ctx = uni.createCanvasContext(CANVAS_ID);
		// 直接铺满 160x160（不做裁剪框，MVP 简化）
		ctx.drawImage(src, 0, 0, TARGET_SIZE, TARGET_SIZE);
		// 必须等绘制回调，否则 canvasToTempFilePath 可能拿到空图
		ctx.draw(false, () => {
			uni.canvasToTempFilePath({
				canvasId: CANVAS_ID,
				x: 0,
				y: 0,
				width: TARGET_SIZE,
				height: TARGET_SIZE,
				destWidth: TARGET_SIZE,
				destHeight: TARGET_SIZE,
				fileType: 'jpg',
				quality: QUALITY,
				success: (res) => {
					// 小程序 readFile 得到的是裸 base64，需要自己拼 dataURL 前缀
					uni.getFileSystemManager().readFile({
						filePath: res.tempFilePath,
						encoding: 'base64',
						success: (file) => resolve('data:image/jpeg;base64,' + file.data),
						fail: (err) => reject(err || new Error('读取图片失败'))
					});
				},
				fail: (err) => reject(err || new Error('图片压缩失败'))
			});
		});
	});
}

/* ------------------------------------------------------------------ H5 */

function compressByBrowserCanvas(src) {
	return loadImage(src).then((img) => {
		// 正方形居中裁剪：以短边为准，避免头像被拉伸变形
		const side = Math.min(img.width || TARGET_SIZE, img.height || TARGET_SIZE);
		const sx = ((img.width || side) - side) / 2;
		const sy = ((img.height || side) - side) / 2;

		const canvas = document.createElement('canvas');
		canvas.width = TARGET_SIZE;
		canvas.height = TARGET_SIZE;
		const ctx = canvas.getContext('2d');
		ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);

		// H5 的 toDataURL 已经是完整 dataURL，不要再拼前缀
		return canvas.toDataURL('image/jpeg', QUALITY);
	});
}

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('图片加载失败'));
		// H5 下 uni.chooseImage 返回的是 blob: URL，可直接交给 Image
		img.src = src;
	});
}
