/**
 * JSON Schema helpers for DH declarative card shapes (`trackedState`, `attack`).
 * Used for tests and optional validation — not required for read-only sheet rendering.
 */

/**
 * Wrap an author fragment as a JSON Schema object root (validator bootstrap).
 * @param {object} fragment — `{ required?, properties?, ... }` without root `type`
 * @returns {object}
 */
export function wrapJsonSchemaFragment(fragment) {
  if (!fragment || typeof fragment !== 'object') {
    return { type: 'object' };
  }
  return {
    type: 'object',
    ...fragment,
  };
}

/**
 * Deep-clone a schema node and map DH-only `type` values to JSON Schema / draft-07 friendly shapes.
 * @param {*} node
 * @returns {*}
 */
export function mapDhSchemaTypesForValidator(node) {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(mapDhSchemaTypesForValidator);
  const out = { ...node };
  const t = out.type;
  if (t === 'trackedState') {
    out.type = 'integer';
  } else if (t === 'attack') {
    out.type = 'string';
    if (out.minLength == null) out.minLength = 1;
  } else if (t === 'sizeMultiplierPair') {
    // Virtual reference field (bridges widthKey/lengthKey/linkedKey sibling properties) —
    // no real data lives at this key, so any object shape validates.
    out.type = 'object';
  } else if (t === 'imagePortrait') {
    // Virtual field — data lives as sibling imageUrl / _additionalImages keys; skip strict validation.
    out.type = 'object';
  }
  for (const k of Object.keys(out)) {
    if (k === 'properties' && out.properties && typeof out.properties === 'object') {
      const next = {};
      for (const pk of Object.keys(out.properties)) {
        next[pk] = mapDhSchemaTypesForValidator(out.properties[pk]);
      }
      out.properties = next;
    } else if (k === 'items' && out.items != null) {
      out.items = mapDhSchemaTypesForValidator(out.items);
    } else if (typeof out[k] === 'object') {
      out[k] = mapDhSchemaTypesForValidator(out[k]);
    }
  }
  return out;
}

/**
 * @param {object|null|undefined} card
 * @returns {object}
 */
export function omitShapeId(card) {
  if (!card || typeof card !== 'object') return {};
  const { shapeId: _s, ...rest } = card;
  return rest;
}

/**
 * Read `bind.path` (dot segments) on a character-ish object.
 * @param {object} root
 * @param {string} path — e.g. `companion`
 * @returns {unknown}
 */
export function getBoundObject(root, path) {
  if (!root || typeof root !== 'object' || !path || typeof path !== 'string') return undefined;
  const parts = path.split('.').filter(Boolean);
  let cur = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Immutable set `path` on a clone of `root` (single top-level key for character forms).
 * @param {object} root
 * @param {string} path
 * @param {object} value
 * @returns {object}
 */
export function setBoundObject(root, path, value) {
  const base = root && typeof root === 'object' ? { ...root } : {};
  if (!path || typeof path !== 'string') return base;
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 1) {
    base[parts[0]] = value;
    return base;
  }
  let cur = base;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const nextSrc = cur[p];
    const next = nextSrc && typeof nextSrc === 'object' ? { ...nextSrc } : {};
    cur[p] = next;
    cur = next;
  }
  cur[parts[parts.length - 1]] = value;
  return base;
}
