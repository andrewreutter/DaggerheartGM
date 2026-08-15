/**
 * Per-collection JSON field / tier SQL for unified library list queries.
 * Shared by `server.js` (GET /api/data/:collection) and `db.js` (library-all merge).
 */
export function unifiedListConfig(collection) {
  const d = { typeField: null, extraTypeField: null, tierExprSql: `COALESCE((data->>'tier')::int, 1)` };
  const map = {
    adversaries: { typeField: 'role', tierExprSql: `COALESCE((data->>'tier')::int, 1)` },
    environments: { typeField: 'type', tierExprSql: `COALESCE((data->>'tier')::int, 1)` },
    abilities: { typeField: 'domain', tierExprSql: `COALESCE((data->>'level')::int, 1)` },
    weapons: { typeField: 'primary_or_secondary', extraTypeField: 'physical_or_magical', tierExprSql: `COALESCE((data->>'tier')::int, 1)` },
    armor: { tierExprSql: `COALESCE((data->>'tier')::int, 1)` },
    beastforms: { tierExprSql: `COALESCE((data->>'tier')::int, 1)` },
    ancestries: { tierExprSql: `1` },
    classes: { tierExprSql: `1` },
    communities: { tierExprSql: `1` },
    consumables: { tierExprSql: `1` },
    domains: { tierExprSql: `1` },
    items: { tierExprSql: `1` },
    subclasses: { tierExprSql: `1` },
    scenes: { tierExprSql: `COALESCE((data->>'tier')::int, 1)` },
  };
  return { ...d, ...map[collection] };
}
