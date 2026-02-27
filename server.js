import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { runMigrations, getItems, upsertItem, deleteItem } from './src/db.js';
import { validateFCGUrl, scrapeFCG } from './src/fcg-scraper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;
const APP_ID = process.env.APP_ID || 'daggerheart-gm-tool';
const COLLECTIONS = ['adversaries', 'environments', 'groups', 'scenes', 'adventures', 'table_state'];

// --- Firebase Admin (token verification only; no service account key needed) ---
if (!getApps().length) {
  initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}

// --- Auth middleware ---
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  try {
    const decoded = await getAuth().verifyIdToken(header.slice(7));
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid auth token' });
  }
}

app.use(express.json());

// --- Config route (no auth required) ---
app.get('/api/config', (req, res) => {
  res.json({
    firebaseConfig: {
      apiKey:     process.env.FIREBASE_API_KEY     || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId:  process.env.FIREBASE_PROJECT_ID  || '',
      appId:      process.env.FIREBASE_APP_ID      || '',
    },
  });
});

// --- FreshCutGrass.app scrape route ---

app.get('/api/fetch-fcg', requireAuth, async (req, res) => {
  const { url } = req.query;
  if (!url || !validateFCGUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL. Must be https://freshcutgrass.app/homebrew/<username>' });
  }
  try {
    const result = await scrapeFCG(url);
    res.json(result);
  } catch (err) {
    console.error('FCG scrape error:', err);
    res.status(500).json({ error: `Failed to fetch from FreshCutGrass.app: ${err.message}` });
  }
});

// --- Data routes ---

app.get('/api/data', requireAuth, async (req, res) => {
  try {
    const results = await Promise.all(
      COLLECTIONS.map(col => getItems(APP_ID, req.uid, col))
    );
    const data = Object.fromEntries(COLLECTIONS.map((col, i) => [col, results[i]]));
    res.json(data);
  } catch (err) {
    console.error('GET /api/data error:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.put('/api/data/:collection', requireAuth, async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Unknown collection' });
  }
  const item = req.body;
  if (!item || typeof item !== 'object') {
    return res.status(400).json({ error: 'Invalid item body' });
  }
  const id = item.id || crypto.randomUUID();
  const { id: _id, ...data } = item;
  try {
    await upsertItem(APP_ID, req.uid, collection, id, { ...data });
    res.json({ id, ...data });
  } catch (err) {
    console.error(`PUT /api/data/${collection} error:`, err);
    res.status(500).json({ error: 'Failed to save item' });
  }
});

app.delete('/api/data/:collection/:id', requireAuth, async (req, res) => {
  const { collection, id } = req.params;
  if (!COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Unknown collection' });
  }
  try {
    await deleteItem(APP_ID, req.uid, collection, id);
    res.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/data/${collection}/${id} error:`, err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

app.use(express.static(join(__dirname, 'public')));

// SPA fallback — serve index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// --- Startup ---
if (process.env.DATABASE_URL) {
  runMigrations()
    .then(() => {
      app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
    })
    .catch(err => {
      console.error('Migration failed, aborting startup:', err);
      process.exit(1);
    });
} else {
  console.warn('[db] DATABASE_URL not set — running without database');
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}
