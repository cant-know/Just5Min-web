<template>
	<view class="page">
		<view v-if="loading" class="tip">加载中…</view>
		<view v-else-if="!article" class="tip">资料不存在或已下架</view>

		<block v-else>
			<view class="head">
				<view class="cat">{{ article.categoryName || '学习资料' }}</view>
				<view class="title">{{ article.title }}</view>
				<view class="meta">
					<text>{{ formatDate(article.createdAt) }}</text>
					<text class="dot">·</text>
					<text>{{ article.readCount || 0 }} 次阅读</text>
				</view>
				<view v-if="article.tagList && article.tagList.length" class="tags">
					<text v-for="t in article.tagList" :key="t" class="tag">{{ t }}</text>
				</view>
			</view>

			<view class="content">
				<rich-text :nodes="bodyHtml"></rich-text>
			</view>

			<view class="foot-tip">— 内容由「刷题5分钟」整理，仅供学习交流 —</view>
		</block>

		<view class="bar-placeholder"></view>
		<view class="action-bar">
			<view class="fav" :class="{ on: favorited }" @click="toggleFavorite">
				<text class="fav-icon">{{ favorited ? '★' : '☆' }}</text>
				<text class="fav-text">{{ favorited ? '已收藏' : '收藏' }}</text>
			</view>
			<view class="bar-btn" @click="goList">更多资料</view>
		</view>
	</view>
</template>

<script setup>
	import { getArticle } from '../../apis/index.js';
	import { renderMarkdown } from '../../utils/markdown.js';
	import { onLoad } from '@dcloudio/uni-app';
	import { ref, computed } from 'vue';

	/** 本机收藏的资料 id 列表（纯前端，不做后端表） */
	const FAV_KEY = 'articleFavorites';

	const loading = ref(true);
	const article = ref(null);
	const favorited = ref(false);

	const bodyHtml = computed(() => renderMarkdown(article.value ? article.value.content : ''));

	function readFavIds() {
		try {
			return uni.getStorageSync(FAV_KEY) || [];
		} catch (e) {
			return [];
		}
	}

	function loadFavState() {
		const ids = readFavIds();
		favorited.value = ids.indexOf(article.value.id) >= 0;
	}

	function toggleFavorite() {
		if (!article.value) return;
		const ids = readFavIds();
		const idx = ids.indexOf(article.value.id);
		if (idx >= 0) {
			ids.splice(idx, 1);
			favorited.value = false;
			uni.showToast({ title: '已取消收藏', icon: 'none' });
		} else {
			ids.unshift(article.value.id);
			favorited.value = true;
			uni.showToast({ title: '已收藏', icon: 'success' });
		}
		uni.setStorageSync(FAV_KEY, ids);
	}

	function formatDate(value) {
		if (!value) return '';
		return String(value).replace('T', ' ').slice(0, 10);
	}

	function goList() {
		// 回独立的文章列表页（不再跳商城）
		uni.navigateTo({ url: '/pages/articles/articles' });
	}

	async function load(id) {
		loading.value = true;
		try {
			article.value = await getArticle(id);
			if (article.value && article.value.title) {
				uni.setNavigationBarTitle({ title: article.value.title.slice(0, 14) });
			}
			loadFavState();
		} catch (e) {
			article.value = null;
		} finally {
			loading.value = false;
		}
	}

	onLoad((options) => {
		const id = Number(options.id || 0);
		if (!id) {
			loading.value = false;
			return;
		}
		load(id);
	});
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #FFFFFF;
		padding: 0 40rpx;
		box-sizing: border-box;
	}

	.tip {
		padding: 200rpx 0;
		text-align: center;
		font-size: 28rpx;
		color: #8A8F99;
	}

	/* ---------- 头部 ---------- */
	.head {
		padding: 40rpx 0 28rpx;
		border-bottom: 2rpx solid #F2F4F7;
	}

	.cat {
		display: inline-block;
		font-size: 22rpx;
		color: #3C7BFF;
		background-color: #EAF1FF;
		border-radius: 999rpx;
		padding: 6rpx 20rpx;
	}

	.title {
		margin-top: 22rpx;
		font-size: 44rpx;
		font-weight: 700;
		color: #1A1A1A;
		line-height: 1.35;
	}

	.meta {
		margin-top: 18rpx;
		font-size: 24rpx;
		color: #A6ABB5;
	}

	.meta .dot {
		margin: 0 10rpx;
	}

	.tags {
		margin-top: 20rpx;
	}

	.tag {
		display: inline-block;
		font-size: 22rpx;
		color: #6B7280;
		background-color: #F3F5F9;
		border-radius: 8rpx;
		padding: 4rpx 14rpx;
		margin: 0 12rpx 10rpx 0;
	}

	/* ---------- 正文 ---------- */
	.content {
		padding: 30rpx 0 10rpx;
		font-size: 30rpx;
		line-height: 1.85;
		color: #2A2F3A;
	}

	.foot-tip {
		margin: 50rpx 0 20rpx;
		text-align: center;
		font-size: 22rpx;
		color: #B4B9C2;
	}

	/* ---------- 底部操作条 ---------- */
	.bar-placeholder {
		height: 150rpx;
	}

	.action-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 22rpx;
		padding: 18rpx 32rpx calc(18rpx + env(safe-area-inset-bottom));
		background-color: #FFFFFF;
		border-top: 2rpx solid #F2F4F7;
	}

	.fav {
		flex: 1;
		height: 84rpx;
		border-radius: 999rpx;
		border: 2rpx solid #E6E9EF;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28rpx;
		color: #5A6270;
	}

	.fav.on {
		border-color: #FFB020;
		color: #E89500;
		background-color: #FFF8EC;
	}

	.fav-icon {
		margin-right: 10rpx;
		font-size: 32rpx;
	}

	.bar-btn {
		flex: 1.4;
		height: 84rpx;
		border-radius: 999rpx;
		background-color: #3C7BFF;
		color: #FFFFFF;
		font-size: 29rpx;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
