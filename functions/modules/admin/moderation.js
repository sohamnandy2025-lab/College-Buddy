/* admin/moderation.js
   Admin moderation endpoints: ban user, delete post/event, review reports, audit logs
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');

const router = makeRouter();
const db = admin.firestore();

function ensureAdmin(req, res) {
  if (!(req.user && (req.user.role === 'admin' || req.user.admin === true))) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

router.post('/banUser', asyncHandler(async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const { uid } = req.body;
  await admin.auth().updateUser(uid, { disabled: true });
  await db.collection('audit').add({ type: 'banUser', uid, by: req.user.uid, at: admin.firestore.FieldValue.serverTimestamp() });
  res.json({ ok: true });
}));

router.post('/deletePost', asyncHandler(async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const { postId } = req.body;
  await db.collection('posts').doc(postId).delete();
  await db.collection('audit').add({ type: 'deletePost', postId, by: req.user.uid, at: admin.firestore.FieldValue.serverTimestamp() });
  res.json({ ok: true });
}));

router.post('/deleteEvent', asyncHandler(async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const { eventId } = req.body;
  await db.collection('events').doc(eventId).delete();
  await db.collection('audit').add({ type: 'deleteEvent', eventId, by: req.user.uid, at: admin.firestore.FieldValue.serverTimestamp() });
  res.json({ ok: true });
}));

router.get('/reviewReports', asyncHandler(async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const snap = await db.collection('reports').orderBy('createdAt', 'desc').limit(200).get();
  res.json({ reports: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.get('/auditLogs', asyncHandler(async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const snap = await db.collection('audit').orderBy('at', 'desc').limit(200).get();
  res.json({ logs: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

module.exports = router;
