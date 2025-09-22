/* gamification/badges.js
   Award badges and list user badges
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');

const router = makeRouter();
const db = admin.firestore();

router.post('/award', asyncHandler(async (req, res) => {
  const { userUid, badgeType } = req.body;
  if (!userUid || !badgeType) return res.status(400).json({ error: 'userUid and badgeType required' });
  await db.collection('gamification').doc('badges').collection(userUid).doc(badgeType)
    .set({ type: badgeType, at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return res.json({ ok: true });
}));

router.get('/:uid', asyncHandler(async (req, res) => {
  const snap = await db.collection('gamification').doc('badges').collection(req.params.uid).get();
  return res.json({ badges: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

module.exports = router;
