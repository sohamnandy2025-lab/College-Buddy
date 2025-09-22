import express from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import morgan from 'morgan';

const app = express();
const server = createServer(app);

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryDelayOnFailover: 100,
  retryDelayOnClusterDown: 300,
  maxRetriesPerRequest: 3,
});

// Middleware
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'messaging' }));

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map(); // Map<userId, WebSocket>

wss.on('connection', (ws) => {
  let userId = null;
  
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      switch (msg.type) {
        case 'auth':
          // Simple auth: userId from client (in production, verify JWT)
          userId = msg.userId;
          clients.set(userId, ws);
          console.log(`User ${userId} connected via WebSocket`);
          break;
          
        case 'typing':
          // Typing indicator for conversation
          if (userId && msg.conversationId) {
            const key = `typing:${msg.conversationId}`;
            await redis.setex(key + ':' + userId, 10, '1'); // 10s TTL
            
            // Notify other users in conversation (simple fanout)
            const typingUsers = await redis.keys(`typing:${msg.conversationId}:*`);
            const typingUids = typingUsers.map(k => k.split(':').pop()).filter(u => u !== userId);
            
            // Send to other connected users
            typingUids.forEach(uid => {
              const client = clients.get(uid);
              if (client?.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'typing', conversationId: msg.conversationId, userId }));
              }
            });
          }
          break;
          
        case 'presence':
          // Update presence
          if (userId) {
            await redis.setex(`presence:${userId}`, 60, JSON.stringify({ status: msg.status || 'online', lastSeen: Date.now() }));
          }
          break;
          
        default:
          ws.send(JSON.stringify({ error: 'Unknown message type' }));
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  });
  
  ws.on('close', async () => {
    if (userId) {
      clients.delete(userId);
      await redis.del(`presence:${userId}`);
      console.log(`User ${userId} disconnected`);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Simple message endpoint for testing
app.post('/echo', (req, res) => {
  res.json({ echo: req.body, timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Messaging service listening on port ${PORT}`);
});

export { app, server };