import { ref } from 'vue';
import { isLoggedIn } from './auth.js';

/**
 * 登录门禁：把「需要登录才能做的事」包一层。
 *
 * 已登录 → 直接执行 action；未登录 → 打开登录弹窗，登录成功后自动补执行 action。
 *
 * 用法：
 *   const gate = useLoginGate()
 *   gate.requireLogin(() => { ... })
 *   模板里放 <login-popup :visible="gate.visible" @success="gate.handleSuccess" @close="gate.handleClose" />
 *
 * 注意：模板里要用解构出来的变量，否则 ref 不会被自动解包。
 */
export function useLoginGate() {
	const visible = ref(false);
	// 登录成功后要接着执行的动作。普通变量即可，不需要响应式
	let pending = null;

	/**
	 * @param {Function} [action] 登录后要执行的动作；已登录时立即执行
	 */
	function requireLogin(action) {
		if (isLoggedIn()) {
			if (action) action();
			return;
		}
		pending = action || null;
		visible.value = true;
	}

	/** 登录成功回调（挂在 login-popup 的 success 事件上） */
	function handleSuccess() {
		visible.value = false;
		const action = pending;
		pending = null;
		if (action) action();
	}

	/** 关闭弹窗回调（挂在 login-popup 的 close 事件上） */
	function handleClose() {
		visible.value = false;
		pending = null;
	}

	return { visible, requireLogin, handleSuccess, handleClose };
}
