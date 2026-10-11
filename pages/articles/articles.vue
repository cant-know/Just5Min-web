<template>
	<view class="page">
		<!-- 顶部标题区 -->
		<view class="head">
			<view class="head-title">文章专栏</view>
			<view class="head-sub">政治 / 英语 / 数学 / 专业课 · 备考干货随时翻看</view>
		</view>

		<!-- 分类横滑 -->
		<scroll-view class="cat-scroll" scroll-x :show-scrollbar="false">
			<view class="cat-list">
				<view
					class="cat-item"
					:class="{ active: activeCategoryId === 0 }"
					@click="switchCategory(0)"
				>全部</view>
				<view
					v-for="c in categories"
					:key="c.id"
					class="cat-item"
					:class="{ active: activeCategoryId === c.id }"
					@click="switchCategory(c.id)"
				>{{ c.name }}</view>
			</view>
		</scroll-view>

		<!-- 文章列表 -->
		<scroll-view class="list-scroll" scroll-y>
			<view v-if="loading" class="tip">加载中…</view>
			<view v-else-if="articles.length === 0" class="tip">该分类暂无文章</view>
			<view v-else class="list">
				<view v-for="a in articles" :key="a.id" class="card" @click="openArticle(a)">
					<view class="card-head">
						<view class="kind">{{ a.categoryName || '文章' }}</view>
						<view class="read">{{ a.readCount || 0 }} 阅读</view>
					</view>
					<view class="card-title">{{ a.title }}</view>
					<view v-if="a.summary" class="card-summary">{{ a.summary }}</view>
					<view class="card-foot">
						<view class="tags">
							<text v-for="t in (a.tagList || [])" :key="t" class="tag">{{ t }}</text>
						</view>
						<view class="go">阅读 ›</view>
					</view>
				</view>
			</view>
			<view class="bottom-placeholder"></view>
		</scroll-view>
	</view>
</template>

<script setup>
import { getMallCategories, getArticles } from '../../apis/index.js';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';

/** 分类只读复用商城分类接口（不改商城任何代码） */
const categories = ref([]);
const articles = ref([]);
/** 0 = 全部 */
const activeCategoryId = ref(0);
const loading = ref(true);

async function loadCategories() {
	try {
		categories.value = (await getMallCategories()) || [];
	} catch (e) {
		categories.value = [];
	}
}

async function loadArticles(silent = false) {
	if (!silent) loading.value = true;
	try {
		articles.value = (await getArticles(activeCategoryId.value || undefined)) || [];
	} catch (e) {
		articles.value = [];
	} finally {
		if (!silent) loading.value = false;
	}
}

function switchCategory(id) {
	if (activeCategoryId.value === id) return;
	activeCategoryId.value = id;
	loadArticles();
}

function openArticle(a) {
	uni.navigateTo({ url: '/pages/article/article?id=' + a.id });
}

onLoad(() => {
	loadCategories();
	loadArticles();
});
onShow(() => {
	// 页面不重建：每次回来静默刷新，避免钉在首屏快照
	loadArticles(articles.value.length > 0);
});
</script>

<style scoped>
.page {
	height: calc(100vh - var(--window-bottom, 0px));
	display: flex;
	flex-direction: column;
	overflow: hidden;
	background: #f5f6f8;
}

/* 顶部标题区 */
.head {
	padding: 32rpx 32rpx 8rpx;
	flex-shrink: 0;
}
.head-title {
	font-size: 40rpx;
	font-weight: 700;
	color: #1a1a1a;
}
.head-sub {
	margin-top: 10rpx;
	font-size: 24rpx;
	color: #8a8f99;
}

/* 分类横滑 */
.cat-scroll {
	margin-top: 22rpx;
	padding: 0 24rpx;
	white-space: nowrap;
	flex-shrink: 0;
}
.cat-list {
	display: inline-flex;
	gap: 16rpx;
}
.cat-item {
	display: inline-block;
	padding: 14rpx 32rpx;
	background: #ffffff;
	color: #5a6072;
	font-size: 26rpx;
	border-radius: 999rpx;
	border: 1rpx solid #e8ebf1;
}
.cat-item.active {
	background: #3c7bff;
	color: #ffffff;
	border-color: #3c7bff;
	font-weight: 600;
}

/* 文章列表 */
.list-scroll {
	flex: 1;
	min-height: 0;
	margin-top: 22rpx;
	padding: 0 24rpx;
	box-sizing: border-box;
}
.list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}
.card {
	background: #ffffff;
	border-radius: 20rpx;
	padding: 30rpx 30rpx 26rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.card:active {
	background: #fafbfd;
}
.card-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.kind {
	font-size: 22rpx;
	color: #3c7bff;
	background: #eaf1ff;
	border-radius: 999rpx;
	padding: 4rpx 18rpx;
}
.read {
	font-size: 22rpx;
	color: #a6abb5;
}
.card-title {
	margin-top: 18rpx;
	font-size: 32rpx;
	font-weight: 700;
	color: #1a1a1a;
	line-height: 1.45;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
}
.card-summary {
	margin-top: 12rpx;
	font-size: 25rpx;
	color: #8a8f99;
	line-height: 1.6;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
}
.card-foot {
	margin-top: 20rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.tags {
	flex: 1;
	min-width: 0;
	overflow: hidden;
}
.tag {
	display: inline-block;
	font-size: 21rpx;
	color: #6b7280;
	background: #f3f5f9;
	border-radius: 8rpx;
	padding: 4rpx 12rpx;
	margin-right: 10rpx;
}
.go {
	flex-shrink: 0;
	margin-left: 16rpx;
	font-size: 24rpx;
	color: #3c7bff;
	font-weight: 600;
}

.tip {
	text-align: center;
	color: #8a8f99;
	font-size: 26rpx;
	padding: 120rpx 0;
}
.bottom-placeholder {
	height: 40rpx;
}
</style>
