<template>
	<view class="page">
		<view class="search-bar">
			<input
				class="search-input"
				type="text"
				:value="keyword"
				placeholder="用户ID / 手机号 / 昵称"
				placeholder-class="ph"
				confirm-type="search"
				@input="onInput"
				@confirm="doSearch"
			/>
			<view class="search-btn" @click="doSearch">搜索</view>
		</view>

		<view class="hint">
			输入完整手机号或用户ID可精确查找；输入昵称会模糊匹配。
		</view>

		<view v-if="loading" class="tip">搜索中…</view>
		<view v-else-if="searched && results.length === 0" class="empty">没有找到匹配的用户</view>
		<view v-else-if="results.length" class="list">
			<view v-for="item in results" :key="item.userId" class="item">
				<image v-if="item.avatarUrl" class="avatar img" :src="item.avatarUrl" mode="aspectFill" />
				<view v-else class="avatar">{{ initial(item.nickname) }}</view>
				<view class="item-main">
					<view class="item-name">{{ item.nickname }}</view>
					<view class="item-meta">ID：{{ item.userId }}</view>
				</view>
				<view class="action" :class="actionClass(item.relation)" @click="onAction(item)">
					{{ actionText(item.relation) }}
				</view>
			</view>
		</view>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { searchFriends, sendFriendRequest } from '../../apis/index.js';
	import { isLoggedIn } from '../../utils/auth.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onLoad } from '@dcloudio/uni-app';
	import { ref } from 'vue';

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const keyword = ref('');
	const results = ref([]);
	const loading = ref(false);
	const searched = ref(false);

	function initial(name) {
		if (!name) return '友';
		return String(name).slice(0, 1);
	}

	function onInput(e) {
		keyword.value = e.detail.value;
	}

	/** 关系 → 按钮文案 */
	function actionText(relation) {
		return (
			{
				self: '这是你自己',
				friend: '已是好友',
				pending_out: '已发送',
				pending_in: '去处理'
			}[relation] || '加好友'
		);
	}

	/** 关系 → 按钮样式（只有陌生人可点） */
	function actionClass(relation) {
		return relation === 'none' || relation == null
			? 'action-primary'
			: relation === 'pending_in'
				? 'action-link'
				: 'action-disabled';
	}

	async function doSearch() {
		const kw = keyword.value.trim();
		if (!kw) {
			uni.showToast({ title: '请输入搜索内容', icon: 'none' });
			return;
		}
		loading.value = true;
		searched.value = false;
		try {
			const list = await searchFriends(kw);
			results.value = list || [];
			searched.value = true;
		} catch (e) {
			// 错误已由 request 层 toast
		} finally {
			loading.value = false;
		}
	}

	function onAction(item) {
		if (item.relation === 'self' || item.relation === 'friend') {
			return;
		}
		if (item.relation === 'pending_out') {
			uni.showToast({ title: '已发送，等待对方处理', icon: 'none' });
			return;
		}
		if (item.relation === 'pending_in') {
			uni.navigateTo({ url: '/pages/friend-requests/friend-requests' });
			return;
		}
		confirmSend(item);
	}

	function confirmSend(item) {
		uni.showModal({
			title: '添加好友',
			content: '向「' + item.nickname + '」发送好友请求？',
			success: (res) => {
				if (res.confirm) {
					doSend(item);
				}
			}
		});
	}

	async function doSend(item) {
		try {
			await sendFriendRequest(item.userId);
			// 就地更新，避免整表重搜
			item.relation = 'pending_out';
			uni.showToast({ title: '请求已发送', icon: 'success' });
		} catch (e) {
			// 已是好友 / 已发送 / 对方不存在等业务错误已由 request 层 toast
		}
	}

	function onLoginSuccess() {
		handleSuccess();
	}

	function onLoginClose() {
		handleClose();
		uni.navigateBack();
	}

	onLoad(() => {
		if (!isLoggedIn()) {
			requireLogin();
		}
	});
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #F5F6F8;
		padding: 32rpx 28rpx 60rpx;
		box-sizing: border-box;
	}

	.search-bar {
		display: flex;
		align-items: center;
		background-color: #FFFFFF;
		border-radius: 999rpx;
		padding: 8rpx 8rpx 8rpx 32rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.search-input {
		flex: 1;
		height: 76rpx;
		font-size: 29rpx;
		color: #1A1A1A;
	}

	.ph {
		color: #A6ACB8;
		font-size: 28rpx;
	}

	.search-btn {
		flex-shrink: 0;
		height: 76rpx;
		line-height: 76rpx;
		padding: 0 40rpx;
		background-color: #3C7BFF;
		color: #FFFFFF;
		font-size: 28rpx;
		font-weight: 600;
		border-radius: 999rpx;
	}

	.hint {
		margin: 22rpx 12rpx 26rpx;
		font-size: 22rpx;
		color: #A6ABB5;
		line-height: 1.6;
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
		margin-top: 6rpx;
		font-size: 22rpx;
		color: #A6ABB5;
	}

	.action {
		flex-shrink: 0;
		margin-left: 16rpx;
		height: 60rpx;
		line-height: 60rpx;
		padding: 0 28rpx;
		border-radius: 999rpx;
		font-size: 25rpx;
		font-weight: 600;
	}

	.action-primary {
		background-color: #3C7BFF;
		color: #FFFFFF;
	}

	.action-link {
		background-color: #EEF3FF;
		color: #3C7BFF;
	}

	.action-disabled {
		background-color: #F2F4F7;
		color: #A6ABB5;
	}

	.tip {
		padding: 100rpx 0;
		text-align: center;
		font-size: 28rpx;
		color: #8A8F99;
	}

	.empty {
		padding: 80rpx 40rpx;
		text-align: center;
		font-size: 26rpx;
		color: #A6ABB5;
		background-color: #FFFFFF;
		border-radius: 22rpx;
	}
</style>
