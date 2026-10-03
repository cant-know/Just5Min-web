<template>
	<view class="page">
		<!-- 未登录：引导登录 -->
		<view v-if="!loggedIn" class="guest">
			<view class="guest-icon">🔒</view>
			<view class="guest-title">登录后查看错题本</view>
			<view class="guest-desc">登录后会自动记录你答错的题目，方便反复攻克</view>
			<button class="guest-btn" @click="openLogin">微信 / 手机号登录</button>
		</view>

		<block v-else>
			<view v-if="loading" class="tip">加载中…</view>
			<view v-else-if="list.length === 0" class="tip">错题本是空的，去题库刷几道题吧</view>

			<block v-else>
				<view class="top-row">
					<view class="count">共 {{ list.length }} 道错题</view>
					<view class="redo" @click="redoAll">全部重做</view>
				</view>

				<view v-for="item in list" :key="item.question.id" class="card" @click="redoOne(item)">
					<view class="card-head">
						<view class="tag">{{ item.question.questionType === 2 ? '多选' : '单选' }}</view>
						<view class="wrong-count">错 {{ item.wrongCount }} 次</view>
					</view>
					<view class="content">{{ item.question.content }}</view>
					<view class="card-foot">
						<text class="time">{{ formatTime(item.lastWrongAt) }}</text>
						<text class="remove" @click.stop="remove(item)">移出错题本</text>
					</view>
				</view>
			</block>
		</block>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { getWrongQuestions, removeWrongQuestion } from '../../apis/index.js';
	import { isLoggedIn } from '../../utils/auth.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onShow } from '@dcloudio/uni-app';
	import { ref } from 'vue';

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const loading = ref(true);
	const list = ref([]);
	const loggedIn = ref(false);

	async function load() {
		// 错题本属于个人数据，游客不请求接口，直接展示引导
		if (!isLoggedIn()) {
			loggedIn.value = false;
			list.value = [];
			loading.value = false;
			return;
		}
		loggedIn.value = true;
		loading.value = true;
		try {
			list.value = await getWrongQuestions({});
		} catch (e) {
			list.value = [];
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

	function formatTime(value) {
		if (!value) return '';
		return String(value).replace('T', ' ').slice(0, 16);
	}

	function redoAll() {
		uni.navigateTo({ url: '/pages/quiz/quiz?mode=wrong&name=' + encodeURIComponent('错题重做') });
	}

	function redoOne(item) {
		uni.navigateTo({
			url: '/pages/quiz/quiz?mode=wrong&categoryId=' + item.question.categoryId +
				'&name=' + encodeURIComponent('错题重做')
		});
	}

	function remove(item) {
		uni.showModal({
			title: '移出错题本',
			content: '确认将这道题移出错题本？',
			success: async (res) => {
				if (!res.confirm) return;
				try {
					await removeWrongQuestion(item.question.id);
					uni.showToast({ title: '已移出', icon: 'success' });
					load();
				} catch (e) {
					// 已在 request 层提示
				}
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
		padding: 28rpx;
		box-sizing: border-box;
	}

	/* ---------- 游客引导 ---------- */
	.guest {
		padding: 130rpx 40rpx 0;
		text-align: center;
	}

	.guest-icon {
		font-size: 76rpx;
		line-height: 1;
	}

	.guest-title {
		margin-top: 30rpx;
		font-size: 33rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.guest-desc {
		margin-top: 16rpx;
		font-size: 25rpx;
		color: #8A8F99;
		line-height: 1.6;
	}

	.guest-btn {
		width: 420rpx;
		height: 88rpx;
		line-height: 88rpx;
		margin: 48rpx auto 0;
		background-color: #3C7BFF;
		color: #FFFFFF;
		font-size: 30rpx;
		font-weight: 600;
		border-radius: 999rpx;
		border: none;
	}

	.guest-btn::after {
		border: none;
	}

	.tip {
		padding: 140rpx 0;
		text-align: center;
		font-size: 28rpx;
		color: #8A8F99;
	}

	.top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12rpx 6rpx 26rpx;
	}

	.count {
		font-size: 27rpx;
		color: #8A8F99;
	}

	.redo {
		font-size: 27rpx;
		color: #3C7BFF;
		font-weight: 600;
	}

	.card {
		background-color: #FFFFFF;
		border-radius: 20rpx;
		padding: 28rpx 26rpx;
		margin-bottom: 22rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
	}

	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16rpx;
	}

	.tag {
		font-size: 22rpx;
		color: #3C7BFF;
		background-color: #EAF1FF;
		border-radius: 999rpx;
		padding: 4rpx 18rpx;
	}

	.wrong-count {
		font-size: 24rpx;
		color: #F5453F;
	}

	.content {
		font-size: 29rpx;
		line-height: 1.55;
		color: #1A1A1A;
	}

	.card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 22rpx;
	}

	.time {
		font-size: 23rpx;
		color: #A6ABB5;
	}

	.remove {
		font-size: 25rpx;
		color: #8A8F99;
	}
</style>
