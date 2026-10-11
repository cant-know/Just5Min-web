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

		<!-- 商品分类横滑 -->
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
		<scroll-view class="list-scroll" scroll-y>
			<view v-if="loading" class="empty">加载中...</view>
			<view v-else-if="products.length === 0" class="empty">该分类暂无商品</view>
			<view v-else class="list">
				<view v-for="p in products" :key="p.id" class="card">
					<view class="card-main">
						<view class="card-head">
							<view class="kind">{{ categoryName(p.categoryId) }}</view>
							<view class="stock">剩余 {{ p.stock }}</view>
						</view>
						<view class="card-name">{{ p.name }}</view>
						<view v-if="p.description" class="card-desc">{{ p.description }}</view>
						<view class="card-foot">
							<view class="price">
								<text v-if="p.price > 0" class="price-num">{{ p.price }}</text>
								<text v-else class="price-free">免费</text>
								<text class="price-unit">{{ p.price > 0 ? '积分' : '' }}</text>
							</view>
							<view class="exchange-btn" :class="{ disabled: !canAfford(p) }" @click.stop="onExchange(p)">
								{{ canAfford(p) ? '立即兑换' : '积分不足' }}
							</view>
						</view>
					</view>
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
import { ref, computed } from 'vue';

const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

const loggedIn = ref(false);
const points = ref(0);
const categories = ref([]);
const products = ref([]);
const activeCategoryId = ref(0);
const loading = ref(true);

/** 分类 id → 名称映射（列表项展示所属分类） */
const categoryMap = computed(() => {
	const map = {};
	categories.value.forEach((c) => {
		map[c.id] = c.name;
	});
	return map;
});

function categoryName(id) {
	return categoryMap.value[id] || '商品';
}

/** 积分够不够（游客视为不够，点按钮会先引导登录） */
function canAfford(p) {
	if (!loggedIn.value) return true;
	const price = p.price || 0;
	return price <= 0 || points.value >= price;
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

async function loadProducts(silent = false) {
	if (!silent) loading.value = true;
	try {
		products.value = await getMallProducts(activeCategoryId.value || undefined);
	} catch (e) {
		products.value = [];
	} finally {
		if (!silent) loading.value = false;
	}
}

function switchCategory(id) {
	if (activeCategoryId.value === id) return;
	activeCategoryId.value = id;
	loadProducts();
}

/** 兑换：未登录先弹登录，成功后自动补执行；已登录弹确认框 */
function onExchange(product) {
	requireLogin(() => {
		const isFree = !product.price || product.price <= 0;
		uni.showModal({
			title: '确认兑换',
			content: isFree
				? `确认领取「${product.name}」？`
				: `将消耗 ${product.price} 积分兑换「${product.name}」`,
			success: (res) => {
				if (!res.confirm) return;
				doExchange(product);
			}
		});
	});
}

async function doExchange(product) {
	try {
		const result = await exchangeProduct(product.id);
		// 用返回余额覆盖本地，避免多一次请求
		if (result && typeof result.pointsBalance === 'number') {
			points.value = result.pointsBalance;
		}
		uni.showToast({
			title: (product.price || 0) > 0 ? '兑换成功' : '领取成功',
			icon: 'success'
		});
		// 与商品关联的资料：直接跳文章详情阅读
		if (result && result.articleId) {
			setTimeout(() => {
				uni.navigateTo({ url: '/pages/article/article?id=' + result.articleId });
			}, 600);
		} else {
			loadProducts(true);
		}
	} catch (e) {
		// 积分不足 / 库存不足等错误已在 request 层提示，这里补刷余额
		if (e && e.needLogin) {
			loggedIn.value = false;
			points.value = 0;
		} else {
			loadIdentity();
		}
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
	// tabBar 页不重建：每次回来都静默刷新商品与余额
	loadProducts(products.value.length > 0);
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

/* 商品列表 */
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
.stock {
	font-size: 22rpx;
	color: #a6abb5;
}
.card-name {
	margin-top: 18rpx;
	font-size: 32rpx;
	font-weight: 700;
	color: #1a1a1a;
	line-height: 1.45;
}
.card-desc {
	margin-top: 12rpx;
	font-size: 25rpx;
	color: #8a8f99;
	line-height: 1.6;
}
.card-foot {
	margin-top: 22rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.price {
	display: flex;
	align-items: baseline;
}
.price-num {
	font-size: 40rpx;
	font-weight: 700;
	color: #ff7a1a;
	line-height: 1;
}
.price-free {
	font-size: 32rpx;
	font-weight: 700;
	color: #19b36b;
	line-height: 1;
}
.price-unit {
	margin-left: 6rpx;
	font-size: 22rpx;
	color: #a6abb5;
}
.exchange-btn {
	flex-shrink: 0;
	min-width: 168rpx;
	height: 68rpx;
	line-height: 68rpx;
	text-align: center;
	padding: 0 28rpx;
	border-radius: 999rpx;
	background: #3c7bff;
	color: #ffffff;
	font-size: 26rpx;
	font-weight: 600;
}
.exchange-btn:active {
	opacity: 0.85;
}
.exchange-btn.disabled {
	background: #dfe4ec;
	color: #98a0ad;
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
