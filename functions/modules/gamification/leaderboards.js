/* gamification/leaderboards.js
   Simple leaderboards by points
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');

const router = makeRouter();
const db = admin.firestore();

router.get('/points', asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 20);
  const snap = await db.collection('gamification').doc('points').collection('users').orderBy('total', 'desc').limit(limit).get();
  return res.json({ leaderboard: snap.docs.map(d => ({ uid: d.id, total: d.data().total || 0 })) });
}));

module.exports = router;
