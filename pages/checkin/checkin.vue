<template>
	<view class="page">
		<!-- 连续天数卡片 -->
		<view class="hero">
			<view class="hero-left">
				<view class="hero-row">
					<text class="hero-icon">⚡</text>
					<text class="hero-num">{{ summary.totalDays }}</text>
					<text class="hero-unit">天</text>
				</view>
				<view class="hero-sub">{{ summary.continuousDays > 0 ? `连续不断电 ${summary.continuousDays} 天` : '坚持打卡，不断电' }}</view>
			</view>
			<view class="hero-badge">🎁</view>
		</view>

		<!-- 月历 -->
		<view class="calendar">
			<view class="cal-head">
				<view class="cal-title">{{ year }}年{{ monthNum }}月</view>
				<view class="cal-nav">
					<view class="cal-arrow" :class="{ disabled: !canPrev }" @click="prevMonth">‹</view>
					<view class="cal-arrow" :class="{ disabled: !canNext }" @click="nextMonth">›</view>
				</view>
			</view>

			<view class="cal-week">
				<text v-for="w in weeks" :key="w" class="cal-week-cell">{{ w }}</text>
			</view>

			<view class="cal-grid">
				<view v-for="(cell, i) in cells" :key="i" class="cal-cell">
					<view v-if="cell" class="cal-day"
						:class="{ checked: cell.checked, today: cell.isToday && !cell.checked, future: cell.future }">
						<text v-if="cell.checked" class="cal-check-mark">✓</text>
						<text v-else>{{ cell.day }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 打卡按钮 -->
		<view class="checkin-btn" :class="{ done: summary.checkedToday }" @click="onCheckIn">
			{{ btnText }}
		</view>
		<view class="checkin-tip">每日打卡 +10 积分，可在商城兑换学习资料</view>

		<!-- 断电保护卡（占位） -->
		<view class="guard-card">
			<view class="guard-icon">🔋</view>
			<view class="guard-main">
				<view class="guard-name">断电保护卡</view>
				<view class="guard-desc">装备后，它将在你忘记学习的日子，自动帮你保住连击天数战绩不掉</view>
			</view>
			<view class="guard-soon">敬请期待</view>
		</view>

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { getCheckInSummary, doCheckIn } from '../../apis/index.js';
	import { isLoggedIn } from '../../utils/auth.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onLoad, onShow } from '@dcloudio/uni-app';
	import { ref, computed } from 'vue';

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const weeks = ['一', '二', '三', '四', '五', '六', '日'];

	const summary = ref({ totalDays: 0, continuousDays: 0, checkedToday: false, dates: [] });
	const year = ref(0);
	const monthNum = ref(0);

	const todayStr = computed(() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	});

	/** 当月已打卡日期集合 */
	const checkedSet = computed(() => new Set(summary.value.dates || []));

	/** 月历格子：周一起排列，前导空位 + 每天 */
	const cells = computed(() => {
		if (!year.value) return [];
		const y = year.value;
		const m = monthNum.value;
		const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
		const days = new Date(y, m, 0).getDate();
		const now = new Date();
		const arr = [];
		for (let i = 0; i < offset; i++) arr.push(null);
		for (let d = 1; d <= days; d++) {
			const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			arr.push({
				day: d,
				date: ds,
				checked: checkedSet.value.has(ds),
				isToday: ds === todayStr.value,
				future: new Date(y, m - 1, d) > now
			});
		}
		return arr;
	});

	const canPrev = computed(() => {
		// 最早只能翻到注册功能上线的月份（简化：2026-10），避免无限翻空月
		return !(year.value === 2026 && monthNum.value === 10);
	});
	const canNext = computed(() => {
		const now = new Date();
		return year.value < now.getFullYear() || monthNum.value < now.getMonth() + 1;
	});

	const btnText = computed(() => {
		if (summary.value.checkedToday) return '今日已打卡 ✓ 明天再来';
		return '立即打卡 +10 积分';
	});

	/** 拉取指定月份概览；游客保持零值展示 */
	async function load() {
		if (!isLoggedIn()) {
			summary.value = { totalDays: 0, continuousDays: 0, checkedToday: false, dates: [] };
			return;
		}
		try {
			const ym = `${year.value}-${String(monthNum.value).padStart(2, '0')}`;
			summary.value = await getCheckInSummary(ym);
		} catch (e) {
			// 错误已在 request 层提示；保持当前数据
		}
	}

	function shiftMonth(delta) {
		let y = year.value;
		let m = monthNum.value + delta;
		if (m < 1) { m = 12; y -= 1; }
		if (m > 12) { m = 1; y += 1; }
		year.value = y;
		monthNum.value = m;
		load();
	}

	function prevMonth() {
		if (canPrev.value) shiftMonth(-1);
	}

	function nextMonth() {
		if (canNext.value) shiftMonth(1);
	}

	function onCheckIn() {
		requireLogin(async () => {
			try {
				const res = await doCheckIn();
				uni.showToast({ title: `打卡成功 +${res.pointsEarned} 积分`, icon: 'none' });
				load();
			} catch (e) {
				if (e && e.code === 1005) {
					// 重复打卡：刷新一下状态即可
					load();
				}
			}
		});
	}

	function onLoginSuccess() {
		handleSuccess();
		load();
	}

	function onLoginClose() {
		handleClose();
	}

	function initMonth() {
		const now = new Date();
		year.value = now.getFullYear();
		monthNum.value = now.getMonth() + 1;
	}

	onLoad(() => {
		initMonth();
	});

	onShow(() => {
		if (!year.value) initMonth();
		load();
	});
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #F2F0FA;
		padding: 24rpx 28rpx 60rpx;
		box-sizing: border-box;
	}

	/* ---------- 连续天数卡片 ---------- */
	.hero {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: linear-gradient(135deg, #9B4DFF, #C86BFF);
		border-radius: 26rpx;
		padding: 44rpx 36rpx;
		box-shadow: 0 10rpx 28rpx rgba(155, 77, 255, 0.32);
	}

	.hero-row {
		display: flex;
		align-items: baseline;
	}

	.hero-icon {
		font-size: 44rpx;
		margin-right: 12rpx;
	}

	.hero-num {
		font-size: 84rpx;
		font-weight: 800;
		color: #FFFFFF;
		line-height: 1;
	}

	.hero-unit {
		margin-left: 10rpx;
		font-size: 30rpx;
		color: rgba(255, 255, 255, 0.9);
	}

	.hero-sub {
		margin-top: 16rpx;
		font-size: 25rpx;
		color: rgba(255, 255, 255, 0.85);
	}

	.hero-badge {
		width: 96rpx;
		height: 96rpx;
		line-height: 96rpx;
		text-align: center;
		font-size: 48rpx;
		background-color: rgba(255, 255, 255, 0.22);
		border-radius: 50%;
	}

	/* ---------- 月历 ---------- */
	.calendar {
		margin-top: 26rpx;
		background-color: #FFFFFF;
		border-radius: 26rpx;
		padding: 30rpx 26rpx 34rpx;
	}

	.cal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.cal-title {
		font-size: 32rpx;
		font-weight: 700;
		color: #1A1A1A;
	}

	.cal-nav {
		display: flex;
	}

	.cal-arrow {
		width: 56rpx;
		height: 56rpx;
		line-height: 52rpx;
		text-align: center;
		font-size: 36rpx;
		color: #5A6270;
		background-color: #F4F2FB;
		border-radius: 14rpx;
		margin-left: 14rpx;
	}

	.cal-arrow.disabled {
		color: #C4C9D2;
	}

	.cal-week {
		display: flex;
		margin-top: 26rpx;
	}

	.cal-week-cell {
		flex: 1;
		text-align: center;
		font-size: 24rpx;
		color: #A6ABB5;
	}

	.cal-grid {
		display: flex;
		flex-wrap: wrap;
		margin-top: 12rpx;
	}

	.cal-cell {
		width: 14.28%;
		display: flex;
		justify-content: center;
		padding: 8rpx 0;
		box-sizing: border-box;
	}

	.cal-day {
		width: 60rpx;
		height: 60rpx;
		line-height: 60rpx;
		text-align: center;
		font-size: 26rpx;
		color: #3A3F4A;
		border-radius: 16rpx;
		box-sizing: border-box;
	}

	.cal-day.checked {
		background: linear-gradient(135deg, #9B4DFF, #C86BFF);
		color: #FFFFFF;
		font-weight: 700;
	}

	.cal-day.today {
		border: 2rpx solid #9B4DFF;
		color: #9B4DFF;
		font-weight: 700;
	}

	.cal-day.future {
		color: #C4C9D2;
	}

	.cal-check-mark {
		font-size: 30rpx;
	}

	/* ---------- 打卡按钮 ---------- */
	.checkin-btn {
		margin-top: 30rpx;
		height: 96rpx;
		line-height: 96rpx;
		text-align: center;
		font-size: 31rpx;
		font-weight: 700;
		color: #FFFFFF;
		background: linear-gradient(135deg, #9B4DFF, #C86BFF);
		border-radius: 999rpx;
		box-shadow: 0 8rpx 22rpx rgba(155, 77, 255, 0.3);
	}

	.checkin-btn.done {
		background: #E4E1EE;
		color: #9A94AC;
		box-shadow: none;
	}

	.checkin-tip {
		margin-top: 16rpx;
		text-align: center;
		font-size: 23rpx;
		color: #A29CB4;
	}

	/* ---------- 断电保护卡（占位） ---------- */
	.guard-card {
		display: flex;
		align-items: center;
		margin-top: 34rpx;
		background-color: #FFFFFF;
		border-radius: 24rpx;
		padding: 30rpx 28rpx;
	}

	.guard-icon {
		width: 84rpx;
		height: 84rpx;
		line-height: 84rpx;
		text-align: center;
		font-size: 42rpx;
		background-color: #FFF4DC;
		border-radius: 20rpx;
		margin-right: 22rpx;
		flex-shrink: 0;
	}

	.guard-main {
		flex: 1;
		min-width: 0;
	}

	.guard-name {
		font-size: 29rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.guard-desc {
		margin-top: 8rpx;
		font-size: 23rpx;
		color: #A6ABB5;
		line-height: 1.5;
	}

	.guard-soon {
		flex-shrink: 0;
		margin-left: 16rpx;
		font-size: 22rpx;
		color: #B4A8CC;
		background-color: #F4F2FB;
		border-radius: 999rpx;
		padding: 8rpx 18rpx;
	}
</style>
