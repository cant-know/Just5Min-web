<template>
	<view class="page">
		<!-- 游客 -->
		<view v-if="!loggedIn" class="guest-note">
			<view class="guest-emoji">👥</view>
			<view class="guest-title">登录后和研友一起刷题</view>
			<view class="guest-desc">加好友后可互相查看答题数、正确率与打卡天数</view>
			<button class="btn primary" @click="openLogin">微信 / 手机号登录</button>
		</view>

		<block v-else>
			<!-- 搜索入口 -->
			<view class="entry" @click="goSearch">
				<text class="entry-icon">🔍</text>
				<view class="entry-text">添加好友</view>
				<view class="entry-desc">用户ID / 手机号 / 昵称</view>
				<view class="chevron">›</view>
			</view>

			<!-- 好友请求入口 -->
			<view class="entry" @click="goRequests">
				<text class="entry-icon">📨</text>
				<view class="entry-text">好友请求</view>
				<view class="entry-tail">
					<view v-if="pendingCount > 0" class="badge">{{ pendingCount > 99 ? '99+' : pendingCount }}</view>
					<view v-else class="tail-text">暂无新的请求</view>
				</view>
				<view class="chevron">›</view>
			</view>

			<view class="section-title">
				我的好友
				<text v-if="friends.length" class="section-count">{{ friends.length }}</text>
			</view>

			<view v-if="loading" class="tip">加载中…</view>
			<view v-else-if="friends.length === 0" class="empty">还没有好友，点上方「添加好友」找找研友吧</view>
			<view v-else class="list">
				<view v-for="item in friends" :key="item.userId" class="item" @longpress="confirmRemove(item)">
					<image v-if="item.avatarUrl" class="avatar img" :src="item.avatarUrl" mode="aspectFill" />
					<view v-else class="avatar">{{ initial(item.nickname) }}</view>
					<view class="item-main">
						<view class="item-name">{{ item.nickname }}</view>
						<view class="item-meta">
							答题 {{ item.totalAnswered || 0 }} · 正确率 {{ pct(item.accuracy) }}% · 打卡 {{ item.checkinDays || 0 }} 天
						</view>
					</view>
					<view class="item-right">
						<view class="item-points">{{ item.points || 0 }}</view>
						<view class="item-points-label">积分</view>
					</view>
				</view>
				<view v-if="hasMore" class="more" @click="loadMore">加载更多</view>
			</view>
			<view v-if="friends.length" class="hint">长按好友可删除</view>
		</block>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { getFriendList, getFriendRequestCount, removeFriend } from '../../apis/index.js';
	import { isLoggedIn } from '../../utils/auth.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onShow } from '@dcloudio/uni-app';
	import { ref } from 'vue';

	/** tabBar 里「好友」是第 4 项，索引为 3（改动 tabBar 顺序时要同步这里） */
	const FRIEND_TAB_INDEX = 3;

	/** 好友列表分页大小；头像以 Base64 返回，页大小不宜过大 */
	const PAGE_LIMIT = 50;

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const loggedIn = ref(false);
	const loading = ref(true);
	const friends = ref([]);
	const pendingCount = ref(0);
	const hasMore = ref(false);

	function initial(name) {
		if (!name) return '友';
		return String(name).slice(0, 1);
	}

	function pct(accuracy) {
		return Math.round((accuracy || 0) * 100);
	}

	function setBadge(count) {
		// setTabBarBadge 不持久化，冷启动/每次进页面都要重设
		try {
			if (count > 0) {
				uni.setTabBarBadge({ index: FRIEND_TAB_INDEX, text: count > 99 ? '99+' : String(count) });
			} else {
				uni.removeTabBarBadge({ index: FRIEND_TAB_INDEX });
			}
		} catch (e) {
			// 某些平台不支持角标，忽略即可
		}
	}

	async function fetchPage(offset) {
		return getFriendList({ limit: PAGE_LIMIT, offset });
	}

	/**
	 * 列表页统一写法：首次带骨架，之后静默刷新（tabBar 页切 tab / 返回都不会重建页面）
	 */
	async function load(silent = false) {
		if (!isLoggedIn()) {
			loggedIn.value = false;
			friends.value = [];
			pendingCount.value = 0;
			hasMore.value = false;
			setBadge(0);
			loading.value = false;
			return;
		}
		loggedIn.value = true;
		if (!silent) loading.value = true;
		try {
			const [list, count] = await Promise.all([fetchPage(0), getFriendRequestCount()]);
			friends.value = list || [];
			hasMore.value = (list || []).length === PAGE_LIMIT;
			pendingCount.value = count || 0;
			setBadge(pendingCount.value);
		} catch (e) {
			if (e && e.needLogin) {
				loggedIn.value = false;
				friends.value = [];
				pendingCount.value = 0;
				setBadge(0);
			}
		} finally {
			loading.value = false;
		}
	}

	async function loadMore() {
		try {
			const list = await fetchPage(friends.value.length);
			const merged = friends.value.concat(list || []);
			friends.value = merged;
			hasMore.value = (list || []).length === PAGE_LIMIT;
		} catch (e) {
			// 错误已由 request 层 toast
		}
	}

	function goSearch() {
		uni.navigateTo({ url: '/pages/friend-search/friend-search' });
	}

	function goRequests() {
		uni.navigateTo({ url: '/pages/friend-requests/friend-requests' });
	}

	function confirmRemove(item) {
		uni.showModal({
			title: '删除好友',
			content: '确定删除好友「' + item.nickname + '」吗？删除后双方都会从好友列表移除。',
			confirmColor: '#F5453F',
			success: (res) => {
				if (!res.confirm) return;
				doRemove(item.userId);
			}
		});
	}

	async function doRemove(friendId) {
		try {
			await removeFriend(friendId);
			uni.showToast({ title: '已删除', icon: 'none' });
			load(true);
		} catch (e) {
			// 错误已由 request 层 toast
		}
	}

	function openLogin() {
		requireLogin(() => load());
	}

	function onLoginSuccess() {
		handleSuccess();
		load();
	}

	function onLoginClose() {
		handleClose();
	}

	onShow(() => {
		load(loggedIn.value);
	});
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #F5F6F8;
		padding: 32rpx 28rpx 60rpx;
		box-sizing: border-box;
	}

	/* ---------- 入口卡 ---------- */
	.entry {
		display: flex;
		align-items: center;
		background-color: #FFFFFF;
		border-radius: 22rpx;
		padding: 30rpx 30rpx;
		margin-bottom: 20rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.entry-icon {
		font-size: 40rpx;
		margin-right: 22rpx;
	}

	.entry-text {
		font-size: 30rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.entry-desc {
		flex: 1;
		text-align: right;
		font-size: 24rpx;
		color: #A6ABB5;
		margin-right: 12rpx;
	}

	.entry-tail {
		flex: 1;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		margin-right: 12rpx;
	}

	.tail-text {
		font-size: 24rpx;
		color: #A6ABB5;
	}

	.badge {
		min-width: 36rpx;
		height: 36rpx;
		line-height: 36rpx;
		padding: 0 12rpx;
		box-sizing: border-box;
		border-radius: 999rpx;
		background-color: #F5453F;
		color: #FFFFFF;
		font-size: 22rpx;
		text-align: center;
	}

	.chevron {
		flex-shrink: 0;
		font-size: 34rpx;
		color: #C4C9D2;
		line-height: 1;
	}

	/* ---------- 列表 ---------- */
	.section-title {
		margin: 40rpx 6rpx 20rpx;
		font-size: 29rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.section-count {
		margin-left: 12rpx;
		font-size: 24rpx;
		font-weight: 400;
		color: #A6ABB5;
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
		font-size: 22rpx;
		color: #8A8F99;
	}

	.item-right {
		flex-shrink: 0;
		margin-left: 16rpx;
		text-align: center;
	}

	.item-points {
		font-size: 32rpx;
		font-weight: 700;
		color: #3C7BFF;
		line-height: 1.1;
	}

	.item-points-label {
		font-size: 20rpx;
		color: #A6ABB5;
	}

	.more {
		padding: 28rpx 0;
		text-align: center;
		font-size: 26rpx;
		color: #3C7BFF;
	}

	.hint {
		margin: 20rpx 8rpx 0;
		text-align: center;
		font-size: 22rpx;
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
		line-height: 1.7;
		background-color: #FFFFFF;
		border-radius: 22rpx;
	}

	/* ---------- 游客 ---------- */
	.guest-note {
		background-color: #FFFFFF;
		border-radius: 22rpx;
		padding: 70rpx 40rpx;
		text-align: center;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.guest-emoji {
		font-size: 76rpx;
		line-height: 1;
	}

	.guest-title {
		margin-top: 22rpx;
		font-size: 31rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.guest-desc {
		margin-top: 14rpx;
		font-size: 25rpx;
		color: #8A8F99;
		line-height: 1.6;
	}

	.btn {
		height: 92rpx;
		line-height: 92rpx;
		border-radius: 999rpx;
		font-size: 31rpx;
		font-weight: 600;
		border: none;
		margin-top: 44rpx;
	}

	.btn.primary {
		background-color: #3C7BFF;
		color: #FFFFFF;
	}

	.btn::after {
		border: none;
	}
</style>
