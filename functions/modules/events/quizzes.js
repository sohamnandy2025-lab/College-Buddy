/* events/quizzes.js
   Quizzes: create, submit attempt, leaderboard
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');

const router = makeRouter();
const db = admin.firestore();

router.post('/', asyncHandler(async (req, res) => {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = await db.collection('quizzes').add({ ...req.body, hostUid: req.user.uid, createdAt: now, updatedAt: now });
  return res.json({ quizId: ref.id });
}));

router.post('/:quizId/submit', asyncHandler(async (req, res) => {
  const { answers } = req.body;
  if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers must be array' });
  const qsnap = await db.collection('quizzes').doc(req.params.quizId).get();
  if (!qsnap.exists) return res.status(404).json({ error: 'Quiz not found' });
  const quiz = qsnap.data();
  const questions = quiz.questions || [];
  let score = 0;
  for (let i = 0; i < questions.length; i++) if (answers[i] === questions[i].correctOption) score += Number(questions[i].points || 1);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = await db.collection('quizAttempts').add({ quizId: req.params.quizId, userUid: req.user.uid, answers, score, submittedAt: now });
  return res.json({ attemptId: ref.id, score });
}));

router.get('/:quizId/leaderboard', asyncHandler(async (req, res) => {
  const snap = await db.collection('quizAttempts').where('quizId', '==', req.params.quizId).orderBy('score', 'desc').orderBy('submittedAt', 'asc').limit(50).get();
  return res.json({ leaderboard: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

module.exports = router;
