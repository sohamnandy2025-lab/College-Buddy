/* messaging/chat.js
   Direct messages, read receipts, unread count
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler, convKey } = require('../utils/helpers');
const { Limits } = require('../utils/constants');

const router = makeRouter();
const db = admin.firestore();

router.post('/', asyncHandler(async (req, res) => {
  const { receiverUid, text = '', attachments = [] } = req.body;
  if (!receiverUid) return res.status(400).json({ error: 'receiverUid required' });
  const key = convKey(req.user.uid, receiverUid);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const msg = { conversationKey: key, senderUid: req.user.uid, receiverUid, text, attachments, timestamp: now, seen: false };
  const ref = await db.collection('messages').add(msg);
  await db.collection('notifications').add({ toUid: receiverUid, type: 'message', payload: { fromUid: req.user.uid, messageId: ref.id }, read: false, createdAt: now });
  return res.json({ messageId: ref.id });
}));

router.get('/conversation/:uid1/:uid2', asyncHandler(async (req, res) => {
  const { uid1, uid2 } = req.params;
  const lim = Number(req.query.limit || Limits.MESSAGES_PAGE);
  const key = convKey(uid1, uid2);
  const snap = await db.collection('messages').where('conversationKey', '==', key).orderBy('timestamp', 'asc').limit(lim).get();
  return res.json({ messages: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.post('/read/:messageId', asyncHandler(async (req, res) => {
  const ref = db.collection('messages').doc(req.params.messageId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  const m = snap.data();
  if (m.receiverUid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
  await ref.update({ seen: true });
  return res.json({ ok: true });
}));

router.get('/unread/:uid', asyncHandler(async (req, res) => {
  const uid = req.params.uid;
  if (uid !== req.user.uid && !(req.user.role === 'admin' || req.user.admin === true)) return res.status(403).json({ error: 'Forbidden' });
  const snap = await db.collection('messages').where('receiverUid', '==', uid).where('seen', '==', false).orderBy('timestamp', 'asc').limit(100).get();
  return res.json({ messages: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

module.exports = router;
