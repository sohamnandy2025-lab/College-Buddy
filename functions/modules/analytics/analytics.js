/* analytics/analytics.js
   Analytics read endpoints; writes are via triggers in index.js
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');

const router = makeRouter();
const db = admin.firestore();

router.get('/popularSkills', asyncHandler(async (req, res) => {
  const doc = await db.collection('analytics').doc('popularSkills').get();
  return res.json(doc.exists ? doc.data() : { top: [] });
}));

router.get('/topEvents', asyncHandler(async (req, res) => {
  const doc = await db.collection('analytics').doc('topEvents').get();
  return res.json(doc.exists ? doc.data() : { top: [] });
}));

router.get('/messagesPerDay', asyncHandler(async (req, res) => {
  const doc = await db.collection('analytics').doc('messagesPerDay').get();
  return res.json(doc.exists ? doc.data() : { series: [] });
}));

module.exports = router;
