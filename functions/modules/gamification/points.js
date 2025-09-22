/* gamification/points.js
   Points system: award points for actions; read totals; simple leaderboards by points
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');

const router = makeRouter();
const db = admin.firestore();

router.post('/award', asyncHandler(async (req, res) => {
  const { userUid, actionType, points = 1 } = req.body;
  if (!userUid || !actionType) return res.status(400).json({ error: 'userUid and actionType required' });
  await db.collection('gamification').doc('points').collection('users').doc(userUid)
    .set({ total: admin.firestore.FieldValue.increment(points) }, { merge: true });
  await db.collection('gamification').doc('history').collection(userUid)
    .add({ actionType, points, at: admin.firestore.FieldValue.serverTimestamp() });
  return res.json({ ok: true });
}));

router.get('/total/:uid', asyncHandler(async (req, res) => {
  const snap = await db.collection('gamification').doc('points').collection('users').doc(req.params.uid).get();
  return res.json({ total: snap.exists ? (snap.data().total || 0) : 0 });
}));

module.exports = router;
