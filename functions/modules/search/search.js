/* search/search.js
   Precomputed searchIndex search for users, posts, events
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');
const { Limits } = require('../utils/constants');

const router = makeRouter();
const db = admin.firestore();

router.get('/users', asyncHandler(async (req, res) => {
  const { q = '', college, branch, limit = Limits.SEARCH_LIMIT } = req.query;
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  let ref = db.collection('users');
  if (terms.length) ref = ref.where('searchIndex', 'array-contains-any', terms);
  if (college) ref = ref.where('college', '==', college);
  if (branch) ref = ref.where('branch', '==', branch);
  const snap = await ref.limit(Number(limit)).get();
  return res.json({ users: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.get('/events', asyncHandler(async (req, res) => {
  const { q = '', tag, limit = Limits.SEARCH_LIMIT } = req.query;
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  let ref = db.collection('events');
  if (terms.length) ref = ref.where('searchIndex', 'array-contains-any', terms);
  if (tag) ref = ref.where('tags', 'array-contains', String(tag));
  const snap = await ref.limit(Number(limit)).get();
  return res.json({ events: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.get('/posts', asyncHandler(async (req, res) => {
  const { q = '', tag, limit = Limits.SEARCH_LIMIT } = req.query;
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  let ref = db.collection('posts');
  if (terms.length) ref = ref.where('searchIndex', 'array-contains-any', terms);
  if (tag) ref = ref.where('tags', 'array-contains', String(tag));
  const snap = await ref.orderBy('createdAt', 'desc').limit(Number(limit)).get();
  return res.json({ posts: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

module.exports = router;
