<template>
	<view class="page">
		<view class="card">
			<view class="ring">
				<text class="ring-num">{{ accuracy }}%</text>
				<text class="ring-label">正确率</text>
			</view>
			<view class="summary">
				<view class="sum-item">
					<view class="sum-num">{{ total }}</view>
					<view class="sum-label">总题数</view>
				</view>
				<view class="sum-item">
					<view class="sum-num ok">{{ correct }}</view>
					<view class="sum-label">答对</view>
				</view>
				<view class="sum-item">
					<view class="sum-num no">{{ total - correct }}</view>
					<view class="sum-label">答错</view>
				</view>
			</view>
			<view v-if="name" class="cat">科目：{{ name }}</view>
			<view class="hint">答错的题已自动进入错题本</view>
		</view>

		<view class="actions">
			<button class="btn primary" @click="again">再刷一组</button>
			<button class="btn ghost" @click="home">回到首页</button>
		</view>
	</view>
</template>

<script setup>
	import { onLoad } from '@dcloudio/uni-app';
	import { ref, reactive, computed } from 'vue';

	const total = ref(0);
	const correct = ref(0);
	const categoryId = ref(0);
	const name = ref('');

	const accuracy = computed(() => {
		if (total.value === 0) return 0;
		return Math.round((correct.value / total.value) * 100);
	});

	function again() {
		uni.redirectTo({
			url: `/pages/quiz/quiz?categoryId=${categoryId.value}&name=${encodeURIComponent(name.value)}`
		});
	}

	function home() {
		uni.switchTab({ url: '/pages/index/index' });
	}

	onLoad((options) => {
		total.value = Number(options.total || 0);
		correct.value = Number(options.correct || 0);
		categoryId.value = Number(options.categoryId || 0);
		name.value = decodeURIComponent(options.name || '');
	});
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #F5F6F8;
		padding: 40rpx 28rpx;
		box-sizing: border-box;
	}

	.card {
		background-color: #FFFFFF;
		border-radius: 24rpx;
		padding: 50rpx 30rpx 40rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
		text-align: center;
	}

	.ring {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 260rpx;
		height: 260rpx;
		margin: 0 auto 40rpx;
		border-radius: 50%;
		background-color: #F3F7FF;
		border: 12rpx solid #3C7BFF;
		box-sizing: border-box;
	}

	.ring-num {
		font-size: 62rpx;
		font-weight: 700;
		color: #3C7BFF;
	}

	.ring-label {
		margin-top: 6rpx;
		font-size: 24rpx;
		color: #8A8F99;
	}

	.summary {
		display: flex;
		justify-content: space-around;
	}

	.sum-item {
		flex: 1;
	}

	.sum-num {
		font-size: 40rpx;
		font-weight: 700;
		color: #1A1A1A;
	}

	.sum-num.ok {
		color: #19B36B;
	}

	.sum-num.no {
		color: #F5453F;
	}

	.sum-label {
		margin-top: 8rpx;
		font-size: 24rpx;
		color: #8A8F99;
	}

	.cat {
		margin-top: 36rpx;
		font-size: 26rpx;
		color: #5A6270;
	}

	.hint {
		margin-top: 16rpx;
		font-size: 24rpx;
		color: #A6ABB5;
	}

	.actions {
		margin-top: 50rpx;
	}

	.btn {
		height: 92rpx;
		line-height: 92rpx;
		border-radius: 999rpx;
		font-size: 31rpx;
		font-weight: 600;
		border: none;
		margin-bottom: 22rpx;
	}

	.btn.primary {
		background-color: #3C7BFF;
		color: #FFFFFF;
	}

	.btn.ghost {
		background-color: #FFFFFF;
		color: #5A6270;
		border: 2rpx solid #E6E9EF;
	}

	.btn::after {
		border: none;
	}
</style>
