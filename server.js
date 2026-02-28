import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { runMigrations, getItems, getSrdItems, getPublicItems, upsertItem, deleteItem } from './src/db.js';
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

// --- Rolz session management ---

// In-memory cache: uid -> { cookie, expiresAt }
const rolzSessions = new Map();
const ROLZ_SESSION_TTL = 30 * 60 * 1000; // 30 minutes

async function rolzLogin(username, password) {
  // Form field is "nick", hidden field "action" is required
  const body = new URLSearchParams({ action: 'signin', nick: username, password, whence: '', t: '' });
  const res = await fetch('https://rolz.org/join/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('Rolz login failed — no session cookie returned');
  // Take only the first name=value pair; avoid splitting on commas inside expires dates
  const cookie = setCookie.split(';')[0].trim();
  return cookie;
}

async function getRolzSession(uid, username, password) {
  const cached = rolzSessions.get(uid);
  if (cached && Date.now() < cached.expiresAt) return cached.cookie;
  const cookie = await rolzLogin(username, password);
  rolzSessions.set(uid, { cookie, expiresAt: Date.now() + ROLZ_SESSION_TTL });
  return cookie;
}

// --- Rolz API proxies ---

app.get('/api/rolz-roomlog', requireAuth, async (req, res) => {
  const { room } = req.query;
  if (!room) {
    return res.status(400).json({ error: 'room parameter is required' });
  }
  try {
    const rolzRes = await fetch(`https://rolz.org/api/roomlog?room=${encodeURIComponent(room)}`);
    const body = await rolzRes.text();
    try {
      const parsed = JSON.parse(body);
      res.json(parsed);
    } catch {
      res.json({ raw: body });
    }
  } catch (err) {
    console.error('Rolz roomlog proxy error:', err);
    res.status(500).json({ error: `Failed to reach Rolz.org: ${err.message}` });
  }
});

app.post('/api/rolz-post', requireAuth, async (req, res) => {
  const { room, text, from, rolzUsername, rolzPassword } = req.body;
  if (!room || !text) {
    return res.status(400).json({ error: 'room and text are required' });
  }
  if (!rolzUsername || !rolzPassword) {
    return res.status(400).json({ error: 'rolzUsername and rolzPassword are required' });
  }
  const postToRolz = async (cookie) => {
    const params = new URLSearchParams({ room, text });
    if (from) params.set('from', from);
    return fetch(`https://rolz.org/api/post?${params}`, { headers: { Cookie: cookie } });
  };
  try {
    let cookie = await getRolzSession(req.uid, rolzUsername, rolzPassword);
    let rolzRes = await postToRolz(cookie);
    let body = await rolzRes.text();
    // If session expired, invalidate cache and retry once with a fresh login
    if (body.includes('Invalid account name')) {
      rolzSessions.delete(req.uid);
      cookie = await getRolzSession(req.uid, rolzUsername, rolzPassword);
      rolzRes = await postToRolz(cookie);
      body = await rolzRes.text();
    }
    try {
      res.json(JSON.parse(body));
    } catch {
      res.json({ raw: body });
    }
  } catch (err) {
    console.error('Rolz proxy error:', err);
    res.status(500).json({ error: `Failed to reach Rolz.org: ${err.message}` });
  }
});

// --- Data routes ---

app.get('/api/data', requireAuth, async (req, res) => {
  const includeSrd = req.query.includeSrd === '1';
  const includePublic = req.query.includePublic === '1';
  try {
    const results = await Promise.all(
      COLLECTIONS.map(col => getItems(APP_ID, req.uid, col))
    );
    const data = Object.fromEntries(COLLECTIONS.map((col, i) => [col, results[i].map(item => ({ ...item, _source: 'own' }))]));

    if (includeSrd) {
      const srdCollections = ['adversaries', 'environments'];
      const srdResults = await Promise.all(srdCollections.map(col => getSrdItems(APP_ID, col)));
      srdCollections.forEach((col, i) => {
        data[col] = [...data[col], ...srdResults[i]];
      });
    }

    if (includePublic) {
      const publicResults = await Promise.all(
        COLLECTIONS.map(col => getPublicItems(APP_ID, req.uid, col))
      );
      COLLECTIONS.forEach((col, i) => {
        if (data[col]) data[col] = [...data[col], ...publicResults[i]];
      });
    }

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
  const { id: _id, is_public, _source, _owner, ...rest } = item;
  try {
    await upsertItem(APP_ID, req.uid, collection, id, { ...rest }, Boolean(is_public));
    res.json({ id, ...rest, is_public: Boolean(is_public), _source: 'own' });
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
