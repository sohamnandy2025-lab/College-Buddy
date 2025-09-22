/* events/events.js
   Events: create, update, register/unregister, attendees, list
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');
const { Limits } = require('../utils/constants');

const router = makeRouter();
const db = admin.firestore();

// Create event
router.post('/', asyncHandler(async (req, res) => {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const data = {
    ...req.body,
    organizerUid: req.user.uid,
    attendees: [],
    attendeesCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await db.collection('events').add(data);
  return res.json({ eventId: ref.id });
}));

// Update event (organizer or admin)
router.put('/:eventId', asyncHandler(async (req, res) => {
  const ref = db.collection('events').doc(req.params.eventId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  const ev = snap.data();
  const isAdmin = (req.user && (req.user.role === 'admin' || req.user.admin === true));
  if (!isAdmin && ev.organizerUid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
  await ref.update({ ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return res.json({ ok: true });
}));

// Delete event (organizer or admin)
router.delete('/:eventId', asyncHandler(async (req, res) => {
  const ref = db.collection('events').doc(req.params.eventId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  const ev = snap.data();
  const isAdmin = (req.user && (req.user.role === 'admin' || req.user.admin === true));
  if (!isAdmin && ev.organizerUid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
  await ref.delete();
  return res.json({ ok: true });
}));

// Register for event
router.post('/:eventId/register', asyncHandler(async (req, res) => {
  const ref = db.collection('events').doc(req.params.eventId);
  await ref.update({
    attendees: admin.firestore.FieldValue.arrayUnion(req.user.uid),
    attendeesCount: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return res.json({ ok: true });
}));

// Unregister from event
router.post('/:eventId/unregister', asyncHandler(async (req, res) => {
  const ref = db.collection('events').doc(req.params.eventId);
  await ref.update({
    attendees: admin.firestore.FieldValue.arrayRemove(req.user.uid),
    attendeesCount: admin.firestore.FieldValue.increment(-1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return res.json({ ok: true });
}));

// List attendees
router.get('/:eventId/attendees', asyncHandler(async (req, res) => {
  const snap = await db.collection('events').doc(req.params.eventId).get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });
  const attendees = snap.data().attendees || [];
  return res.json({ attendees, count: attendees.length });
}));

// List events with optional filters
router.get('/', asyncHandler(async (req, res) => {
  const { type, tag, limit = Limits.SEARCH_LIMIT } = req.query;
  let ref = db.collection('events');
  if (type) ref = ref.where('type', '==', String(type));
  if (tag) ref = ref.where('tags', 'array-contains', String(tag));
  const snap = await ref.orderBy('dateStart', 'desc').limit(Number(limit)).get();
  return res.json({ events: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

module.exports = router;
