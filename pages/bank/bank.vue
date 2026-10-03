<template>
	<view class="page">
		<!-- 搜索栏 -->
		<view class="search-wrap">
			<view class="search-box">
				<text class="search-icon">🔍</text>
				<input
					class="search-input"
					type="text"
					:value="keyword"
					placeholder="搜索想要练习的考试"
					placeholder-class="search-ph"
					confirm-type="search"
					@input="onKeywordInput"
				/>
				<text v-if="keyword" class="search-clear" @click="clearKeyword">✕</text>
			</view>
		</view>

		<!-- 搜索结果 -->
		<scroll-view v-if="isSearching" class="result-list" scroll-y>
			<view v-if="searching" class="tip">搜索中…</view>
			<view v-else-if="searchResults.length === 0" class="tip">没有找到相关考试，换个关键词试试</view>
			<block v-else>
				<view
					v-for="item in searchResults"
					:key="item.id"
					class="result-item"
					@click="goQuiz(item)"
				>
					<view class="result-main">
						<view class="result-name">{{ item.name }}</view>
						<view class="result-path">{{ item.path }}</view>
					</view>
					<view class="result-count">{{ item.questionCount }} 题</view>
				</view>
			</block>
		</scroll-view>

		<!-- 分类树：左侧一级 + 右侧分组/叶子 -->
		<view v-else class="body">
			<scroll-view class="side" scroll-y>
				<view v-if="loading" class="side-tip">…</view>
				<view
					v-for="top in tree"
					:key="top.id"
					class="side-item"
					:class="{ active: top.id === activeId }"
					@click="activeId = top.id"
				>
					<text class="side-text">{{ top.name }}</text>
				</view>
			</scroll-view>

			<scroll-view class="main" scroll-y>
				<view v-if="loading" class="tip">加载中…</view>
				<view v-else-if="!activeTop" class="tip">暂无题库分类</view>
				<block v-else>
					<view v-for="(group, gi) in groups" :key="gi" class="group">
						<view v-if="group.title" class="group-title">{{ group.title }}</view>
						<view class="leaf-grid">
							<view
								v-for="leaf in group.items"
								:key="leaf.id"
								class="leaf-card"
								@click="goQuiz(leaf)"
							>
								<view class="leaf-name">{{ leaf.name }}</view>
								<view class="leaf-count">{{ leaf.questionCount }} 题</view>
							</view>
						</view>
					</view>
				</block>
			</scroll-view>
		</view>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { getCategoryTree, searchCategories } from '../../apis/index.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onShow } from '@dcloudio/uni-app';
	import { ref, computed } from 'vue';

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const tree = ref([]);
	const activeId = ref(0);
	const loading = ref(true);
	const loaded = ref(false);

	const keyword = ref('');
	const searchResults = ref([]);
	const searching = ref(false);
	// 防抖定时器：普通变量即可，不需要响应式
	let searchTimer = null;

	const activeTop = computed(() => tree.value.find((t) => t.id === activeId.value) || null);

	/**
	 * 右侧分组：二级有子分类 → 作为分组标题 + 三级叶子卡片；
	 * 二级本身是叶子（如「计算机四级」）→ 并入无标题分组，直接平铺卡片。
	 */
	const groups = computed(() => {
		const top = activeTop.value;
		if (!top) return [];
		const out = [];
		let loose = null;
		for (const child of top.children || []) {
			if (child.children && child.children.length > 0) {
				out.push({ title: child.name, items: child.children });
			} else {
				if (!loose) {
					loose = { title: '', items: [] };
					out.push(loose);
				}
				loose.items.push(child);
			}
		}
		return out;
	});

	const isSearching = computed(() => keyword.value.trim().length > 0);

	async function loadTree() {
		loading.value = true;
		try {
			// 分类树是只读接口，游客也能拉取；不做登录拦截
			const data = await getCategoryTree();
			tree.value = data || [];
			if (tree.value.length > 0) {
				// 保持已选中的一级分类；首次进入默认选第一个
				const exists = tree.value.some((t) => t.id === activeId.value);
				if (!exists) activeId.value = tree.value[0].id;
			}
		} catch (e) {
			// 错误提示已在 request 层统一处理
		} finally {
			loading.value = false;
			loaded.value = true;
		}
	}

	function onKeywordInput(e) {
		keyword.value = e.detail.value;
		if (searchTimer) clearTimeout(searchTimer);
		const kw = keyword.value.trim();
		if (!kw) {
			searchResults.value = [];
			searching.value = false;
			return;
		}
		searching.value = true;
		searchTimer = setTimeout(() => {
			doSearch(kw);
		}, 300);
	}

	async function doSearch(kw) {
		try {
			// 搜索同样是只读接口，游客可用
			const res = await searchCategories(kw);
			// 关键词可能已被改动，丢弃过期结果
			if (keyword.value.trim() !== kw) return;
			searchResults.value = res || [];
		} catch (e) {
			searchResults.value = [];
		} finally {
			if (keyword.value.trim() === kw) searching.value = false;
		}
	}

	function clearKeyword() {
		if (searchTimer) clearTimeout(searchTimer);
		keyword.value = '';
		searchResults.value = [];
		searching.value = false;
	}

	/** 点击题目分类：未登录先弹登录，登录成功后自动进入刷题 */
	function goQuiz(item) {
		requireLogin(() => {
			uni.navigateTo({
				url: `/pages/quiz/quiz?categoryId=${item.id}&name=${encodeURIComponent(item.name)}`
			});
		});
	}

	function onLoginSuccess() {
		handleSuccess();
	}

	function onLoginClose() {
		handleClose();
	}

	onShow(() => {
		// tabBar 页面会频繁 onShow，树数据只拉一次
		if (!loaded.value) loadTree();
	});
</script>

<style>
	/* 页面高度减去 H5 端 tabBar（小程序端该变量为 0；带 fallback 防止变量缺失导致整条 calc 失效） */
	.page {
		height: calc(100vh - var(--window-bottom, 0px));
		display: flex;
		flex-direction: column;
		background-color: #F5F6F8;
		box-sizing: border-box;
		overflow: hidden;
	}

	/* ---------- 搜索栏 ---------- */
	.search-wrap {
		flex-shrink: 0;
		padding: 20rpx 28rpx;
		background-color: #FFFFFF;
	}

	.search-box {
		display: flex;
		align-items: center;
		height: 72rpx;
		background-color: #F2F4F8;
		border-radius: 999rpx;
		padding: 0 24rpx;
	}

	.search-icon {
		font-size: 26rpx;
		margin-right: 12rpx;
	}

	.search-input {
		flex: 1;
		height: 72rpx;
		font-size: 27rpx;
		color: #1A1A1A;
	}

	.search-ph {
		color: #A6ACB8;
		font-size: 27rpx;
	}

	.search-clear {
		width: 44rpx;
		text-align: center;
		font-size: 26rpx;
		color: #A6ACB8;
	}

	/* ---------- 搜索结果 ---------- */
	.result-list {
		flex: 1;
		height: 100%;
		background-color: #FFFFFF;
	}

	.result-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 28rpx 30rpx;
		border-bottom: 2rpx solid #F2F4F8;
	}

	.result-main {
		flex: 1;
		min-width: 0;
	}

	.result-name {
		font-size: 30rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.result-path {
		margin-top: 8rpx;
		font-size: 23rpx;
		color: #A6ACB8;
	}

	.result-count {
		flex-shrink: 0;
		margin-left: 20rpx;
		font-size: 24rpx;
		color: #3C7BFF;
		background-color: #EAF1FF;
		border-radius: 999rpx;
		padding: 6rpx 18rpx;
	}

	/* ---------- 分类树主体 ---------- */
	.body {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.side {
		width: 190rpx;
		height: 100%;
		background-color: #F5F6F8;
		flex-shrink: 0;
	}

	.side-tip {
		padding: 40rpx 0;
		text-align: center;
		font-size: 24rpx;
		color: #A6ACB8;
	}

	.side-item {
		position: relative;
		padding: 34rpx 16rpx 34rpx 26rpx;
		font-size: 27rpx;
		color: #5A6270;
	}

	.side-item.active {
		background-color: #FFFFFF;
		color: #3C7BFF;
		font-weight: 600;
	}

	.side-item.active::before {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		width: 6rpx;
		height: 36rpx;
		background-color: #3C7BFF;
		border-radius: 0 6rpx 6rpx 0;
	}

	.main {
		flex: 1;
		height: 100%;
		background-color: #FFFFFF;
	}

	.group {
		padding: 8rpx 0 4rpx;
	}

	.group-title {
		padding: 24rpx 26rpx 10rpx;
		font-size: 25rpx;
		font-weight: 600;
		color: #8A8F99;
	}

	.leaf-grid {
		display: flex;
		flex-direction: column;
		padding: 0 22rpx;
	}

	.leaf-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background-color: #F7F8FA;
		border-radius: 16rpx;
		padding: 28rpx 24rpx;
		margin-bottom: 18rpx;
	}

	.leaf-name {
		font-size: 29rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.leaf-count {
		flex-shrink: 0;
		margin-left: 16rpx;
		font-size: 23rpx;
		color: #8A8F99;
	}

	.tip {
		padding: 100rpx 40rpx;
		text-align: center;
		font-size: 27rpx;
		color: #8A8F99;
	}
</style>
