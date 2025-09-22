// ai/personalization.js
// Hyper-personalization functions: personalized feed generation, embeddings, A/B tests
// Firestore collections used: userEmbeddings, feedScores, abTests
// This module is stateless; pass in clients via params for testability.

import { FieldValue } from 'firebase-admin/firestore';

// generatePersonalizedFeed: compute a contextual feed for a user
// Inputs: { uid, tenantId, mood, redis, admin }
// Returns: { feed: [...], modelVersion, algorithm, context }
export async function generatePersonalizedFeed({ uid, tenantId, mood, redis, admin }) {
  if (!uid) throw new Error('Missing uid');
  const db = admin.firestore();

  // Try Redis cache first (short TTL personalized feed head)
  const cacheKey = `pfeed:${tenantId}:${uid}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return { feed: JSON.parse(cached), modelVersion: 'cached', algorithm: 'last-good', context: { mood } };
  }

  // Fetch user embedding and recent activity for context-aware ranking
  const embSnap = await db.collection('userEmbeddings').doc(`${tenantId}_${uid}`).get();
  const embedding = embSnap.exists ? embSnap.data().vector : null;

  // Simple placeholder scoring: pull precomputed feedScores for this user/tenant and apply mood/time boost
  const scoresSnap = await db.collection('feedScores').where('tenantId', '==', tenantId).where('uid', '==', uid).orderBy('score', 'desc').limit(50).get();
  let items = scoresSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Context boost example
  const hour = new Date().getHours();
  const isEvening = hour >= 18 || hour < 6;
  items = items.map(x => ({ ...x, score: x.score + (mood === 'excited' ? 0.1 : 0) + (isEvening ? 0.05 : 0) }));
  items.sort((a, b) => b.score - a.score);

  // Store in Redis briefly (e.g., 60s)
  await redis.set(cacheKey, JSON.stringify(items.slice(0, 30)), 'EX', 60);

  return { feed: items.slice(0, 30), modelVersion: 'v1', algorithm: 'contextual-rank', context: { mood, hour } };
}

// updateUserEmbeddings: update user embedding based on new activity
// Inputs: { uid, tenantId, activity, admin, driver }
export async function updateUserEmbeddings({ uid, tenantId, activity, admin, driver }) {
  if (!uid) throw new Error('Missing uid');
  const db = admin.firestore();

  // Placeholder: Update a simple count vector; in production call a model service
  const ref = db.collection('userEmbeddings').doc(`${tenantId}_${uid}`);
  await ref.set({
    tenantId, uid,
    vector: activity?.vector || [],
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // Optionally update graph properties in Neo4j for recommendations
  try {
    const session = driver.session();
    await session.executeWrite(tx => tx.run(
      'MERGE (u:User {uid: $uid, tenantId: $tenantId}) SET u.lastEmbeddingAt = timestamp()',
      { uid, tenantId }
    ));
    await session.close();
  } catch (e) {
    // Log and continue; do not fail the request
    console.warn('Neo4j embedding update failed', e);
  }
}

// runFeedABTest: create or update an A/B test config
// Inputs: { tenantId, algorithmA, algorithmB, admin }
export async function runFeedABTest({ tenantId, algorithmA, algorithmB, admin }) {
  if (!tenantId || !algorithmA || !algorithmB) throw new Error('Missing A/B params');
  const db = admin.firestore();
  const ref = db.collection('abTests').doc(`feed_${tenantId}`);
  const config = { tenantId, algorithmA, algorithmB, updatedAt: FieldValue.serverTimestamp() };
  await ref.set(config, { merge: true });
  return config;
}
