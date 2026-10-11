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

		<!-- 公告栏：纵向滚动（1 条时静止展示） -->
		<view class="notice" @click="onNoticeTap">
			<view class="notice-badge">公告</view>
			<swiper
				class="notice-swiper"
				:vertical="true"
				:autoplay="notices.length > 1"
				:interval="3000"
				:duration="450"
				:circular="notices.length > 1"
				@change="onNoticeChange"
			>
				<swiper-item v-for="(n, i) in notices" :key="i">
					<view class="notice-text">{{ n.text }}</view>
				</swiper-item>
			</swiper>
			<view class="notice-arrow">›</view>
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

		<!-- 文章专栏：标题 + 简介，竖向卡片框 -->
		<view class="column">
			<view class="column-head">
				<view class="column-title">文章专栏</view>
				<view class="column-more" @click="goArticles">全部 ›</view>
			</view>
			<view class="article-box-list">
				<view
					v-for="a in articles"
					:key="a.id"
					class="article-box"
					@click="goArticle(a)"
				>
					<view class="box-head">
						<text class="box-kind">{{ a.categoryName || '文章' }}</text>
						<text class="box-read">{{ a.readCount || 0 }} 阅读</text>
					</view>
					<view class="box-title">{{ a.title }}</view>
					<view v-if="a.summary" class="box-summary">{{ a.summary }}</view>
				</view>
				<view v-if="articles.length === 0" class="box-empty">暂无文章</view>
			</view>
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

			<view class="entry-card" @click="goArticles">
				<view class="entry-icon">📄</view>
				<view class="entry-main">
					<view class="entry-name">文章专栏</view>
					<view class="entry-desc">政治 / 英语 / 数学 / 专业课 干货文章</view>
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
	import { getCheckInSummary, getArticles } from '../../apis/index.js';
	import { isLoggedIn } from '../../utils/auth.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onShow } from '@dcloudio/uni-app';
	import { ref, computed } from 'vue';

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	/** 公告栏文案：直接改这里即可（点击跳转按 target） */
	const notices = ref([
		{ text: '新增「文章专栏」，4 大科目备考干货免费看', target: 'articles' },
		{ text: '每日打卡 +10 积分，连续打卡不断电', target: 'checkin' },
		{ text: '每答一题 +1 积分，快来题库刷起来', target: 'bank' }
	]);
	/** 公告当前滚动到第几条（决定点击跳哪个页面） */
	const noticeIndex = ref(0);

	const lastQuiz = ref(null);
	const loggedIn = ref(false);
	/** 打卡天数：null=未登录（只显示"打卡"），数字=已登录 */
	const checkinDays = ref(null);
	/** 首页文章专栏：取最新 5 篇 */
	const articles = ref([]);

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

	/** 文章专栏：游客也能看（首页只取前 5 篇做卡片框） */
	async function loadArticles() {
		try {
			const list = await getArticles();
			articles.value = (list || []).slice(0, 5);
		} catch (e) {
			articles.value = [];
		}
	}

	function goArticle(a) {
		uni.navigateTo({ url: '/pages/article/article?id=' + a.id });
	}

	/** 进入独立的文章列表页（普通页，非 tab） */
	function goArticles() {
		uni.navigateTo({ url: '/pages/articles/articles' });
	}

	/** swiper 滚动回调：记录当前是第几条公告 */
	function onNoticeChange(e) {
		noticeIndex.value = (e && e.detail && e.detail.current) || 0;
	}

	/** 公告点击：按「当前滚动到的那条」的 target 跳对应页面 */
	function onNoticeTap() {
		const cur = notices.value[noticeIndex.value];
		const target = cur && cur.target;
		if (target === 'bank') {
			uni.switchTab({ url: '/pages/bank/bank' });
		} else if (target === 'articles') {
			goArticles();
		} else if (target === 'checkin') {
			goCheckIn();
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

	function goWrong() {
		// 错题本已从 tabBar 移除，改为普通页面跳转
		uni.navigateTo({ url: '/pages/wrong/wrong' });
	}

	onShow(() => {
		readLastQuiz();
		// 不主动登录：未登录即为游客，可自由浏览，点题目时才引导登录
		loggedIn.value = isLoggedIn();
		loadCheckin();
		loadArticles();
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

	/* ---------- 公告栏（纵向滚动） ---------- */
	.notice {
		display: flex;
		align-items: center;
		background-color: #FFFFFF;
		border-radius: 16rpx;
		padding: 18rpx 22rpx;
		margin-bottom: 24rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.notice-badge {
		flex-shrink: 0;
		font-size: 21rpx;
		font-weight: 600;
		color: #FF7A1A;
		background-color: #FFF1E3;
		border-radius: 8rpx;
		padding: 4rpx 14rpx;
		margin-right: 18rpx;
	}

	.notice-swiper {
		flex: 1;
		min-width: 0;
		height: 44rpx;
	}

	.notice-text {
		height: 44rpx;
		line-height: 44rpx;
		font-size: 25rpx;
		color: #5A6270;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.notice-arrow {
		flex-shrink: 0;
		margin-left: 10rpx;
		font-size: 30rpx;
		color: #C4C9D2;
		line-height: 1;
	}

	/* ---------- 文章专栏 ---------- */
	.column {
		margin-bottom: 30rpx;
	}

	.column-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 6rpx 18rpx;
	}

	.column-title {
		font-size: 32rpx;
		font-weight: 700;
		color: #1A1A1A;
	}

	.column-more {
		font-size: 25rpx;
		color: #8A8F99;
	}

	/* 竖向卡片框：每个框展示 标题 + 简介 */
	.article-box-list {
		display: flex;
		flex-direction: column;
	}

	.article-box {
		background-color: #FFFFFF;
		border-radius: 20rpx;
		padding: 26rpx 28rpx;
		margin-bottom: 20rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.article-box:active {
		background-color: #FAFBFD;
	}

	.box-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.box-kind {
		font-size: 21rpx;
		color: #3C7BFF;
		background-color: #EAF1FF;
		border-radius: 999rpx;
		padding: 4rpx 16rpx;
	}

	.box-read {
		font-size: 21rpx;
		color: #A6ABB5;
	}

	.box-title {
		margin-top: 16rpx;
		font-size: 30rpx;
		font-weight: 700;
		color: #1A1A1A;
		line-height: 1.45;
		/* 标题最多两行 */
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
	}

	.box-summary {
		margin-top: 10rpx;
		font-size: 24rpx;
		color: #8A8F99;
		line-height: 1.6;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
	}

	.box-empty {
		padding: 50rpx 0;
		text-align: center;
		font-size: 25rpx;
		color: #A6ABB5;
		background-color: #FFFFFF;
		border-radius: 20rpx;
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
