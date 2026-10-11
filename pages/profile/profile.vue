<template>
	<view class="page">
		<!-- 基本信息 -->
		<view class="section-label">基本信息</view>
		<view class="card">
			<view class="row" @click="pickAvatar">
				<view class="row-label">头像</view>
				<view class="row-main">
					<image v-if="previewAvatar" class="avatar" :src="previewAvatar" mode="aspectFill" />
					<view v-else class="avatar placeholder">{{ avatarText }}</view>
				</view>
				<view class="chevron">›</view>
			</view>

			<view class="divider"></view>

			<view class="row">
				<view class="row-label">昵称</view>
				<input
					class="row-input"
					type="text"
					maxlength="64"
					:value="form.nickname"
					placeholder="请输入昵称"
					placeholder-class="ph"
					@input="onInput('nickname', $event)"
				/>
				<view class="counter">{{ form.nickname.length }}/64</view>
			</view>

			<view class="divider"></view>

			<view class="row" @click="pickGender">
				<view class="row-label">性别</view>
				<view class="row-value" :class="{ ph: !genderLabel }">{{ genderLabel || '未设置' }}</view>
				<view class="chevron">›</view>
			</view>

			<view class="divider"></view>

			<!-- mode="date" 是各端通用的原生日期选择器，比自己弹输入框体验好得多 -->
			<picker mode="date" :value="birthdayPickerValue" start="1900-01-01" :end="today" @change="onBirthdayChange">
				<view class="row">
					<view class="row-label">生日</view>
					<view class="row-value" :class="{ ph: !form.birthday }">
						{{ form.birthday || '未设置' }}
					</view>
					<view class="chevron">›</view>
				</view>
			</picker>

			<view v-if="form.birthday" class="clear-row" @click="form.birthday = ''">清除生日</view>

			<view class="divider"></view>

			<view class="row">
				<view class="row-label">地区</view>
				<input
					class="row-input"
					type="text"
					maxlength="32"
					:value="form.region"
					placeholder="如 北京 / 成都"
					placeholder-class="ph"
					@input="onInput('region', $event)"
				/>
				<view class="counter">{{ form.region.length }}/32</view>
			</view>
		</view>

		<!-- 备考信息 -->
		<view class="section-label">备考信息</view>
		<view class="card">
			<view class="row">
				<view class="row-label">个性签名</view>
				<input
					class="row-input"
					type="text"
					maxlength="64"
					:value="form.signature"
					placeholder="写句话给自己打气"
					placeholder-class="ph"
					@input="onInput('signature', $event)"
				/>
				<view class="counter">{{ form.signature.length }}/64</view>
			</view>

			<view class="divider"></view>

			<view class="row">
				<view class="row-label">目标院校</view>
				<input
					class="row-input"
					type="text"
					maxlength="64"
					:value="form.targetSchool"
					placeholder="如 某某大学"
					placeholder-class="ph"
					@input="onInput('targetSchool', $event)"
				/>
			</view>

			<view class="divider"></view>

			<view class="row">
				<view class="row-label">报考专业</view>
				<input
					class="row-input"
					type="text"
					maxlength="64"
					:value="form.targetMajor"
					placeholder="如 计算机科学与技术"
					placeholder-class="ph"
					@input="onInput('targetMajor', $event)"
				/>
			</view>

			<view class="divider"></view>

			<!-- 年份用 selector 模式：只需要「年」，用日期选择器反而要连月日一起选 -->
			<picker mode="selector" :range="examYearRange" :value="examYearIndex" @change="onExamYearChange">
				<view class="row">
					<view class="row-label">考研年份</view>
					<view class="row-value" :class="{ ph: !form.examYear }">
						{{ form.examYear ? form.examYear + ' 年' : '未设置' }}
					</view>
					<view class="chevron">›</view>
				</view>
			</picker>

			<view v-if="form.examYear" class="clear-row" @click="form.examYear = ''">清除年份</view>
		</view>

		<!-- 账号（只读） -->
		<view class="section-label">账号</view>
		<view class="card">
			<view class="row readonly">
				<view class="row-label">手机号</view>
				<view class="row-value">{{ phoneText }}</view>
			</view>
		</view>

		<view class="tip">
			头像会在本地压缩到 160×160 后上传；性别 / 生日 / 考研年份点一下即可选择，选「清除」可取消设置
		</view>

		<button class="btn primary" :disabled="saving || loading" @click="save">
			{{ saving ? '保存中…' : '保存' }}
		</button>

		<!-- 小程序端头像压缩需要原生画布（H5 走浏览器 canvas，不需要） -->
		<!-- #ifdef MP-WEIXIN -->
		<canvas canvas-id="avatarCanvas" class="hidden-canvas"></canvas>
		<!-- #endif -->

		<login-popup :visible="loginVisible" @success="onLoginSuccess" @close="onLoginClose" />
	</view>
</template>

<script setup>
	import LoginPopup from '../../components/login-popup/login-popup.vue';
	import { getUserProfile, updateProfile } from '../../apis/index.js';
	import { isLoggedIn, updateUserInfoCache } from '../../utils/auth.js';
	import { chooseAvatarBase64 } from '../../utils/avatar.js';
	import { useLoginGate } from '../../utils/login-gate.js';
	import { onLoad } from '@dcloudio/uni-app';
	import { ref, reactive, computed } from 'vue';

	const { visible: loginVisible, requireLogin, handleSuccess, handleClose } = useLoginGate();

	/** 性别选项：index 与取值一一对应（0未知 1男 2女） */
	const GENDER_OPTIONS = ['不显示', '男', '女'];

	/** 考研年份选项：今年往前 3 年、往后 6 年 */
	const THIS_YEAR = new Date().getFullYear();
	const examYearRange = [];
	for (let y = THIS_YEAR - 3; y <= THIS_YEAR + 6; y++) {
		examYearRange.push(String(y));
	}

	/** 今天的 yyyy-MM-dd，作为生日选择器的上限（不允许选未来） */
	const today = (() => {
		const d = new Date();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		return d.getFullYear() + '-' + mm + '-' + dd;
	})();

	const loading = ref(false);
	const saving = ref(false);

	/** 接口返回的原始资料（用于 diff 出真正改动过的字段） */
	const profile = ref(null);
	/** 新选的头像（Base64 DataURL）；为 null 表示这次没换头像 */
	const localAvatar = ref(null);

	/** 表单：全部用字符串存，方便与「未设置」区分（空串 = 未填/已清除） */
	const form = reactive({
		nickname: '',
		gender: 0,
		birthday: '',
		region: '',
		signature: '',
		targetSchool: '',
		targetMajor: '',
		examYear: ''
	});

	const previewAvatar = computed(() => localAvatar.value || (profile.value && profile.value.avatarUrl) || '');

	const avatarText = computed(() => {
		const nick = form.nickname || (profile.value && profile.value.nickname) || '';
		return nick ? nick.slice(0, 1) : '我';
	});

	const genderLabel = computed(() => (form.gender ? GENDER_OPTIONS[form.gender] : ''));

	/** <picker mode="date"> 的 value：无值时给个中性默认，避免部分端空串报错 */
	const birthdayPickerValue = computed(() => form.birthday || '2000-01-01');

	/** <picker mode="selector"> 的 value 是下标；无值时指向今年 */
	const examYearIndex = computed(() => {
		const idx = examYearRange.indexOf(form.examYear);
		return idx >= 0 ? idx : examYearRange.indexOf(String(THIS_YEAR));
	});

	/** 手机号：只读展示。微信登录用户没有手机号，给明确文案 */
	const phoneText = computed(() => {
		const phone = profile.value && profile.value.phone;
		if (!phone) return '微信登录';
		return phone.length === 11 ? phone.slice(0, 3) + '****' + phone.slice(7) : phone;
	});

	function applyProfile(data) {
		profile.value = data;
		form.nickname = (data && data.nickname) || '';
		form.gender = (data && data.gender) || 0;
		form.birthday = (data && data.birthday) || '';
		form.region = (data && data.region) || '';
		form.signature = (data && data.signature) || '';
		form.targetSchool = (data && data.targetSchool) || '';
		form.targetMajor = (data && data.targetMajor) || '';
		form.examYear = data && data.examYear ? String(data.examYear) : '';
		localAvatar.value = null;
	}

	async function load() {
		if (!isLoggedIn()) {
			return;
		}
		loading.value = true;
		try {
			applyProfile(await getUserProfile());
		} catch (e) {
			if (e && e.needLogin) {
				uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
				setTimeout(() => uni.navigateBack(), 800);
			}
		} finally {
			loading.value = false;
		}
	}

	function onInput(key, e) {
		form[key] = e.detail.value;
	}

	function pickAvatar() {
		chooseAvatarBase64()
			.then((dataUrl) => {
				localAvatar.value = dataUrl;
			})
			.catch((err) => {
				// 用户取消选择不算错误
				if (err && err.cancelled) return;
				uni.showToast({ title: (err && err.message) || '选择图片失败', icon: 'none' });
			});
	}

	function pickGender() {
		uni.showActionSheet({
			itemList: GENDER_OPTIONS,
			success: (res) => {
				form.gender = res.tapIndex;
			}
		});
	}

	function onBirthdayChange(e) {
		form.birthday = e.detail.value;
	}

	function onExamYearChange(e) {
		form.examYear = examYearRange[Number(e.detail.value)] || '';
	}

	/**
	 * 只提交真正改动过的字段（沿用原有 diff 思路，扩展到新字段）。
	 * 文本字段清空时提交空串（后端会写入空串表示清空）；生日/年份清空时提交空串。
	 */
	function buildPayload() {
		const nextNick = form.nickname.trim();
		if (!nextNick) {
			uni.showToast({ title: '昵称不能为空', icon: 'none' });
			return null;
		}

		const origin = profile.value || {};
		const payload = {};
		if (nextNick !== (origin.nickname || '')) payload.nickname = nextNick;
		if (localAvatar.value) payload.avatarUrl = localAvatar.value;

		if (form.gender !== ((origin.gender || 0) || 0)) payload.gender = form.gender;

		const originBirthday = origin.birthday || '';
		if (form.birthday !== originBirthday) payload.birthday = form.birthday;

		const originExamYear = origin.examYear ? String(origin.examYear) : '';
		if (form.examYear !== originExamYear) payload.examYear = form.examYear;

		['region', 'signature', 'targetSchool', 'targetMajor'].forEach((key) => {
			const next = form[key].trim();
			if (next !== (origin[key] || '')) payload[key] = next;
		});

		if (Object.keys(payload).length === 0) {
			uni.showToast({ title: '还没有修改内容', icon: 'none' });
			return null;
		}
		return payload;
	}

	async function save() {
		if (saving.value) return;
		const payload = buildPayload();
		if (!payload) return;

		saving.value = true;
		try {
			const data = await updateProfile(payload);
			// 同步本地缓存，返回「我的」页时 onShow 立刻能拿到新昵称/头像
			updateUserInfoCache({
				userId: data.userId,
				nickname: data.nickname || '',
				phone: data.phone || '',
				avatarUrl: data.avatarUrl || ''
			});
			applyProfile(data);
			uni.showToast({ title: '已保存', icon: 'success' });
			setTimeout(() => uni.navigateBack(), 700);
		} catch (e) {
			// 业务错误（1010 头像过大 / 400 参数）已由 request 层统一 toast
		} finally {
			saving.value = false;
		}
	}

	function onLoginSuccess() {
		handleSuccess();
		load();
	}

	function onLoginClose() {
		handleClose();
		uni.navigateBack();
	}

	onLoad(() => {
		if (!isLoggedIn()) {
			requireLogin(load);
			return;
		}
		load();
	});
</script>

<style>
	.page {
		min-height: 100vh;
		background-color: #F5F6F8;
		padding: 24rpx 28rpx 60rpx;
		box-sizing: border-box;
	}

	.section-label {
		margin: 24rpx 8rpx 14rpx;
		font-size: 25rpx;
		color: #8A8F99;
	}

	.section-label:first-child {
		margin-top: 8rpx;
	}

	.card {
		background-color: #FFFFFF;
		border-radius: 22rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
		overflow: hidden;
	}

	.row {
		display: flex;
		align-items: center;
		padding: 28rpx 30rpx;
		min-height: 104rpx;
		box-sizing: border-box;
	}

	.row.readonly {
		min-height: 96rpx;
	}

	.row-label {
		width: 150rpx;
		flex-shrink: 0;
		font-size: 29rpx;
		color: #1A1A1A;
		font-weight: 500;
	}

	.row-main {
		flex: 1;
		display: flex;
		justify-content: flex-end;
		padding-right: 10rpx;
	}

	.row-value {
		flex: 1;
		text-align: right;
		font-size: 29rpx;
		color: #1A1A1A;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.avatar {
		width: 110rpx;
		height: 110rpx;
		border-radius: 50%;
		display: block;
		background-color: #F2F4F7;
	}

	.avatar.placeholder {
		background-color: #3C7BFF;
		color: #FFFFFF;
		font-size: 44rpx;
		font-weight: 700;
		text-align: center;
		line-height: 110rpx;
	}

	.row-input {
		flex: 1;
		height: 72rpx;
		font-size: 29rpx;
		color: #1A1A1A;
		text-align: right;
	}

	.ph {
		color: #A6ACB8;
		font-size: 28rpx;
	}

	.counter {
		flex-shrink: 0;
		margin-left: 16rpx;
		font-size: 23rpx;
		color: #A6ABB5;
	}

	.chevron {
		flex-shrink: 0;
		margin-left: 8rpx;
		font-size: 34rpx;
		color: #C4C9D2;
		line-height: 1;
	}

	.divider {
		height: 2rpx;
		background-color: #F2F4F7;
		margin-left: 30rpx;
	}

	/* 「清除生日/清除年份」小按钮：挂在对应行下方 */
	.clear-row {
		padding: 0 30rpx 24rpx;
		text-align: right;
		font-size: 23rpx;
		color: #3C7BFF;
	}

	.tip {
		margin: 24rpx 8rpx 0;
		font-size: 23rpx;
		color: #A6ABB5;
		line-height: 1.6;
	}

	.btn {
		height: 92rpx;
		line-height: 92rpx;
		border-radius: 999rpx;
		font-size: 31rpx;
		font-weight: 600;
		border: none;
		margin-top: 44rpx;
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

	.hidden-canvas {
		position: fixed;
		left: -9999px;
		top: -9999px;
		width: 160px;
		height: 160px;
	}
</style>
