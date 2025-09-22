/* notifications/notifications.js
   Notifications list, mark read; push is in root index via /push/* endpoints
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');
const { Limits } = require('../utils/constants');

const router = makeRouter();
const db = admin.firestore();

router.get('/:uid', asyncHandler(async (req, res) => {
  const uid = req.params.uid;
  if (uid !== req.user.uid && !(req.user.role === 'admin' || req.user.admin === true)) return res.status(403).json({ error: 'Forbidden' });
  const snap = await db.collection('notifications').where('toUid', '==', uid).orderBy('createdAt', 'desc').limit(100).get();
  return res.json({ notifications: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.post('/:notificationId/read', asyncHandler(async (req, res) => {
  const ref = db.collection('notifications').doc(req.params.notificationId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  const n = snap.data();
  if (n.toUid !== req.user.uid && !(req.user.role === 'admin' || req.user.admin === true)) return res.status(403).json({ error: 'Forbidden' });
  await ref.update({ read: true });
  return res.json({ ok: true });
}));

module.exports = router;
