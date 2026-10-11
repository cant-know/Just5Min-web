<template>
	<view class="page">
		<view class="page-title">轻触头像以切换账号</view>
		<view class="manage-row">
			<text v-if="accounts.length" class="manage-link" @click="toggleManage">
				{{ managing ? '完成' : '管理' }}
			</text>
		</view>

		<view class="list">
			<view v-for="a in accounts" :key="a.userId" class="card" @click="tapAccount(a)">
				<view v-if="managing" class="remove" @click.stop="removeAccount(a)">−</view>
				<image v-if="a.avatarUrl" class="avatar" :src="a.avatarUrl" mode="aspectFill" />
				<view v-else class="avatar placeholder">{{ avatarText(a) }}</view>
				<view class="info">
					<view class="name-row">
						<text class="name">{{ a.nickname || '微信用户' }}</text>
						<text v-if="a.userId === currentId" class="current-tag">当前</text>
					</view>
					<view class="sub">{{ subtitle(a) }}</view>
				</view>
			</view>

			<view class="card add" @click="addAccount">
				<view class="avatar plus">+</view>
				<view class="info">
					<view class="name add-name">添加账号</view>
				</view>
			</view>
		</view>

		<view class="foot-note">最多记住 {{ maxAccounts }} 个账号，仅保存在本机</view>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="loginVisible = false" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import {
		getSavedAccounts,
		getUserInfo,
		switchToAccount,
		removeSavedAccount,
		updateUserInfoCache
	} from '../../utils/auth.js';
	import { getUserProfile } from '../../apis/index.js';
	import { onShow } from '@dcloudio/uni-app';
	import { ref } from 'vue';

	/** 与 utils/auth.js 的 MAX_SAVED_ACCOUNTS 保持一致，仅用于文案展示 */
	const maxAccounts = 5;

	const accounts = ref([]);
	const currentId = ref(0);
	const managing = ref(false);
	const loginVisible = ref(false);
	const switching = ref(false);

	onShow(() => {
		refresh();
	});

	function refresh() {
		accounts.value = getSavedAccounts();
		const cur = getUserInfo();
		currentId.value = cur ? cur.userId : 0;
	}

	function avatarText(a) {
		const nick = a.nickname || '';
		return nick ? nick.slice(0, 1) : '用';
	}

	function subtitle(a) {
		if (a.phone) {
			// 138****0001 形式脱敏展示
			return a.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
		}
		return 'ID：' + a.userId;
	}

	function toggleManage() {
		managing.value = !managing.value;
	}

	function removeAccount(a) {
		uni.showModal({
			title: '删除账号记录',
			content: '将清除「' + (a.nickname || '该账号') + '」的本机登录记录，不会删除账号里的答题数据。',
			success: (res) => {
				if (!res.confirm) return;
				removeSavedAccount(a.userId);
				refresh();
			}
		});
	}

	async function tapAccount(a) {
		if (managing.value || switching.value) return;
		// 点当前账号 = 返回
		if (a.userId === currentId.value) {
			uni.navigateBack();
			return;
		}
		switching.value = true;
		// 有缓存 token 则直接切换；否则清登录态、要求重新登录
		const hasToken = switchToAccount(a);
		if (!hasToken) {
			switching.value = false;
			loginVisible.value = true;
			uni.showToast({ title: '该账号需重新登录验证', icon: 'none' });
			return;
		}
		try {
			// 用 profile 接口校验 token 是否仍有效（失效时 request 层会清 token 并 reject needLogin）
			const prof = await getUserProfile();
			updateUserInfoCache({
				userId: prof.userId,
				nickname: prof.nickname || '',
				phone: prof.phone || '',
				avatarUrl: prof.avatarUrl || ''
			});
			uni.showToast({ title: '已切换账号', icon: 'success' });
			setTimeout(() => uni.navigateBack(), 500);
		} catch (e) {
			if (e && e.needLogin) {
				loginVisible.value = true;
				uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
			}
			switching.value = false;
		}
	}

	function addAccount() {
		loginVisible.value = true;
	}

	function onLoginSuccess() {
		loginVisible.value = false;
		uni.showToast({ title: '登录成功', icon: 'success' });
		// 新账号已由 saveLogin 记入列表并成为当前账号，返回上一页（「我的」会自动刷新）
		setTimeout(() => uni.navigateBack(), 500);
	}
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #DDDFE2;
		padding: 30rpx 30rpx 60rpx;
		box-sizing: border-box;
	}

	.page-title {
		margin-top: 40rpx;
		text-align: center;
		font-size: 42rpx;
		font-weight: 700;
		color: #1A1A1A;
	}

	.manage-row {
		height: 60rpx;
		margin-top: 20rpx;
		display: flex;
		justify-content: flex-end;
		align-items: center;
	}

	.manage-link {
		font-size: 26rpx;
		color: #3C7BFF;
		padding: 8rpx 12rpx;
	}

	.list {
		margin-top: 10rpx;
	}

	.card {
		position: relative;
		display: flex;
		align-items: center;
		background-color: #FFFFFF;
		border-radius: 18rpx;
		padding: 34rpx 30rpx;
		margin-bottom: 24rpx;
	}

	.card:active {
		background-color: #F5F6F8;
	}

	.card.add {
		background-color: rgba(255, 255, 255, 0.7);
	}

	.avatar {
		width: 96rpx;
		height: 96rpx;
		border-radius: 50%;
		background-color: #C7CCD6;
		flex-shrink: 0;
	}

	.avatar.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #FFFFFF;
		font-size: 40rpx;
		font-weight: 700;
	}

	.avatar.plus {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #EDEFF3;
		color: #A6ABB5;
		font-size: 48rpx;
		font-weight: 400;
	}

	.info {
		flex: 1;
		min-width: 0;
		margin-left: 26rpx;
	}

	.name-row {
		display: flex;
		align-items: center;
	}

	.name {
		font-size: 31rpx;
		font-weight: 600;
		color: #1A1A1A;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name.add-name {
		font-weight: 400;
		color: #5A6270;
	}

	.current-tag {
		flex-shrink: 0;
		margin-left: 14rpx;
		padding: 4rpx 16rpx;
		font-size: 20rpx;
		color: #3C7BFF;
		background-color: #E8F0FF;
		border-radius: 999rpx;
	}

	.sub {
		margin-top: 8rpx;
		font-size: 25rpx;
		color: #8A8F99;
	}

	/* 管理模式下的删除角标 */
	.remove {
		position: absolute;
		left: -12rpx;
		top: -12rpx;
		width: 44rpx;
		height: 44rpx;
		line-height: 40rpx;
		text-align: center;
		border-radius: 50%;
		background-color: #F5453F;
		color: #FFFFFF;
		font-size: 32rpx;
		z-index: 2;
	}

	.foot-note {
		margin-top: 30rpx;
		text-align: center;
		font-size: 23rpx;
		color: #9AA0AB;
	}
</style>
