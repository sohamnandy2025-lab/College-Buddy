/* users/connections.js
   Connection requests, acceptance, rejection, remove, block, suggestions
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler, convKey, chunk } = require('../utils/helpers');

const router = makeRouter();
const db = admin.firestore();

router.post('/request', asyncHandler(async (req, res) => {
  const { toUid } = req.body;
  if (!toUid) return res.status(400).json({ error: 'toUid required' });
  const id = convKey(req.user.uid, toUid);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('connections').doc(id).set({ fromUid: req.user.uid, toUid, status: 'pending', createdAt: now, updatedAt: now }, { merge: true });
  return res.json({ requestId: id });
}));

router.post('/accept', asyncHandler(async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ error: 'requestId required' });
  const ref = db.collection('connections').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  const data = snap.data();
  if (![data.fromUid, data.toUid].includes(req.user.uid)) return res.status(403).json({ error: 'Forbidden' });
  await ref.update({ status: 'accepted', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  const [a, b] = requestId.split('_');
  await Promise.all([
    db.collection('users').doc(a).update({ friends: admin.firestore.FieldValue.arrayUnion(b) }),
    db.collection('users').doc(b).update({ friends: admin.firestore.FieldValue.arrayUnion(a) })
  ]);
  return res.json({ ok: true });
}));

router.post('/reject', asyncHandler(async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ error: 'requestId required' });
  const ref = db.collection('connections').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  const data = snap.data();
  if (![data.fromUid, data.toUid].includes(req.user.uid)) return res.status(403).json({ error: 'Forbidden' });
  await ref.update({ status: 'rejected', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return res.json({ ok: true });
}));

router.post('/remove', asyncHandler(async (req, res) => {
  const { targetUid } = req.body;
  const id = convKey(req.user.uid, targetUid);
  await db.collection('connections').doc(id).delete();
  await Promise.all([
    db.collection('users').doc(req.user.uid).update({ friends: admin.firestore.FieldValue.arrayRemove(targetUid) }),
    db.collection('users').doc(targetUid).update({ friends: admin.firestore.FieldValue.arrayRemove(req.user.uid) })
  ]);
  return res.json({ ok: true });
}));

router.post('/block', asyncHandler(async (req, res) => {
  const { targetUid } = req.body;
  const id = convKey(req.user.uid, targetUid);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('connections').doc(id).set({ fromUid: req.user.uid, toUid: targetUid, status: 'blocked', updatedAt: now }, { merge: true });
  return res.json({ ok: true });
}));

router.get('/suggestions/:uid', asyncHandler(async (req, res) => {
  // Simple AI-like heuristic: same college/branch, overlapping skills/hobbies, mutual connections
  const uid = req.params.uid;
  const u = await db.collection('users').doc(uid).get();
  if (!u.exists) return res.json({ suggestions: [] });
  const me = u.data();
  const skills = me.skills || [];
  const hobbies = me.hobbies || [];
  let ref = db.collection('users').where('college', '==', me.college).where('branch', '==', me.branch);
  const snap = await ref.limit(200).get();
  const candidate = [];
  const myFriends = new Set(me.friends || []);
  for (const d of snap.docs) {
    if (d.id === uid) continue;
    const x = d.data();
    const overlap = (x.skills || []).filter(s => skills.includes(s)).length + (x.hobbies || []).filter(h => hobbies.includes(h)).length;
    const mutuals = (x.friends || []).filter(f => myFriends.has(f)).length;
    candidate.push({ id: d.id, score: overlap * 2 + mutuals * 3, ...x });
  }
  candidate.sort((a, b) => b.score - a.score);
  return res.json({ suggestions: candidate.slice(0, 20) });
}));

module.exports = router;
