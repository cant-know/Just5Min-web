<template>
	<view class="page">
		<!-- 顶部栏（自定义导航）：左上角打卡入口 -->
		<view class="top-bar">
			<view class="checkin-pill" @click="goCheckIn">
				<text class="checkin-icon">📅</text>
				<text class="checkin-text">{{ checkinText }}</text>
				<text class="checkin-arrow">›</text>
			</view>
		</view>

		<view class="hero">
			<view class="hero-title">刷题5分钟</view>
			<view class="hero-sub">每天 5 分钟，考研稳步提分</view>
		</view>

		<!-- 游客提示：不拦截浏览，只做告知 -->
		<view v-if="!loggedIn" class="guest-bar" @click="openLogin">
			<text class="guest-text">当前为游客模式，登录后可保存答题记录</text>
			<text class="guest-action">去登录</text>
		</view>

		<!-- 上次刷题分类：快速跳转 -->
		<view v-if="lastQuiz" class="resume-card">
			<view class="resume-main" @click="resumeToPractice">
				<view class="resume-label">上次刷题 · 快速跳转</view>
				<view class="resume-name">{{ lastQuiz.name }}</view>
			</view>
			<view class="resume-btn" @click.stop="resumeQuiz">继续刷题</view>
		</view>

		<!-- 快捷入口 -->
		<view class="entry-list">
			<view class="entry-card" @click="goBank">
				<view class="entry-icon">📚</view>
				<view class="entry-main">
					<view class="entry-name">题库</view>
					<view class="entry-desc">按分类挑考试科目，开始刷题</view>
				</view>
				<view class="entry-arrow">›</view>
			</view>

			<view class="entry-card" @click="goMall">
				<view class="entry-icon">🎁</view>
				<view class="entry-main">
					<view class="entry-name">积分商城</view>
					<view class="entry-desc">答题赚积分，兑换会员与备考资料</view>
				</view>
				<view class="entry-arrow">›</view>
			</view>

			<view class="entry-card" @click="goWrong">
				<view class="entry-icon">📝</view>
				<view class="entry-main">
					<view class="entry-name">错题本</view>
					<view class="entry-desc">回顾做错的题，逐个攻克</view>
				</view>
				<view class="entry-arrow">›</view>
			</view>
		</view>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { getCheckInSummary } from '../../apis/index.js';
	import { isLoggedIn } from '../../utils/auth.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onShow } from '@dcloudio/uni-app';
	import { ref, computed } from 'vue';

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const lastQuiz = ref(null);
	const loggedIn = ref(false);
	/** 打卡天数：null=未登录（只显示"打卡"），数字=已登录 */
	const checkinDays = ref(null);

	const checkinText = computed(() =>
		checkinDays.value === null ? '打卡' : `打卡 ${checkinDays.value} 天`
	);

	function readLastQuiz() {
		try {
			const saved = uni.getStorageSync('lastQuiz');
			lastQuiz.value = saved && saved.categoryId ? saved : null;
		} catch (e) {
			lastQuiz.value = null;
		}
	}

	/** 左上角打卡天数（登录才拉，失败静默） */
	async function loadCheckin() {
		if (!isLoggedIn()) {
			checkinDays.value = null;
			return;
		}
		try {
			const summary = await getCheckInSummary();
			checkinDays.value = Number(summary.totalDays || 0);
		} catch (e) {
			// 静默失败，不打断首页
		}
	}

	/** 进入打卡页（未登录先弹登录，成功后自动进入） */
	function goCheckIn() {
		requireLogin(() => {
			uni.navigateTo({ url: '/pages/checkin/checkin' });
		});
	}

	/** 跳转到上次刷题的三级分类（练习主页，游客可浏览） */
	function resumeToPractice() {
		if (!lastQuiz.value) return;
		uni.navigateTo({
			url: `/pages/practice/practice?categoryId=${lastQuiz.value.categoryId}` +
				`&name=${encodeURIComponent(lastQuiz.value.name || '')}&count=0`
		});
	}

	/** 直接继续上次分类的随机刷题（未登录先弹登录，登录成功后自动进入） */
	function resumeQuiz() {
		if (!lastQuiz.value) return;
		requireLogin(() => {
			uni.navigateTo({
				url: `/pages/quiz/quiz?categoryId=${lastQuiz.value.categoryId}&name=${encodeURIComponent(lastQuiz.value.name || '')}`
			});
		});
	}

	function openLogin() {
		requireLogin();
	}

	function onLoginSuccess() {
		loggedIn.value = true;
		handleSuccess();
		loadCheckin();
	}

	function onLoginClose() {
		handleClose();
	}

	function goBank() {
		uni.switchTab({ url: '/pages/bank/bank' });
	}

	function goMall() {
		uni.switchTab({ url: '/pages/mall/mall' });
	}

	function goWrong() {
		// 错题本已从 tabBar 移除，改为普通页面跳转
		uni.navigateTo({ url: '/pages/wrong/wrong' });
	}

	onShow(() => {
		readLastQuiz();
		// 不主动登录：未登录即为游客，可自由浏览，点题目时才引导登录
		loggedIn.value = isLoggedIn();
		loadCheckin();
	});
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #F5F6F8;
		padding: 0 28rpx 40rpx;
		box-sizing: border-box;
	}

	/* ---------- 顶部栏（自定义导航，含状态栏高度） ---------- */
	.top-bar {
		margin: 0 -28rpx;
		padding: calc(var(--status-bar-height, 0px) + 16rpx) 28rpx 12rpx;
	}

	.checkin-pill {
		display: inline-flex;
		align-items: center;
		background-color: #FFFFFF;
		border-radius: 999rpx;
		padding: 12rpx 22rpx;
		box-shadow: 0 4rpx 14rpx rgba(0, 0, 0, 0.06);
	}

	.checkin-icon {
		font-size: 28rpx;
		margin-right: 10rpx;
	}

	.checkin-text {
		font-size: 25rpx;
		font-weight: 600;
		color: #7A3BE0;
	}

	.checkin-arrow {
		margin-left: 8rpx;
		font-size: 28rpx;
		color: #B4A8CC;
		line-height: 1;
	}

	.hero {
		padding: 16rpx 8rpx 30rpx;
	}

	.hero-title {
		font-size: 48rpx;
		font-weight: 700;
		color: #1A1A1A;
	}

	.hero-sub {
		margin-top: 12rpx;
		font-size: 26rpx;
		color: #8A8F99;
	}

	/* ---------- 游客提示条 ---------- */
	.guest-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background-color: #FFF6E8;
		border-radius: 16rpx;
		padding: 22rpx 26rpx;
		margin-bottom: 26rpx;
	}

	.guest-text {
		flex: 1;
		font-size: 24rpx;
		color: #A9711C;
	}

	.guest-action {
		flex-shrink: 0;
		margin-left: 18rpx;
		font-size: 25rpx;
		font-weight: 600;
		color: #3C7BFF;
	}

	/* ---------- 上次刷题快速跳转 ---------- */
	.resume-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: linear-gradient(135deg, #3C7BFF, #6AA1FF);
		border-radius: 20rpx;
		padding: 34rpx 30rpx;
		margin-bottom: 30rpx;
		box-shadow: 0 8rpx 24rpx rgba(60, 123, 255, 0.24);
	}

	.resume-main {
		flex: 1;
		min-width: 0;
	}

	.resume-label {
		font-size: 24rpx;
		color: rgba(255, 255, 255, 0.82);
	}

	.resume-name {
		margin-top: 10rpx;
		font-size: 34rpx;
		font-weight: 700;
		color: #FFFFFF;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.resume-btn {
		flex-shrink: 0;
		margin-left: 20rpx;
		font-size: 26rpx;
		font-weight: 600;
		color: #3C7BFF;
		background-color: #FFFFFF;
		border-radius: 999rpx;
		padding: 12rpx 30rpx;
	}

	/* ---------- 快捷入口 ---------- */
	.entry-list {
		display: flex;
		flex-direction: column;
	}

	.entry-card {
		display: flex;
		align-items: center;
		background-color: #FFFFFF;
		border-radius: 20rpx;
		padding: 32rpx 30rpx;
		margin-bottom: 22rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.entry-icon {
		width: 76rpx;
		height: 76rpx;
		line-height: 76rpx;
		text-align: center;
		font-size: 36rpx;
		background-color: #F2F5FC;
		border-radius: 18rpx;
		margin-right: 24rpx;
		flex-shrink: 0;
	}

	.entry-main {
		flex: 1;
		min-width: 0;
	}

	.entry-name {
		font-size: 32rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.entry-desc {
		margin-top: 8rpx;
		font-size: 24rpx;
		color: #8A8F99;
	}

	.entry-arrow {
		font-size: 44rpx;
		color: #C4C9D2;
		line-height: 1;
		flex-shrink: 0;
	}
</style>
