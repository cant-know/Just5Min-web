<template>
	<view class="page">
		<!-- 顶部积分条 -->
		<view class="points-bar" v-if="loggedIn">
			<view class="points-num">{{ points }}</view>
			<view class="points-label">当前积分余额</view>
		</view>

		<view v-if="!loggedIn" class="guest-note">
			<view class="guest-title">登录后查看兑换记录</view>
			<view class="guest-desc">答题赚积分，兑换会员与备考资料</view>
			<button class="btn primary" @click="openLogin">微信 / 手机号登录</button>
		</view>

		<view v-else-if="loading" class="empty">加载中...</view>

		<view v-else-if="records.length === 0" class="empty">
			<view class="empty-icon">🎁</view>
			<view>还没有兑换记录</view>
			<view class="empty-tip">去商城用积分换点好东西吧</view>
		</view>

		<view v-else class="record-list">
			<view v-for="r in records" :key="r.id" class="record-card">
				<view class="record-main">
					<view class="record-name">{{ r.productName }}</view>
					<view class="record-time">{{ formatTime(r.createdAt) }} · 已兑换</view>
				</view>
				<view class="record-cost">-{{ r.pointsCost }} 积分</view>
			</view>
		</view>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
import LoginPopup from '../../components/login-popup/login-popup.vue';
import { getExchangeRecords, getUserStats } from '../../apis/index.js';
import { isLoggedIn } from '../../utils/auth.js';
import { useLoginGate } from '../../utils/login-gate.js';
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';

const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

const loggedIn = ref(false);
const points = ref(0);
const records = ref([]);
const loading = ref(true);

async function load() {
	loggedIn.value = isLoggedIn();
	if (!loggedIn.value) {
		points.value = 0;
		records.value = [];
		loading.value = false;
		return;
	}
	loading.value = true;
	try {
		const [stats, list] = await Promise.all([getUserStats(), getExchangeRecords()]);
		points.value = stats.points || 0;
		records.value = list;
	} catch (e) {
		if (e && e.needLogin) {
			loggedIn.value = false;
			points.value = 0;
			records.value = [];
		}
	} finally {
		loading.value = false;
	}
}

function formatTime(iso) {
	if (!iso) return '';
	return String(iso).replace('T', ' ').slice(0, 16);
}

function openLogin() {
	requireLogin(load);
}
function onLoginSuccess() {
	handleSuccess();
	load();
}
function onLoginClose() {
	handleClose();
}

onShow(() => {
	load();
});
</script>

<style scoped>
.page {
	min-height: calc(100vh - var(--window-bottom, 0px));
	background: #f5f6f8;
	padding: 22rpx 24rpx;
	box-sizing: border-box;
}

.points-bar {
	background: linear-gradient(135deg, #3c7bff, #6a9bff);
	border-radius: 22rpx;
	padding: 30rpx 32rpx;
	color: #ffffff;
	margin-bottom: 22rpx;
	box-shadow: 0 6rpx 18rpx rgba(60, 123, 255, 0.25);
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

.guest-note {
	background: #ffffff;
	border-radius: 22rpx;
	padding: 70rpx 40rpx;
	text-align: center;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.guest-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #2a2f3a;
}
.guest-desc {
	margin: 14rpx 0 36rpx;
	font-size: 24rpx;
	color: #8a8f99;
}

.btn {
	margin: 0;
	border-radius: 999rpx;
	font-size: 27rpx;
}
.btn.primary {
	background: #3c7bff;
	color: #ffffff;
	height: 80rpx;
	line-height: 80rpx;
}

.record-list {
	display: flex;
	flex-direction: column;
	gap: 18rpx;
}
.record-card {
	background: #ffffff;
	border-radius: 20rpx;
	padding: 28rpx 30rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.record-name {
	font-size: 28rpx;
	font-weight: 600;
	color: #2a2f3a;
}
.record-time {
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #8a8f99;
}
.record-cost {
	font-size: 27rpx;
	font-weight: 700;
	color: #ff7a1a;
	flex-shrink: 0;
	margin-left: 20rpx;
}

.empty {
	text-align: center;
	color: #8a8f99;
	font-size: 27rpx;
	padding: 140rpx 0;
}
.empty-icon {
	font-size: 80rpx;
	margin-bottom: 20rpx;
}
.empty-tip {
	margin-top: 12rpx;
	font-size: 23rpx;
	color: #b3b8c2;
}
</style>
