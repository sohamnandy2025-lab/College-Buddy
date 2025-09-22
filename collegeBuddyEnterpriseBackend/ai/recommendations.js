// ai/recommendations.js
// Higher-level recommendations orchestrator: friend/event/post using embeddings and graph.

import algoliasearch from 'algoliasearch';

export async function recommendFriends({ uid, tenantId, admin, driver, limit = 20 }) {
  const session = driver.session();
  try {
    const result = await session.executeRead(tx => tx.run(
      `MATCH (u:User {uid: $uid, tenantId: $tenantId})-[:FRIEND*1..2]-(f:User)
       WHERE f.uid <> $uid
       WITH f, count(*) AS mutuals
       RETURN f.uid as uid, mutuals ORDER BY mutuals DESC LIMIT $limit`,
      { uid, tenantId, limit }
    ));
    return result.records.map(r => ({ uid: r.get('uid'), mutuals: r.get('mutuals') }))
  } finally { await session.close(); }
}

export async function recommendEvents({ uid, tenantId, admin, limit = 20 }) {
  const db = admin.firestore();
  const snap = await db.collection('feedScores')
    .where('tenantId', '==', tenantId)
    .where('uid', '==', uid)
    .where('type', '==', 'event')
    .orderBy('score', 'desc').limit(limit).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function recommendPosts({ uid, tenantId, admin, limit = 30 }) {
  const db = admin.firestore();
  const snap = await db.collection('feedScores')
    .where('tenantId', '==', tenantId)
    .where('uid', '==', uid)
    .where('type', '==', 'post')
    .orderBy('score', 'desc').limit(limit).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
