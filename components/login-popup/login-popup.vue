<template>
	<view v-if="visible" class="mask" @click="close">
		<view class="sheet" @click.stop>
			<view class="sheet-close" @click="close">✕</view>

			<view class="sheet-title">登录刷题5分钟</view>
			<view class="sheet-sub">登录后可保存答题记录、错题本与学习统计</view>

			<!-- 小程序端：微信一键登录 -->
			<!-- #ifdef MP-WEIXIN -->
			<button class="btn wechat" :disabled="busy" @click="doWxLogin">
				<text class="wx-badge">微</text>
				<text>{{ busy && loadingType === 'wx' ? '登录中…' : '微信一键登录' }}</text>
			</button>
			<!-- #endif -->

			<!-- #ifdef H5 -->
			<view class="hint">当前为浏览器调试环境，请使用手机号注册 / 登录</view>
			<!-- #endif -->
			<!-- #ifdef MP-WEIXIN -->
			<view class="divider">
				<view class="divider-line"></view>
				<text class="divider-text">或使用手机号</text>
				<view class="divider-line"></view>
			</view>
			<!-- #endif -->

			<!-- 手机号表单 -->
			<view class="form">
				<view class="field">
					<input
						class="input"
						type="number"
						maxlength="11"
						:value="form.phone"
						placeholder="请输入手机号"
						placeholder-class="ph"
						@input="onInput('phone', $event)"
					/>
				</view>
				<view class="field">
					<input
						class="input"
						password
						:value="form.password"
						placeholder="请输入密码（6~32位）"
						placeholder-class="ph"
						@input="onInput('password', $event)"
					/>
				</view>
				<view v-if="isRegister" class="field">
					<input
						class="input"
						password
						:value="form.confirm"
						placeholder="请再次输入密码"
						placeholder-class="ph"
						@input="onInput('confirm', $event)"
					/>
				</view>
			</view>

			<button class="btn primary" :disabled="busy" @click="submit">
				{{ busy && loadingType === 'phone' ? '请稍候…' : (isRegister ? '注册并登录' : '登录') }}
			</button>

			<view class="switch-row" @click="toggleMode">
				{{ isRegister ? '已有账号？去登录' : '没有账号？立即注册' }}
			</view>

			<view class="later" @click="close">暂不登录，先随便看看</view>
		</view>
	</view>
</template>

<script setup>
	import { register, passwordLogin, wxLogin } from '../../utils/auth.js';
	import { ref, reactive, computed, watch } from 'vue';

	const props = defineProps({
		visible: { type: Boolean, default: false }
	});
	const emit = defineEmits(['close', 'success']);

	/** login | register */
	const mode = ref('login');
	const busy = ref(false);
	/** 'wx' | 'phone'，用于给对应按钮显示 loading 文案 */
	const loadingType = ref('');
	const form = reactive({ phone: '', password: '', confirm: '' });

	const isRegister = computed(() => mode.value === 'register');

	// 每次打开时清空密码、重置忙碌态（手机号保留，方便用户重试）
	watch(
		() => props.visible,
		(v) => {
			if (v) {
				form.password = '';
				form.confirm = '';
				busy.value = false;
				loadingType.value = '';
			}
		}
	);

	function onInput(key, e) {
		form[key] = e.detail.value;
	}

	function close() {
		if (busy.value) return;
		emit('close');
	}

	function toggleMode() {
		if (busy.value) return;
		mode.value = isRegister.value ? 'login' : 'register';
		form.password = '';
		form.confirm = '';
	}

	function toast(title) {
		uni.showToast({ title, icon: 'none' });
	}

	function validate() {
		if (!/^1[3-9]\d{9}$/.test(form.phone)) {
			toast('请输入正确的手机号');
			return false;
		}
		if (!form.password || form.password.length < 6) {
			toast('密码至少 6 位');
			return false;
		}
		if (isRegister.value && form.confirm !== form.password) {
			toast('两次输入的密码不一致');
			return false;
		}
		return true;
	}

	async function doWxLogin() {
		if (busy.value) return;
		busy.value = true;
		loadingType.value = 'wx';
		try {
			await wxLogin();
			finishSuccess();
		} catch (e) {
			toast((e && e.message) || '微信登录失败，请重试');
		} finally {
			busy.value = false;
			loadingType.value = '';
		}
	}

	async function submit() {
		if (busy.value) return;
		if (!validate()) return;
		busy.value = true;
		loadingType.value = 'phone';
		try {
			if (isRegister.value) {
				await register(form.phone, form.password);
			} else {
				await passwordLogin(form.phone, form.password);
			}
			finishSuccess();
		} catch (e) {
			// 业务错误（手机号已注册、密码错误、参数不合法）已由 request 层统一 toast
		} finally {
			busy.value = false;
			loadingType.value = '';
		}
	}

	function finishSuccess() {
		uni.showToast({ title: '登录成功', icon: 'success' });
		emit('success');
	}
</script>

<style>
	.mask {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		/* 小程序端原生 tabBar 无法被覆盖，这里让蒙层止于 tabBar 之上 */
		bottom: var(--window-bottom, 0px);
		background-color: rgba(0, 0, 0, 0.45);
		z-index: 999;
		display: flex;
		align-items: flex-end;
	}

	.sheet {
		position: relative;
		width: 100%;
		background-color: #FFFFFF;
		border-radius: 28rpx 28rpx 0 0;
		padding: 46rpx 40rpx calc(36rpx + env(safe-area-inset-bottom));
		box-sizing: border-box;
	}

	.sheet-close {
		position: absolute;
		right: 20rpx;
		top: 16rpx;
		width: 64rpx;
		height: 64rpx;
		line-height: 64rpx;
		text-align: center;
		font-size: 30rpx;
		color: #A6ABB5;
	}

	.sheet-title {
		font-size: 38rpx;
		font-weight: 700;
		color: #1A1A1A;
		text-align: center;
	}

	.sheet-sub {
		margin-top: 14rpx;
		font-size: 25rpx;
		color: #8A8F99;
		text-align: center;
		line-height: 1.5;
	}

	/* ---------- 微信登录按钮 ---------- */
	.btn {
		height: 92rpx;
		line-height: 92rpx;
		border-radius: 999rpx;
		font-size: 31rpx;
		font-weight: 600;
		border: none;
		padding: 0;
		margin: 0;
	}

	.btn::after {
		border: none;
	}

	.btn.wechat {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #07C160;
		color: #FFFFFF;
		margin-top: 40rpx;
	}

	.btn.wechat[disabled] {
		opacity: 0.7;
		color: #FFFFFF;
		background-color: #07C160;
	}

	.wx-badge {
		width: 40rpx;
		height: 40rpx;
		line-height: 40rpx;
		text-align: center;
		border-radius: 50%;
		background-color: #FFFFFF;
		color: #07C160;
		font-size: 24rpx;
		font-weight: 700;
		margin-right: 14rpx;
	}

	.hint {
		margin-top: 30rpx;
		font-size: 24rpx;
		color: #A6ABB5;
		text-align: center;
	}

	.divider {
		display: flex;
		align-items: center;
		margin: 34rpx 0 26rpx;
	}

	.divider-line {
		flex: 1;
		height: 2rpx;
		background-color: #EDEFF3;
	}

	.divider-text {
		padding: 0 20rpx;
		font-size: 23rpx;
		color: #A6ABB5;
	}

	/* ---------- 手机号表单 ---------- */
	.form {
		margin-top: 8rpx;
	}

	.field {
		height: 92rpx;
		background-color: #F5F6F8;
		border-radius: 18rpx;
		padding: 0 28rpx;
		margin-bottom: 20rpx;
		display: flex;
		align-items: center;
	}

	.input {
		flex: 1;
		height: 92rpx;
		font-size: 29rpx;
		color: #1A1A1A;
	}

	.ph {
		color: #A6ACB8;
		font-size: 28rpx;
	}

	.btn.primary {
		background-color: #3C7BFF;
		color: #FFFFFF;
		margin-top: 10rpx;
	}

	.btn.primary[disabled] {
		background-color: #B9CDF7;
		color: #FFFFFF;
	}

	.switch-row {
		margin-top: 26rpx;
		text-align: center;
		font-size: 26rpx;
		color: #3C7BFF;
	}

	.later {
		margin-top: 22rpx;
		text-align: center;
		font-size: 25rpx;
		color: #A6ABB5;
	}
</style>
