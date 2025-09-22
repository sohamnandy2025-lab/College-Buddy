# College Buddy HTTP API (Cloud Functions)

Base URL (after deploy): https://us-central1-<PROJECT_ID>.cloudfunctions.net/api
Auth: Send Firebase ID token in Authorization: Bearer <token>

Profiles
- GET /profiles?college=&branch=&skill=&hobby=&limit=50
- GET /profile/:uid
- POST /profile (body: partial user fields) – updates current user
- DELETE /profile/:uid (admin only)

Connections
- POST /connections/request (body: { toUid })
- POST /connections/accept (body: { requestId })
- POST /connections/reject (body: { requestId })
- GET /connections/:uid

Messaging
- POST /messages (body: { receiverUid, text, attachments })
- GET /messages/conversation/:uid1/:uid2?limit=100
- GET /messages/unread/:uid

Posts
- POST /posts (body: { content, media, tags, visibility })
- PUT /posts/:postId
- DELETE /posts/:postId
- POST /posts/:postId/like
- POST /posts/:postId/comment (body: { text })
- GET /feed?college=&friends=uid1&friends=uid2&limit=30

Events
- POST /events (host/admin)
- PUT /events/:eventId (host/admin)
- DELETE /events/:eventId (host/admin)
- POST /events/:eventId/register
- POST /events/:eventId/unregister
- GET /events?type=&tag=&limit=50

Quizzes
- POST /quizzes (quiz host)
- PUT /quizzes/:quizId (quiz host)
- DELETE /quizzes/:quizId (quiz host)
- GET /quizzes?tag=&limit=50
- POST /quizzes/:quizId/submit (body: { answers: [] })
- GET /quizzes/:quizId/attempts/:userUid

Notifications
- POST /notifications/send (body: { toUid, type, payload })
- GET /notifications/:uid
- PUT /notifications/:notificationId/read

Analytics
- GET /analytics/popularSkills
- GET /analytics/topEvents
- GET /analytics/messagesPerDay

Search
- GET /search/users?q=&college=&branch=&limit=50
- GET /search/events?q=&tag=&limit=50
- GET /search/posts?q=&tag=&limit=50

Push Notifications
- POST /push/send (body: { toUid, type, payload, title, body })
- POST /push/subscribe (body: { token })
- POST /push/unsubscribe (body: { token })

Media
- POST /media/delete (body: { filePath }) – client uploads directly to Storage via SDK; server validates deletions

Notes
- Use Firebase custom claims to set roles (admin, event-host, quiz-host). Admin can set via Admin SDK:
  admin.auth().setCustomUserClaims(uid, { role: 'admin', eventHost: true, quizHost: true });
- Firestore Security Rules are included in /firestore.rules.
- Recommended indexes are in /firestore.indexes.json.
