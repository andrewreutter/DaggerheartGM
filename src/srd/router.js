/**
 * SRD sub-application Express router.
 *
 * Mounted at /api/srd in server.js. No auth required — all SRD content is public.
 *
 * Routes:
 *   GET /api/srd/collections              — list available collection names
 *   GET /api/srd/:collection              — paginated list with optional filters
 *   GET /api/srd/:collection/:id          — single item by ID
 */

import { Router } from 'express';
import { COLLECTION_NAMES, getItem, searchCollection } from './parser.js';

const router = Router();

router.get('/collections', (req, res) => {
  res.json({ collections: COLLECTION_NAMES });
});

router.get('/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTION_NAMES.includes(collection)) {
    return res.status(404).json({ error: `Unknown SRD collection: ${collection}` });
  }

  const { search, tier, type } = req.query;
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  try {
    const result = await searchCollection(collection, {
      search: search || '',
      tier: tier || null,
      type: type || null,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    console.error(`GET /api/srd/${collection} error:`, err);
    res.status(500).json({ error: 'Failed to fetch SRD collection' });
  }
});

router.get('/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  if (!COLLECTION_NAMES.includes(collection)) {
    return res.status(404).json({ error: `Unknown SRD collection: ${collection}` });
  }

  try {
    const item = await getItem(collection, id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    console.error(`GET /api/srd/${collection}/${id} error:`, err);
    res.status(500).json({ error: 'Failed to fetch SRD item' });
  }
});

export { router as srdRouter };
