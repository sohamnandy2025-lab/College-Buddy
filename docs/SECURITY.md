# Security & Compliance for College Buddy

Authentication & RBAC
- Use Firebase Auth (Email/Password, Google; add LinkedIn via custom provider flow).
- Set custom claims for roles: admin, event-host, quiz-host.
- Enforce coarse controls in Firestore Rules; fine-grained checks in Functions endpoints.

Input validation
- Validate payloads in Functions before writes. Enforce types and size limits (e.g., comment length, media count).
- Sanitize text displayed in UI to prevent XSS.

Rate limiting
- Use Firebase App Check + reCAPTCHA on clients.
- Server: basic per-instance throttling included in functions/index.js (augment with Cloud Armor/API gateways or Redis if needed).

Storage security
- Storage rules restrict writes to owner folders. Avoid public write paths.
- Generate thumbnails on upload (optional Cloud Function) and store secure URLs.

Data protection
- Encryption at rest (Firebase managed) and TLS in transit (HTTPS).
- Avoid storing secrets in Firestore. Use Functions runtime config for server secrets.

Access logging
- Use Cloud Logging; retain logs per policy and set alerts for anomalies.
- Enable Firebase App Check in client and set ENFORCE_APPCHECK=true for APIs if desired.
- Enable multi-factor auth (MFA) in Firebase Auth for elevated roles.

Backup & retention
- Automate Firestore exports to Cloud Storage.
- Plan retention for analytics and notifications to control costs.

Vulnerability management
- Keep dependencies updated; scan with Dependabot/GitHub advisories.
- Use eslint and TypeScript in functions for safety (optional upgrade).
