/* modules/index.js
   Aggregate router mounting all subdomain routers under /v2
*/
const { makeRouter } = require('./utils/helpers');

const router = makeRouter();

router.use('/users', require('./users/profile'));
router.use('/connections', require('./users/connections'));

router.use('/posts', require('./posts/posts'));
router.use('/reactions', require('./posts/reactions'));
router.use('/comments', require('./posts/comments'));

router.use('/messages', require('./messaging/chat'));
router.use('/messages', require('./messaging/groupChat'));

router.use('/events', require('./events/events'));
router.use('/quizzes', require('./events/quizzes'));

router.use('/notifications', require('./notifications/notifications'));
router.use('/analytics', require('./analytics/analytics'));
router.use('/search', require('./search/search'));
router.use('/storage', require('./storage/files'));

// Gamification
router.use('/gamification/points', require('./gamification/points'));
router.use('/gamification/badges', require('./gamification/badges'));
router.use('/gamification/leaderboards', require('./gamification/leaderboards'));

// AI recommendations
router.use('/ai', require('./ai/recommendations'));

module.exports = router;
