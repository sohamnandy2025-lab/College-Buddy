# Deployment and DevOps for College Buddy

Prerequisites
- Install Firebase CLI: npm i -g firebase-tools
- Login: firebase login
- Initialize project: firebase init (choose Firestore, Functions, Hosting, Storage)
- Make sure firebase.json, firestore.rules, firestore.indexes.json, storage.rules, functions/ are present (already created).

Local development
- Start emulators:
  firebase emulators:start --only firestore,functions,hosting
- Deploy rules and indexes to emulators automatically from firebase.json.

Deploy to production
- Set your default project: firebase use --add
- Environment config (Functions)
  - Optional: enforce App Check on API: set ENFORCE_APPCHECK=true
  - Optional: set FIRESTORE_BACKUP_BUCKET=your-gcs-bucket-name
  - Example (Linux/macOS):
    firebase functions:config:set env.enforce_appcheck="true" env.firestore_backup_bucket="your-bucket"
  - Or set as deploy-time environment variables in your CI/CD
- Deploy rules and indexes:
  firebase deploy --only firestore:rules,firestore:indexes,storage:rules
- Deploy functions:
  cd functions && npm install && cd ..
  firebase deploy --only functions
- Deploy hosting:
  firebase deploy --only hosting

CI/CD (optional)
- Use GitHub Actions to run lint/tests and deploy on main merges:
  - Set FIREBASE_TOKEN as a GitHub secret (firebase login:ci)
  - Use an action like w9jds/firebase-action to deploy.

Backups
- Schedule exports using gcloud or a Cloud Scheduler job with a backup function.
- Alternatively, use Firebase scheduled backups via GCP Console (Firestore export to Cloud Storage).

Monitoring & Alerts
- Firebase Console > Functions and Firestore metrics: set alerts for error rate, latency, and function invocations.
- Add Google Analytics 4 to your frontend for user behavior.
- Use Cloud Logging (Stackdriver) for server-side logs.

Environment configuration
- For web: keep public Firebase config in client code.
- For Functions: use runtime config for secrets if needed: firebase functions:config:set service.key="..."

Notes
- For FCM in web, set up a service worker (firebase-messaging-sw.js) and VAPID key.
- Ensure CORS is limited if you have known origins.
