# DaggerheartGM

A GM tool for the Daggerheart tabletop RPG.

## Architecture

Express.js server serving a React SPA built from `src/client/`. Authentication is handled by Firebase (Google sign-in). Data persistence is backed by Postgres via Supabase. Client-side routing uses the History API (`src/client/lib/router.js`) so the browser back/forward buttons work across all views.

Data loading is **lazy and per-collection**: on sign-in only `table_state` and non-paginated collections (groups, scenes, adventures) load. Adversaries and environments load on demand as the user navigates tabs, with pagination (20 per page). Scene/group expansion uses a batch `POST /api/data/resolve` call (with `adopt: true`) to look up referenced IDs, auto-cloning any non-own items into the user's library.

**Popularity tracking**: every item carries `clone_count`, `play_count`, and a computed `popularity` score. Adding any item to the GM Table increments `play_count` on its source and auto-clones non-own items into the user's library (find-or-reuse via `_clonedFrom`). Cloning increments `clone_count`. Community items (SRD, public, mirrors) are sorted by popularity descending. A flame badge appears on cards with popularity > 0.

**Fresh Cut Grass integration**: adversaries and environments tabs have an "Include FCG" checkbox that merges results from the FreshCutGrass.app public search API directly into the paginated list. Played/cloned FCG items are stored as `__MIRROR__` rows in the DB so they surface in local search (with their accumulated popularity) and are deduped from live FCG results. The Feature Library panel (shown when editing adversaries/environments) has its own independent "Include Fresh Cut Grass" toggle for feature discovery.

The nav bar user menu (click your name/email) provides Export JSON, Import JSON, and Sign Out.

```
DaggerheartGM/
├── .cursor/rules/project.mdc   # Cursor agent context (always applied)
├── data/                       # Generated SRD JSON (not committed — run npm run fetch:srd)
│   ├── srd-adversaries.json
│   └── srd-environments.json
├── migrations/                 # Numbered .sql migration files
│   ├── 001_create_items_table.sql
│   ├── 002_add_is_public.sql
│   └── 003_add_popularity.sql  # clone_count, play_count, _clonedFrom index
├── public/
│   ├── index.html              # SPA shell — loads Babel, Tailwind, importmap
│   └── styles.css              # Generated Tailwind output (do not edit by hand)
├── scripts/
│   ├── fetch-srd.js            # Fetch SRD data from GitHub → data/
│   └── seed-srd.js             # Upsert data/ into DB with user_id='__SRD__'
├── src/
│   ├── client/
│   │   ├── app.jsx             # React SPA entry point
│   │   ├── components/         # UI components (LibraryView, GMTableView, NavBtn, …)
│   │   │   ├── forms/          # Item creation/edit forms (all include is_public toggle); FeatureLibrary.jsx sidebar for feature discovery
│   │   │   └── modals/         # Import modals (Rolz) + inline edit modals (EditChoiceDialog, EditFormModal)
│   │   └── lib/                # API client, helpers, constants, parsers, router
│   ├── db.js                   # Postgres pool + migration runner + query helpers (own, community, popularity, mirrors)
│   ├── fcg-search.js           # FreshCutGrass public search API integration
│   └── input.css               # Tailwind CSS entry point
├── server.js                   # Express server + API routes
├── package.json
├── .env                        # Local environment variables (never commit)
└── .gitignore
```

## Local Setup

```bash
npm install
# fill in .env with credentials from the sections below
npm run dev    # auto-restarts on file changes, opens at http://localhost:3456
```

### Seeding SRD Content (optional)

To include the Daggerheart SRD adversaries and environments in your database:

```bash
npm run fetch:srd   # downloads from GitHub → data/srd-adversaries.json + data/srd-environments.json
npm run seed:srd    # inserts into DB (requires DATABASE_URL in .env)
```

Users can then toggle **Include SRD** in the Adversaries/Environments library views to show SRD content alongside their own items. There is also an **Include FCG** toggle that pulls live results from the FreshCutGrass.app public homebrew library via their search API — no scraping required. Both SRD and FCG items are read-only in their source form; use "Clone to My Library" or the in-context "Edit Copy" flow to make an editable copy. **Adding any item to the GM Table automatically clones it to your library** (finding an existing auto-clone if one already exists), so your library reflects everything you've actually used at the table.

A **compact/spacious view toggle** (grid icon in the header) switches between a spacious 3-column card layout and a dense 7-column layout. Compact mode hides the banner image and shows a small bottom-right thumbnail that expands on hover. The choice is persisted in `localStorage` under `libraryViewMode`.

### Rolz.org Dice Room Integration

The **Game Table** tab has two side-by-side panels (70/30 split):
- **Zoom Whiteboard** (left) — paste an `<iframe>` embed code to display a Zoom whiteboard
- **Rolz Room Log** (right) — a live chat-style view of your Rolz dice room that polls for new messages every 5 seconds. Shows text messages, dice rolls (highlighted), server messages, and time separators. Includes a header with refresh and "open in new tab" links.

A collapsible **Configure Embeds** bar at the top contains inputs for both. It collapses automatically once configured, giving the embeds maximum vertical space.

When a **room name and Rolz credentials** are configured, adversary attack actions become clickable throughout the GM Table:
- Clicking an action in the **Actions Board** sidebar posts the roll to the Rolz room (briefly flashes green on success)
- The **attack line** and **action-type attack features** on each adversary card also show a dice icon and post a roll when clicked

**To enable posting:** enter your Rolz dice room and type `/room api=on`. Then fill in your Rolz username and password in the Configure Embeds panel and click Save. The server logs in on your behalf and caches the session for 30 minutes.

Room name and credentials are persisted in your session state automatically.

### Adding to the GM Table

The "Behind the Screen" view has four buttons — **Add Adversary**, **Add Environment**, **Add Group**, and **Start Scene** — each of which opens a focused modal picker. The modal has its own independent filter state (Source, Tier, Role/Type, and a search box), all on separate rows, and is completely isolated from the library tab filters. Results appear as text rows showing Name, Tier, and Role/Type. Clicking a result adds it to the table (or starts the scene) and closes the modal.

### Inline Editing

Adversaries and environments can be edited directly from the GM Table, Scene detail, and Group detail views via a pencil button on each card. A dialog asks whether to edit a local copy (leaving the library unchanged) or the library original (propagating changes everywhere). SRD/public items are always edited as local copies.

Scenes and Groups store their elements as either library ID references or inline **owned copies**. Owned copies appear with an amber "local copy" badge and are preserved through normal edit/save operations.

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
| `DATABASE_URL` | Yes (seed) | Required for `npm run seed:srd` as well as normal operation |

---

## Development

```bash
npm run dev        # development — auto-restarts on file changes (Node 18+)
npm start          # production
npm run fetch:srd  # re-fetch SRD data from GitHub
npm run seed:srd   # re-seed SRD data into DB
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
