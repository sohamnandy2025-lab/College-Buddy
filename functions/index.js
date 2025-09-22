/* Cloud Functions HTTP API for College Buddy
 - Auth via Firebase ID token (Authorization: Bearer <token>)
 - RBAC via custom claims (role = admin | event-host | quiz-host | user)
 - Endpoints correspond to the required API surface
*/

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

try { admin.initializeApp(); } catch (e) {}
const db = admin.firestore();
const messaging = admin.messaging();
const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();

// Firestore Admin client for backups
const { v1: FirestoreAdmin } = require('@google-cloud/firestore');
const firestoreAdminClient = new FirestoreAdmin.FirestoreAdminClient();

// Mount advanced modular API under /v2 (keeps earlier endpoints intact)
const v2Router = require('./modules');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Simple per-instance rate limiting (best-effort; complement with App Check)
const rateMap = new Map();
const WINDOW_MS = 10_000; // 10s
const MAX_REQ = 60; // 60 requests per 10s per uid
app.use((req, res, next) => {
  try {
    const uid = (req.user && req.user.uid) || req.ip || 'anon';
    const now = Date.now();
    let entry = rateMap.get(uid);
    if (!entry || now - entry.start > WINDOW_MS) {
      entry = { start: now, count: 0 };
    }
    entry.count += 1;
    rateMap.set(uid, entry);
    if (entry.count > MAX_REQ) return res.status(429).json({ error: 'Too many requests' });
  } catch (e) { /* ignore */ }
  return next();
});

// App Check verification (optional, controlled by env ENFORCE_APPCHECK=true)
async function verifyAppCheck(req, res, next) {
  try {
    if (process.env.ENFORCE_APPCHECK === 'true') {
      const token = req.header('X-Firebase-AppCheck');
      if (!token) return res.status(401).json({ error: 'Missing App Check token' });
      await admin.appCheck().verifyToken(token);
    }
    return next();
  } catch (e) {
    functions.logger.warn('App Check verification failed', e);
    return res.status(401).json({ error: 'Invalid App Check token' });
  }
}

// All /v2 routes require App Check (optional) + Auth
app.use('/v2', verifyAppCheck, verifyAuth, v2Router);

// Admin router under /v2/admin (mounted from v2 modules)
app.use('/v2/admin', verifyAuth, require('./modules/admin/moderation'));
app.use('/v2/admin/roles', verifyAuth, require('./modules/admin/roles'));

// Global error handler
app.use((err, req, res, next) => {
  functions.logger.error('Unhandled error', { err: err.stack || String(err) });
  res.status(500).json({ error: 'Server error' });
});

// ---------- Middleware ----------
async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing Authorization header' });
    const decoded = await admin.auth().verifyIdToken(token, true);
    req.user = decoded; // contains uid, email, email_verified, role (custom claim), etc.
    next();
  } catch (err) {
    console.error('Auth error', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function isAdmin(req) {
  return req.user && (req.user.role === 'admin' || req.user.admin === true);
}
function isEventHost(req) {
  return isAdmin(req) || (req.user && (req.user.role === 'event-host' || req.user.eventHost === true));
}
function isQuizHost(req) {
  return isAdmin(req) || (req.user && (req.user.role === 'quiz-host' || req.user.quizHost === true));
}

function convKey(a, b) {
  return [a, b].sort().join('_');
}

function requireBodyFields(req, res, fields) {
  for (const f of fields) {
    if (req.body[f] === undefined) return res.status(400).json({ error: `Missing field: ${f}` });
  }
}

// ---------- Profiles ----------
app.get('/profiles', verifyAuth, async (req, res) => {
  try {
    const { college, branch, skill, hobby, limit: lim = 50 } = req.query;
    let ref = db.collection('users');
    if (college) ref = ref.where('college', '==', college);
    if (branch) ref = ref.where('branch', '==', branch);
    if (skill) ref = ref.where('skills', 'array-contains', String(skill));
    if (hobby) ref = ref.where('hobbies', 'array-contains', String(hobby));
    const snap = await ref.orderBy('createdAt', 'desc').limit(Number(lim)).get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ users });
  } catch (e) {
    console.error(e); return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/profile/:uid', verifyAuth, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.params.uid).get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    return res.json({ id: snap.id, ...snap.data() });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.post('/profile', verifyAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const body = req.body || {};
    body.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    const ref = db.collection('users').doc(uid);
    const cur = await ref.get();
    if (!cur.exists) body.createdAt = admin.firestore.FieldValue.serverTimestamp();
    await ref.set(body, { merge: true });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.delete('/profile/:uid', verifyAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    await db.collection('users').doc(req.params.uid).delete();
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

// ---------- Connections ----------
app.post('/connections/request', verifyAuth, async (req, res) => {
  try {
    const { toUid } = req.body;
    if (!toUid) return res.status(400).json({ error: 'toUid required' });
    const id = convKey(req.user.uid, toUid);
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('connections').doc(id).set({ fromUid: req.user.uid, toUid, status: 'pending', createdAt: now, updatedAt: now }, { merge: true });
    return res.json({ id });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.post('/connections/accept', verifyAuth, async (req, res) => {
  try {
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
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.post('/connections/reject', verifyAuth, async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'requestId required' });
    const ref = db.collection('connections').doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const data = snap.data();
    if (![data.fromUid, data.toUid].includes(req.user.uid)) return res.status(403).json({ error: 'Forbidden' });
    await ref.update({ status: 'rejected', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.get('/connections/:uid', verifyAuth, async (req, res) => {
  try {
    // Read friends array from user doc
    const u = await db.collection('users').doc(req.params.uid).get();
    if (!u.exists) return res.json({ friends: [] });
    const friends = u.data().friends || [];
    if (!friends.length) return res.json({ friends: [] });
    const chunks = [];
    for (let i = 0; i < friends.length; i += 10) chunks.push(friends.slice(i, i + 10));
    const results = [];
    for (const ch of chunks) {
      const snap = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', ch).get();
      results.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    return res.json({ friends: results });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

// ---------- Messaging ----------
app.post('/messages', verifyAuth, async (req, res) => {
  try {
    const { receiverUid, text = '', attachments = [] } = req.body;
    if (!receiverUid) return res.status(400).json({ error: 'receiverUid required' });
    const key = convKey(req.user.uid, receiverUid);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const data = { conversationKey: key, senderUid: req.user.uid, receiverUid, text, attachments, timestamp: now, seen: false };
    const ref = await db.collection('messages').add(data);
    await db.collection('notifications').add({ toUid: receiverUid, type: 'message', payload: { fromUid: req.user.uid, messageId: ref.id }, read: false, createdAt: now });
    // Publish Pub/Sub event for messaging
    try {
      await pubsub.topic('collegebuddy.events.messageSent').publishMessage({ json: { eventType: 'messageSent', messageId: ref.id, senderUid: req.user.uid, receiverUid, tenantId: req.user.tenantId || null, occurredAt: new Date().toISOString() } });
    } catch (e) { functions.logger.warn('PubSub publish messageSent failed', e); }
    return res.json({ messageId: ref.id });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.get('/messages/conversation/:uid1/:uid2', verifyAuth, async (req, res) => {
  try {
    const key = convKey(req.params.uid1, req.params.uid2);
    const lim = Number(req.query.limit || 100);
    let ref = db.collection('messages').where('conversationKey', '==', key).orderBy('timestamp', 'asc').limit(lim);
    const snap = await ref.get();
    return res.json({ messages: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.get('/messages/unread/:uid', verifyAuth, async (req, res) => {
  try {
    const uid = req.params.uid;
    if (uid !== req.user.uid && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const snap = await db.collection('messages').where('receiverUid', '==', uid).where('seen', '==', false).orderBy('timestamp', 'asc').limit(100).get();
    return res.json({ messages: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

// ---------- Events ----------
app.post('/events', verifyAuth, async (req, res) => {
  try {
    if (!isEventHost(req)) return res.status(403).json({ error: 'Forbidden' });
    const now = admin.firestore.FieldValue.serverTimestamp();
    const data = { ...req.body, hostUid: req.user.uid, attendees: [], attendeesCount: 0, createdAt: now, updatedAt: now };
    const ref = await db.collection('events').add(data);
    return res.json({ eventId: ref.id });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.put('/events/:eventId', verifyAuth, async (req, res) => {
  try {
    const ref = db.collection('events').doc(req.params.eventId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const data = snap.data();
    if (!(isEventHost(req) && data.hostUid === req.user.uid) && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    await ref.update({ ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.delete('/events/:eventId', verifyAuth, async (req, res) => {
  try {
    if (!isEventHost(req) && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    await db.collection('events').doc(req.params.eventId).delete();
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.post('/events/:eventId/register', verifyAuth, async (req, res) => {
  try {
    const ref = db.collection('events').doc(req.params.eventId);
    await ref.update({ attendees: admin.firestore.FieldValue.arrayUnion(req.user.uid), attendeesCount: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    try {
      await pubsub.topic('collegebuddy.events.eventRegistered').publishMessage({ json: { eventType: 'eventRegistered', eventId: req.params.eventId, userUid: req.user.uid, tenantId: req.user.tenantId || null, occurredAt: new Date().toISOString() } });
    } catch (e) { functions.logger.warn('PubSub publish eventRegistered failed', e); }
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.post('/events/:eventId/unregister', verifyAuth, async (req, res) => {
  try {
    const ref = db.collection('events').doc(req.params.eventId);
    await ref.update({ attendees: admin.firestore.FieldValue.arrayRemove(req.user.uid), attendeesCount: admin.firestore.FieldValue.increment(-1), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.get('/events', verifyAuth, async (req, res) => {
  try {
    const { type, tag, limit: lim = 50 } = req.query;
    let ref = db.collection('events');
    if (type) ref = ref.where('type', '==', type);
    if (tag) ref = ref.where('tags', 'array-contains', String(tag));
    const snap = await ref.orderBy('dateStart', 'desc').limit(Number(lim)).get();
    return res.json({ events: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

// ---------- Quizzes ----------
app.post('/quizzes', verifyAuth, async (req, res) => {
  try {
    if (!isQuizHost(req)) return res.status(403).json({ error: 'Forbidden' });
    const now = admin.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection('quizzes').add({ ...req.body, hostUid: req.user.uid, createdAt: now, updatedAt: now });
    return res.json({ quizId: ref.id });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.put('/quizzes/:quizId', verifyAuth, async (req, res) => {
  try {
    const ref = db.collection('quizzes').doc(req.params.quizId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const q = snap.data();
    if (!(isQuizHost(req) && q.hostUid === req.user.uid) && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    await ref.update({ ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.delete('/quizzes/:quizId', verifyAuth, async (req, res) => {
  try {
    if (!isQuizHost(req) && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    await db.collection('quizzes').doc(req.params.quizId).delete();
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.get('/quizzes', verifyAuth, async (req, res) => {
  try {
    const { tag, limit: lim = 50 } = req.query;
    let ref = db.collection('quizzes');
    if (tag) ref = ref.where('tags', 'array-contains', String(tag));
    const snap = await ref.orderBy('createdAt', 'desc').limit(Number(lim)).get();
    return res.json({ quizzes: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.post('/quizzes/:quizId/submit', verifyAuth, async (req, res) => {
  try {
    const { answers } = req.body;
    if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers must be an array' });
    const qsnap = await db.collection('quizzes').doc(req.params.quizId).get();
    if (!qsnap.exists) return res.status(404).json({ error: 'Quiz not found' });
    const quiz = qsnap.data();
    const questions = quiz.questions || [];
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      if (answers[i] === questions[i].correctOption) score += Number(questions[i].points || 1);
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection('quizAttempts').add({ quizId: req.params.quizId, userUid: req.user.uid, answers, score, submittedAt: now });
    return res.json({ attemptId: ref.id, score });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.get('/quizzes/:quizId/attempts/:userUid', verifyAuth, async (req, res) => {
  try {
    if (req.params.userUid !== req.user.uid && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const snap = await db.collection('quizAttempts').where('quizId', '==', req.params.quizId).where('userUid', '==', req.params.userUid).orderBy('submittedAt', 'desc').limit(20).get();
    return res.json({ attempts: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

// ---------- Notifications ----------
app.post('/notifications/send', verifyAuth, async (req, res) => {
  try {
    const { toUid, type, payload = {} } = req.body;
    if (!toUid || !type) return res.status(400).json({ error: 'toUid and type required' });
    const ref = await db.collection('notifications').add({ toUid, type, payload, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.json({ notificationId: ref.id });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

// Push notifications via FCM
app.post('/push/send', verifyAuth, async (req, res) => {
  try {
    const { toUid, type, payload = {}, title = 'College Buddy', body = '' } = req.body;
    if (!toUid || !type) return res.status(400).json({ error: 'toUid and type required' });
    const tokensSnap = await db.collection('users').doc(toUid).collection('fcmTokens').get();
    const tokens = tokensSnap.docs.map(d => d.id);
    if (!tokens.length) return res.json({ sent: 0 });
    const msg = {
      tokens,
      notification: { title, body },
      data: { type: String(type), ...Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, String(v)])) }
    };
    const resp = await messaging.sendEachForMulticast(msg);
    return res.json({ sent: resp.successCount, failed: resp.failureCount });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.post('/push/subscribe', verifyAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    await db.collection('users').doc(req.user.uid).collection('fcmTokens').doc(token).set({ token, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.post('/push/unsubscribe', verifyAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    await db.collection('users').doc(req.user.uid).collection('fcmTokens').doc(token).delete();
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.get('/notifications/:uid', verifyAuth, async (req, res) => {
  try {
    const uid = req.params.uid;
    if (uid !== req.user.uid && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const snap = await db.collection('notifications').where('toUid', '==', uid).orderBy('createdAt', 'desc').limit(100).get();
    return res.json({ notifications: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.put('/notifications/:notificationId/read', verifyAuth, async (req, res) => {
  try {
    const ref = db.collection('notifications').doc(req.params.notificationId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const n = snap.data();
    if (n.toUid !== req.user.uid && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    await ref.update({ read: true });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

// ---------- Analytics (reads) ----------
app.get('/analytics/popularSkills', verifyAuth, async (req, res) => {
  try {
    const doc = await db.collection('analytics').doc('popularSkills').get();
    return res.json(doc.exists ? doc.data() : { top: [] });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.get('/analytics/topEvents', verifyAuth, async (req, res) => {
  try {
    const doc = await db.collection('analytics').doc('topEvents').get();
    return res.json(doc.exists ? doc.data() : { top: [] });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.get('/analytics/messagesPerDay', verifyAuth, async (req, res) => {
  try {
    const doc = await db.collection('analytics').doc('messagesPerDay').get();
    return res.json(doc.exists ? doc.data() : { series: [] });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

// ---------- Posts API ----------
app.post('/posts', verifyAuth, async (req, res) => {
  try {
    const { content = '', media = [], tags = [], visibility = 'public' } = req.body;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection('posts').add({ authorUid: req.user.uid, content, media, tags, visibility, createdAt: now, updatedAt: now, likesCount: 0, commentsCount: 0 });
    // Publish Pub/Sub event for feed processing and moderation
    try {
      await pubsub.topic('collegebuddy.events.postCreated').publishMessage({ json: { eventType: 'postCreated', postId: ref.id, authorUid: req.user.uid, tenantId: req.user.tenantId || null, tags, visibility, occurredAt: new Date().toISOString() } });
    } catch (e) { functions.logger.warn('PubSub publish postCreated failed', e); }
    return res.json({ postId: ref.id });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.put('/posts/:postId', verifyAuth, async (req, res) => {
  try {
    const ref = db.collection('posts').doc(req.params.postId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const post = snap.data();
    if (post.authorUid !== req.user.uid && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    await ref.update({ ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.delete('/posts/:postId', verifyAuth, async (req, res) => {
  try {
    const ref = db.collection('posts').doc(req.params.postId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const post = snap.data();
    if (post.authorUid !== req.user.uid && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    await ref.delete();
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.post('/posts/:postId/like', verifyAuth, async (req, res) => {
  try {
    const likeRef = db.collection('posts').doc(req.params.postId).collection('likes').doc(req.user.uid);
    await likeRef.set({ uid: req.user.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    await db.collection('posts').doc(req.params.postId).update({ likesCount: admin.firestore.FieldValue.increment(1) });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.post('/posts/:postId/comment', verifyAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    await db.collection('posts').doc(req.params.postId).collection('comments').add({ uid: req.user.uid, text, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    await db.collection('posts').doc(req.params.postId).update({ commentsCount: admin.firestore.FieldValue.increment(1) });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

// Feeds (basic query strategy)
app.get('/feed', verifyAuth, async (req, res) => {
  try {
    const lim = Number(req.query.limit || 30);
    const college = req.query.college;
    const friends = Array.isArray(req.query.friends) ? req.query.friends : [];
    const result = [];
    let snap = await db.collection('posts').where('visibility', '==', 'public').orderBy('createdAt', 'desc').limit(Math.min(10, lim)).get();
    result.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    if (college) {
      const s2 = await db.collection('posts').where('visibility', '==', 'college').where('tags', 'array-contains', `college:${college}`).orderBy('createdAt', 'desc').limit(Math.min(10, lim)).get();
      result.push(...s2.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    for (let i = 0; i < friends.length && result.length < lim; i += 10) {
      const chunk = friends.slice(i, i + 10);
      const s3 = await db.collection('posts').where('authorUid', 'in', chunk).orderBy('createdAt', 'desc').limit(Math.min(10, lim - result.length)).get();
      result.push(...s3.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    result.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    return res.json({ posts: result.slice(0, lim) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

// ---------- Search API (precomputed searchIndex) ----------
app.get('/search/users', verifyAuth, async (req, res) => {
  try {
    const { q = '', college, branch, limit: lim = 50 } = req.query;
    const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
    let ref = db.collection('users');
    if (terms.length) ref = ref.where('searchIndex', 'array-contains-any', terms);
    if (college) ref = ref.where('college', '==', college);
    if (branch) ref = ref.where('branch', '==', branch);
    const snap = await ref.limit(Number(lim)).get();
    return res.json({ users: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.get('/search/events', verifyAuth, async (req, res) => {
  try {
    const { q = '', tag, limit: lim = 50 } = req.query;
    const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
    let ref = db.collection('events');
    if (terms.length) ref = ref.where('searchIndex', 'array-contains-any', terms);
    if (tag) ref = ref.where('tags', 'array-contains', String(tag));
    const snap = await ref.limit(Number(lim)).get();
    return res.json({ events: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

app.get('/search/posts', verifyAuth, async (req, res) => {
  try {
    const { q = '', tag, limit: lim = 50 } = req.query;
    const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
    let ref = db.collection('posts');
    if (terms.length) ref = ref.where('searchIndex', 'array-contains-any', terms);
    if (tag) ref = ref.where('tags', 'array-contains', String(tag));
    const snap = await ref.orderBy('createdAt', 'desc').limit(Number(lim)).get();
    return res.json({ posts: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

// ---------- Media management (delete) ----------
// Uploads should be done directly from client to Storage with Security Rules.
app.post('/media/delete', verifyAuth, async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath required' });
    // Validate ownership by path prefix (e.g., uploads/<uid>/... or posts/<postId>/<uid>/...)
    const allowed = filePath.startsWith(`uploads/${req.user.uid}/`) || filePath.includes(`/${req.user.uid}/`);
    if (!allowed && !isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    // Deletion happens client-side with Storage SDK; server can run GCS deletion if needed.
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
});

exports.api = functions.region('us-central1').https.onRequest(app);

// ---------- Schedulers (Cloud Scheduler / PubSub) ----------
// Daily Firestore backup to GCS. Set env FIRESTORE_BACKUP_BUCKET=your-gcs-bucket
exports.dailyBackup = functions.pubsub.schedule('every 24 hours').timeZone('UTC').onRun(async () => {
  try {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    const bucket = process.env.FIRESTORE_BACKUP_BUCKET;
    if (!bucket) {
      functions.logger.warn('Skipping backup: FIRESTORE_BACKUP_BUCKET not set');
      return null;
    }
    const databaseName = firestoreAdminClient.databasePath(projectId, '(default)');
    const prefix = `gs://${bucket}/firestore-exports/export_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const [op] = await firestoreAdminClient.exportDocuments({ name: databaseName, outputUriPrefix: prefix, collectionIds: [] });
    functions.logger.info('Started Firestore export', { operation: op.name, prefix });
    return null;
  } catch (e) {
    functions.logger.error('Backup failed', e);
    return null;
  }
});

// Scheduled notifications dispatcher: send any notifications with scheduledAt <= now and not sent
exports.scheduledNotifications = functions.pubsub.schedule('every 5 minutes').timeZone('UTC').onRun(async () => {
  try {
    const now = admin.firestore.Timestamp.now();
    const snap = await db.collection('notifications')
      .where('scheduledAt', '<=', now)
      .where('sent', '==', false)
      .limit(200)
      .get();
    for (const d of snap.docs) {
      const n = d.data();
      const tokensSnap = await db.collection('users').doc(n.toUid).collection('fcmTokens').get();
      const tokens = tokensSnap.docs.map(t => t.id);
      if (tokens.length) {
        await messaging.sendEachForMulticast({
          tokens,
          notification: { title: n.title || 'College Buddy', body: n.message || '' },
          data: { type: String(n.type || 'info'), link: String(n.link || '') }
        });
      }
      await d.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    functions.logger.info('Scheduled notifications processed', { count: snap.size });
    return null;
  } catch (e) { functions.logger.error('Scheduled notifications error', e); return null; }
});

// Weekly leaderboard reset (snapshot current leaderboard, then reset totals)
exports.weeklyLeaderboardReset = functions.pubsub.schedule('every sunday 00:00').timeZone('UTC').onRun(async () => {
  try {
    const pointsCol = db.collection('gamification').doc('points').collection('users');
    const snap = await pointsCol.orderBy('total', 'desc').limit(1000).get();
    const weekDoc = db.collection('gamification').doc('leaderboards').collection('weeks').doc(new Date().toISOString().slice(0,10));
    await weekDoc.set({ top: snap.docs.map(d => ({ uid: d.id, total: d.data().total || 0 })) });
    const batch = db.batch();
    snap.docs.forEach(d => batch.set(pointsCol.doc(d.id), { total: 0 }, { merge: true }));
    await batch.commit();
    functions.logger.info('Leaderboard reset complete');
    return null;
  } catch (e) { functions.logger.error('Leaderboard reset error', e); return null; }
});

// Event reminders: notify attendees for events starting within next hour
exports.eventReminders = functions.pubsub.schedule('every 15 minutes').timeZone('UTC').onRun(async () => {
  try {
    const now = Date.now();
    const soon = now + 60*60*1000;
    const snap = await db.collection('events')
      .where('dateStart', '>=', new Date(now))
      .where('dateStart', '<=', new Date(soon))
      .limit(200)
      .get();
    for (const d of snap.docs) {
      const e = d.data();
      const attendees = e.attendees || [];
      for (const uid of attendees) {
        const tokensSnap = await db.collection('users').doc(uid).collection('fcmTokens').get();
        const tokens = tokensSnap.docs.map(t => t.id);
        if (tokens.length) {
          await messaging.sendEachForMulticast({
            tokens,
            notification: { title: 'Event Reminder', body: `${e.title} starts soon` },
            data: { type: 'eventReminder', eventId: d.id }
          });
        }
      }
    }
    functions.logger.info('Event reminders sent', { events: snap.size });
    return null;
  } catch (e) { functions.logger.error('Event reminders error', e); return null; }
});

// ---------- Triggers (Aggregation examples) ----------
// Algolia sync triggers (optional; requires ALGOLIA_APP_ID and ALGOLIA_ADMIN_KEY)
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
let algolia = null;
if (ALGOLIA_APP_ID && ALGOLIA_ADMIN_KEY) {
  algolia = require('algoliasearch')(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
}

function algoliaIndex(name) { return algolia ? algolia.initIndex(name) : null; }

exports.searchSyncUsers = functions.firestore.document('users/{uid}').onWrite(async (change, ctx) => {
  if (!algolia) return null;
  const index = algoliaIndex('users');
  if (!change.after.exists) { await index.deleteObject(ctx.params.uid); return null; }
  const data = change.after.data();
  await index.saveObject({ objectID: ctx.params.uid, name: data.name || '', college: data.college || '', branch: data.branch || '', skills: data.skills || [], hobbies: data.hobbies || [], tenantId: data.tenantId || null });
  return null;
});

exports.searchSyncPosts = functions.firestore.document('posts/{postId}').onWrite(async (change, ctx) => {
  if (!algolia) return null;
  const index = algoliaIndex('posts');
  if (!change.after.exists) { await index.deleteObject(ctx.params.postId); return null; }
  const p = change.after.data();
  await index.saveObject({ objectID: ctx.params.postId, content: p.content || '', tags: p.tags || [], authorUid: p.authorUid, tenantId: p.tenantId || null, visibility: p.visibility || 'public', createdAt: p.createdAt ? p.createdAt.toMillis?.() : Date.now() });
  return null;
});

exports.searchSyncEvents = functions.firestore.document('events/{eventId}').onWrite(async (change, ctx) => {
  if (!algolia) return null;
  const index = algoliaIndex('events');
  if (!change.after.exists) { await index.deleteObject(ctx.params.eventId); return null; }
  const e = change.after.data();
  await index.saveObject({ objectID: ctx.params.eventId, title: e.title || '', tags: e.tags || [], dateStart: e.dateStart ? +new Date(e.dateStart) : null, tenantId: e.tenantId || null });
  return null;
});

exports.onMessageCreate = functions.firestore.document('messages/{messageId}').onCreate(async (snap) => {
  try {
    const date = new Date();
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
    const ref = db.collection('analytics').doc('messagesPerDay');
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.exists ? doc.data() : { series: [] };
      const idx = data.series.findIndex((p) => p.day === day);
      if (idx >= 0) data.series[idx].count += 1; else data.series.push({ day, count: 1 });
      tx.set(ref, data, { merge: true });
    });
  } catch (e) { functions.logger.error('Aggregation error', e); }
});

// When a connection is accepted, update social graph analytics
exports.onConnectionUpdate = functions.firestore.document('connections/{id}').onUpdate(async (change) => {
  try {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status !== 'accepted' && after.status === 'accepted') {
      const [a, b] = change.after.id.split('_');
      const ref = db.collection('analytics').doc('socialGraph');
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        const data = doc.exists ? doc.data() : { edges: 0 };
        data.edges = (data.edges || 0) + 1;
        tx.set(ref, data, { merge: true });
      });
    }
  } catch (e) { functions.logger.error('onConnectionUpdate error', e); }
});

// Track event registrations for topEvents analytics
exports.onEventWrite = functions.firestore.document('events/{eventId}').onWrite(async (change) => {
  try {
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return;
    const ref = db.collection('analytics').doc('topEvents');
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      let data = doc.exists ? doc.data() : { top: [] };
      const idx = data.top.findIndex((e) => e.eventId === change.after.id);
      const attendees = (after.attendees || []).length;
      if (idx >= 0) data.top[idx].attendees = attendees; else data.top.push({ eventId: change.after.id, attendees });
      data.top.sort((x, y) => y.attendees - x.attendees);
      data.top = data.top.slice(0, 50);
      tx.set(ref, data, { merge: true });
    });
  } catch (e) { functions.logger.error('onEventWrite error', e); }
});

// Maintain quiz analytics on attempt
exports.onQuizAttemptCreate = functions.firestore.document('quizAttempts/{id}').onCreate(async (snap) => {
  try {
    const a = snap.data();
    const ref = db.collection('analytics').doc(`quiz_${a.quizId}`);
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.exists ? doc.data() : { attempts: 0, avgScore: 0 };
      const total = (data.attempts || 0) * (data.avgScore || 0) + (a.score || 0);
      data.attempts = (data.attempts || 0) + 1;
      data.avgScore = total / data.attempts;
      tx.set(ref, data, { merge: true });
    });
  } catch (e) { functions.logger.error('onQuizAttemptCreate error', e); }
});

// Maintain per-user activity and post aggregates
exports.onPostCreate = functions.firestore.document('posts/{postId}').onCreate(async (snap, ctx) => {
  try {
    const p = snap.data();
    const userRef = db.collection('analytics').doc(`user_${p.authorUid}`);
    await db.runTransaction(async (tx) => {
      const docu = await tx.get(userRef);
      const data = docu.exists ? docu.data() : { messages: 0, posts: 0, likes: 0 };
      data.posts = (data.posts || 0) + 1;
      tx.set(userRef, data, { merge: true });
    });
  } catch (e) { console.error('onPostCreate error', e); }
});

exports.onLikeCreate = functions.firestore.document('posts/{postId}/likes/{uid}').onCreate(async (snap, ctx) => {
  try {
    const uid = snap.id;
    const userRef = db.collection('analytics').doc(`user_${uid}`);
    await db.runTransaction(async (tx) => {
      const docu = await tx.get(userRef);
      const data = docu.exists ? docu.data() : { messages: 0, posts: 0, likes: 0 };
      data.likes = (data.likes || 0) + 1;
      tx.set(userRef, data, { merge: true });
    });
  } catch (e) { console.error('onLikeCreate error', e); }
});
