---
name: ""
overview: ""
todos: []
isProject: false
---

# Library “All” tab — unified browse + filter spec

This document supersedes the earlier “hub-only” All-tab approach. **Default route** remains `/library` → `**all`**. The **All** view is a **merged, paginated library** across SRD unified collections, with a **single filter bar** that exposes **every** filter dimension used on any collection tab; **each dimension applies only to collections that define that filter** (see mapping below).

Non-goals for v1 of merged browse: replacing per-tab URLs; Game Table modal routes remain unchanged (`all` is library-only).

---

## 1. Data storage (unchanged)

- `**items`**: `(app_id, user_id, collection, id)` + `data` JSONB.
- `**external_item_cache`**: SRD/HoD rows per `collection`.
- Existing `**[getUnifiedItems](../../src/db.js)`** builds a per-`collection` `UNION ALL` (own + public + external) with collection-specific `typeField`, `tierExprSql`, `extraTypeField`.

No new tables are **required** for merged browse; optional **SQL VIEW** is an implementation detail (see §5).

---

## 2. Filter dimensions — “sum of all filters”

The All tab UI shows **one combined filter bar** assembling controls from `**[getLibraryFilterConfig](../../src/client/lib/library-filter-config.js)`** / `**[CollectionFilters](../../src/client/components/CollectionFilters.jsx)`** across tabs. **Semantics**: user-selected values are stored in **one shared filter state** (extend `[useCollectionSearch](../../src/client/lib/useCollectionSearch.js)` or a sibling hook, e.g. `useAllCollectionsSearch`). When issuing API requests, the server **ignores** a dimension for collections where it does not apply.

### 2.1 Dimension → collections matrix


| Dimension            | Control(s)                                     | Applies to collections                                          | Notes                                                                                                                                                                                                                                |
| -------------------- | ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Source**           | `includes` (Mine / SRD / Public / HoD / “All”) | All 13 `SRD_UNIFIED_COLLECTIONS`                                | Same as today; `[LIBRARY_INCLUDES_GLOBAL_KEY](../../src/client/lib/library-filter-config.js)`.                                                                                                                                       |
| **Search**           | text                                           | All 13                                                          | `data->>'name' ILIKE` (existing).                                                                                                                                                                                                    |
| **Sort**             | popularity, name, type, source, tier           | All 13                                                          | Existing `[SORT_OPTIONS](../../src/db.js)`; “type” / “tier” sort uses per-row `type_val` / `tier_val` (already computed per collection).                                                                                             |
| **Tier** (1–4)       | multi `TIERS`                                  | `adversaries`, `environments`, `weapons`, `armor`, `beastforms` | Collections with `rankMode: 'tier'`. Ignored for abilities (level), ancestries/classes/… (no tier rank UI).                                                                                                                          |
| **Level** (1–9)      | level chips                                    | `**abilities` only**                                            | Uses `tierExprSql` = level in `[unifiedListConfig](../../server.js)` (`abilities`). Other collections: ignore `levels` param.                                                                                                        |
| **Role**             | ROLES                                          | `**adversaries` only**                                          | `typeField: 'role'`.                                                                                                                                                                                                                 |
| **Environment type** | ENV_TYPES                                      | `**environments` only**                                         | `typeField: 'type'`.                                                                                                                                                                                                                 |
| **Domain**           | ABILITY_DOMAINS                                | `**abilities` only**                                            | `typeField: 'domain'`.                                                                                                                                                                                                               |
| **Weapon slot**      | Primary / Secondary                            | `**weapons` only**                                              | `typeField: 'primary_or_secondary'`.                                                                                                                                                                                                 |
| **Damage type**      | Physical / Magical                             | `**weapons` only**                                              | `extraTypeField: 'physical_or_magical'`.                                                                                                                                                                                             |
| **Include scaled**   | checkbox                                       | `**adversaries` only**                                          | When exactly one tier selected → `tierMax` + scaling (existing client `[computeScaledStats](../../src/client/lib/adversary-defaults.js)` may stay client-side post-fetch **or** move to server parity with single-collection route). |


Collections with **no** primary/extra type row in the bar (`armor`, `beastforms`, `ancestries`, `classes`, `communities`, `consumables`, `domains`, `items`, `subclasses`) still participate in merged results; only **tier** (where applicable) + **search** + **source** + **sort** constrain them.

### 2.2 UI behavior

- Render **one** `[CollectionFilters](../../src/client/components/CollectionFilters.jsx)`-style layout with `collection="all"` (new variant or wrapper):
  - **Search** + **Source** + **Sort** (full width / first rows).
  - **Tier** row: show when any target collection uses tier rank (see matrix); optional muted caption: *Tier filters adversaries, environments, weapons, armor, and beastforms.*
  - **Level** row: abilities only — caption *Spell level (abilities).*
  - **Type** rows: split or grouped — **Role** (adversaries), **Environment type**, **Domain** (abilities), **Slot** + **Physical/Magical** (weapons). Use existing labels from `LIBRARY_FILTER_CONFIG` to avoid duplicate terminology.
  - **Include scaled**: only when adversaries would show it today (single tier + adversaries in scope); for All tab, same rule: visible if tier filter is compatible with scaled-adversary logic.
- **Persistence**: reuse `[LIBRARY_FILTERS_PERSIST_KEY](../../src/client/lib/library-filter-config.js)` with a dedicated key e.g. `dh_collectionFilters_v2_all` **or** store under `all` in the same persist shape as other tabs (extend persist key to include `all`).
- **Shared search / includes**: keep `[LIBRARY_SEARCH_GLOBAL_KEY](../../src/client/lib/library-filter-config.js)` / `[LIBRARY_INCLUDES_GLOBAL_KEY](../../src/client/lib/library-filter-config.js)` so switching All ↔ single tab does not reset global search/source.

---

## 3. API contract

### 3.1 New route (recommended)

`GET /api/data/library-all` (name TBD; must not collide with `collection` path param for real collections).

**Query params** (superset of existing `[GET /api/data/:collection](../../server.js)`):

- `includeMine`, `includePublic`, `includeSrd`, `includeHod` — same semantics as unified list.
- `search`, `sort`, `offset`, `limit` (cap 100).
- `tier` — repeated / comma-separated tier values (1–4).
- `level` — optional repeated (1–9) for **abilities** only.
- `type` — **disambiguation required**: today a single `type` array is overloaded (role vs env type vs domain vs slot). Options:
  - **A (preferred)**: namespaced params, e.g. `advRole`, `envType`, `ablDomain`, `wpnSlot`, `wpnPhyMag` (each optional array), **or**
  - **B**: single `type` array only where collections share disjoint value sets (fragile).

Recommend **namespaced query params** mirroring server mapping to each `getUnifiedItems` call.

- `includeScaledUp` — adversaries branch only.
- `tierMax` — derived server-side for adversaries when `includeScaledUp` + single tier (same as current adversary behavior).

**Response**:

```json
{
  "items": [
    { "...item fields": "...", "_collection": "adversaries" }
  ],
  "totalCount": 1234,
  "nextOffset": 20
}
```

Every row MUST include `**_collection**` (discriminator) so `[ItemCard](../../src/client/components/ItemCard.jsx)` / modal opens with the correct `collection` and routes to `/library/{collection}/{id}`.

### 3.2 Scenes / adventures / characters

**Option A (v1):** Merged All tab = **13 SRD unified collections only**; sidebar still links to Characters / Scenes / Adventures for full browse.

**Option B:** Add parallel fetches for non-unified collections with **only** search + tier (where applicable) + source rules and merge into the same list (sort key alignment is harder). **Defer** unless product requires one grid for everything.

Document the chosen option in the implementation PR.

---

## 4. Server implementation sketch

1. **New handler** next to `[app.get('/api/data/:collection')](../../server.js)`: validate auth, parse namespaced filters, compute `include*` flags from query (same as today).
2. **DB layer** — two viable approaches:
  - **4a. Parallel `getUnifiedItems`**  
   For each `c` in `SRD_UNIFIED_COLLECTIONS`, build opts from §2.1 (pass **only** applicable filters). Run queries, concatenate rows with `_collection: c`, **sort in memory** by global `sort`, apply `offset`/`limit`.  
   **Total count**: sum of per-collection counts (each query’s `totalCount` with same filters) — correct.  
   **Pagination**: for `offset`/`limit`, either fetch-all-then-slice (bad at scale) or **fetch enough** from each branch (complex). Prefer **4b** for production pagination.
  - **4b. Single SQL `UNION ALL`**  
  One subquery per collection, identical shape: `id`, `data`, `user_id`, `is_public`, `cc`, `pc`, `_source`, `type_val`, `tier_val`, `extra_type_val`, **literal `'adversaries'::text AS _collection`**, etc. Each subquery applies **only** that collection’s filter predicates (from §2.1). Outer query: `WHERE` search/sort/order, `COUNT(*)`, `OFFSET`/`LIMIT`.  
  Reuse fragments from existing `getUnifiedItems` **or** generate from shared builder to avoid drift.
3. **Scaled adversaries**: preserve existing behavior inside the adversaries sub-branch only.
4. **Tests**: `[test/unit/](../../test/unit/)` — filter mapping (which params affect which collection); optional integration test against DB if present.

---

## 5. Database VIEW (optional)

A **VIEW** is not mandatory: the merged query can remain **dynamic SQL** in `db.js` (same as today). If a VIEW is introduced, it would be a **thin** `UNION ALL` of normalized columns (`collection`, `id`, `data`, …) for analytics or simpler ad hoc queries; **filter predicates would still be collection-specific** (CHECK or WHERE per branch). The plan does **not** require a VIEW for correctness.

---

## 6. Client: `[LibraryView.jsx](../../src/client/components/LibraryView.jsx)`

- **Router**: `[VALID_TABS](../../src/client/lib/router.js)` includes `'all'`; `[DEFAULT_LIBRARY_TAB](../../src/client/lib/router.js)` = `'all'`; `**VALID_COLLECTIONS`** excludes `'all'`.
- `**activeTab === 'all'`**: use new hook hitting `GET /api/data/library-all`, same virtualized grid as paginated tabs, `**ItemCard`** receives `tab={item._collection}` (or `collection` prop if refactored).
- **Deep links**: `/library/all/:id` — resolve item by **fetching known collection** (batch resolve) or **encode collection in URL** as `/library/:collection/:id` only (simplest: **do not** support `/library/all/:id`; clicking a card navigates to `/library/{_collection}/{id}`).
- **New item**: All tab has **no** single “New” — hide primary New or show a **dropdown** “New in…” → navigate to `/library/{collection}/new`.

---

## 7. Documentation updates (on implementation)

- `[.cursor/rules/project.mdc](../../.cursor/rules/project.mdc)` — Library URL default + `library-all` API one-liner.
- `[README.md](../../README.md)` — if it lists routes.

---

## 8. Implementation todos

1. Router: `all` tab + default; invalid deep links clear to `/library/all`.
2. `db.js` / `server.js`: `getUnifiedLibraryItems` or equivalent + `GET /api/data/library-all`.
3. Client: `useAllCollectionsSearch` + combined filter state + `CollectionFilters` variant for `all`.
4. `LibraryView`: merged grid + `_collection` on cards + navigation.
5. Unit tests: router, filter mapping, API response shape.
6. Docs: project.mdc (+ README if applicable).

