import express from 'express';
import morgan from 'morgan';
import algoliasearch from 'algoliasearch';

const app = express();
app.use(express.json());
app.use(morgan('combined'));

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
let client = null;
if (ALGOLIA_APP_ID && ALGOLIA_API_KEY) {
  client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
}

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'search' }));

function ensureClient(res) {
  if (!client) { res.status(500).json({ error: 'Algolia not configured' }); return false; }
  return true;
}

app.get('/v1/search/:index', async (req, res) => {
  if (!ensureClient(res)) return;
  const { index } = req.params;
  const { q = '', tenantId, page = 0, hitsPerPage = 20 } = req.query;
  const idx = client.initIndex(index);
  const filters = tenantId ? `tenantId:${tenantId}` : undefined;
  const result = await idx.search(String(q), { page: Number(page), hitsPerPage: Number(hitsPerPage), filters });
  res.json(result);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Search service on ${PORT}`));

export default app;
