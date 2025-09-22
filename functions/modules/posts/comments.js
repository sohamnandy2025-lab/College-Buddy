/* posts/comments.js
   Nested comments support: comments and replies subcollection
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');
const { nonEmptyString } = require('../utils/validation');
const { Limits } = require('../utils/constants');

const router = makeRouter();
const db = admin.firestore();

router.post('/:postId/comments', asyncHandler(async (req, res) => {
  const { text, parentId } = req.body;
  nonEmptyString(text, 'text');
  const now = admin.firestore.FieldValue.serverTimestamp();
  if (parentId) {
    // reply to a comment
    await db.collection('posts').doc(req.params.postId).collection('comments').doc(parentId)
      .collection('replies').add({ uid: req.user.uid, text, timestamp: now });
  } else {
    await db.collection('posts').doc(req.params.postId).collection('comments').add({ uid: req.user.uid, text, timestamp: now });
    await db.collection('posts').doc(req.params.postId).update({ commentsCount: admin.firestore.FieldValue.increment(1) });
  }
  return res.json({ ok: true });
}));

router.get('/:postId/comments', asyncHandler(async (req, res) => {
  const lim = Number(req.query.limit || Limits.COMMENTS_PAGE);
  const snap = await db.collection('posts').doc(req.params.postId).collection('comments').orderBy('timestamp', 'asc').limit(lim).get();
  return res.json({ comments: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

module.exports = router;
