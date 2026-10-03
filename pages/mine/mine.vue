<template>
	<view class="page">
		<view class="profile">
			<view class="avatar" :class="{ guest: !loggedIn }">{{ avatarText }}</view>
			<view class="profile-info">
				<view class="nick">{{ nickname }}</view>
				<view class="uid">{{ subtitle }}</view>
			</view>
			<button v-if="!loggedIn" class="mini-btn" @click="openLogin">登录</button>
		</view>

		<!-- 已登录：积分 + 学习统计 -->
		<block v-if="loggedIn">
			<view v-if="loading" class="tip">加载中…</view>
			<block v-else>
				<view class="points-bar" @click="goMall">
					<view class="points-left">
						<view class="points-num">{{ stats.points || 0 }}</view>
						<view class="points-label">我的积分 · 每答一题 +1</view>
					</view>
					<view class="points-action">去商城兑换 ›</view>
				</view>

				<view class="stat-row">
					<view class="stat-card">
						<view class="stat-num">{{ stats.totalAnswered }}</view>
						<view class="stat-label">累计答题</view>
					</view>
					<view class="stat-card">
						<view class="stat-num ok">{{ accuracyPct }}%</view>
						<view class="stat-label">正确率</view>
					</view>
					<view class="stat-card">
						<view class="stat-num no">{{ stats.wrongCount }}</view>
						<view class="stat-label">错题数</view>
					</view>
				</view>

				<view class="section-title">各科目答题情况</view>
				<view v-if="!stats.perCategory || stats.perCategory.length === 0" class="empty">还没有答题记录</view>
				<view v-else class="cat-list">
					<view v-for="item in stats.perCategory" :key="item.categoryId" class="cat-row">
						<view class="cat-name">{{ item.name }}</view>
						<view class="cat-detail">
							<text class="answered">{{ item.answered }} 题</text>
							<text class="correct">对 {{ item.correct }}</text>
						</view>
					</view>
				</view>

				<button class="btn ghost" @click="goWrong">查看错题本</button>
				<button class="btn ghost danger" @click="confirmLogout">退出登录</button>
			</block>
		</block>

		<!-- 游客 -->
		<view v-else class="guest-note">
			<view class="guest-title">你正在以游客身份浏览</view>
			<view class="guest-desc">登录后可保存答题记录、错题本与学习统计</view>
			<button class="btn primary" @click="openLogin">微信 / 手机号登录</button>
		</view>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { getUserStats } from '../../apis/index.js';
	import { isLoggedIn, getUserInfo, logout } from '../../utils/auth.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onShow } from '@dcloudio/uni-app';
	import { ref, reactive, computed } from 'vue';

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const loading = ref(true);
	const loggedIn = ref(false);
	const userInfo = ref(null);
	const stats = reactive({
		totalAnswered: 0,
		totalCorrect: 0,
		accuracy: 0,
		wrongCount: 0,
		points: 0,
		perCategory: []
	});

	const avatarText = computed(() => {
		if (!loggedIn.value) return '游';
		const nick = (userInfo.value && userInfo.value.nickname) || '';
		return nick ? nick.slice(0, 1) : '我';
	});

	const nickname = computed(() => {
		if (!loggedIn.value) return '游客';
		return (userInfo.value && userInfo.value.nickname) || '微信用户';
	});

	const subtitle = computed(() => {
		if (!loggedIn.value) return '登录后保存学习记录';
		const u = userInfo.value || {};
		if (u.phone) return '手机号：' + u.phone;
		return 'ID：' + (u.userId || '-');
	});

	const accuracyPct = computed(() => Math.round((stats.accuracy || 0) * 100));

	function resetStats() {
		Object.assign(stats, {
			totalAnswered: 0,
			totalCorrect: 0,
			accuracy: 0,
			wrongCount: 0,
			points: 0,
			perCategory: []
		});
	}

	function goMall() {
		uni.switchTab({ url: '/pages/mall/mall' });
	}

	async function load() {
		if (!isLoggedIn()) {
			loggedIn.value = false;
			userInfo.value = null;
			resetStats();
			loading.value = false;
			return;
		}
		loggedIn.value = true;
		userInfo.value = getUserInfo();
		loading.value = true;
		try {
			const data = await getUserStats();
			Object.assign(stats, data);
		} catch (e) {
			// token 失效（401）时退回游客态，由用户重新登录
			if (e && e.needLogin) {
				loggedIn.value = false;
				userInfo.value = null;
				resetStats();
			}
		} finally {
			loading.value = false;
		}
	}

	function openLogin() {
		requireLogin(load);
	}

	function onLoginSuccess() {
		handleSuccess();
	}

	function onLoginClose() {
		handleClose();
	}

	function goWrong() {
		uni.switchTab({ url: '/pages/wrong/wrong' });
	}

	function confirmLogout() {
		uni.showModal({
			title: '退出登录',
			content: '退出后回到游客模式，本地登录态会被清除（答题记录仍保留在账号里）。',
			success: (res) => {
				if (!res.confirm) return;
				logout();
				load();
				uni.showToast({ title: '已退出登录', icon: 'none' });
			}
		});
	}

	onShow(() => {
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

	.profile {
		display: flex;
		align-items: center;
		background-color: #FFFFFF;
		border-radius: 22rpx;
		padding: 34rpx 30rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.avatar {
		width: 100rpx;
		height: 100rpx;
		border-radius: 50%;
		background-color: #3C7BFF;
		color: #FFFFFF;
		font-size: 40rpx;
		font-weight: 700;
		text-align: center;
		line-height: 100rpx;
		margin-right: 24rpx;
		flex-shrink: 0;
	}

	.avatar.guest {
		background-color: #C4C9D2;
	}

	.profile-info {
		flex: 1;
		min-width: 0;
	}

	.nick {
		font-size: 32rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.uid {
		margin-top: 8rpx;
		font-size: 24rpx;
		color: #8A8F99;
	}

	.mini-btn {
		flex-shrink: 0;
		height: 64rpx;
		line-height: 64rpx;
		padding: 0 34rpx;
		margin: 0;
		background-color: #3C7BFF;
		color: #FFFFFF;
		font-size: 26rpx;
		font-weight: 600;
		border-radius: 999rpx;
		border: none;
	}

	.mini-btn::after {
		border: none;
	}

	.tip {
		padding: 120rpx 0;
		text-align: center;
		font-size: 28rpx;
		color: #8A8F99;
	}

	.stat-row {
		display: flex;
		margin-top: 26rpx;
	}

	/* 积分条 */
	.points-bar {
		margin-top: 26rpx;
		padding: 30rpx 32rpx;
		background: linear-gradient(135deg, #3C7BFF, #6A9BFF);
		border-radius: 20rpx;
		color: #FFFFFF;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-shadow: 0 6rpx 18rpx rgba(60, 123, 255, 0.25);
	}

	.points-left {
		display: flex;
		flex-direction: column;
	}

	.points-num {
		font-size: 44rpx;
		font-weight: 700;
		line-height: 1.1;
	}

	.points-label {
		margin-top: 6rpx;
		font-size: 22rpx;
		opacity: 0.85;
	}

	.points-action {
		font-size: 25rpx;
		background: rgba(255, 255, 255, 0.2);
		padding: 12rpx 24rpx;
		border-radius: 999rpx;
	}

	.stat-card {
		flex: 1;
		background-color: #FFFFFF;
		border-radius: 20rpx;
		padding: 32rpx 0;
		text-align: center;
		margin-right: 20rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.stat-card:last-child {
		margin-right: 0;
	}

	.stat-num {
		font-size: 42rpx;
		font-weight: 700;
		color: #1A1A1A;
	}

	.stat-num.ok {
		color: #19B36B;
	}

	.stat-num.no {
		color: #F5453F;
	}

	.stat-label {
		margin-top: 10rpx;
		font-size: 24rpx;
		color: #8A8F99;
	}

	.section-title {
		margin: 44rpx 6rpx 20rpx;
		font-size: 29rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.empty {
		padding: 40rpx 0;
		text-align: center;
		font-size: 26rpx;
		color: #A6ABB5;
	}

	.cat-list {
		background-color: #FFFFFF;
		border-radius: 20rpx;
		overflow: hidden;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.cat-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 28rpx 28rpx;
		border-bottom: 2rpx solid #F2F4F7;
	}

	.cat-row:last-child {
		border-bottom: none;
	}

	.cat-name {
		font-size: 29rpx;
		color: #1A1A1A;
	}

	.cat-detail .answered {
		font-size: 26rpx;
		color: #5A6270;
		margin-right: 24rpx;
	}

	.cat-detail .correct {
		font-size: 26rpx;
		color: #19B36B;
	}

	/* ---------- 游客 ---------- */
	.guest-note {
		margin-top: 30rpx;
		background-color: #FFFFFF;
		border-radius: 22rpx;
		padding: 70rpx 40rpx;
		text-align: center;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.guest-title {
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
		margin-top: 50rpx;
	}

	.btn.ghost {
		background-color: #FFFFFF;
		color: #5A6270;
		border: 2rpx solid #E6E9EF;
	}

	.btn.ghost.danger {
		color: #F5453F;
	}

	.btn.primary {
		background-color: #3C7BFF;
		color: #FFFFFF;
		margin-top: 44rpx;
	}

	.btn::after {
		border: none;
	}
</style>
