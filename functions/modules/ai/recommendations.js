/* ai/recommendations.js
   AI-like recommendations for users, events, and posts using heuristics.
   For production, integrate a proper ML pipeline or a service like Recommendations AI.
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');

const router = makeRouter();
const db = admin.firestore();

router.get('/connections/:uid', asyncHandler(async (req, res) => {
  const uid = req.params.uid;
  const meSnap = await db.collection('users').doc(uid).get();
  if (!meSnap.exists) return res.json({ suggestions: [] });
  const me = meSnap.data();
  const skills = new Set(me.skills || []);
  const hobbies = new Set(me.hobbies || []);
  const myFriends = new Set(me.friends || []);
  const snap = await db.collection('users').where('college', '==', me.college).limit(500).get();
  const arr = [];
  for (const d of snap.docs) {
    if (d.id === uid || myFriends.has(d.id)) continue;
    const u = d.data();
    let score = 0;
    (u.skills || []).forEach(s => { if (skills.has(s)) score += 2; });
    (u.hobbies || []).forEach(h => { if (hobbies.has(h)) score += 1; });
    const mutuals = (u.friends || []).filter(f => myFriends.has(f)).length;
    score += mutuals * 3;
    arr.push({ id: d.id, score, ...u });
  }
  arr.sort((a, b) => b.score - a.score);
  res.json({ suggestions: arr.slice(0, 20) });
}));

router.get('/events/:uid', asyncHandler(async (req, res) => {
  const uid = req.params.uid;
  const meSnap = await db.collection('users').doc(uid).get();
  if (!meSnap.exists) return res.json({ events: [] });
  const me = meSnap.data();
  const skills = new Set(me.skills || []);
  const tags = new Set([...(me.skills || []), ...(me.hobbies || [])]);
  const snap = await db.collection('events').limit(200).get();
  const arr = [];
  for (const d of snap.docs) {
    const e = d.data();
    const overlap = (e.tags || []).filter(t => tags.has(t)).length;
    const score = overlap + ((e.attendees || []).includes(uid) ? -10 : 0);
    arr.push({ id: d.id, score, ...e });
  }
  arr.sort((a, b) => b.score - a.score);
  res.json({ events: arr.slice(0, 20) });
}));

router.get('/posts', asyncHandler(async (req, res) => {
  const snap = await db.collection('posts').orderBy('likesCount', 'desc').limit(50).get();
  res.json({ posts: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

module.exports = router;
