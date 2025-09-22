// realtime/videoRooms.js
// Live audio/video rooms. This module provides controller functions and
// abstracts the signaling layer (to be implemented with a TURN/STUN provider or 3rd-party SDK).

export async function createVideoRoom({ roomId, hostUid, tenantId, admin }) {
  if (!roomId || !hostUid) throw new Error('Missing roomId/hostUid');
  const db = admin.firestore();
  await db.collection('videoRooms').doc(`${tenantId}_${roomId}`).set({
    tenantId, roomId, hostUid, participants: [hostUid], createdAt: new Date(), status: 'open'
  }, { merge: true });
  return { ok: true };
}

export async function joinVideoRoom({ roomId, uid, tenantId, admin }) {
  const db = admin.firestore();
  const ref = db.collection('videoRooms').doc(`${tenantId}_${roomId}`);
  await ref.update({ participants: admin.firestore.FieldValue.arrayUnion(uid) });
  return { ok: true };
}
