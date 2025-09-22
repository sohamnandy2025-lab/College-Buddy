# Search Service (Cloud Run)

Features
- Proxies search requests to Algolia indices (users, posts, events).
- Adds multi-tenant filters (tenantId) and basic paging.

Env vars
- ALGOLIA_APP_ID
- ALGOLIA_API_KEY (search-only key recommended)

Local dev
- npm install
- npm run dev

Deploy
- gcloud run deploy search-service --source . --region=<REGION> --project=<PROJECT> --platform=managed --allow-unauthenticated
