// collegeBuddyAdvancedBackend.js
// Frontend-friendly helper that wraps the /api/v2 Cloud Functions endpoints and exposes
// ready-to-use functions. Uses Firebase client Auth token for Authorization.
// Includes examples and real-time listener notes.

// Note: This file focuses on calling the secure HTTP API for write operations
// and uses Firestore listeners for real-time features when appropriate.

export async function getIdToken() {
  // Expect global firebase.auth() in your app, or import from CDN modular SDK
  const user = (window.firebase && window.firebase.auth && window.firebase.auth().currentUser) || null;
  if (!user) throw new Error('Not authenticated');
  return await user.getIdToken();
}

export async function apiFetch(baseUrl, path, options = {}) {
  const token = await getIdToken();
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Users
export const UsersAPI = (baseUrl) => ({
  createOrUpdateProfile: (profile) => apiFetch(baseUrl, '/v2/users', { method: 'POST', body: JSON.stringify(profile) }),
  getUserProfile: (uid) => apiFetch(baseUrl, `/v2/users/${uid}`),
  getAllProfiles: (params = {}) => apiFetch(baseUrl, `/v2/users?${new URLSearchParams(params).toString()}`),
  deleteUser: (uid) => apiFetch(baseUrl, `/v2/users/${uid}`, { method: 'DELETE' }),
  trackLastLogin: (uid) => apiFetch(baseUrl, `/v2/users/${uid}/trackLastLogin`, { method: 'POST' }),
});

// Connections
export const ConnectionsAPI = (baseUrl) => ({
  request: (toUid) => apiFetch(baseUrl, '/v2/connections/request', { method: 'POST', body: JSON.stringify({ toUid }) }),
  accept: (requestId) => apiFetch(baseUrl, '/v2/connections/accept', { method: 'POST', body: JSON.stringify({ requestId }) }),
  reject: (requestId) => apiFetch(baseUrl, '/v2/connections/reject', { method: 'POST', body: JSON.stringify({ requestId }) }),
  remove: (targetUid) => apiFetch(baseUrl, '/v2/connections/remove', { method: 'POST', body: JSON.stringify({ targetUid }) }),
  block: (targetUid) => apiFetch(baseUrl, '/v2/connections/block', { method: 'POST', body: JSON.stringify({ targetUid }) }),
  suggestions: (uid) => apiFetch(baseUrl, `/v2/connections/suggestions/${uid}`)
});

// Posts
export const PostsAPI = (baseUrl) => ({
  createPost: (postObj) => apiFetch(baseUrl, '/v2/posts', { method: 'POST', body: JSON.stringify(postObj) }),
  editPost: (postId, updates) => apiFetch(baseUrl, `/v2/posts/${postId}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deletePost: (postId) => apiFetch(baseUrl, `/v2/posts/${postId}`, { method: 'DELETE' }),
  sharePost: (postId) => apiFetch(baseUrl, `/v2/posts/${postId}/share`, { method: 'POST' }),
  react: (postId, type) => apiFetch(baseUrl, `/v2/reactions/${postId}/react`, { method: 'POST', body: JSON.stringify({ type }) }),
  unreact: (postId) => apiFetch(baseUrl, `/v2/reactions/${postId}/unreact`, { method: 'POST' }),
  addComment: (postId, text, parentId=null) => apiFetch(baseUrl, `/v2/comments/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text, parentId }) }),
  getComments: (postId, params={}) => apiFetch(baseUrl, `/v2/comments/${postId}/comments?${new URLSearchParams(params).toString()}`),
  getFeed: (params={}) => apiFetch(baseUrl, `/feed?${new URLSearchParams(params).toString()}`),
});

// Messaging
export const MessagingAPI = (baseUrl) => ({
  send: (receiverUid, text, attachments=[]) => apiFetch(baseUrl, '/v2/messages', { method: 'POST', body: JSON.stringify({ receiverUid, text, attachments }) }),
  getConversation: (uid1, uid2, params={}) => apiFetch(baseUrl, `/v2/messages/conversation/${uid1}/${uid2}?${new URLSearchParams(params).toString()}`),
  markRead: (messageId) => apiFetch(baseUrl, `/v2/messages/read/${messageId}`, { method: 'POST' }),
  getUnread: (uid) => apiFetch(baseUrl, `/v2/messages/unread/${uid}`)
});

// Events & Quizzes
export const EventsAPI = (baseUrl) => ({
  create: (eventObj) => apiFetch(baseUrl, '/v2/events', { method: 'POST', body: JSON.stringify(eventObj) }),
  register: (eventId) => apiFetch(baseUrl, `/v2/events/${eventId}/register`, { method: 'POST' }),
  attendees: (eventId) => apiFetch(baseUrl, `/v2/events/${eventId}/attendees`),
});

export const QuizzesAPI = (baseUrl) => ({
  create: (quizObj) => apiFetch(baseUrl, '/v2/quizzes', { method: 'POST', body: JSON.stringify(quizObj) }),
  submit: (quizId, answers) => apiFetch(baseUrl, `/v2/quizzes/${quizId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  leaderboard: (quizId) => apiFetch(baseUrl, `/v2/quizzes/${quizId}/leaderboard`),
});

// Notifications
export const NotificationsAPI = (baseUrl) => ({
  list: (uid) => apiFetch(baseUrl, `/v2/notifications/${uid}`),
  markRead: (notificationId) => apiFetch(baseUrl, `/v2/notifications/${notificationId}/read`, { method: 'POST' }),
  sendPush: (payload) => apiFetch(baseUrl, '/push/send', { method: 'POST', body: JSON.stringify(payload) }),
  subscribe: (token) => apiFetch(baseUrl, '/push/subscribe', { method: 'POST', body: JSON.stringify({ token }) }),
  unsubscribe: (token) => apiFetch(baseUrl, '/push/unsubscribe', { method: 'POST', body: JSON.stringify({ token }) }),
});

// Search
export const SearchAPI = (baseUrl) => ({
  users: (params) => apiFetch(baseUrl, `/v2/search/users?${new URLSearchParams(params).toString()}`),
  events: (params) => apiFetch(baseUrl, `/v2/search/events?${new URLSearchParams(params).toString()}`),
  posts: (params) => apiFetch(baseUrl, `/v2/search/posts?${new URLSearchParams(params).toString()}`),
});

// Admin
export const AdminAPI = (baseUrl) => ({
  banUser: (uid) => apiFetch(baseUrl, '/v2/admin/banUser', { method: 'POST', body: JSON.stringify({ uid }) }),
  deletePost: (postId) => apiFetch(baseUrl, '/v2/admin/deletePost', { method: 'POST', body: JSON.stringify({ postId }) }),
  deleteEvent: (eventId) => apiFetch(baseUrl, '/v2/admin/deleteEvent', { method: 'POST', body: JSON.stringify({ eventId }) }),
  reviewReports: () => apiFetch(baseUrl, '/v2/admin/reviewReports'),
  auditLogs: () => apiFetch(baseUrl, '/v2/admin/auditLogs'),
});

// Analytics
export const AnalyticsAPI = (baseUrl) => ({
  popularSkills: () => apiFetch(baseUrl, '/v2/analytics/popularSkills'),
  topEvents: () => apiFetch(baseUrl, '/v2/analytics/topEvents'),
  messagesPerDay: () => apiFetch(baseUrl, '/v2/analytics/messagesPerDay')
});

/* Real-time listeners (client-side, using Firestore client SDK)
   Example for post comments:
   import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
   import { getFirestore, collection, query, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

   const app = initializeApp(firebaseConfig);
   const db = getFirestore(app);
   const q = query(collection(db, 'posts', postId, 'comments'), orderBy('timestamp', 'asc'));
   const unsub = onSnapshot(q, snap => { ... });
*/
