import { get, post, put, del } from '../utils/request.js';

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

/** 我的资料（含昵称/头像/积分，需登录） */
export const getUserProfile = () => get('/api/user/profile');

/**
 * 编辑资料（需登录）
 * @param {{nickname?:string, avatarUrl?:string}} data 只传要改的字段
 * @returns {Promise<{userId:number,nickname:string,phone:string,avatarUrl:string,points:number}>}
 */
export const updateProfile = (data) => put('/api/user/profile', data);

/* ==================== 好友（全部需登录） ==================== */

/**
 * 好友列表（含对方学习数据：答题数/正确率/打卡天数/积分）
 * @param {{limit?:number, offset?:number}} [params] limit 默认 50，上限 50
 */
export const getFriendList = (params) => get('/api/friends', params || {});

/** 删除好友（双向） */
export const removeFriend = (friendId) => del('/api/friends/' + friendId);

/**
 * 搜索用户：用户ID / 手机号 精确，昵称 模糊
 * @returns {Promise<Array<{userId:number,nickname:string,avatarUrl:string,relation:string}>>}
 *          relation: none | pending_out | pending_in | friend | self
 */
export const searchFriends = (keyword) => get('/api/friends/search', { keyword });

/** 我收到的待处理好友请求 */
export const getFriendRequests = () => get('/api/friends/requests');

/** 待处理好友请求数量（tabBar 角标） */
export const getFriendRequestCount = () => get('/api/friends/requests/count');

/** 发送好友请求 */
export const sendFriendRequest = (toUserId, message) =>
	post('/api/friends/requests', message ? { toUserId, message } : { toUserId });

/** 同意好友请求 */
export const acceptFriendRequest = (id) => post('/api/friends/requests/' + id + '/accept', {});

/** 拒绝好友请求 */
export const rejectFriendRequest = (id) => post('/api/friends/requests/' + id + '/reject', {});

/* ==================== 好友私信聊天（需登录，仅限好友） ==================== */

/**
 * 与某好友的聊天记录（按时间正序，最后一条最新；进会话后对方的未读会被置已读）
 * @param {number} friendId 对方用户ID
 * @param {{beforeId?:number, limit?:number}} [params] beforeId 翻页游标（上一页最旧一条的 id）
 * @returns {Promise<Array<{id,fromUserId,toUserId,content,mine,read,createdAt}>>} mine=true 表示我发的（靠右）
 */
export const getMessages = (friendId, params) =>
	get('/api/messages', Object.assign({ friendId }, params || {}));

/**
 * 发送消息（仅好友之间；非好友返回 1012，自己发给自己返回 1013）
 * @returns {Promise<{id,fromUserId,toUserId,content,mine,read,createdAt}>} 落库后的消息
 */
export const sendMessage = (toUserId, content) => post('/api/messages', { toUserId, content });

/**
 * 会话列表：每个聊过天的好友一条，含最后一条消息与对方发来的未读数
 * @returns {Promise<Array<{userId,nickname,avatarUrl,lastContent,lastMine,lastTime,unreadCount}>>}
 */
export const getChatSessions = () => get('/api/messages/sessions');

/* ==================== 收藏（需登录） ==================== */

/** 收藏列表，categoryId 可选（不传=全部） */
export const getFavorites = (params) => get('/api/favorites', params || {});

/** 收藏题目（幂等） */
export const addFavorite = (questionId) => post('/api/favorites/' + questionId, {});

/** 取消收藏 */
export const removeFavorite = (questionId) => del('/api/favorites/' + questionId);

/* ==================== 学习资料专栏（游客可读） ==================== */

/**
 * 资料列表（不含正文），categoryId 可选
 * @returns {Promise<Array<{id,categoryId,categoryName,title,summary,tags,tagList,readCount,createdAt}>>}
 */
export const getArticles = (categoryId) =>
	get('/api/articles', categoryId ? { categoryId } : {});

/** 资料详情（含正文 content），同时累加阅读量 */
export const getArticle = (id) => get('/api/articles/' + id);

/* ==================== 积分商城（分类/商品列表游客可读，兑换需登录） ==================== */

/** 商品分类（商城页 chips 用；文章专栏页也复用它做筛选） */
export const getMallCategories = () => get('/api/mall/categories');

/** 商品列表，categoryId 可选（不传=全部） */
export const getMallProducts = (categoryId) =>
	get('/api/mall/products', categoryId ? { categoryId } : {});

/**
 * 兑换商品（需登录）。
 * 免费商品（price=0）不扣积分且幂等；付费商品扣库存扣积分。
 * @returns {Promise<{recordId,productId,productName,articleId,pointsCost,pointsBalance}>}
 */
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
