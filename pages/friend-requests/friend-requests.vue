<template>
	<view class="page">
		<view v-if="loading" class="tip">加载中…</view>
		<view v-else-if="requests.length === 0" class="empty">
			<view class="empty-emoji">📭</view>
			<view class="empty-text">暂时没有新的好友请求</view>
		</view>
		<view v-else class="list">
			<view v-for="item in requests" :key="item.id" class="item">
				<image v-if="item.avatarUrl" class="avatar img" :src="item.avatarUrl" mode="aspectFill" />
				<view v-else class="avatar">{{ initial(item.nickname) }}</view>
				<view class="item-main">
					<view class="item-name">{{ item.nickname }}</view>
					<view class="item-meta">{{ item.message || '请求加你为好友' }}</view>
				</view>
				<view class="actions">
					<view class="act reject" @click="onReject(item)">拒绝</view>
					<view class="act accept" @click="onAccept(item)">同意</view>
				</view>
			</view>
		</view>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { getFriendRequests, getFriendRequestCount, acceptFriendRequest, rejectFriendRequest } from '../../apis/index.js';
	import { isLoggedIn } from '../../utils/auth.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onShow } from '@dcloudio/uni-app';
	import { ref } from 'vue';

	/** tabBar 里「好友」是第 4 项，索引为 3（与 friend.vue 保持一致） */
	const FRIEND_TAB_INDEX = 3;

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const loading = ref(true);
	const requests = ref([]);

	function initial(name) {
		if (!name) return '友';
		return String(name).slice(0, 1);
	}

	function setBadge(count) {
		try {
			if (count > 0) {
				uni.setTabBarBadge({ index: FRIEND_TAB_INDEX, text: count > 99 ? '99+' : String(count) });
			} else {
				uni.removeTabBarBadge({ index: FRIEND_TAB_INDEX });
			}
		} catch (e) {
			// 某些平台不支持角标，忽略
		}
	}

	async function load(silent = false) {
		if (!isLoggedIn()) {
			requests.value = [];
			loading.value = false;
			uni.navigateBack();
			return;
		}
		if (!silent) loading.value = true;
		try {
			const list = await getFriendRequests();
			requests.value = list || [];
			setBadge(requests.value.length);
		} catch (e) {
			if (e && e.needLogin) {
				requests.value = [];
			}
		} finally {
			loading.value = false;
		}
	}

	/** 处理完一条后本地移除并刷新角标，避免整表重拉 */
	function removeLocally(id) {
		requests.value = requests.value.filter((r) => r.id !== id);
		setBadge(requests.value.length);
		refreshBadgeFromServer();
	}

	async function refreshBadgeFromServer() {
		try {
			const count = await getFriendRequestCount();
			setBadge(count || 0);
		} catch (e) {
			// 忽略：角标不是关键路径
		}
	}

	function onAccept(item) {
		uni.showModal({
			title: '同意好友',
			content: '同意后你和「' + item.nickname + '」互为好友。',
			success: async (res) => {
				if (!res.confirm) return;
				try {
					await acceptFriendRequest(item.id);
					removeLocally(item.id);
					uni.showToast({ title: '已添加为好友', icon: 'success' });
				} catch (e) {
					// 错误已由 request 层 toast
				}
			}
		});
	}

	function onReject(item) {
		uni.showModal({
			title: '拒绝请求',
			content: '确定拒绝「' + item.nickname + '」的好友请求吗？对方之后仍可再次申请。',
			confirmColor: '#F5453F',
			success: async (res) => {
				if (!res.confirm) return;
				try {
					await rejectFriendRequest(item.id);
					removeLocally(item.id);
					uni.showToast({ title: '已拒绝', icon: 'none' });
				} catch (e) {
					// 错误已由 request 层 toast
				}
			}
		});
	}

	function onLoginSuccess() {
		handleSuccess();
		load();
	}

	function onLoginClose() {
		handleClose();
		uni.navigateBack();
	}

	onShow(() => {
		load(requests.value.length > 0);
	});

	// 页面冷启动时若未登录，弹登录引导
	if (!isLoggedIn()) {
		requireLogin();
	}
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #F5F6F8;
		padding: 32rpx 28rpx 60rpx;
		box-sizing: border-box;
	}

	.list {
		background-color: #FFFFFF;
		border-radius: 22rpx;
		overflow: hidden;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.item {
		display: flex;
		align-items: center;
		padding: 26rpx 28rpx;
		border-bottom: 2rpx solid #F2F4F7;
	}

	.item:last-child {
		border-bottom: none;
	}

	.avatar {
		width: 88rpx;
		height: 88rpx;
		border-radius: 50%;
		background-color: #3C7BFF;
		color: #FFFFFF;
		font-size: 34rpx;
		font-weight: 700;
		text-align: center;
		line-height: 88rpx;
		margin-right: 22rpx;
		flex-shrink: 0;
	}

	.avatar.img {
		display: block;
		background-color: #F2F4F7;
	}

	.item-main {
		flex: 1;
		min-width: 0;
	}

	.item-name {
		font-size: 29rpx;
		font-weight: 600;
		color: #1A1A1A;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-meta {
		margin-top: 8rpx;
		font-size: 23rpx;
		color: #8A8F99;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.actions {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		margin-left: 16rpx;
	}

	.act {
		height: 60rpx;
		line-height: 60rpx;
		padding: 0 26rpx;
		border-radius: 999rpx;
		font-size: 25rpx;
		font-weight: 600;
	}

	.act.reject {
		background-color: #F2F4F7;
		color: #5A6270;
		margin-right: 14rpx;
	}

	.act.accept {
		background-color: #3C7BFF;
		color: #FFFFFF;
	}

	.tip {
		padding: 140rpx 0;
		text-align: center;
		font-size: 28rpx;
		color: #8A8F99;
	}

	.empty {
		padding: 120rpx 40rpx;
		text-align: center;
		background-color: #FFFFFF;
		border-radius: 22rpx;
	}

	.empty-emoji {
		font-size: 76rpx;
		line-height: 1;
	}

	.empty-text {
		margin-top: 22rpx;
		font-size: 26rpx;
		color: #A6ABB5;
	}
</style>
