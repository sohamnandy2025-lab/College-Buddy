/* posts/posts.js
   Post CRUD, sharing, feed
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');
const { assertVisibility, nonEmptyString, safeArray } = require('../utils/validation');
const { Limits } = require('../utils/constants');

const router = makeRouter();
const db = admin.firestore();

router.post('/', asyncHandler(async (req, res) => {
  const { content = '', media = [], tags = [], visibility = 'public' } = req.body;
  nonEmptyString(content, 'content');
  assertVisibility(visibility);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const data = { authorUid: req.user.uid, content, media: safeArray(media), tags: safeArray(tags), visibility, likesCount: 0, commentsCount: 0, sharesCount: 0, createdAt: now, updatedAt: now };
  const ref = await db.collection('posts').add(data);
  return res.json({ postId: ref.id });
}));

router.put('/:postId', asyncHandler(async (req, res) => {
  const ref = db.collection('posts').doc(req.params.postId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  const post = snap.data();
  if (post.authorUid !== req.user.uid && !(req.user.role === 'admin' || req.user.admin === true)) return res.status(403).json({ error: 'Forbidden' });
  await ref.update({ ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return res.json({ ok: true });
}));

router.delete('/:postId', asyncHandler(async (req, res) => {
  const ref = db.collection('posts').doc(req.params.postId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  const post = snap.data();
  if (post.authorUid !== req.user.uid && !(req.user.role === 'admin' || req.user.admin === true)) return res.status(403).json({ error: 'Forbidden' });
  await ref.delete();
  return res.json({ ok: true });
}));

router.post('/:postId/share', asyncHandler(async (req, res) => {
  const ref = db.collection('posts').doc(req.params.postId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  await ref.update({ sharesCount: admin.firestore.FieldValue.increment(1) });
  // Optional: create a lightweight share record under users/{uid}/shares
  return res.json({ ok: true });
}));

router.get('/feed', asyncHandler(async (req, res) => {
  // For brevity, reuse earlier feed logic via /feed endpoint in root index; here provide a minimal feed
  const lim = Number(req.query.limit || Limits.FEED_PAGE);
  const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(lim).get();
  return res.json({ posts: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

module.exports = router;
