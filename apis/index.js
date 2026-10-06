import { get, post, del } from '../utils/request.js';

/* ==================== 登录 / 注册 ==================== */

/** 微信 code 换 token（小程序端） */
export const apiWxLogin = (code) => post('/api/auth/login', { code });

/** 手机号注册（成功即登录） */
export const apiRegister = (phone, password, nickname) =>
	post('/api/auth/register', { phone, password, nickname });

/** 手机号 + 密码登录 */
export const apiPasswordLogin = (phone, password) =>
	post('/api/auth/password-login', { phone, password });

/* ==================== 题库 / 分类（游客可读） ==================== */

/** 一级分类列表（旧接口，保留） */
export const getCategories = () => get('/api/categories');

/** 完整分类树（一级 → 二级分组/直挂叶子 → 三级叶子），用于题库页左右栏 */
export const getCategoryTree = () => get('/api/categories/tree');

/** 按关键字搜索叶子分类，返回带层级路径的结果 */
export const searchCategories = (keyword) => get('/api/categories/search', { keyword });

/**
 * 拉取刷题列表
 * @param {{categoryId:number, limit?:number, order?:'asc'|'random'}} params
 */
export const getQuestions = (params) => get('/api/questions', params);

/** 单题详情 */
export const getQuestion = (id) => get('/api/questions/' + id);

/* ==================== 个人数据（需登录） ==================== */

/** 提交答案（后端判分） */
export const submitAnswer = (data) => post('/api/answers/submit', data);

/** 错题本列表 */
export const getWrongQuestions = (params) => get('/api/wrong-questions', params || {});

/** 移出错题本 */
export const removeWrongQuestion = (questionId) => del('/api/wrong-questions/' + questionId);

/** 学习统计 */
export const getUserStats = () => get('/api/user/stats');

/* ==================== 收藏（需登录） ==================== */

/** 收藏列表，categoryId 可选（不传=全部） */
export const getFavorites = (params) => get('/api/favorites', params || {});

/** 收藏题目（幂等） */
export const addFavorite = (questionId) => post('/api/favorites/' + questionId, {});

/** 取消收藏 */
export const removeFavorite = (questionId) => del('/api/favorites/' + questionId);

/* ==================== 积分商城（分类/商品游客可读，兑换需登录） ==================== */

/** 商城一级分类 */
export const getMallCategories = () => get('/api/mall/categories');

/** 商品列表，categoryId 可选（不传=全部） */
export const getMallProducts = (categoryId) =>
	get('/api/mall/products', categoryId ? { categoryId } : {});

/** 兑换商品（需登录），返回 { recordId, productId, productName, pointsCost, pointsBalance } */
export const exchangeProduct = (productId) => post('/api/mall/exchange', { productId });

/** 我的兑换记录（需登录） */
export const getExchangeRecords = () => get('/api/mall/exchanges');

/* ==================== 每日打卡（需登录） ==================== */

/**
 * 打卡概览：累计/连续天数、今日是否已打卡
 * @param {string} [month] 可选，yyyy-MM，返回该月已打卡日期供月历标记
 */
export const getCheckInSummary = (month) => get('/api/checkins', month ? { month } : {});

/** 每日打卡（每日一次，+10 积分；重复打卡返回 1005） */
export const doCheckIn = () => post('/api/checkins', {});
