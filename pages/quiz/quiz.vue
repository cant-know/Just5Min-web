<template>
	<view class="page">
		<view v-if="loading" class="tip">加载中…</view>
		<view v-else-if="questions.length === 0" class="tip">{{ emptyText }}</view>

		<block v-else>
			<!-- 进度 -->
			<view class="progress-row">
				<view class="progress-text">
					<text class="cur">{{ index + 1 }}</text>
					<text class="sep"> / {{ questions.length }}</text>
				</view>
				<view class="row-right">
					<view class="type-tag">{{ current.questionType === 2 ? '多选题' : '单选题' }}</view>
					<view class="fav-btn" :class="{ on: favorited }" @click="toggleFavorite">
						{{ favorited ? '★' : '☆' }}
					</view>
				</view>
			</view>
			<view class="progress-bar">
				<view class="progress-inner" :style="{ width: ((index + 1) / questions.length * 100) + '%' }"></view>
			</view>

			<!-- 题干 -->
			<view class="stem">{{ current.content }}</view>

			<!-- 选项 -->
			<view class="option-list">
				<view
					v-for="(text, key) in current.options"
					:key="key"
					class="option"
					:class="optionClass(key)"
					@click="choose(key)"
				>
					<view class="option-key">{{ key }}</view>
					<view class="option-text">{{ text }}</view>
				</view>
			</view>

			<!-- 解析 -->
			<view v-if="submitted" class="analysis">
				<view class="analysis-head">
					<text :class="result.correct ? 'ok' : 'no'">{{ result.correct ? '答对了' : '答错了' }}</text>
					<text class="answer">正确答案：{{ result.answer }}</text>
				</view>
				<view v-if="result.analysis" class="analysis-body">{{ result.analysis }}</view>
			</view>

			<!-- 操作 -->
			<view class="actions">
				<button
					v-if="!submitted"
					class="btn primary"
					:disabled="selected.length === 0 || submitting"
					@click="confirm"
				>{{ submitting ? '提交中…' : '确认答案' }}</button>
				<button v-else class="btn primary" @click="next">{{ isLast ? '查看结果' : '下一题' }}</button>
			</view>
		</block>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import {
		getQuestions,
		getWrongQuestions,
		getFavorites,
		addFavorite,
		removeFavorite,
		submitAnswer
	} from '../../apis/index.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onLoad } from '@dcloudio/uni-app';
	import { ref, reactive, computed } from 'vue';

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const loading = ref(true);
	const submitting = ref(false);
	const questions = ref([]);
	const index = ref(0);
	const selected = ref([]);
	const submitted = ref(false);
	const result = ref(null);

	const categoryId = ref(0);
	const name = ref('');
	const mode = ref('normal');
	// 出题顺序：asc=顺序练习，random=随机抽题（默认）
	const order = ref('random');
	const stats = reactive({ total: 0, correct: 0 });
	// 当前题的收藏态（游客从 null 归一为 false，点收藏才引导登录）
	const favorited = ref(false);

	const current = computed(() => questions.value[index.value] || {});
	const isLast = computed(() => index.value >= questions.value.length - 1);

	const emptyText = computed(() => {
		if (mode.value === 'wrong') return '本分类还没有错题，先去刷几道题吧';
		if (mode.value === 'favorite') return '本分类还没有收藏的题目，刷题时点☆收藏吧';
		return '这里还没有题目';
	});

	function syncFavorited() {
		favorited.value = !!current.value.favorited;
	}

	async function init() {
		loading.value = true;
		try {
			const params = categoryId.value > 0 ? { categoryId: categoryId.value } : {};
			// 题目列表是只读接口，游客也能看；提交答案时才要求登录
			if (mode.value === 'wrong') {
				const list = await getWrongQuestions(params);
				questions.value = list.map((it) => it.question).filter(Boolean);
			} else if (mode.value === 'favorite') {
				const list = await getFavorites(params);
				questions.value = list.map((it) => it.question).filter(Boolean);
			} else {
				// 顺序练习：拉整个分类的题目，按题库顺序做完整套；
				// 随机模式仍只取 10 道，用于快速刷题
				questions.value = await getQuestions({
					categoryId: categoryId.value,
					limit: order.value === 'asc' ? 200 : 10,
					order: order.value
				});
			}
			uni.setNavigationBarTitle({ title: name.value || '刷题' });
			syncFavorited();
		} catch (e) {
			questions.value = [];
		} finally {
			loading.value = false;
		}
	}

	/** 收藏 / 取消收藏当前题（未登录先弹登录，登录成功后补执行） */
	function toggleFavorite() {
		const questionId = current.value.id;
		if (!questionId) return;
		const next = !favorited.value;
		requireLogin(() => doToggleFavorite(questionId, next));
	}

	async function doToggleFavorite(questionId, next) {
		try {
			if (next) {
				await addFavorite(questionId);
			} else {
				await removeFavorite(questionId);
			}
			favorited.value = next;
			// 同步回题目对象，翻页返回时状态不丢
			if (current.value && current.value.id === questionId) {
				current.value.favorited = next;
			}
			uni.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'none', duration: 800 });
		} catch (e) {
			// token 失效时重新走登录门禁；其余错误已在 request 层提示
			if (e && e.needLogin) {
				requireLogin(() => doToggleFavorite(questionId, next));
			}
		}
	}

	function choose(key) {
		if (submitted.value) return;
		if (current.value.questionType === 2) {
			const i = selected.value.indexOf(key);
			if (i >= 0) selected.value.splice(i, 1);
			else selected.value.push(key);
		} else {
			selected.value = [key];
		}
	}

	function optionClass(key) {
		if (!submitted.value) {
			return selected.value.includes(key) ? 'selected' : '';
		}
		const answer = result.value ? result.value.answer || '' : '';
		if (answer.includes(key)) return 'correct';
		if (selected.value.includes(key)) return 'wrong';
		return '';
	}

	async function confirm() {
		if (selected.value.length === 0 || submitting.value) return;
		await doSubmit();
	}

	async function doSubmit() {
		submitting.value = true;
		const userAnswer = [...selected.value].sort().join('');
		try {
			const res = await submitAnswer({ questionId: current.value.id, userAnswer });
			result.value = res;
			submitted.value = true;
			stats.total += 1;
			if (res.correct) stats.correct += 1;
			// 积分反馈：每提交一次答案 +1（后端结算，pointsTotal 为最新余额）
			if (res.pointsEarned) {
				uni.showToast({ title: `+${res.pointsEarned} 积分`, icon: 'none', duration: 800 });
			}
		} catch (e) {
			// 游客（未登录）提交答案会被后端 401 拦下 → 弹登录，登录成功后自动补交这题
			if (e && e.needLogin) {
				requireLogin(() => doSubmit());
			}
			// 其余错误已在 request 层提示
		} finally {
			submitting.value = false;
		}
	}

	function onLoginSuccess() {
		handleSuccess();
	}

	function onLoginClose() {
		handleClose();
	}

	function next() {
		if (isLast.value) {
			uni.redirectTo({
				url: `/pages/result/result?total=${stats.total}&correct=${stats.correct}` +
					`&categoryId=${categoryId.value}&name=${encodeURIComponent(name.value)}`
			});
			return;
		}
		index.value += 1;
		selected.value = [];
		submitted.value = false;
		result.value = null;
		syncFavorited();
	}

	onLoad((options) => {
		categoryId.value = Number(options.categoryId || 0);
		name.value = decodeURIComponent(options.name || '');
		mode.value = options.mode || 'normal';
		order.value = options.order === 'asc' ? 'asc' : 'random';
		// 记录本次练习入口，供首页「继续上次练习」使用（错题/收藏重做不算）
		if (mode.value === 'normal' && categoryId.value > 0) {
			uni.setStorageSync('lastQuiz', { categoryId: categoryId.value, name: name.value });
		}
		init();
	});
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #F5F6F8;
		padding: 28rpx 28rpx 60rpx;
		box-sizing: border-box;
	}

	.tip {
		padding: 120rpx 0;
		text-align: center;
		font-size: 28rpx;
		color: #8A8F99;
	}

	.progress-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.progress-text .cur {
		font-size: 40rpx;
		font-weight: 700;
		color: #3C7BFF;
	}

	.progress-text .sep {
		font-size: 26rpx;
		color: #8A8F99;
	}

	.type-tag {
		font-size: 24rpx;
		color: #3C7BFF;
		background-color: #EAF1FF;
		border-radius: 999rpx;
		padding: 6rpx 20rpx;
	}

	.row-right {
		display: flex;
		align-items: center;
	}

	.fav-btn {
		margin-left: 18rpx;
		width: 60rpx;
		height: 60rpx;
		line-height: 58rpx;
		text-align: center;
		font-size: 34rpx;
		color: #B4B9C2;
		background-color: #FFFFFF;
		border-radius: 50%;
	}

	.fav-btn.on {
		color: #F5A623;
	}

	.progress-bar {
		height: 8rpx;
		background-color: #E6E9EF;
		border-radius: 999rpx;
		margin: 20rpx 0 34rpx;
		overflow: hidden;
	}

	.progress-inner {
		height: 100%;
		background-color: #3C7BFF;
		border-radius: 999rpx;
		transition: width 0.25s ease;
	}

	.stem {
		font-size: 32rpx;
		line-height: 1.6;
		color: #1A1A1A;
		font-weight: 600;
		margin-bottom: 32rpx;
	}

	.option {
		display: flex;
		align-items: flex-start;
		background-color: #FFFFFF;
		border: 2rpx solid #EDEFF3;
		border-radius: 18rpx;
		padding: 26rpx 24rpx;
		margin-bottom: 20rpx;
	}

	.option.selected {
		border-color: #3C7BFF;
		background-color: #F3F7FF;
	}

	.option.correct {
		border-color: #19B36B;
		background-color: #EFFAF4;
	}

	.option.wrong {
		border-color: #F5453F;
		background-color: #FDF0EF;
	}

	.option-key {
		width: 48rpx;
		height: 48rpx;
		line-height: 48rpx;
		text-align: center;
		border-radius: 50%;
		background-color: #F0F2F6;
		color: #5A6270;
		font-size: 26rpx;
		font-weight: 600;
		margin-right: 20rpx;
		flex-shrink: 0;
	}

	.option.selected .option-key {
		background-color: #3C7BFF;
		color: #FFFFFF;
	}

	.option.correct .option-key {
		background-color: #19B36B;
		color: #FFFFFF;
	}

	.option.wrong .option-key {
		background-color: #F5453F;
		color: #FFFFFF;
	}

	.option-text {
		flex: 1;
		font-size: 29rpx;
		line-height: 1.5;
		color: #2B2F36;
		padding-top: 4rpx;
	}

	.analysis {
		background-color: #FFFFFF;
		border-radius: 18rpx;
		padding: 28rpx 26rpx;
		margin-top: 10rpx;
	}

	.analysis-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16rpx;
	}

	.analysis-head .ok {
		font-size: 30rpx;
		font-weight: 700;
		color: #19B36B;
	}

	.analysis-head .no {
		font-size: 30rpx;
		font-weight: 700;
		color: #F5453F;
	}

	.analysis-head .answer {
		font-size: 26rpx;
		color: #5A6270;
	}

	.analysis-body {
		font-size: 27rpx;
		line-height: 1.7;
		color: #5A6270;
	}

	.actions {
		margin-top: 44rpx;
	}

	.btn {
		height: 92rpx;
		line-height: 92rpx;
		border-radius: 999rpx;
		font-size: 31rpx;
		font-weight: 600;
		border: none;
	}

	.btn.primary {
		background-color: #3C7BFF;
		color: #FFFFFF;
	}

	.btn.primary[disabled] {
		background-color: #B9CDF7;
		color: #FFFFFF;
	}

	.btn::after {
		border: none;
	}
</style>
