import express from 'express';
import Redis from 'ioredis';
import morgan from 'morgan';

const app = express();
app.use(express.json());
app.use(morgan('combined'));

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const PORT = process.env.PORT || 8080;

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'feed' }));

// Get personalized feed head from Redis
app.get('/v1/feed/:tenantId/:uid', async (req, res) => {
  const { tenantId, uid } = req.params;
  const key = `feed:${tenantId}:${uid}`;
  const data = await redis.get(key);
  if (!data) return res.status(204).end();
  res.json(JSON.parse(data));
});

// Pub/Sub push handler to update feeds
app.post('/pubsub/feed-events', async (req, res) => {
  // Basic verification
  const token = req.header('x-pubsub-token');
  if (process.env.PUBSUB_VERIFICATION_TOKEN && token !== process.env.PUBSUB_VERIFICATION_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const message = req.body?.message;
    const payload = message?.data ? JSON.parse(Buffer.from(message.data, 'base64').toString()) : null;
    if (!payload) return res.status(400).json({ error: 'Invalid Pub/Sub message' });

    switch (payload.eventType) {
      case 'postCreated': {
        // Prepend to author’s friends feed heads (simplified demo: just mark trending)
        const tenantId = payload.tenantId || 'global';
        const trendingKey = `trending:${tenantId}`;
        // Maintain a simple list (cap at 100)
        const trending = JSON.parse((await redis.get(trendingKey)) || '[]');
        trending.unshift({ postId: payload.postId, ts: Date.now() });
        await redis.set(trendingKey, JSON.stringify(trending.slice(0, 100)));
        break;
      }
      case 'eventRegistered': {
        // could update attendee-based recommendations cache
        break;
      }
      default:
        break;
    }
    res.status(204).end();
  } catch (e) {
    console.error('feed-events error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => console.log(`Feed service listening on ${PORT}`));

export default app;
