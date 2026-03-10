# DaggerheartGM

A GM tool for the Daggerheart tabletop RPG.

## Architecture

Express.js server serving a React SPA built from `src/client/`. Authentication is handled by Firebase (Google sign-in). Data persistence is backed by Postgres via Supabase. Client-side routing uses the History API (`src/client/lib/router.js`) so the browser back/forward buttons work across all views. Item detail modals have their own URLs (`/library/:tab/:id`, `/gm-table/:gmUid/:collection/:id`) for back/forward, link sharing, and reload. The GM's Game Table URL is `/gm-table/:gmUid` (their Firebase UID), making it directly shareable with players. Players navigating to the URL see a read-only view (unless they have an assigned character); the GM manages which emails can join via a "Manage Invited Players" panel.

Data loading is **lazy and per-collection**: on sign-in the app renders immediately; `table_state` and admin status load in the background. Adversaries and environments are fetched on demand by `LibraryView`'s `useCollectionSearch` hook as the user browses. Scenes and adventures load when the user navigates to those tabs or opens the Add Scene/Adventure picker on the Game Table. The `GET /api/data/:collection` endpoint uses a **unified query** over `items` + `external_item_cache` — no live external API calls. SRD, FCG, and HoD content is pre-loaded: SRD adversaries/environments are loaded into the cache at server startup (`loadSrdIntoDb`); FCG and HoD are synced by a background job (cron at 3 AM, or `npm run crawl` manually). Scene expansion uses a batch `POST /api/data/resolve` call (with `adopt: true`) to look up referenced IDs, auto-cloning any non-own items into the user's library. The resolve endpoint falls back to `external_item_cache`, SRD sub-application, or `fetchHoDFoundryDetail()` for IDs not in the user's DB. **Image optimization**: to avoid slow saves when scenes contain large base64 images, the client strips `imageUrl` and `_additionalImages` from normal PUT payloads; the server merges incoming data while preserving image fields. Image changes (AI generate, import) use a dedicated `PUT /api/data/:collection/:id/image` endpoint.

**Shared collection search**: a `useCollectionSearch` hook (`src/client/lib/useCollectionSearch.js`) encapsulates all fetch/filter logic and is used by `LibraryView`, `AddToTableModal`, `FeatureLibrary`, and `ExperienceLibrary`. Source, Tier, Role/Type, and **sort** (popularity, name, type, source, tier) filters. For adversaries, when exactly one tier is selected, an "Include Scaled" checkbox lets you include lower-tier adversaries; those are scaled up to the selected tier using RightKnight guide rules and displayed with "[Scaled]" prepended to their names. Filter state is persisted per-collection to `localStorage`. A `CollectionFilters` component renders two variants: `bar` (horizontal, LibraryView) and `panel` (stacked, used in Add to Table modal and Feature/Experience Library). A virtualized grid (`@tanstack/react-virtual`) renders `ItemCard`s with infinite scroll via `loadMore`. Scenes and Adventures use a non-virtualized flex-wrap layout.

**Popularity tracking**: clone and play actions are recorded in `item_popularity` (one row per user per item per action). Counts are computed via subquery. Community items (SRD, public, mirrors) are sorted by popularity descending by default. A flame badge appears on cards with popularity > 0.

**Heart of Daggers (HoD) integration**: adversaries and environments are synced from the [Heart of Daggers Homebrew Vault](https://heartofdaggers.com/vault/) into `external_item_cache` by the background job. The sync fetches full Foundry VTT JSON (2 parallel per 1.5s throttle); daily runs are incremental (skip cached items), with a weekly full refresh on Sundays. Aborts after 3 consecutive fetch failures; rerun to resume. Items are tagged `_source: 'hod'` and show a rose-coloured "HoD" badge. HoD environment `potential_adversaries` is extracted from Foundry JSON as name-only placeholder objects.

**Fresh Cut Grass integration**: adversaries and environments are synced from the FreshCutGrass.app public search API into `external_item_cache` by the background job. Played/cloned FCG items are stored as `__MIRROR__` rows in the DB so they surface in local search with their accumulated popularity. When an FCG item is picked as a scene reference (via `CollectionRefPicker`), a mirror is automatically created so the item can be resolved by ID later. The Feature Library (and Experience Library for adversaries) panel uses the same source filter. FCG environment `potential_adversaries` is stored as name-only placeholder objects.

**Daggerstack character sync**: GM Table characters can be linked to a [Daggerstack.com](https://daggerstack.com) character sheet. The Add/Edit Character dialog has a collapsible "Sync from Daggerstack" section (URL, email, password). On sync, the server calls `POST /api/daggerstack/sync` → `src/daggerstack-sync.js`, which authenticates via Daggerstack's Supabase backend, fetches the character row, and resolves class/subclass/ancestry/community/armor/weapon UUIDs against local SRD data (via `data/daggerstack-uuid-map.json`). Resolved fields include evasion (class base + armor/ancestry modifiers), armor score + thresholds, all traits, weapons, inventory, and features. Credentials are stored on the character element and used for later re-sync. Hovering a character card shows a `CharacterHoverCard` overlay to the right of the Characters panel with a full character sheet. The small card also shows an Armor `CheckboxTrack` + Evasion badge when populated. The UUID map is generated by `scripts/refresh-daggerstack-uuids.js` and refreshed nightly at 4 AM (also runnable via `npm run refresh:daggerstack`).

The nav bar user menu (click your name/email) provides Export JSON, Import JSON, and Sign Out.

```
DaggerheartGM/
├── .cursor/rules/project.mdc   # Cursor agent context (always applied)
├── data/
│   └── daggerstack-uuid-map.json # Daggerstack UUID → SRD slug mapping (committed; refreshed nightly)
├── scripts/
│   ├── crawl.js                # Manual FCG + HoD sync (npm run crawl)
│   └── refresh-daggerstack-uuids.js # Regenerates daggerstack-uuid-map.json (npm run refresh:daggerstack)
├── daggerheart-srd/            # Git submodule — seansbox/daggerheart-srd
│   ├── adversaries/            # Markdown files for each SRD entity
│   ├── environments/           # (and 11 other content directories)
│   └── .build/03_json/         # Pre-built JSON used by src/srd/parser.js
├── migrations/                 # Numbered .sql migration files
│   ├── 001_create_items_table.sql
│   ├── 002_add_is_public.sql
│   ├── 003_add_popularity.sql  # clone_count, play_count, _clonedFrom index
│   ├── 004_remove_srd_rows.sql # Removes legacy __SRD__ DB rows (SRD now in-memory)
│   ├── 005_create_blocked_reddit.sql # blocked_reddit_posts table for admin content moderation
│   ├── 006_create_item_popularity.sql # Per-user clone/play tracking
│   ├── 007_create_external_item_cache.sql # Cache for SRD, FCG, HoD
│   ├── 008_remove_popularity_from_items.sql # Drops clone_count, play_count from items
│   ├── 009_create_sync_state.sql # Sync metadata (e.g. SRD hash)
│   ├── 010_fix_items_pk.sql    # Fix items table primary key
│   ├── 011_create_whiteboard_snapshots.sql # TLDraw canvas state per GM room
│   └── 012_create_dice_rolls.sql # Persists dice roll history across server restarts
├── public/
│   ├── index.html              # SPA shell — importmap (React, Firebase, Lucide, marked, @3d-dice/dice-box)
│   ├── styles.css              # Generated Tailwind output (do not edit by hand)
│   └── dice-box/               # @3d-dice/dice-box static assets (meshes, textures, WASM physics, worker JS)
├── src/
│   ├── game-constants.js       # Single source of truth: ROLES, ROLE_BP_COST, ENV_TYPES, TIERS
│   ├── daggerstack-sync.js     # Daggerstack.com character sync — Supabase auth, UUID resolution via SRD map + adapters
│   ├── client/
│   │   ├── app.jsx             # React SPA entry point (partySize + partyTier derived from character elements)
│   │   ├── components/         # UI components (LibraryView, GMTableView, DiceRoller, NavBtn, ItemCard, ItemActionButtons, …)
│   │   │   ├── DiceRoller.jsx         # 3D dice visualization overlay — animates server-rolled dice using @3d-dice/dice-box
│   │   │   ├── DiceLog.jsx            # Compact dice history strip above the TLDraw canvas (no polling)
│   │   │   ├── Whiteboard.jsx         # TLDraw collaborative whiteboard (useSync, WebSocket to /api/whiteboard/:gmUid)
│   │   │   ├── CharacterHoverCard.jsx # Detailed character sheet hover panel (traits, defense, weapons, inventory, features)
│   │   │   ├── CollectionFilters.jsx  # Shared filter bar/panel (bar variant + panel variant)
│   │   │   ├── TierSelector.jsx       # Shared tier 1–4 button bank (multi-select for filters, single-select for character dialog)
│   │   │   ├── ItemActionButtons.jsx  # Shared Add to Table, Clone, Edit, Delete (ItemCard + ItemDetailModal)
│   │   │   ├── forms/          # Item forms (controlled+uncontrolled); ImageEditor for add/remove images; SceneForm has Battle Budget section
│   │   │   │   └── modals/         # ItemDetailModal (unified view+edit overlay; SceneBudgetBar for scenes)
│   │   └── lib/                # API client, helpers, constants, battle-points.js, table-ops.js, router, hooks, markdown
│   ├── srd/                    # SRD sub-application (no DB dependency)
│   │   ├── parser.js           # Loads .build/03_json/*.json, normalizes 13 collections, caches in memory
│   │   ├── router.js           # Express Router — GET /api/srd/collections, /:collection, /:collection/:id
│   │   └── index.js            # Re-exports srdRouter, warmCache, getItem, searchCollection, COLLECTION_NAMES
│   ├── db.js                   # Postgres pool + migration runner + query helpers (unified query, item_popularity, external cache)
│   ├── external-sync.js        # Background sync of FCG + HoD (parallel; HoD incremental + weekly full)
│   ├── srd-loader.js           # Loads SRD adversaries/environments into external_item_cache at startup
│   ├── external-sources.js     # EXTERNAL_SOURCES for legacy /api/data bulk endpoint
│   ├── fcg-search.js           # FreshCutGrass public search API (used by external-sync)
│   ├── hod-search.js           # Heart of Daggers Vault integration (used by external-sync)
    │   ├── text-parse.js           # Regex-based stat block parser (selftext + OCR output)
    │   ├── ocr-parse.js            # Multi-engine OCR orchestrator + artwork cropping
    │   ├── ocr-engines/            # Per-engine adapters (common contract: name/isAvailable/recognize/terminate)
    │   │   └── tesseract.js        # Tesseract.js WASM adapter (always available)
    │   ├── llm-parse.js            # GPT-4o vision parse — optional LLM fallback for Reddit posts
│   └── input.css               # Tailwind CSS entry point
├── server.js                   # Express server + API routes
├── package.json
├── vitest.config.js            # Vitest unit test config (test/unit/**/*.test.js)
├── playwright.config.js        # Playwright browser test config (port 3457, NODE_ENV=test)
├── test/
│   ├── unit/                   # Vitest unit tests for pure logic modules
│   │   ├── battle-points.test.js
│   │   └── table-ops.test.js
│   ├── browser/                # Playwright browser/visual regression tests
│   │   └── smoke.spec.js
│   ├── helpers/
│   │   └── auth.js             # Playwright helper: mock Firebase + API for authenticated tests
│   ├── fixtures/               # OCR parse fixture images + expected JSON
│   └── parse-fixtures.js       # OCR engine accuracy scorecard (run manually)
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

There is also an **Include HoD** and **Include FCG** toggle for the [Heart of Daggers Homebrew Vault](https://heartofdaggers.com/vault/) and FreshCutGrass.app. SRD, HoD, and FCG content is pre-synced into the database by a background job (daily 3 AM: FCG full + HoD incremental; weekly Sunday 3 AM: HoD full refresh; run `npm run crawl` manually to refresh). Both HoD and FCG items are read-only in their source form; use "Clone to My Library" or the in-context "Edit Copy" flow to make an editable copy. **Adding any item to the Game Table automatically clones it to your library** (finding an existing auto-clone if one already exists), so your library reflects everything you've actually used at the table.

A **compact/spacious view toggle** (grid icon in the header) switches between a spacious 3-column card layout and a dense 7-column layout. Compact mode hides the banner image and shows a small bottom-right thumbnail that expands on hover. The choice is persisted in `localStorage` under `libraryViewMode`.

### Built-In Dice System

The **Game Table** tab layout: a **Characters panel** (left sidebar, `w-56`) with a dedicated "+ Add Character" button and character cards; a **center column** (`flex-1`) with a compact **Dice Log strip** (`DiceLog.jsx`) above a **TLDraw collaborative whiteboard** (`Whiteboard.jsx`); an **Encounter panel** (right sidebar, `w-56`, GM only) with Fear counter, GM Moves hover trigger, BP Budget card, Add menu (Adversary/Environment/Scene), environment cards, and adversary HP/stress tracks.

The "+ Add Character" button in the Characters panel opens a small dialog. Characters are GM-side party tracking cards stored as `elementType: 'character'` entries in `activeElements` (no separate DB collection). Each character has a name, player name, **tier** (1–4, default 1; selected via the shared `TierSelector` component), Hope counter (±buttons), HP track, Stress track, and conditions field. A tier badge (`T{n}`) is displayed on each character card header. The highest character tier (`partyTier`) is used as the comparison basis for the "lower-tier adversary" BP budget auto-modifier. Character cards use sky-blue styling to distinguish them from adversaries (dark) and environments (emerald). The pencil icon reopens the creation dialog pre-filled for mid-session edits. Clear Table preserves character cards — only adversaries and environments are removed.

**Multi-player support**: GMs can invite players by email via the "Manage Invited Players" section in the Characters panel. Invited players sign in and see a dedicated nav tab linking directly to the GM's table. Real-time sync uses **Server-Sent Events (SSE)**: `GET /api/room/my/players` keeps the GM updated on who is connected; `GET /api/room/:gmUid/stream` streams table state and dice roll events to players. **Operational sync**: each GM mutation (HP toggle, fear change, element add/remove, etc.) broadcasts a lightweight `table-op` SSE event via `POST /api/room/my/op` so other clients see changes instantly. The debounced table_state save (2s) handles DB persistence and provides consistency repair for any lost ops. `CLIENT_ID` (stable per-session UUID) tags both saves and ops for self-echo skip. When the GM rolls dice, 3D dice animations play on all screens simultaneously; the GM acknowledges the roll (via `POST /api/room/my/dice-ack`), which then applies side effects on all clients. The GM can assign characters to specific players (`assignedPlayerUid`); assigned players can edit their own character's resources (HP, stress, hope) while all other table content is read-only for players.
- **TLDraw Whiteboard** (center) — a full-featured collaborative canvas powered by [TLDraw](https://tldraw.dev/). All table participants (GM and players) can draw simultaneously in real time. State is persisted to Postgres via WebSocket sync (`GET /api/whiteboard/:gmUid`). Images pasted or dropped onto the canvas are uploaded to **Supabase Storage** (`whiteboard-assets` bucket) via `POST /api/whiteboard/assets` and stored as public CDN URLs, keeping the Postgres snapshot lean. Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars and a public bucket named `whiteboard-assets` (see Supabase setup below). Without these the asset store falls back to inline data URLs automatically. **Player permissions**: every shape is tagged with its creator's UID (`meta.createdBy`); when a player is viewing the board, TLDraw side-effect hooks (`beforeChange`, `beforeDelete`) prevent them from modifying or deleting shapes they did not create. Shapes without an owner (pre-existing content) are treated as GM-owned and are equally protected.
- **Dice Log** (center, strip above whiteboard) — a compact history of completed rolls for the current session; auto-scrolls to the newest entry

Dice rolling requires no external service or credentials. Attack actions are always clickable:
- Clicking an action in the **GM Moves** sidebar rolls server-side and briefly flashes green on success
- The **attack line** and **action-type attack features** on each adversary card also show a dice icon and roll when clicked

Rolls are processed by `POST /api/room/my/roll` (GM) or `POST /api/room/:gmUid/roll` (player). The server uses `crypto.randomInt` for tamper-proof dice and broadcasts results to all room clients via SSE. An in-memory ring buffer (last 50 rolls) is sent to late-joining players on connect.

### Adding to the Game Table

The Encounter panel's **Add** menu has three options — **Adversary**, **Environment**, and **Scene** — each of which opens an **`ItemPickerModal`** and **appends** the selection to the current table (never clears the board). For adversaries and environments the modal uses `useCollectionSearch` + `CollectionFilters` (panel variant) providing Source, Tier, Role/Type, and a search box with infinite scroll. For scenes a simple client-side search is shown. Results appear as text rows. Clicking a result adds it to the table and closes the modal.

A **Capture Table** button (camera icon, disabled when the table is empty) opens a small dialog where you name and save the current table contents as a new **Scene** (capturing all adversaries and environments). After saving, the new scene is opened in the library.

### Environment — Potential Adversaries

Environments carry a structured `potential_adversaries` field: an array of `{ adversaryId?, name }` objects.

- **Linked reference** (`{ adversaryId, name }`): points to a real adversary in the library or SRD. Displays with a chain-link icon.
- **Placeholder** (`{ name }`): a named-only entry with no linked adversary yet. Displays with a dashed border.

In the environment edit form (`EnvironmentForm`), a **"Potential Adversaries"** section lets you:
- **Find & link**: opens the adversary picker (searches own, SRD, HoD, FCG adversaries).
- **Enter a placeholder**: type a name and press Add/Enter.
- **Link a placeholder later**: click the search icon on any placeholder to open the picker pre-filtered to that name.
- **Create from placeholder**: click the plus icon to instantly create a new adversary stub (inheriting the environment's tier), which replaces the placeholder with a linked reference.

SRD environments auto-populate linked references using deterministic SRD adversary IDs (`srd-adv-<slug>`). FCG and HoD produce name-only placeholders. The `normalizePotentialAdversaries(raw)` helper (exported from `EnvironmentForm.jsx`) coerces any legacy string or empty value to the array format and is used throughout the display layer.

### Scene / Adventure Forms

Scenes can reference adversaries, environments, and **nested Scenes** (allowing reusable encounter building blocks). When creating or editing a Scene or Adventure, a bank of **"Add Adversary / Add Environment / Add Scene"** buttons appears via the `CollectionRefPicker` widget. Each button opens the same `ItemPickerModal`. All selected items appear in one combined list with type badges, quantity controls (for adversaries), and remove buttons. Pre-existing references are resolved on mount via `POST /api/data/resolve`.

**Circular reference prevention**: `SceneForm` validates nested scene selections at save time — if adding a scene would create a cycle (scene A → scene B → scene A), the save is blocked with an error. All expansion functions also pass a `visited` set to guard against cycles in stale data.

Nested scene chips display in **blue** on `ItemCard` in the Scenes library tab.

### Image Import

The **"Import"** button in the Library header opens an `ImageImportModal` — a single-page import flow for stat block images or pasted text.

**Three input methods** are supported:
- **Drag and drop** — drop image files onto the drop zone
- **Click to browse** — standard file picker (`image/*`, multiple selection)
- **Clipboard paste** — Ctrl/Cmd+V after copying a screenshot or image

**Optional text input** — paste one or more stat blocks as plain text (separate multiple blocks with blank lines).

**Auto-parse**: images are parsed automatically as they're added or removed (debounced 600ms). Each image thumbnail has a role toggle — **"Stat block"** (default, sent to `POST /api/import/parse` for OCR + regex detection) or **"Scene img"** (excluded from parsing, used as scene artwork). Toggling an image to "Scene img" automatically enables the Scene builder. The server runs Tesseract.js OCR on each buffer via `ocrBuffer()`, then calls `detectCollection()` to auto-detect adversary vs environment using keyword heuristics. No LLM is used.

**Inline preview**: parsed items appear below the input area in collapsible cards. A confidence badge (%) indicates parse quality. An `⇄` button lets you override the auto-detected type. All cards are editable inline via `AdversaryForm` / `EnvironmentForm` before importing. Duplicate detection warns when an item's name matches an existing library entry, with "Add as new" / "Replace existing" choice.

**Scene builder**: a "Create a Scene" checkbox at the bottom of the modal assembles a scene from imported items. Parsed adversaries/environments are saved first, then a scene is created with references to them. Images marked as "Scene img" become the scene's `imageUrl` (converted to data URL). The import button reflects what will be created (e.g. "Import Scene + 3 Items").

### Markdown Support

All multi-line text fields support **GitHub Flavored Markdown** (GFM): bold, italic, bullet lists, numbered lists, blockquotes, inline code, and links. This applies to feature descriptions, adversary/environment descriptions, motives, and scene/adventure descriptions — for items of any origin (own, SRD, Reddit, HoD, FCG, or created from scratch).

A `MarkdownHelpTooltip` icon (?) appears next to description and feature textareas in all edit forms. Hovering shows a compact cheat sheet and a link to the full GFM documentation.

**Rendering**: `FeatureDescription` renders feature text as markdown HTML with GM-trigger phrases (spend/mark fear, mark stress) and dice patterns (XdY+Z, e.g. 2d6+3) bolded as a post-processing step. Other multi-line text fields use the `MarkdownText` component (`src/client/lib/markdown.js`, `.dh-md` CSS class). Items truncated for compact display (card grid, GM sidebar) remain plain text to avoid jagged `line-clamp` truncation.

**OCR parsing**: when a Reddit stat block image is parsed, Strategy 1 of the text parser now preserves newlines and applies `formatListPatterns()` to auto-detect and convert d-table ranges (`1-2: Sugar Shrub. 3-4: Spiced Gravel.`) and concatenated numbered lists into proper markdown bullets. The LLM parser is similarly instructed to emit markdown for feature descriptions containing roll tables or lists.

### Item Detail and Editing

All item viewing and editing happens inside a single **`ItemDetailModal`** overlay — there are no separate view or edit pages.

- **Library**: Clicking any card (or "New") opens `ItemDetailModal`. Own items show a split pane: **live display preview** on the left (updates in real-time as you type), **edit form** on the right. Adversaries show a stacked **Feature + Experience Library** (tab switcher; experiences from matching adversaries); environments show a narrow **Feature Library** panel. Changes **auto-save** after 800ms of inactivity. **Undo/redo** (Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z) are available for the full session. SRD/public/FCG items open display-only with a Clone action.
- **Game Table**: The pencil button on each card opens an `EditChoiceDialog` asking "Edit Table Copy" or "Edit Library Original", then opens `ItemDetailModal`. Copy mode auto-saves only in memory (preserving HP/stress). Original mode auto-saves to the DB.
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

#### 2e. Enable the Google People API (optional — for Contact autocomplete)

The "Manage Invited Players" panel offers a **Google Contacts autocomplete** that lets GMs pick player emails from their contacts. This requires the People API:

1. GCP console → **APIs & Services** → **Library** → search **"People API"** → click **Enable**.
2. No extra environment variables needed — the client uses the existing Google OAuth flow.

Without this step the contact autocomplete button simply won't appear (or will fail silently); the manual email input always works as a fallback.

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

### 3. Enable Supabase Storage for whiteboard images (optional)

Images pasted or dropped onto the TLDraw whiteboard are uploaded to Supabase Storage so they are served from the CDN rather than bloating the Postgres snapshot. This step is optional — without it the whiteboard still works but images are embedded as data URLs in the canvas state.

1. Supabase dashboard → **Storage** → **New bucket**.
2. Name it **`whiteboard-assets`** and enable **Public bucket** (so images can be served directly without signed URLs).
3. Supabase dashboard → **Project settings** → **API**.
4. Copy the **Project URL** and the **`service_role`** secret key (under "Project API keys").
5. Add to `.env`:

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

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
| `OPENAI_API_KEY` | No | OpenAI API key — optional LLM fallback for Reddit posts that can't be parsed by regex/OCR |
| `HF_TOKEN` | No | Hugging Face access token — enables the "Generate with AI" image button in all item editor forms. Without this the button is hidden. Generate one at huggingface.co/settings/tokens (needs "Inference Providers" write permission). |
| `HF_MODEL` | No | Hugging Face model ID for text-to-image generation (default: `black-forest-labs/FLUX.1-schnell`) |
| `HF_EDIT_MODEL` | No | Hugging Face model ID for image-to-image editing (default: `black-forest-labs/FLUX.1-Kontext-dev`) |
| `HF_PROVIDER` | No | Hugging Face inference provider (default: `replicate`). Other options: `fal-ai`, `together`, `novita`, etc. — see huggingface.co/docs/inference-providers |
| `ADMIN_EMAILS` | No | Comma-separated list of email addresses granted admin access (e.g. `alice@example.com,bob@example.com`). |
| `SUPABASE_URL` | No | Supabase project URL (e.g. `https://xxxx.supabase.co`). Required for whiteboard image asset uploads to Supabase Storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase `service_role` secret key. Required for whiteboard image asset uploads. Keep this secret — never expose it client-side. |

---

## Development

```bash
npm run dev        # development — auto-restarts on file changes (Node 18+)
npm start          # production
npm run build      # rebuild CSS + JS bundles
npm run crawl         # manual FCG + HoD sync (same as daily cron)
npm run crawl:fcg     # sync FCG only
npm run crawl:hod     # sync HoD only (incremental)
npm run crawl:hod -- --full          # HoD full refresh (same as weekly cron)
npm run refresh:daggerstack          # regenerate Daggerstack UUID map (same as nightly 4 AM cron)
```

### Dev Live Reload

`npm run dev` starts esbuild and Tailwind in watch mode. The server exposes `GET /livereload` — an SSE endpoint that watches `public/` for file changes and broadcasts a reload signal. `public/index.html` includes a small inline `EventSource` script that calls `location.reload()` whenever the signal arrives or the connection is re-established after a server restart. No browser extension or extra tooling needed.

### Regression Test Suite

The project has two layers of automated tests:

| Layer | Framework | Location | Command |
|-------|-----------|----------|---------|
| Unit (pure logic) | Vitest | `test/unit/*.test.js` | `npm run test:unit` |
| Browser / visual | Playwright | `test/browser/*.spec.js` | `npm run test:browser` |
| Both | — | — | `npm test` |

```bash
npm test              # run unit + browser tests
npm run test:unit     # Vitest only (fast, no server needed)
npm run test:browser  # Playwright only (starts server on port 3457)
```

**Regression test policy**: every bugfix must include a test that fails without the fix and passes with it. See `.cursor/rules/testing.mdc` for detailed guidance, including how to mock Firebase auth and assert CSS properties for visual bug regressions.

The Playwright test server runs on port 3457 (`NODE_ENV=test`) with a Firebase auth bypass for `Authorization: Bearer test-token`. The `test/helpers/auth.js` helper sets up all required route mocks in one call.

First-time setup (Playwright Chromium download):
```bash
npx playwright install chromium
```

### OCR Engine Testing

A fixture-based test runner compares OCR engine accuracy on real stat card images:

```bash
node test/parse-fixtures.js                    # all available engines
node test/parse-fixtures.js --engine tesseract # one engine only
```

Fixture images live in `test/fixtures/{adversaries,environments}/`. Each image needs a matching `<name>.expected.json` with the fields to validate. Add new fixtures organically whenever a card parses badly in production — drop the image and expected JSON into the folder.

---

### Deployment (Fly.io)

A `Dockerfile` and `fly.toml` are included for Fly.io deployment.

```bash
fly auth login
fly launch --no-deploy   # creates app on first run; skip if fly.toml already configured
fly secrets set \
  DATABASE_URL=... \
  FIREBASE_PROJECT_ID=... \
  FIREBASE_API_KEY=... \
  FIREBASE_AUTH_DOMAIN=... \
  FIREBASE_APP_ID=... \
  APP_ID=... \
  ADMIN_EMAILS=...
fly deploy
```

The `fly.toml` allocates 1 GB of memory per VM — required for CPU-based PyTorch inference. Adjust `cpus` and `memory` as needed.

---

### Adding API Routes

Add routes in `server.js` before the static middleware block:

```js
app.get('/api/example', (req, res) => {
  res.json({ message: 'Hello' });
});
```
