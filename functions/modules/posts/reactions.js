/* posts/reactions.js
   Reactions: like, love, clap, wow — one reaction per user; track counts
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');
const { assertReaction } = require('../utils/validation');

const router = makeRouter();
const db = admin.firestore();

router.post('/:postId/react', asyncHandler(async (req, res) => {
  const { type } = req.body;
  assertReaction(type);
  const postId = req.params.postId;
  const reactRef = db.collection('posts').doc(postId).collection('reactions').doc(req.user.uid);
  await reactRef.set({ uid: req.user.uid, type, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  // Denormalized counts per type
  await db.collection('posts').doc(postId).set({ [`reactions.${type}`]: admin.firestore.FieldValue.increment(1) }, { merge: true });
  return res.json({ ok: true });
}));

router.post('/:postId/unreact', asyncHandler(async (req, res) => {
  const postId = req.params.postId;
  const reactRef = db.collection('posts').doc(postId).collection('reactions').doc(req.user.uid);
  const snap = await reactRef.get();
  if (!snap.exists) return res.json({ ok: true });
  const prev = snap.data();
  await reactRef.delete();
  if (prev && prev.type) {
    await db.collection('posts').doc(postId).set({ [`reactions.${prev.type}`]: admin.firestore.FieldValue.increment(-1) }, { merge: true });
  }
  return res.json({ ok: true });
}));

module.exports = router;
