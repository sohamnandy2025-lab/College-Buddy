# Advanced Backend Overview (v2)

Base URL after deploy: https://us-central1-<PROJECT_ID>.cloudfunctions.net/api/v2
Auth: Firebase ID token in Authorization: Bearer <token>

Modules and routes
- Users: /users
  - GET /users/:uid
  - GET /users?college=&branch=&limit=
  - POST /users (createOrUpdateProfile)
  - DELETE /users/:uid (admin)
  - POST /users/:uid/trackLastLogin
- Connections: /connections
  - POST /connections/request
  - POST /connections/accept
  - POST /connections/reject
  - POST /connections/remove
  - POST /connections/block
  - GET /connections/suggestions/:uid
- Posts: /posts
  - POST /posts
  - PUT /posts/:postId
  - DELETE /posts/:postId
  - POST /posts/:postId/share
  - GET /posts/feed?limit=
- Reactions: /reactions
  - POST /reactions/:postId/react (body: { type: like|love|clap|wow })
  - POST /reactions/:postId/unreact
- Comments: /comments
  - POST /comments/:postId/comments (body: { text, parentId? })
  - GET /comments/:postId/comments?limit=
- Messaging: /messages
  - POST /messages
  - GET /messages/conversation/:uid1/:uid2?limit=
  - POST /messages/read/:messageId
  - GET /messages/unread/:uid
- Events: /events
  - POST /events
  - POST /events/:eventId/register
  - GET /events/:eventId/attendees
- Quizzes: /quizzes
  - POST /quizzes
  - POST /quizzes/:quizId/submit
  - GET /quizzes/:quizId/leaderboard
- Notifications: /notifications
  - GET /notifications/:uid
  - POST /notifications/:notificationId/read
- Gamification: /gamification
  - POST /gamification/points/award { userUid, actionType, points }
  - GET  /gamification/points/total/:uid
  - POST /gamification/badges/award { userUid, badgeType }
  - GET  /gamification/badges/:uid
  - GET  /gamification/leaderboards/points?limit=
- Analytics: /analytics
  - GET /analytics/popularSkills
  - GET /analytics/topEvents
  - GET /analytics/messagesPerDay
- Search: /search
  - GET /search/users?q=&college=&branch=&limit=
  - GET /search/events?q=&tag=&limit=
  - GET /search/posts?q=&tag=&limit=
- AI: /ai
  - GET /ai/connections/:uid
  - GET /ai/events/:uid
  - GET /ai/posts
- Storage: /storage
  - POST /storage/delete { filePath }
- Admin: /admin
  - POST /admin/banUser { uid }
  - POST /admin/deletePost { postId }
  - POST /admin/deleteEvent { eventId }
  - GET  /admin/reviewReports
  - GET  /admin/auditLogs

Frontend helper
- Use collegeBuddyAdvancedBackend.js to call v2 endpoints with an ID token.

Real-time
- Use Firestore client listeners for chat, posts/comments, notifications badges.

Security
- Firestore rules cover users, connections, messages, events, quizzes, notifications, posts (with comments/replies/reactions), and FCM tokens.
- Admin actions are server-only endpoints.

Deployment
- See docs/DEPLOYMENT.md for Firebase CLI steps.
- Scheduled jobs created in Functions (requires Cloud Scheduler enabled in GCP):
  - dailyBackup (Firestore export) – set FIRESTORE_BACKUP_BUCKET
  - scheduledNotifications – sends due notifications every 5 minutes
  - weeklyLeaderboardReset – snapshots and resets points every Sunday 00:00 UTC
  - eventReminders – notifies attendees for events starting within 60 minutes
- App Check
  - Set ENFORCE_APPCHECK=true to require X-Firebase-AppCheck on /v2 APIs
