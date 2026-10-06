<template>
	<view class="page">
		<view class="card">
			<!-- 头像 -->
			<view class="row" @click="pickAvatar">
				<view class="row-label">头像</view>
				<view class="row-main">
					<image v-if="previewAvatar" class="avatar" :src="previewAvatar" mode="aspectFill" />
					<view v-else class="avatar placeholder">{{ avatarText }}</view>
				</view>
				<view class="chevron">›</view>
			</view>

			<view class="divider"></view>

			<!-- 昵称 -->
			<view class="row">
				<view class="row-label">昵称</view>
				<input
					class="row-input"
					type="text"
					maxlength="64"
					:value="nickname"
					placeholder="请输入昵称"
					placeholder-class="ph"
					@input="onNickInput"
				/>
				<view class="counter">{{ nickname.length }}/64</view>
			</view>
		</view>

		<view class="tip">头像会在本地压缩到 160×160 后上传；手机号是登录账号，暂不支持修改</view>

		<button class="btn primary" :disabled="saving || loading" @click="save">
			{{ saving ? '保存中…' : '保存' }}
		</button>

		<!-- 小程序端头像压缩需要原生画布（H5 走浏览器 canvas，不需要） -->
		<!-- #ifdef MP-WEIXIN -->
		<canvas canvas-id="avatarCanvas" class="hidden-canvas"></canvas>
		<!-- #endif -->

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { getUserProfile, updateProfile } from '../../apis/index.js';
	import { isLoggedIn, getUserInfo, updateUserInfoCache } from '../../utils/auth.js';
	import { chooseAvatarBase64 } from '../../utils/avatar.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onLoad } from '@dcloudio/uni-app';
	import { ref, computed } from 'vue';

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const loading = ref(false);
	const saving = ref(false);

	/** 接口返回的原始资料（用于判断哪些字段真的被改过） */
	const profile = ref(null);
	const nickname = ref('');
	/** 新选的头像（Base64 DataURL）；为 null 表示这次没换头像 */
	const localAvatar = ref(null);

	const previewAvatar = computed(() => localAvatar.value || (profile.value && profile.value.avatarUrl) || '');

	const avatarText = computed(() => {
		const nick = nickname.value || (profile.value && profile.value.nickname) || '';
		return nick ? nick.slice(0, 1) : '我';
	});

	function applyProfile(data) {
		profile.value = data;
		nickname.value = (data && data.nickname) || '';
		localAvatar.value = null;
	}

	async function load() {
		if (!isLoggedIn()) {
			return;
		}
		loading.value = true;
		try {
			const data = await getUserProfile();
			applyProfile(data);
		} catch (e) {
			if (e && e.needLogin) {
				// 登录态失效：清掉本地缓存并退回上一页
				uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
				setTimeout(() => uni.navigateBack(), 800);
			}
		} finally {
			loading.value = false;
		}
	}

	function onNickInput(e) {
		nickname.value = e.detail.value;
	}

	function pickAvatar() {
		chooseAvatarBase64()
			.then((dataUrl) => {
				localAvatar.value = dataUrl;
			})
			.catch((err) => {
				// 用户取消选择不算错误
				if (err && err.cancelled) return;
				uni.showToast({ title: (err && err.message) || '选择图片失败', icon: 'none' });
			});
	}

	async function save() {
		if (saving.value) return;

		const nextNick = nickname.value.trim();
		if (!nextNick) {
			uni.showToast({ title: '昵称不能为空', icon: 'none' });
			return;
		}

		const payload = {};
		if (nextNick !== ((profile.value && profile.value.nickname) || '')) {
			payload.nickname = nextNick;
		}
		if (localAvatar.value) {
			payload.avatarUrl = localAvatar.value;
		}

		if (Object.keys(payload).length === 0) {
			uni.showToast({ title: '还没有修改内容', icon: 'none' });
			return;
		}

		saving.value = true;
		try {
			const data = await updateProfile(payload);
			// 同步本地缓存，返回「我的」页时 onShow 立刻能拿到新昵称/头像
			updateUserInfoCache({
				userId: data.userId,
				nickname: data.nickname || '',
				phone: data.phone || '',
				avatarUrl: data.avatarUrl || ''
			});
			applyProfile(data);
			uni.showToast({ title: '已保存', icon: 'success' });
			setTimeout(() => uni.navigateBack(), 700);
		} catch (e) {
			// 业务错误（1010 头像过大 / 400 参数）已由 request 层统一 toast
		} finally {
			saving.value = false;
		}
	}

	function onLoginSuccess() {
		handleSuccess();
		load();
	}

	function onLoginClose() {
		handleClose();
		uni.navigateBack();
	}

	onLoad(() => {
		if (!isLoggedIn()) {
			// 正常只会从「我的」页进来；这里兜底，未登录先弹登录再加载
			requireLogin(load);
			return;
		}
		load();
	});
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #F5F6F8;
		padding: 32rpx 28rpx 60rpx;
		box-sizing: border-box;
	}

	.card {
		background-color: #FFFFFF;
		border-radius: 22rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
		overflow: hidden;
	}

	.row {
		display: flex;
		align-items: center;
		padding: 28rpx 30rpx;
		min-height: 120rpx;
		box-sizing: border-box;
	}

	.row-label {
		width: 130rpx;
		flex-shrink: 0;
		font-size: 29rpx;
		color: #1A1A1A;
		font-weight: 500;
	}

	.row-main {
		flex: 1;
		display: flex;
		justify-content: flex-end;
		padding-right: 10rpx;
	}

	.avatar {
		width: 110rpx;
		height: 110rpx;
		border-radius: 50%;
		display: block;
		background-color: #F2F4F7;
	}

	.avatar.placeholder {
		background-color: #3C7BFF;
		color: #FFFFFF;
		font-size: 44rpx;
		font-weight: 700;
		text-align: center;
		line-height: 110rpx;
	}

	.row-input {
		flex: 1;
		height: 72rpx;
		font-size: 29rpx;
		color: #1A1A1A;
		text-align: right;
	}

	.ph {
		color: #A6ACB8;
		font-size: 28rpx;
	}

	.counter {
		flex-shrink: 0;
		margin-left: 16rpx;
		font-size: 23rpx;
		color: #A6ABB5;
	}

	.chevron {
		flex-shrink: 0;
		margin-left: 8rpx;
		font-size: 34rpx;
		color: #C4C9D2;
		line-height: 1;
	}

	.divider {
		height: 2rpx;
		background-color: #F2F4F7;
		margin-left: 30rpx;
	}

	.tip {
		margin: 24rpx 8rpx 0;
		font-size: 23rpx;
		color: #A6ABB5;
		line-height: 1.6;
	}

	.btn {
		height: 92rpx;
		line-height: 92rpx;
		border-radius: 999rpx;
		font-size: 31rpx;
		font-weight: 600;
		border: none;
		margin-top: 50rpx;
	}

	.btn.primary {
		background-color: #3C7BFF;
		color: #FFFFFF;
	}

	.btn.primary[disabled] {
		background-color: #B9CDF7;
		color: #FFFFFF;
	}

	.btn::after {
		border: none;
	}

	.hidden-canvas {
		position: fixed;
		left: -9999px;
		top: -9999px;
		width: 160px;
		height: 160px;
	}
</style>
