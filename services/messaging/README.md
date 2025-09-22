# Messaging Service (Cloud Run)

Features
- WebSocket gateway for direct user messaging signals (typing, presence).
- Express REST for health and simple message echo.
- Redis for presence state and pub/sub fanout.

Env vars
- REDIS_URL=redis://host:6379
- AUTH_PUBLIC_KEYS_URL (optional; for JWT verification if you enforce auth at gateway)

Local dev
- npm install
- docker-compose up -d redis
- npm run dev

Deploy (Cloud Run)
- gcloud run deploy messaging-service --source . --region=<REGION> --project=<PROJECT> --platform=managed --allow-unauthenticated
