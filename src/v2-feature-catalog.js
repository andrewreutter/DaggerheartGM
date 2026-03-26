/**
 * V2 feature catalog for Library `features` tab — loads generated JSON (no DB).
 * @see scripts/gen-v2-feature-catalog.mjs
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, 'features-v2/generated/feature-catalog.json');

let cachedRows = null;

function loadRows() {
  if (cachedRows) return cachedRows;
  const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  cachedRows = Array.isArray(raw.rows) ? raw.rows : [];
  return cachedRows;
}

/** @typedef {{ search?: string, featScope?: string[], sort?: string, tiers?: number[] }} FeatureCatalogQuery */

function matchesSearch(row, q) {
  if (!q) return true;
  const hay = `${row.name || ''}\n${row.description || ''}\n${row._parentName || ''}\n${row._scope || ''}`.toLowerCase();
  return hay.includes(q);
}

function matchesScope(row, featScope) {
  if (!featScope || featScope.length === 0) return true;
  return featScope.includes(row._scope);
}

function matchesTier(row, tiers) {
  if (!tiers || tiers.length === 0) return true;
  const t = row.tier;
  if (t === undefined || t === null || t === '') return false;
  return tiers.includes(Number(t));
}

function cmpName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
}

function sortRows(rows, sort) {
  const out = [...rows];
  if (sort === 'popularity') {
    out.sort((a, b) => {
      const pa = (a.clone_count || 0) + (a.play_count || 0);
      const pb = (b.clone_count || 0) + (b.play_count || 0);
      if (pb !== pa) return pb - pa;
      return cmpName(a, b);
    });
  } else if (sort === 'source') {
    out.sort((a, b) => {
      const sc = String(a._source || '').localeCompare(String(b._source || ''));
      if (sc !== 0) return sc;
      return cmpName(a, b);
    });
  } else if (sort === 'tier') {
    out.sort((a, b) => {
      const ta = a.tier == null || a.tier === '' ? 999 : Number(a.tier);
      const tb = b.tier == null || b.tier === '' ? 999 : Number(b.tier);
      if (ta !== tb) return ta - tb;
      return cmpName(a, b);
    });
  } else if (sort === 'type') {
    out.sort((a, b) => {
      const ta = String(a._scope || '').toLowerCase();
      const tb = String(b._scope || '').toLowerCase();
      const c = ta.localeCompare(tb);
      if (c !== 0) return c;
      return cmpName(a, b);
    });
  } else {
    out.sort(cmpName);
  }
  return out;
}

/**
 * @param {FeatureCatalogQuery & { offset?: number, limit?: number }} opts
 * @returns {{ items: object[], totalCount: number }}
 */
export function filterFeatureCatalog(opts = {}) {
  const {
    search = '',
    featScope = [],
    tiers = [],
    sort = 'name',
    offset = 0,
    limit = 20,
  } = opts;

  const tierNums = Array.isArray(tiers)
    ? tiers.map(t => Number(t)).filter(n => !isNaN(n) && n >= 1 && n <= 12)
    : [];

  const q = String(search).trim().toLowerCase();
  let rows = loadRows().filter(
    r => matchesScope(r, featScope) && matchesSearch(r, q) && matchesTier(r, tierNums)
  );
  rows = sortRows(rows, sort);
  const totalCount = rows.length;
  const items = rows.slice(offset, offset + limit).map(r => ({
    ...r,
    popularity: (r.clone_count || 0) + (r.play_count || 0),
  }));
  return { items, totalCount };
}

/**
 * @param {FeatureCatalogQuery} opts
 * @returns {number}
 */
export function countFeatureCatalog(opts = {}) {
  const { search = '', featScope = [], tiers = [] } = opts;
  const tierNums = Array.isArray(tiers)
    ? tiers.map(t => Number(t)).filter(n => !isNaN(n) && n >= 1 && n <= 12)
    : [];
  const q = String(search).trim().toLowerCase();
  return loadRows().filter(
    r => matchesScope(r, featScope) && matchesSearch(r, q) && matchesTier(r, tierNums)
  ).length;
}

/**
 * @param {string} id
 * @returns {object | null}
 */
export function getFeatureCatalogById(id) {
  if (!id) return null;
  const row = loadRows().find(r => r.id === id);
  return row ? { ...row } : null;
}
