# Feed Service (Cloud Run)

Features
- REST endpoints to fetch personalized feed from Redis cache.
- Pub/Sub push endpoint to update cached feeds and trending lists on post/events.
- Multi-tenant via tenantId in cache keys.

Env vars
- REDIS_URL=redis://host:6379
- PUBSUB_VERIFICATION_TOKEN=secret-string

Local dev
- docker-compose up -d redis
- npm run dev

Deploy (Cloud Run)
- gcloud run deploy feed-service --source . --region=<REGION> --project=<PROJECT> --platform=managed --allow-unauthenticated
