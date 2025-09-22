// collegeBuddyBackend.js
// Modular helper for College Buddy (browser-friendly, works with CDN Firebase SDK)
// - Initialization (App, Auth, Firestore)
// - Users, Connections, Messaging, Events, Quizzes, Notifications, Analytics (client-side helpers)
// - RBAC: enforce on server endpoints; this file performs basic client-side checks, but DO NOT rely on client checks for security
// - Real-time: shows how to attach listeners with onSnapshot
//
// IMPORTANT: For true production security + scale, deploy the Cloud Functions API included in /functions and have the frontend call those endpoints.
// This file is suitable for quick prototypes and read-heavy operations with Firestore Security Rules enforcement.

// Firebase CDN imports (v10+ modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  serverTimestamp,
  Timestamp,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  documentId,
  arrayUnion,
  arrayRemove,
  increment,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

let app = null;
let db = null;
let auth = null;
let googleProvider = null;
let storage = null;
let messaging = null;

export async function initFirebase(config) {
  if (app) return { app, db, auth, googleProvider, storage, messaging };
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  googleProvider = new GoogleAuthProvider();
  // Messaging may not be supported in all browsers/contexts
  if (await isSupported()) {
    messaging = getMessaging(app);
  }
  return { app, db, auth, googleProvider, storage, messaging };
}

// Utility: get current user's custom claims (role, etc.)
export async function getCurrentUserClaims() {
  if (!auth) throw new Error('Firebase not initialized. Call initFirebase first.');
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdTokenResult(true);
  return token.claims || {};
}

// Utility: create deterministic conversation key for two UIDs (sorted underscore)
function convKey(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// ------------------ Users ------------------
export async function getUserProfile(uid) {
  if (!db) throw new Error('Firebase not initialized');
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// filters: { college, branch, skillsAny:[], hobbiesAny:[], limit: number, startAfterId: string }
export async function getAllProfiles(filters = {}) {
  if (!db) throw new Error('Firebase not initialized');
  const col = collection(db, 'users');
  const qs = [];
  if (filters.college) qs.push(where('college', '==', filters.college));
  if (filters.branch) qs.push(where('branch', '==', filters.branch));
  if (filters.skillsAny && filters.skillsAny.length) qs.push(where('skills', 'array-contains-any', filters.skillsAny.slice(0, 10)));
  if (filters.hobbiesAny && filters.hobbiesAny.length) qs.push(where('hobbies', 'array-contains-any', filters.hobbiesAny.slice(0, 10)));
  let qref = query(col, ...qs, orderBy('createdAt', 'desc'), limit(filters.limit || 50));
  // Optional pagination by last doc; you can supply startAfterId
  if (filters.startAfterId) {
    const lastDoc = await getDoc(doc(db, 'users', filters.startAfterId));
    if (lastDoc.exists()) {
      qref = query(col, ...qs, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(filters.limit || 50));
    }
  }
  const snap = await getDocs(qref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createOrUpdateProfile(uid, profileObj) {
  if (!db) throw new Error('Firebase not initialized');
  if (!uid) throw new Error('uid is required');
  const ref = doc(db, 'users', uid);
  const now = serverTimestamp();
  const existing = await getDoc(ref);
  const base = { updatedAt: now };
  if (!existing.exists()) base.createdAt = now;
  await setDoc(ref, { ...profileObj, ...base }, { merge: true });
  return true;
}

export async function deleteUser(uid) {
  // For production, call admin-protected HTTP API instead (Cloud Function)
  if (!db) throw new Error('Firebase not initialized');
  if (!uid) throw new Error('uid is required');
  await deleteDoc(doc(db, 'users', uid));
  return true;
}

// ---------------- Connections ----------------
// Connection document ID is deterministic: convKey(uid1, uid2)
export async function sendConnectionRequest(fromUid, toUid) {
  if (!db) throw new Error('Firebase not initialized');
  const id = convKey(fromUid, toUid);
  const ref = doc(db, 'connections', id);
  const now = serverTimestamp();
  await setDoc(ref, { fromUid, toUid, status: 'pending', createdAt: now, updatedAt: now }, { merge: true });
  return id;
}

export async function acceptConnectionRequest(requestId, actorUid) {
  const ref = doc(db, 'connections', requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found');
  const data = snap.data();
  if (![data.fromUid, data.toUid].includes(actorUid)) throw new Error('Only involved users can accept');
  await updateDoc(ref, { status: 'accepted', updatedAt: serverTimestamp() });
  // Maintain friends lists
  const [a, b] = requestId.split('_');
  await Promise.all([
    updateDoc(doc(db, 'users', a), { friends: arrayUnion(b) }),
    updateDoc(doc(db, 'users', b), { friends: arrayUnion(a) })
  ]);
  return true;
}

export async function rejectConnectionRequest(requestId, actorUid) {
  const ref = doc(db, 'connections', requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found');
  const data = snap.data();
  if (![data.fromUid, data.toUid].includes(actorUid)) throw new Error('Only involved users can reject');
  await updateDoc(ref, { status: 'rejected', updatedAt: serverTimestamp() });
  return true;
}

export async function listFriends(uid) {
  const u = await getDoc(doc(db, 'users', uid));
  if (!u.exists()) return [];
  const friends = u.data().friends || [];
  if (!friends.length) return [];
  const batch = [];
  // Use documentId() IN query in chunks of 10
  for (let i = 0; i < friends.length; i += 10) {
    const chunk = friends.slice(i, i + 10);
    const qref = query(collection(db, 'users'), where(documentId(), 'in', chunk));
    // eslint-disable-next-line no-await-in-loop
    const snap = await getDocs(qref);
    batch.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }
  return batch;
}

// ---------------- Messaging -----------------
export async function sendMessage(senderUid, receiverUid, text, attachments = []) {
  const key = convKey(senderUid, receiverUid);
  const now = serverTimestamp();
  const msg = {
    conversationKey: key,
    senderUid,
    receiverUid,
    text: text || '',
    attachments: attachments || [],
    timestamp: now,
    seen: false
  };
  const ref = await addDoc(collection(db, 'messages'), msg);
  // Optional: also create a notification doc
  await addDoc(collection(db, 'notifications'), {
    toUid: receiverUid,
    type: 'message',
    payload: { fromUid: senderUid, messageId: ref.id },
    read: false,
    createdAt: now
  });
  return ref.id;
}

// options: { limit: 50, startAfterTimestamp: Timestamp }
export async function getConversation(uid1, uid2, options = {}) {
  const key = convKey(uid1, uid2);
  const col = collection(db, 'messages');
  let qref = query(col, where('conversationKey', '==', key), orderBy('timestamp', 'asc'), limit(options.limit || 100));
  if (options.startAfterTimestamp) {
    qref = query(col, where('conversationKey', '==', key), orderBy('timestamp', 'asc'), startAfter(options.startAfterTimestamp), limit(options.limit || 100));
  }
  const snap = await getDocs(qref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getUnreadMessages(uid) {
  const qref = query(collection(db, 'messages'), where('receiverUid', '==', uid), where('seen', '==', false), orderBy('timestamp', 'asc'), limit(100));
  const snap = await getDocs(qref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Real-time listener for a conversation
export function listenConversation(uid1, uid2, callback) {
  const key = convKey(uid1, uid2);
  const qref = query(collection(db, 'messages'), where('conversationKey', '==', key), orderBy('timestamp', 'asc'));
  return onSnapshot(qref, (snap) => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs);
  });
}

// ---------------- Events --------------------
export async function createEvent(eventObj, hostUid) {
  const now = serverTimestamp();
  const ref = await addDoc(collection(db, 'events'), {
    ...eventObj,
    hostUid,
    attendees: [],
    attendeesCount: 0,
    createdAt: now,
    updatedAt: now
  });
  return ref.id;
}

export async function updateEvent(eventId, eventObj) {
  await updateDoc(doc(db, 'events', eventId), { ...eventObj, updatedAt: serverTimestamp() });
  return true;
}

export async function deleteEvent(eventId) {
  await deleteDoc(doc(db, 'events', eventId));
  return true;
}

export async function registerEvent(eventId, userUid) {
  await updateDoc(doc(db, 'events', eventId), { attendees: arrayUnion(userUid), attendeesCount: increment(1), updatedAt: serverTimestamp() });
  return true;
}

export async function unregisterEvent(eventId, userUid) {
  await updateDoc(doc(db, 'events', eventId), { attendees: arrayRemove(userUid), attendeesCount: increment(-1), updatedAt: serverTimestamp() });
  return true;
}

export async function listEvents(filters = {}) {
  const col = collection(db, 'events');
  const qs = [];
  if (filters.type) qs.push(where('type', '==', filters.type));
  if (filters.tag) qs.push(where('tags', 'array-contains', filters.tag));
  let qref = query(col, ...qs, orderBy('dateStart', 'desc'), limit(filters.limit || 50));
  const snap = await getDocs(qref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---------------- Quizzes -------------------
export async function createQuiz(quizObj, hostUid) {
  const now = serverTimestamp();
  const ref = await addDoc(collection(db, 'quizzes'), { ...quizObj, hostUid, createdAt: now, updatedAt: now });
  return ref.id;
}

export async function updateQuiz(quizId, quizObj) {
  await updateDoc(doc(db, 'quizzes', quizId), { ...quizObj, updatedAt: serverTimestamp() });
  return true;
}

export async function deleteQuiz(quizId) {
  await deleteDoc(doc(db, 'quizzes', quizId));
  return true;
}

export async function submitQuizAttempt(quizId, userUid, answers) {
  // Fetch quiz to score
  const qsnap = await getDoc(doc(db, 'quizzes', quizId));
  if (!qsnap.exists()) throw new Error('Quiz not found');
  const quiz = qsnap.data();
  const q = quiz.questions || [];
  let score = 0;
  for (let i = 0; i < q.length; i++) {
    const correct = q[i].correctOption;
    if (answers && answers[i] !== undefined && answers[i] === correct) {
      score += Number(q[i].points || 1);
    }
  }
  const ref = await addDoc(collection(db, 'quizAttempts'), {
    quizId,
    userUid,
    answers: answers || [],
    score,
    submittedAt: serverTimestamp()
  });
  return { attemptId: ref.id, score };
}

export async function getUserQuizAttempts(quizId, userUid) {
  const qref = query(collection(db, 'quizAttempts'), where('quizId', '==', quizId), where('userUid', '==', userUid), orderBy('submittedAt', 'desc'), limit(20));
  const snap = await getDocs(qref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listQuizzes(filters = {}) {
  const qs = [];
  if (filters.tag) qs.push(where('tags', 'array-contains', filters.tag));
  let qref = query(collection(db, 'quizzes'), ...qs, orderBy('createdAt', 'desc'), limit(filters.limit || 50));
  const snap = await getDocs(qref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// -------------- Notifications ---------------
export async function sendNotification(toUid, type, payload) {
  const ref = await addDoc(collection(db, 'notifications'), { toUid, type, payload: payload || {}, read: false, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getNotifications(uid, onlyUnread = false) {
  const qs = [where('toUid', '==', uid)];
  if (onlyUnread) qs.push(where('read', '==', false));
  const qref = query(collection(db, 'notifications'), ...qs, orderBy('createdAt', 'desc'), limit(100));
  const snap = await getDocs(qref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  return true;
}

// ----------------- Analytics ----------------
// These functions read pre-aggregated metrics.
// Maintain these metrics via Cloud Functions triggers for scale.
export async function getPopularSkills(limitN = 10) {
  const snap = await getDoc(doc(db, 'analytics', 'popularSkills'));
  if (!snap.exists()) return [];
  const data = snap.data();
  return (data.top || []).slice(0, limitN);
}

export async function getTopEvents(limitN = 10) {
  const snap = await getDoc(doc(db, 'analytics', 'topEvents'));
  if (!snap.exists()) return [];
  const data = snap.data();
  return (data.top || []).slice(0, limitN);
}

export async function getMessagesPerDay(days = 14) {
  const snap = await getDoc(doc(db, 'analytics', 'messagesPerDay'));
  if (!snap.exists()) return [];
  const data = snap.data();
  return (data.series || []).slice(-days);
}

// -------------------- Posts (Social Feed) --------------------
// Scalable note: We model comments and likes as subcollections for scale:
//   posts/{postId}/comments/{commentId}
//   posts/{postId}/likes/{userUid}
// The post document also keeps denormalized counts: likesCount, commentsCount

export async function createPost(authorUid, content, media = [], tags = [], visibility = 'public') {
  const now = serverTimestamp();
  const post = { authorUid, content, media, tags, visibility, createdAt: now, updatedAt: now, likesCount: 0, commentsCount: 0 };
  const ref = await addDoc(collection(db, 'posts'), post);
  return ref.id;
}

export async function editPost(postId, authorUid, updates) {
  const ref = doc(db, 'posts', postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Post not found');
  const data = snap.data();
  if (data.authorUid !== authorUid) throw new Error('Only author can edit');
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
  return true;
}

export async function deletePost(postId, authorUid) {
  const ref = doc(db, 'posts', postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return true;
  const data = snap.data();
  if (data.authorUid !== authorUid) throw new Error('Only author can delete');
  await deleteDoc(ref);
  // Note: consider background function to cleanup subcollections (comments/likes) for scale
  return true;
}

export async function likePost(postId, userUid) {
  // Create a like doc and increment counter
  await setDoc(doc(db, 'posts', postId, 'likes', userUid), { uid: userUid, createdAt: serverTimestamp() });
  await updateDoc(doc(db, 'posts', postId), { likesCount: increment(1) });
  return true;
}

export async function addComment(postId, commentObj) {
  // commentObj: { uid, text }
  const c = { ...commentObj, timestamp: serverTimestamp() };
  await addDoc(collection(db, 'posts', postId, 'comments'), c);
  await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });
  return true;
}

// Feed strategy:
// - Public posts: visibility == 'public'
// - College posts: visibility == 'college' and same college as user
// - Friends posts: authors in friends[] (query in chunks of 10 with documentId() IN)
export async function getFeed(userUid, filters = {}) {
  const result = [];
  const limitN = filters.limit || 30;

  // 1) Public
  let q1 = query(collection(db, 'posts'), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), limit(Math.min(10, limitN)));
  let s1 = await getDocs(q1);
  result.push(...s1.docs.map(d => ({ id: d.id, ...d.data() })));

  // 2) College
  if (filters.college) {
    const q2 = query(collection(db, 'posts'), where('visibility', '==', 'college'), where('tags', 'array-contains', `college:${filters.college}`), orderBy('createdAt', 'desc'), limit(Math.min(10, limitN)));
    const s2 = await getDocs(q2);
    result.push(...s2.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // 3) Friends (authors IN friends[] in chunks of 10)
  if (filters.friends && filters.friends.length) {
    for (let i = 0; i < filters.friends.length && result.length < limitN; i += 10) {
      const chunk = filters.friends.slice(i, i + 10);
      const q3 = query(collection(db, 'posts'), where('authorUid', 'in', chunk), orderBy('createdAt', 'desc'), limit(Math.min(10, limitN - result.length)));
      // eslint-disable-next-line no-await-in-loop
      const s3 = await getDocs(q3);
      result.push(...s3.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  }
  // Sort client-side by createdAt desc
  return result.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, limitN);
}

export function listenPost(postId, callback) {
  return onSnapshot(doc(db, 'posts', postId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export function listenPostComments(postId, callback) {
  const qref = query(collection(db, 'posts', postId, 'comments'), orderBy('timestamp', 'asc'));
  return onSnapshot(qref, (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function listenPostLikes(postId, callback) {
  const qref = collection(db, 'posts', postId, 'likes');
  return onSnapshot(qref, (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

// -------------------- Advanced Search --------------------
// Basic approach using a precomputed searchIndex array on documents (tokens lowercased)
export async function searchUsers(queryText, filters = {}) {
  const tokens = (queryText || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  let qref = collection(db, 'users');
  if (tokens.length) qref = query(qref, where('searchIndex', 'array-contains-any', tokens));
  const snap = await getDocs(qref);
  let users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (filters.college) users = users.filter(u => u.college === filters.college);
  if (filters.branch) users = users.filter(u => u.branch === filters.branch);
  return users.slice(0, filters.limit || 50);
}

export async function searchEvents(queryText, filters = {}) {
  const tokens = (queryText || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  let qref = collection(db, 'events');
  if (tokens.length) qref = query(qref, where('searchIndex', 'array-contains-any', tokens));
  if (filters.tag) qref = query(qref, where('tags', 'array-contains', filters.tag));
  const snap = await getDocs(qref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, filters.limit || 50);
}

export async function searchPosts(queryText, filters = {}) {
  const tokens = (queryText || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  let qref = collection(db, 'posts');
  if (tokens.length) qref = query(qref, where('searchIndex', 'array-contains-any', tokens));
  const snap = await getDocs(qref);
  let posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (filters.tag) posts = posts.filter(p => (p.tags || []).includes(filters.tag));
  return posts.slice(0, filters.limit || 50);
}

// -------------------- File Uploads --------------------
export async function uploadFile(userUid, file, folder = 'uploads') {
  if (!storage) throw new Error('Storage not initialized');
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const path = `${folder}/${userUid}/${safeName}`;
  const refObj = storageRef(storage, path);
  await uploadBytes(refObj, file, { contentType: file.type });
  const url = await getDownloadURL(refObj);
  return { path, url };
}

export async function deleteFile(filePath) {
  if (!storage) throw new Error('Storage not initialized');
  const refObj = storageRef(storage, filePath);
  await deleteObject(refObj);
  return true;
}

// -------------------- Push Notifications (FCM) --------------------
// Requires Firebase Messaging setup with a VAPID key and service worker for web.
export async function subscribeUserToNotifications(uid, vapidKey) {
  if (!messaging) return null;
  const token = await getToken(messaging, { vapidKey });
  // store token under users/{uid}/fcmTokens/{token}
  await setDoc(doc(db, 'users', uid, 'fcmTokens', token), { token, createdAt: serverTimestamp() });
  return token;
}

export async function unsubscribeUser(uid, token) {
  await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token));
  return true;
}

export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => callback(payload));
}

// -------------------- Analytics helpers --------------------
export async function getUserActivityStats(uid) {
  const docSnap = await getDoc(doc(db, 'analytics', `user_${uid}`));
  return docSnap.exists() ? docSnap.data() : { messages: 0, posts: 0, likes: 0 };
}

export async function getTopPosts(limitN = 10) {
  const qref = query(collection(db, 'posts'), orderBy('likesCount', 'desc'), limit(limitN));
  const snap = await getDocs(qref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// -------------- Real-time hints -------------
// - Profiles list: use getAllProfiles() for initial load; add onSnapshot(...) on users collection for live updates if allowed by rules.
// - Messaging: listenConversation(uid1, uid2, cb) provides real-time messages.
// - Events/quizzes/notifications: attach onSnapshot to their collections based on user role and access.
// - Posts: listenPost, listenPostComments, listenPostLikes for real-time feed interactions.
