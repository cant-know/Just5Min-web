<template>
	<view class="page">
		<!-- 消息列表 -->
		<scroll-view
			class="msg-scroll"
			scroll-y
			:scroll-into-view="scrollTarget"
			:scroll-with-animation="withAnimation"
			@scrolltoupper="loadMore"
		>
			<view class="scroll-inner">
				<view v-if="loadingMore" class="load-more">加载更早的消息…</view>
				<view v-else-if="noMore && messages.length > 0" class="load-more">没有更早的消息了</view>

				<view v-if="loading" class="tip">加载中…</view>
				<view v-else-if="messages.length === 0" class="empty">
					<view class="empty-emoji">💬</view>
					<view class="empty-title">和 {{ friendName }} 打个招呼吧</view>
					<view class="empty-desc">只能和好友聊天，好好交流、一起上岸</view>
				</view>

				<block v-else>
					<view v-for="(m, idx) in messages" :key="m.id" :id="'msg-' + m.id">
						<!-- 时间分隔：首条、或与上一条间隔超过 5 分钟才显示 -->
						<view v-if="showTime(idx)" class="time-divider">{{ fmtTime(m.createdAt) }}</view>

						<view class="row" :class="m.mine ? 'row-mine' : 'row-friend'">
							<image
								v-if="m.mine ? myAvatar : friendAvatar"
								class="bubble-avatar img"
								:src="m.mine ? myAvatar : friendAvatar"
								mode="aspectFill"
							/>
							<view v-else class="bubble-avatar">
								{{ initial(m.mine ? myNickname : friendName) }}
							</view>
							<view class="bubble-wrap">
								<view class="bubble" :class="m.mine ? 'bubble-mine' : 'bubble-friend'">
									<text class="bubble-text">{{ m.content }}</text>
								</view>
								<!-- 自己发的消息显示已读/未读（仿微信的「已读」语义简化版） -->
								<view v-if="m.mine" class="read-state">{{ m.read ? '已读' : '未读' }}</view>
							</view>
						</view>
					</view>
				</block>
				<view id="msg-bottom" class="bottom-anchor"></view>
			</view>
		</scroll-view>

		<!-- 底部输入栏 -->
		<view class="input-bar">
			<input
				class="input"
				v-model="draft"
				type="text"
				:maxlength="500"
				placeholder="发消息…"
				confirm-type="send"
				:adjust-position="true"
				@confirm="onSend"
			/>
			<view class="send-btn" :class="{ disabled: !canSend }" @click="onSend">发送</view>
		</view>
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { getMessages, sendMessage } from '../../apis/index.js';
	import { getUserInfo, isLoggedIn } from '../../utils/auth.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onLoad, onShow } from '@dcloudio/uni-app';
	import { computed, nextTick, ref } from 'vue';

	/** 单页拉取条数（后端上限 100） */
	const PAGE_LIMIT = 30;

	/** 两条消息间隔超过这个毫秒数才插时间分隔（仿微信） */
	const TIME_GAP_MS = 5 * 60 * 1000;

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	const friendId = ref(0);
	const friendName = ref('');
	const friendAvatar = ref('');

	const messages = ref([]);
	const loading = ref(true);
	const loadingMore = ref(false);
	const noMore = ref(false);

	const draft = ref('');
	/** scroll-into-view 的目标 id，改它即触发滚动 */
	const scrollTarget = ref('');
	const withAnimation = ref(false);

	const myInfo = getUserInfo() || {};
	const myAvatar = computed(() => myInfo.avatarUrl || '');
	const myNickname = computed(() => myInfo.nickname || '我');

	const canSend = computed(() => !!draft.value.trim());

	function initial(name) {
		if (!name) return '友';
		return String(name).slice(0, 1);
	}

	/** 后端返回 "2026-10-11T14:05:33" 这类本地时间串，兼容 iOS 需把 T 换成空格 */
	function parseTime(value) {
		if (!value) return null;
		const t = new Date(String(value).replace(/-/g, '/').replace('T', ' ').replace(/\.\d+$/, ''));
		return isNaN(t.getTime()) ? null : t;
	}

	function fmtTime(value) {
		const t = parseTime(value);
		if (!t) return '';
		const now = new Date();
		const hm = pad(t.getHours()) + ':' + pad(t.getMinutes());
		if (sameDay(t, now)) return hm;

		const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		if (sameDay(t, yesterday)) return '昨天 ' + hm;

		const md = t.getMonth() + 1 + '月' + t.getDate() + '日';
		if (t.getFullYear() === now.getFullYear()) return md + ' ' + hm;
		return t.getFullYear() + '年' + md + ' ' + hm;
	}

	function pad(n) {
		return n < 10 ? '0' + n : String(n);
	}

	function sameDay(a, b) {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}

	/** 首条必显示时间；之后与上一条间隔 > 5 分钟才显示 */
	function showTime(idx) {
		if (idx === 0) return true;
		const cur = parseTime(messages.value[idx].createdAt);
		const prev = parseTime(messages.value[idx - 1].createdAt);
		if (!cur || !prev) return false;
		return cur.getTime() - prev.getTime() > TIME_GAP_MS;
	}

	function scrollToBottom(animated) {
		withAnimation.value = !!animated;
		nextTick(() => {
			scrollTarget.value = '';
			nextTick(() => {
				scrollTarget.value = 'msg-bottom';
			});
		});
	}

	/** 滚到某条消息（翻页后保持在原来那条的位置） */
	function scrollToId(id) {
		withAnimation.value = false;
		nextTick(() => {
			scrollTarget.value = '';
			nextTick(() => {
				scrollTarget.value = 'msg-' + id;
			});
		});
	}

	/**
	 * 拉最新一页。进页面与从后台返回时都调（页面不会被重建，靠 onShow 刷新）。
	 */
	async function load(silent = false) {
		if (!isLoggedIn() || !friendId.value) {
			loading.value = false;
			return;
		}
		if (!silent) loading.value = true;
		try {
			const list = (await getMessages(friendId.value, { limit: PAGE_LIMIT })) || [];
			const hadMessages = messages.value.length > 0;
			messages.value = list;
			noMore.value = list.length < PAGE_LIMIT;
			// 只有首次/首屏才滚到底；静默刷新（发完消息另处理）不打扰阅读位置
			if (!silent && !hadMessages) {
				scrollToBottom(false);
			}
		} catch (e) {
			if (e && e.needLogin) {
				requireLogin(() => load());
			}
		} finally {
			loading.value = false;
		}
	}

	/** 上滑到顶 → 用 beforeId 游标拉更早的一页，拼在前面 */
	async function loadMore() {
		if (loadingMore.value || noMore.value || messages.value.length === 0) return;
		loadingMore.value = true;
		const anchorId = messages.value[0].id;
		try {
			const older = (await getMessages(friendId.value, {
				beforeId: anchorId,
				limit: PAGE_LIMIT
			})) || [];
			if (older.length === 0) {
				noMore.value = true;
			} else {
				messages.value = older.concat(messages.value);
				noMore.value = older.length < PAGE_LIMIT;
				scrollToId(anchorId);
			}
		} catch (e) {
			// 错误已由 request 层 toast
		} finally {
			loadingMore.value = false;
		}
	}

	async function doSend() {
		const text = draft.value.trim();
		if (!text) return;
		draft.value = '';
		try {
			const saved = await sendMessage(friendId.value, text);
			if (saved) messages.value = messages.value.concat([saved]);
			scrollToBottom(true);
		} catch (e) {
			// 发送失败把内容还回输入框，避免用户白打一段字
			draft.value = text;
			if (e && e.needLogin) requireLogin(() => {});
		}
	}

	function onSend() {
		if (!canSend.value) return;
		requireLogin(() => doSend());
	}

	function onLoginSuccess() {
		handleSuccess();
		load();
	}

	function onLoginClose() {
		handleClose();
	}

	onLoad((options) => {
		friendId.value = Number((options && options.friendId) || 0);
		// 路由传参只是首屏快照（昵称/头像可能已过期），后端接口不回带对方资料，
		// 这里先用它渲染，聊天页本身不依赖它做任何逻辑判断。
		friendName.value = decodeURIComponent((options && options.name) || '') || '好友';
		friendAvatar.value = decodeURIComponent((options && options.avatar) || '');
		if (friendName.value && friendName.value !== '好友') {
			uni.setNavigationBarTitle({ title: friendName.value });
		}
	});

	onShow(() => {
		// 从后台切回 / 从别的页面返回都刷新一次，保证能看到好友刚发来的消息
		if (messages.value.length > 0) {
			load(true);
		} else {
			load();
		}
	});
</script>

<style>
	.page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: #F5F6F8;
		box-sizing: border-box;
	}

	/* ---------- 消息滚动区 ---------- */
	.msg-scroll {
		flex: 1;
		min-height: 0;
	}

	.scroll-inner {
		padding: 24rpx 24rpx 12rpx;
	}

	.load-more {
		padding: 16rpx 0 24rpx;
		text-align: center;
		font-size: 22rpx;
		color: #A6ABB5;
	}

	/* ---------- 时间分隔 ---------- */
	.time-divider {
		margin: 20rpx 0 24rpx;
		text-align: center;
		font-size: 22rpx;
		color: #A6ABB5;
	}

	/* ---------- 消息行 ---------- */
	.row {
		display: flex;
		align-items: flex-start;
		margin-bottom: 28rpx;
	}

	.row-mine {
		flex-direction: row-reverse;
	}

	.bubble-avatar {
		width: 76rpx;
		height: 76rpx;
		border-radius: 12rpx;
		background-color: #3C7BFF;
		color: #FFFFFF;
		font-size: 30rpx;
		font-weight: 700;
		text-align: center;
		line-height: 76rpx;
		flex-shrink: 0;
	}

	.bubble-avatar.img {
		display: block;
		background-color: #F2F4F7;
	}

	.row-mine .bubble-avatar {
		margin-left: 18rpx;
	}

	.row-friend .bubble-avatar {
		margin-right: 18rpx;
	}

	.bubble-wrap {
		max-width: 70%;
		display: flex;
		flex-direction: column;
	}

	.row-mine .bubble-wrap {
		align-items: flex-end;
	}

	.row-friend .bubble-wrap {
		align-items: flex-start;
	}

	.bubble {
		padding: 20rpx 26rpx;
		border-radius: 14rpx;
		word-break: break-all;
	}

	/* 自己：主色底 + 白字；对方：白底 + 深字（与微信一致） */
	.bubble-mine {
		background-color: #3C7BFF;
		color: #FFFFFF;
	}

	.bubble-friend {
		background-color: #FFFFFF;
		color: #1A1A1A;
		box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
	}

	.bubble-text {
		font-size: 29rpx;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.read-state {
		margin-top: 8rpx;
		font-size: 20rpx;
		color: #A6ABB5;
	}

	/* ---------- 空态 ---------- */
	.empty {
		padding: 140rpx 40rpx;
		text-align: center;
	}

	.empty-emoji {
		font-size: 76rpx;
		line-height: 1;
	}

	.empty-title {
		margin-top: 22rpx;
		font-size: 30rpx;
		font-weight: 600;
		color: #1A1A1A;
	}

	.empty-desc {
		margin-top: 12rpx;
		font-size: 24rpx;
		color: #A6ABB5;
	}

	.tip {
		padding: 100rpx 0;
		text-align: center;
		font-size: 28rpx;
		color: #8A8F99;
	}

	.bottom-anchor {
		height: 1rpx;
	}

	/* ---------- 底部输入栏 ---------- */
	.input-bar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		padding: 16rpx 24rpx;
		/* 全面屏底部安全区：不加会被 Home 指示条盖住 */
		padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
		padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
		background-color: #FFFFFF;
		border-top: 2rpx solid #EDEFF3;
	}

	.input {
		flex: 1;
		height: 76rpx;
		padding: 0 26rpx;
		box-sizing: border-box;
		background-color: #F2F4F7;
		border-radius: 999rpx;
		font-size: 28rpx;
		color: #1A1A1A;
	}

	.send-btn {
		flex-shrink: 0;
		margin-left: 18rpx;
		padding: 0 34rpx;
		height: 76rpx;
		line-height: 76rpx;
		border-radius: 999rpx;
		background-color: #3C7BFF;
		color: #FFFFFF;
		font-size: 28rpx;
		font-weight: 600;
	}

	.send-btn.disabled {
		background-color: #C9D6F5;
	}
</style>
