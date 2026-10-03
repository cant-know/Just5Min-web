<template>
	<view class="page">
		<!-- 顶部：积分条 -->
		<view class="points-bar">
			<view v-if="loggedIn" class="points-left">
				<view class="points-num">{{ points }}</view>
				<view class="points-label">我的积分 · 每答一题 +1</view>
			</view>
			<view v-else class="points-left">
				<view class="points-num">--</view>
				<view class="points-label">登录后答题赚积分</view>
			</view>
			<view
				class="points-action"
				@click="loggedIn ? goExchange() : openLogin()"
			>{{ loggedIn ? '兑换记录 ›' : '去登录' }}</view>
		</view>

		<!-- 一级分类横滑 -->
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

		<!-- 商品列表 -->
		<scroll-view class="goods-scroll" scroll-y>
			<view v-if="loading" class="empty">加载中...</view>
			<view v-else-if="products.length === 0" class="empty">该分类暂无商品</view>
			<view v-else class="goods-list">
				<view v-for="p in products" :key="p.id" class="goods-card">
					<view class="goods-icon">{{ categoryIcon(p.categoryId) }}</view>
					<view class="goods-main">
						<view class="goods-name">{{ p.name }}</view>
						<view class="goods-desc">{{ p.description || '虚拟商品，兑换后见兑换记录' }}</view>
						<view class="goods-meta">
							<text class="goods-price">{{ p.price }} 积分</text>
							<text class="goods-stock" :class="{ out: p.stock <= 0 }">剩余 {{ p.stock }}</text>
						</view>
					</view>
					<button
						class="exchange-btn"
						:class="{ disabled: p.stock <= 0 }"
						:disabled="p.stock <= 0"
						@click="onExchangeClick(p)"
					>{{ p.stock <= 0 ? '已兑完' : '兑换' }}</button>
				</view>
			</view>
			<view class="bottom-placeholder"></view>
		</scroll-view>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
import LoginPopup from '../../components/login-popup/login-popup.vue';
import { getMallCategories, getMallProducts, exchangeProduct, getUserStats } from '../../apis/index.js';
import { isLoggedIn } from '../../utils/auth.js';
import { useLoginGate } from '../../utils/login-gate.js';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';

const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

const loggedIn = ref(false);
const points = ref(0);
const categories = ref([]);
const products = ref([]);
const activeCategoryId = ref(0);
const loading = ref(true);

const CATEGORY_ICONS = { 1: '👑', 2: '📚', 3: '🎬', 4: '🛠' };
function categoryIcon(categoryId) {
	return CATEGORY_ICONS[categoryId] || '🎁';
}

async function loadIdentity() {
	loggedIn.value = isLoggedIn();
	if (!loggedIn.value) {
		points.value = 0;
		return;
	}
	try {
		const stats = await getUserStats();
		points.value = stats.points || 0;
	} catch (e) {
		if (e && e.needLogin) {
			loggedIn.value = false;
			points.value = 0;
		}
	}
}

async function loadCategories() {
	try {
		categories.value = await getMallCategories();
	} catch (e) {
		categories.value = [];
	}
}

async function loadProducts() {
	loading.value = true;
	try {
		products.value = await getMallProducts(activeCategoryId.value || undefined);
	} catch (e) {
		products.value = [];
	} finally {
		loading.value = false;
	}
}

function switchCategory(id) {
	if (activeCategoryId.value === id) return;
	activeCategoryId.value = id;
	loadProducts();
}

function onExchangeClick(product) {
	requireLogin(() => confirmExchange(product));
}

function confirmExchange(product) {
	uni.showModal({
		title: '确认兑换',
		content: `将消耗 ${product.price} 积分兑换「${product.name}」，确定吗？`,
		confirmText: '兑换',
		success: (res) => {
			if (res.confirm) doExchange(product);
		}
	});
}

async function doExchange(product) {
	try {
		const res = await exchangeProduct(product.id);
		points.value = res.pointsBalance;
		uni.showToast({ title: '兑换成功', icon: 'success' });
		loadProducts();
	} catch (e) {
		// 1003 积分不足 / 1004 库存不足已由 request 层 toast；刷新库存与余额兜底
		loadProducts();
		loadIdentity();
	}
}

function goExchange() {
	uni.navigateTo({ url: '/pages/exchange/exchange' });
}

function openLogin() {
	requireLogin(null);
}
function onLoginSuccess() {
	handleSuccess();
	loadIdentity();
	loadProducts();
}
function onLoginClose() {
	handleClose();
}

onLoad(() => {
	loadCategories();
	loadProducts();
});
onShow(() => {
	loadIdentity();
	// 登录态可能刚变化，商品列表的按钮状态随 loggedIn 刷新即可，无需重拉
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

/* 顶部积分条 */
.points-bar {
	margin: 22rpx 24rpx 0;
	padding: 30rpx 32rpx;
	background: linear-gradient(135deg, #3c7bff, #6a9bff);
	border-radius: 22rpx;
	color: #ffffff;
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
	font-size: 48rpx;
	font-weight: 700;
	line-height: 1.1;
}
.points-label {
	margin-top: 6rpx;
	font-size: 22rpx;
	opacity: 0.85;
}
.points-action {
	font-size: 26rpx;
	background: rgba(255, 255, 255, 0.2);
	padding: 12rpx 24rpx;
	border-radius: 999rpx;
}

/* 一级分类横滑 */
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

/* 商品列表 */
.goods-scroll {
	flex: 1;
	min-height: 0;
	margin-top: 22rpx;
	padding: 0 24rpx;
	box-sizing: border-box;
}
.goods-list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}
.goods-card {
	background: #ffffff;
	border-radius: 20rpx;
	padding: 28rpx 30rpx;
	display: flex;
	align-items: center;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.goods-icon {
	width: 88rpx;
	height: 88rpx;
	border-radius: 18rpx;
	background: #f2f5fc;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 44rpx;
	flex-shrink: 0;
}
.goods-main {
	flex: 1;
	min-width: 0;
	margin: 0 22rpx;
}
.goods-name {
	font-size: 29rpx;
	font-weight: 600;
	color: #2a2f3a;
}
.goods-desc {
	margin-top: 6rpx;
	font-size: 23rpx;
	color: #8a8f99;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.goods-meta {
	margin-top: 10rpx;
	display: flex;
	align-items: center;
	gap: 18rpx;
}
.goods-price {
	font-size: 26rpx;
	font-weight: 700;
	color: #ff7a1a;
}
.goods-stock {
	font-size: 22rpx;
	color: #8a8f99;
}
.goods-stock.out {
	color: #f5453f;
}
.exchange-btn {
	margin: 0;
	flex-shrink: 0;
	background: #3c7bff;
	color: #ffffff;
	font-size: 25rpx;
	padding: 0 30rpx;
	height: 64rpx;
	line-height: 64rpx;
	border-radius: 999rpx;
}
.exchange-btn.disabled {
	background: #c9cdd6;
	color: #ffffff;
}

.empty {
	text-align: center;
	color: #8a8f99;
	font-size: 26rpx;
	padding: 120rpx 0;
}
.bottom-placeholder {
	height: 40rpx;
}
</style>
