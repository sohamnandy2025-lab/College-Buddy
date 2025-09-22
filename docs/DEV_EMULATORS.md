# Local development with emulators and services

Requirements
- Node.js 20+
- Docker (for Redis)
- Firebase CLI (for emulators)
- gcloud SDK (optional) for Pub/Sub emulator

Start Redis
- docker-compose up -d redis

Firebase emulators (Firestore, Functions, Hosting)
- firebase emulators:start --only firestore,functions,hosting

Pub/Sub emulator (optional)
- gcloud beta emulators pubsub start --host-port=localhost:8085
- export PUBSUB_EMULATOR_HOST=localhost:8085

Environment variables
- functions/.env (or set in your shell / CI):
  - ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY (optional for search triggers)
  - ENFORCE_APPCHECK=true (optional)
  - FIRESTORE_BACKUP_BUCKET=your-bucket (for daily backups)

Services (Cloud Run local dev)
- Messaging: services/messaging (ws + express + redis)
- Feed: services/feed (express + redis + Pub/Sub push)
- Search: services/search (express proxy to Algolia)
- Moderation: services/moderation (express + Pub/Sub push + Perspective API)

Testing
- Each service has Jest + supertest tests (basic health checks). Run `npm test` in each service folder.
