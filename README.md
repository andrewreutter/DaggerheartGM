# DaggerheartGM

A GM tool for the Daggerheart tabletop RPG.

## Architecture

Express.js server serving a React SPA built from `src/client/`. Authentication is handled by Firebase (Google sign-in). Data persistence is backed by Postgres via Supabase. Client-side routing uses the History API (`src/client/lib/router.js`) so the browser back/forward buttons work across all views.

Data loading is **lazy and per-collection**: on sign-in only `table_state` and non-paginated collections (scenes, adventures) load. Adversaries and environments are fetched on demand by `LibraryView`'s internal `useCollectionSearch` hook as the user browses. Scene expansion uses a batch `POST /api/data/resolve` call (with `adopt: true`) to look up referenced IDs, auto-cloning any non-own items into the user's library. The resolve endpoint falls back to the SRD sub-application for `srd-*` IDs not found in the DB, ensuring SRD references always resolve.

**Shared collection search**: a `useCollectionSearch` hook (`src/client/lib/useCollectionSearch.js`) encapsulates all fetch/filter/infinite-scroll logic and is used by `LibraryView`, `AddToTableModal`, and `FeatureLibrary`. Filter state is persisted per-collection to `localStorage` under `dh_collectionFilters_<collection>`. A `CollectionFilters` component renders two variants of the filter UI: `bar` (horizontal, LibraryView) and `panel` (stacked with section headers, used in the Add to Table modal and Feature Library). When `infinite: true`, the hook accumulates items across pages (`loadMore()` / `hasMore` / `isLoadingMore`), trims the oldest items once `maxItems` is exceeded to prevent DOM bloat, and tracks `trimmedCount` so the "Showing X of Y" display stays accurate. Each consumer renders a one-page spacer below loaded items (with an IntersectionObserver sentinel) so users can scroll to trigger the next page without explicit pagination controls.

**Popularity tracking**: every item carries `clone_count`, `play_count`, and a computed `popularity` score. Adding any item to the GM Table increments `play_count` on its source and auto-clones non-own items into the user's library (find-or-reuse via `_clonedFrom`). Cloning increments `clone_count`. Community items (SRD, public, mirrors) are sorted by popularity descending. A flame badge appears on cards with popularity > 0.

**Heart of Daggers (HoD) integration**: adversaries and environments tabs have an "HoD" source filter that fetches results from the [Heart of Daggers Homebrew Vault](https://heartofdaggers.com/vault/) via its WordPress AJAX API. HoD list results carry summary data (name, tier for environments, role, HP, stress, difficulty, description). When an HoD item is cloned or added to the GM Table, the server fetches the full Foundry VTT JSON export for that item (two-step: scrape per-item nonce from the detail page, then call the export endpoint) and stores a rich `__MIRROR__` row including features, attacks, thresholds, experiences, and motives. Items are tagged `_source: 'hod'` and show a rose-coloured "HoD" badge. The vault-page nonce used for list queries is cached in memory for 30 minutes.

**Fresh Cut Grass integration**: adversaries and environments tabs have an "FCG" source filter that merges results from the FreshCutGrass.app public search API directly into the infinite-scroll list. Played/cloned FCG items are stored as `__MIRROR__` rows in the DB so they surface in local search (with their accumulated popularity) and are deduped from live FCG results. When an FCG item is picked as a scene reference (via `CollectionRefPicker`), a mirror is automatically created so the item can be resolved by ID later. The Feature Library panel (shown when editing adversaries/environments) uses the same source filter — selecting FCG includes live FCG features in the suggestion list.

The nav bar user menu (click your name/email) provides Export JSON, Import JSON, and Sign Out.

```
DaggerheartGM/
├── .cursor/rules/project.mdc   # Cursor agent context (always applied)
├── daggerheart-srd/            # Git submodule — seansbox/daggerheart-srd
│   ├── adversaries/            # Markdown files for each SRD entity
│   ├── environments/           # (and 11 other content directories)
│   └── .build/03_json/         # Pre-built JSON used by src/srd/parser.js
├── migrations/                 # Numbered .sql migration files
│   ├── 001_create_items_table.sql
│   ├── 002_add_is_public.sql
│   ├── 003_add_popularity.sql  # clone_count, play_count, _clonedFrom index
│   └── 004_remove_srd_rows.sql # Removes legacy __SRD__ DB rows (SRD now in-memory)
├── public/
│   ├── index.html              # SPA shell — loads Babel, Tailwind, importmap
│   └── styles.css              # Generated Tailwind output (do not edit by hand)
├── src/
│   ├── client/
│   │   ├── app.jsx             # React SPA entry point
│   │   ├── components/         # UI components (LibraryView, GMTableView, NavBtn, …)
│   │   │   ├── CollectionFilters.jsx  # Shared filter bar/panel (bar variant + panel variant)
│   │   │   ├── forms/          # Item forms (controlled+uncontrolled); CollectionRefPicker; FeatureLibrary.jsx sidebar
    │   │   │   └── modals/         # ItemDetailModal (unified view+edit overlay); ItemPickerModal; EditChoiceDialog; import modals
    │   │   └── lib/                # API client, helpers, constants, parsers, router, useCollectionSearch, useAutoSaveUndo
│   ├── srd/                    # SRD sub-application (no DB dependency)
│   │   ├── parser.js           # Loads .build/03_json/*.json, normalizes 13 collections, caches in memory
│   │   ├── router.js           # Express Router — GET /api/srd/collections, /:collection, /:collection/:id
│   │   └── index.js            # Re-exports srdRouter, warmCache, getItem, searchCollection, COLLECTION_NAMES
│      ├── db.js                   # Postgres pool + migration runner + query helpers (own, community, popularity, mirrors)
    │   ├── external-sources.js     # EXTERNAL_SOURCES array — SRD + HoD + FCG sharing a common search contract
    │   ├── fcg-search.js           # FreshCutGrass public search API integration
    │   ├── hod-search.js           # Heart of Daggers Vault integration (list search + Foundry JSON detail)
│   └── input.css               # Tailwind CSS entry point
├── server.js                   # Express server + API routes
├── package.json
├── .env                        # Local environment variables (never commit)
└── .gitignore
```

## Local Setup

```bash
git submodule update --init   # initialize the daggerheart-srd submodule
npm install                   # install Node dependencies
# fill in .env with credentials from the sections below
npm run dev    # auto-restarts on file changes, opens at http://localhost:3456
```

### SRD Content

SRD content is served from the `daggerheart-srd` git submodule via the `src/srd/` sub-application. All 13 SRD collections (adversaries, environments, abilities, ancestries, armor, beastforms, classes, communities, consumables, domains, items, subclasses, weapons) are loaded from `daggerheart-srd/.build/03_json/` at server startup and cached in memory. No database seeding is required.

The `/api/srd` routes are public (no auth). To update SRD content to a newer upstream version:

```bash
cd daggerheart-srd && git pull && cd ..
git add daggerheart-srd && git commit -m "Update daggerheart-srd submodule"
```

There is also an **Include HoD** toggle that pulls live results from the [Heart of Daggers Homebrew Vault](https://heartofdaggers.com/vault/) and an **Include FCG** toggle that pulls live results from the FreshCutGrass.app public homebrew library. Both HoD and FCG items are read-only in their source form; use "Clone to My Library" or the in-context "Edit Copy" flow to make an editable copy. **Adding any item to the GM Table automatically clones it to your library** (finding an existing auto-clone if one already exists), so your library reflects everything you've actually used at the table. For HoD items, cloning triggers a full detail fetch that enriches the stored copy with features, attacks, and other stat-block data not available in the list view.

A **compact/spacious view toggle** (grid icon in the header) switches between a spacious 3-column card layout and a dense 7-column layout. Compact mode hides the banner image and shows a small bottom-right thumbnail that expands on hover. The choice is persisted in `localStorage` under `libraryViewMode`.

### Rolz.org Dice Room Integration

The **Game Table** tab has two side-by-side panels (70/30 split):
- **Zoom Whiteboard** (left) — paste an `<iframe>` embed code to display a Zoom whiteboard
- **Rolz Room Log** (right) — a live chat-style view of your Rolz dice room that polls for new messages every 5 seconds. Shows text messages, dice rolls (highlighted), server messages, and time separators. Includes a header with refresh and "open in new tab" links.

A collapsible **Configure Embeds** bar at the top contains inputs for both. It collapses automatically once configured, giving the embeds maximum vertical space.

When a **room name and Rolz credentials** are configured, adversary attack actions become clickable throughout the GM Table:
- Clicking an action in the **GM Moves** sidebar posts the roll to the Rolz room (briefly flashes green on success)
- The **attack line** and **action-type attack features** on each adversary card also show a dice icon and post a roll when clicked

**To enable posting:** enter your Rolz dice room and type `/room api=on`. Then fill in your Rolz username and password in the Configure Embeds panel and click Save. The server logs in on your behalf and caches the session for 30 minutes.

Room name and credentials are persisted in your session state automatically.

### Adding to the GM Table

The "Behind the Screen" view has three buttons — **Add Adversary**, **Add Environment**, and **Add Scene** — each of which opens an **`ItemPickerModal`** and **appends** the selection to the current table (never clears the board). For adversaries and environments the modal uses `useCollectionSearch` + `CollectionFilters` (panel variant) providing Source, Tier, Role/Type, and a search box with infinite scroll. For scenes a simple client-side search is shown. Results appear as text rows. Clicking a result adds it to the table and closes the modal.

A **Capture Table** button (camera icon, disabled when the table is empty) opens a small dialog where you name and save the current table contents as a new **Scene** (capturing all adversaries and environments). After saving, the new scene is opened in the library.

### Scene / Adventure Forms

Scenes can reference adversaries, environments, and **nested Scenes** (allowing reusable encounter building blocks). When creating or editing a Scene or Adventure, a bank of **"Add Adversary / Add Environment / Add Scene"** buttons appears via the `CollectionRefPicker` widget. Each button opens the same `ItemPickerModal`. All selected items appear in one combined list with type badges, quantity controls (for adversaries), and remove buttons. Pre-existing references are resolved on mount via `POST /api/data/resolve`.

**Circular reference prevention**: `SceneForm` validates nested scene selections at save time — if adding a scene would create a cycle (scene A → scene B → scene A), the save is blocked with an error. All expansion functions also pass a `visited` set to guard against cycles in stale data.

Nested scene chips display in **blue** on `ItemCard` in the Scenes library tab.

### Item Detail and Editing

All item viewing and editing happens inside a single **`ItemDetailModal`** overlay — there are no separate view or edit pages.

- **Library**: Clicking any card (or "New") opens `ItemDetailModal`. Own items show a split pane: **live display preview** on the left (updates in real-time as you type), **edit form** on the right. Adversaries and environments also show a narrow **Feature Library** panel to the right. Changes **auto-save** after 800ms of inactivity. **Undo/redo** (Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z) are available for the full session. SRD/public/FCG items open display-only with Clone and Copy Rolz actions.
- **GM Table**: The pencil button on each card opens an `EditChoiceDialog` asking "Edit Table Copy" or "Edit Library Original", then opens `ItemDetailModal`. Copy mode auto-saves only in memory (preserving HP/stress). Original mode auto-saves to the DB.
- **Scene detail**: Same pencil → choice dialog → modal flow. Copy mode converts the reference to an inline owned copy in the parent scene. Original mode saves to the DB.
- SRD and public items are always forced into copy mode.

Scenes store their elements as either library ID references or inline **owned copies**. Owned copies appear with an amber "local copy" badge and are preserved through normal edit/save operations.

---

## GCP / Firebase Setup (Authentication)

Firebase is used only for Google sign-in.

### 1. Create a GCP Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (e.g. `daggerheart-gm`).
2. Note the **Project ID** — you'll need it in the next step.

### 2. Firebase (Google sign-in)

#### 2a. Add Firebase to your GCP project

1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Click **Add project** → select your existing GCP project.
3. Follow the prompts (you can disable Google Analytics).

#### 2b. Register a Web App

1. Firebase console → **Project settings** (gear icon) → **Your apps**.
2. Click **Add app** → **Web** (`</>`).
3. Give it a nickname (e.g. `daggerheart-gm-web`), skip Firebase Hosting.
4. Copy these four values from the `firebaseConfig` object into your `.env`:
   - `apiKey` → `FIREBASE_API_KEY`
   - `authDomain` → `FIREBASE_AUTH_DOMAIN` (e.g. `your-project-id.firebaseapp.com`)
   - `projectId` → `FIREBASE_PROJECT_ID`
   - `appId` → `FIREBASE_APP_ID`

#### 2c. Enable Google Sign-In

1. Firebase console → **Authentication** → **Sign-in method**.
2. Click **Google** → toggle **Enable** → save.

#### 2d. Authorize your domain(s)

1. Firebase console → **Authentication** → **Settings** → **Authorized domains**.
2. `localhost` is included by default for local development.
3. Add your production domain when you deploy (e.g. `your-app.vercel.app`).

---

## Supabase Setup (Database)

### 1. Create a project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to your users and set a strong database password.

### 2. Get the connection string

1. Supabase dashboard → **Project settings** → **Database**.
2. Under **Connection string**, select **URI** and copy the string.
3. Replace `[YOUR-PASSWORD]` with your database password and paste it into `.env`:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```

> **Tip:** For serverless/edge environments use the **Session pooler** (port 5432) or **Transaction pooler** (port 6543) connection strings instead of the direct connection.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `3456`) |
| `FIREBASE_API_KEY` | Yes | Firebase web app API key |
| `FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `FIREBASE_PROJECT_ID` | Yes | Firebase / GCP project ID |
| `FIREBASE_APP_ID` | Yes | Firebase web app ID |
| `DATABASE_URL` | Yes | Supabase Postgres connection string |
| `APP_ID` | No | Data namespace key (default: `daggerheart-gm-tool`) |

---

## Development

```bash
npm run dev        # development — auto-restarts on file changes (Node 18+)
npm start          # production
npm run build      # rebuild CSS + JS bundles
```

### Dev Live Reload

`npm run dev` starts esbuild and Tailwind in watch mode. The server exposes `GET /livereload` — an SSE endpoint that watches `public/` for file changes and broadcasts a reload signal. `public/index.html` includes a small inline `EventSource` script that calls `location.reload()` whenever the signal arrives or the connection is re-established after a server restart. No browser extension or extra tooling needed.

### Adding API Routes

Add routes in `server.js` before the static middleware block:

```js
app.get('/api/example', (req, res) => {
  res.json({ message: 'Hello' });
});
```
