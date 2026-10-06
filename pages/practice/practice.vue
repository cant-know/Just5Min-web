<template>
	<view class="page">
		<!-- 分类信息 + 练习进度 -->
		<view class="hero">
			<view class="hero-name">{{ name || '练习' }}</view>
			<view class="hero-meta">
				<text>共 {{ count }} 题</text>
				<text v-if="loggedIn && done > 0" class="hero-dot">·</text>
				<text v-if="loggedIn && done > 0">已练 {{ done }} 题</text>
			</view>

			<view v-if="loggedIn && count > 0" class="hero-bar">
				<view class="hero-bar-inner" :style="{ width: pct + '%' }"></view>
			</view>
			<view v-if="loggedIn && count > 0" class="hero-tip">
				本分类完成度 {{ pct }}%
			</view>
			<view v-else-if="!loggedIn" class="hero-tip">
				登录后可记录你的练习进度
			</view>
		</view>

		<!-- 主入口：顺序练习 -->
		<view class="primary" @click="goSequence">
			<view class="primary-main">
				<view class="primary-title">顺序练习</view>
				<view class="primary-desc">按题库顺序逐题攻克，答完自动结算</view>
			</view>
			<view class="primary-arrow">›</view>
		</view>

		<!-- 个人题库 -->
		<view class="section-title">我的题库</view>
		<view class="grid">
			<view class="cell" @click="goWrong">
				<view class="cell-icon">📕</view>
				<view class="cell-name">我的错题</view>
				<view class="cell-sub">{{ wrongText }}</view>
			</view>
			<view class="cell" @click="goFavorites">
				<view class="cell-icon">⭐</view>
				<view class="cell-name">我的收藏</view>
				<view class="cell-sub">{{ favoriteText }}</view>
			</view>
		</view>

		<!-- 考试模式（占位） -->
		<view class="section-title">考试模式</view>
		<view class="grid">
			<view class="cell soon" @click="comingSoon('模拟考试')">
				<view class="cell-icon">📝</view>
				<view class="cell-name">模拟考试</view>
				<view class="cell-sub">敬请期待</view>
			</view>
			<view class="cell soon" @click="comingSoon('历年真题')">
				<view class="cell-icon">📄</view>
				<view class="cell-name">历年真题</view>
				<view class="cell-sub">敬请期待</view>
			</view>
		</view>

		<view class="foot">每天 5 分钟，积少成多</view>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { getWrongQuestions, getFavorites, getUserStats, getCategoryTree } from '../../apis/index.js';
	import { isLoggedIn } from '../../utils/auth.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onLoad, onShow } from '@dcloudio/uni-app';
	import { ref, computed } from 'vue';

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const categoryId = ref(0);
	const name = ref('');
	const count = ref(0);

	const loggedIn = ref(false);
	const done = ref(0);
	const wrongCount = ref(null);
	const favoriteCount = ref(null);

	const pct = computed(() => {
		if (!count.value) return 0;
		const p = Math.round((done.value / count.value) * 100);
		return p > 100 ? 100 : p;
	});

	const wrongText = computed(() => {
		if (!loggedIn.value) return '登录后查看';
		return wrongCount.value === null ? '去看看' : `${wrongCount.value} 道待攻克`;
	});

	const favoriteText = computed(() => {
		if (!loggedIn.value) return '登录后查看';
		return favoriteCount.value === null ? '去看看' : `${favoriteCount.value} 道已收藏`;
	});

	/** 在分类树里递归查找目标节点 */
	function findNode(nodes, id) {
		for (const n of nodes || []) {
			if (Number(n.id) === Number(id)) return n;
			const hit = findNode(n.children || [], id);
			if (hit) return hit;
		}
		return null;
	}

	/**
	 * 同步本分类的实时题数。
	 * 路由传参的 count 只作为首屏兜底：题库有增删后它是旧值，
	 * 所以进页面后再按分类树校准一次。
	 */
	async function syncCount() {
		if (!categoryId.value) return;
		try {
			const tree = await getCategoryTree();
			const hit = findNode(tree, categoryId.value);
			if (hit && hit.questionCount != null) count.value = Number(hit.questionCount);
		} catch (e) {
			// 拉取失败就沿用传参兜底值，不打断页面
		}
	}

	/** 拉本分类的练习进度与个人题目数（游客不请求） */
	async function loadPersonal() {
		if (!isLoggedIn()) {
			loggedIn.value = false;
			done.value = 0;
			wrongCount.value = null;
			favoriteCount.value = null;
			return;
		}
		loggedIn.value = true;
		const params = categoryId.value > 0 ? { categoryId: categoryId.value } : {};
		const [statsRes, wrongRes, favRes] = await Promise.allSettled([
			getUserStats(),
			getWrongQuestions(params),
			getFavorites(params)
		]);
		if (statsRes.status === 'fulfilled') {
			const list = (statsRes.value && statsRes.value.perCategory) || [];
			const hit = list.find((it) => Number(it.categoryId) === categoryId.value);
			done.value = hit ? Number(hit.answered || 0) : 0;
		}
		if (wrongRes.status === 'fulfilled') wrongCount.value = (wrongRes.value || []).length;
		if (favRes.status === 'fulfilled') favoriteCount.value = (favRes.value || []).length;
	}

	/** 顺序练习：按题库顺序出题 */
	function goSequence() {
		uni.navigateTo({
			url: `/pages/quiz/quiz?categoryId=${categoryId.value}&name=${encodeURIComponent(name.value)}&order=asc`
		});
	}

	function goWrong() {
		requireLogin(() => {
			uni.navigateTo({
				url: `/pages/wrong/wrong?categoryId=${categoryId.value}&name=${encodeURIComponent(name.value)}`
			});
		});
	}

	function goFavorites() {
		requireLogin(() => {
			uni.navigateTo({
				url: `/pages/favorites/favorites?categoryId=${categoryId.value}&name=${encodeURIComponent(name.value)}`
			});
		});
	}

	function comingSoon(title) {
		uni.showToast({ title: `${title}功能开发中，敬请期待`, icon: 'none' });
	}

	function onLoginSuccess() {
		handleSuccess();
		// 登录后立刻刷新个人数据
		loadPersonal();
	}

	function onLoginClose() {
		handleClose();
	}

	onLoad((options) => {
		categoryId.value = Number(options.categoryId || 0);
		name.value = decodeURIComponent(options.name || '');
		count.value = Number(options.count || 0);
		uni.setNavigationBarTitle({ title: name.value || '练习' });
		// 传参可能是旧值，进页面后向后端校准一次
		syncCount();
	});

	onShow(() => {
		loadPersonal();
	});
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #F5F6F8;
		padding: 28rpx 28rpx 60rpx;
		box-sizing: border-box;
	}

	/* ---------- 顶部信息 ---------- */
	.hero {
		background-color: #FFFFFF;
		border-radius: 22rpx;
		padding: 34rpx 30rpx 30rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.hero-name {
		font-size: 38rpx;
		font-weight: 700;
		color: #1A1A1A;
	}

	.hero-meta {
		margin-top: 12rpx;
		font-size: 25rpx;
		color: #8A8F99;
	}

	.hero-dot {
		margin: 0 10rpx;
	}

	.hero-bar {
		margin-top: 24rpx;
		height: 10rpx;
		background-color: #EDEFF3;
		border-radius: 999rpx;
		overflow: hidden;
	}

	.hero-bar-inner {
		height: 100%;
		background-color: #3C7BFF;
		border-radius: 999rpx;
		transition: width 0.3s ease;
	}

	.hero-tip {
		margin-top: 14rpx;
		font-size: 23rpx;
		color: #A6ABB5;
	}

	/* ---------- 主入口 ---------- */
	.primary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 24rpx;
		padding: 36rpx 30rpx;
		border-radius: 22rpx;
		background-color: #3C7BFF;
		box-shadow: 0 8rpx 22rpx rgba(60, 123, 255, 0.28);
	}

	.primary-title {
		font-size: 34rpx;
		font-weight: 700;
		color: #FFFFFF;
	}

	.primary-desc {
		margin-top: 10rpx;
		font-size: 24rpx;
		color: #DCE8FF;
	}

	.primary-arrow {
		font-size: 54rpx;
		line-height: 1;
		color: #FFFFFF;
		opacity: 0.9;
	}

	/* ---------- 分区与宫格 ---------- */
	.section-title {
		margin: 40rpx 6rpx 18rpx;
		font-size: 26rpx;
		font-weight: 600;
		color: #8A8F99;
	}

	.grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
	}

	.cell {
		width: 48.5%;
		background-color: #FFFFFF;
		border-radius: 20rpx;
		padding: 30rpx 26rpx;
		margin-bottom: 22rpx;
		box-sizing: border-box;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.cell.soon {
		background-color: #FAFBFC;
		box-shadow: none;
	}

	.cell-icon {
		font-size: 46rpx;
		line-height: 1;
	}

	.cell-name {
		margin-top: 18rpx;
		font-size: 29rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.cell.soon .cell-name {
		color: #8A8F99;
	}

	.cell-sub {
		margin-top: 8rpx;
		font-size: 23rpx;
		color: #A6ABB5;
	}

	.foot {
		margin-top: 30rpx;
		text-align: center;
		font-size: 23rpx;
		color: #B4B9C2;
	}
</style>
