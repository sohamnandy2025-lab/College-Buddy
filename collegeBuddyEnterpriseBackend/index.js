import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';
import Redis from 'ioredis';
import neo4j from 'neo4j-driver';

// Initialize Firebase Admin (use Application Default Credentials or service account)
try { admin.app(); } catch { admin.initializeApp(); }

// Create global clients
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password')
);

// Simple request-scoped context (multi-tenancy, request ID, tracing)
function contextMiddleware(req, _res, next) {
  req.ctx = {
    requestId: req.header('x-request-id') || uuidv4(),
    tenantId: req.header('x-tenant-id') || 'global',
    userId: req.header('x-user-id') || null
  };
  next();
}

const app = express();
app.use(pinoHttp());
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(contextMiddleware);

// Security short-circuit: minimal zero-trust style check placeholder
app.use((req, res, next) => {
  // In production, verify Firebase ID token or mTLS between services
  // Optionally validate App Check headers if coming from client apps
  next();
});

// Health endpoint
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'enterprise-backend', requestId: req.ctx.requestId }));

// Import module routers or handlers
import { generatePersonalizedFeed, updateUserEmbeddings, runFeedABTest } from './ai/personalization.js';
import * as recs from './ai/recommendations.js';
import * as videoRooms from './realtime/videoRooms.js';
import * as collab from './realtime/collabEditing.js';
import * as adminDash from './realtime/adminDashboard.js';
import * as cache from './cache/redisCache.js';
import * as tenant from './tenant/tenantIsolation.js';
import * as authz from './security/auth.js';
import * as audit from './security/audit.js';

// Example endpoints (pattern for mounting)
app.post('/v2/ai/feed', async (req, res, next) => {
  try {
    const uid = req.body?.uid || req.ctx.userId;
    const mood = req.body?.mood || null;
    const data = await generatePersonalizedFeed({ uid, tenantId: req.ctx.tenantId, mood, redis, admin });
    res.json({ requestId: req.ctx.requestId, ...data });
  } catch (e) { next(e); }
});

app.post('/v2/ai/embeddings/update', async (req, res, next) => {
  try {
    const uid = req.body?.uid || req.ctx.userId;
    const activity = req.body?.activity || {};
    await updateUserEmbeddings({ uid, tenantId: req.ctx.tenantId, activity, admin, driver });
    res.json({ ok: true, requestId: req.ctx.requestId });
  } catch (e) { next(e); }
});

app.post('/v2/ai/feed/abtest', async (req, res, next) => {
  try {
    const { algorithmA, algorithmB } = req.body || {};
    const test = await runFeedABTest({ tenantId: req.ctx.tenantId, algorithmA, algorithmB, admin });
    res.json({ ok: true, test, requestId: req.ctx.requestId });
  } catch (e) { next(e); }
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  req.log?.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Server error', requestId: req.ctx?.requestId, detail: process.env.NODE_ENV === 'production' ? undefined : String(err) });
});

const PORT = process.env.PORT || 8090;
app.listen(PORT, () => {
  console.log(`Enterprise backend listening on ${PORT}`);
});

export { app, redis, driver };