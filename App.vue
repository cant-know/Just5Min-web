<script>
	import { isLoggedIn } from './utils/auth.js';
	import { getFriendRequestCount } from './apis/index.js';

	/** tabBar 里「好友」是第 4 项，索引为 3（改动 tabBar 顺序时要同步这里） */
	const FRIEND_TAB_INDEX = 3;

	function setFriendBadge(count) {
		// tabBar 角标不会持久化，冷启动/每次回前台都要重设
		try {
			if (count > 0) {
				uni.setTabBarBadge({ index: FRIEND_TAB_INDEX, text: count > 99 ? '99+' : String(count) });
			} else {
				uni.removeTabBarBadge({ index: FRIEND_TAB_INDEX });
			}
		} catch (e) {
			// 个别平台不支持 tabBar 角标，忽略
		}
	}

	function refreshFriendBadge() {
		if (!isLoggedIn()) {
			setFriendBadge(0);
			return;
		}
		getFriendRequestCount()
			.then((count) => setFriendBadge(count || 0))
			.catch(() => {
				// 角标不是关键路径，失败静默
			});
	}

	export default {
		onLaunch: function() {
			console.log('App Launch');
			// 启动时页面还没就绪，延迟一点再设角标
			setTimeout(refreshFriendBadge, 300);
		},
		onShow: function() {
			console.log('App Show');
			refreshFriendBadge();
		},
		onHide: function() {
			console.log('App Hide');
		}
	}
</script>

<style>
	/*每个页面公共css */
</style>
