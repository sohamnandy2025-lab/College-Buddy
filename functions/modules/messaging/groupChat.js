/* messaging/groupChat.js
   Group chats: create groups, add/remove members, send group messages
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');
const { Limits } = require('../utils/constants');

const router = makeRouter();
const db = admin.firestore();

router.post('/groups', asyncHandler(async (req, res) => {
  const { name, participants = [] } = req.body;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const members = Array.from(new Set([req.user.uid, ...participants]));
  const ref = await db.collection('groups').add({ name: name || 'Group', adminUids: [req.user.uid], participants: members, createdAt: now, updatedAt: now });
  return res.json({ groupId: ref.id });
}));

router.post('/groups/:groupId/add', asyncHandler(async (req, res) => {
  const { userUid } = req.body;
  const ref = db.collection('groups').doc(req.params.groupId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  const g = snap.data();
  if (!(g.adminUids || []).includes(req.user.uid)) return res.status(403).json({ error: 'Forbidden' });
  await ref.update({ participants: admin.firestore.FieldValue.arrayUnion(userUid), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return res.json({ ok: true });
}));

router.post('/groups/:groupId/remove', asyncHandler(async (req, res) => {
  const { userUid } = req.body;
  const ref = db.collection('groups').doc(req.params.groupId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  const g = snap.data();
  if (!(g.adminUids || []).includes(req.user.uid)) return res.status(403).json({ error: 'Forbidden' });
  await ref.update({ participants: admin.firestore.FieldValue.arrayRemove(userUid), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return res.json({ ok: true });
}));

router.post('/groups/:groupId/messages', asyncHandler(async (req, res) => {
  const { text = '', attachments = [] } = req.body;
  const gRef = db.collection('groups').doc(req.params.groupId);
  const gSnap = await gRef.get();
  if (!gSnap.exists) return res.status(404).json({ error: 'Not found' });
  const g = gSnap.data();
  if (!(g.participants || []).includes(req.user.uid)) return res.status(403).json({ error: 'Not in group' });
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = await gRef.collection('messages').add({ senderUid: req.user.uid, text, attachments, timestamp: now });
  return res.json({ messageId: ref.id });
}));

module.exports = router;
