/* users/profile.js
   User profile endpoints: create/update, read, list, delete (admin), track last login
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');
const { Limits } = require('../utils/constants');
const { requireFields } = require('../utils/validation');

const router = makeRouter();
const db = admin.firestore();

router.get('/:uid', asyncHandler(async (req, res) => {
  const snap = await db.collection('users').doc(req.params.uid).get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  return res.json({ id: snap.id, ...snap.data() });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { college, branch, limit = Limits.SEARCH_LIMIT } = req.query;
  let ref = db.collection('users');
  if (college) ref = ref.where('college', '==', String(college));
  if (branch) ref = ref.where('branch', '==', String(branch));
  const snap = await ref.orderBy('createdAt', 'desc').limit(Number(limit)).get();
  return res.json({ users: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const body = req.body || {};
  const ref = db.collection('users').doc(uid);
  const cur = await ref.get();
  const now = admin.firestore.FieldValue.serverTimestamp();
  body.updatedAt = now;
  if (!cur.exists) body.createdAt = now;
  await ref.set(body, { merge: true });
  return res.json({ ok: true });
}));

router.delete('/:uid', asyncHandler(async (req, res) => {
  if (!(req.user && (req.user.role === 'admin' || req.user.admin === true))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await db.collection('users').doc(req.params.uid).delete();
  return res.json({ ok: true });
}));

router.post('/:uid/trackLastLogin', asyncHandler(async (req, res) => {
  const { uid } = req.params;
  if (uid !== req.user.uid && !(req.user && (req.user.role === 'admin' || req.user.admin === true))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await db.collection('users').doc(uid).set({ lastLogin: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return res.json({ ok: true });
}));

module.exports = router;
