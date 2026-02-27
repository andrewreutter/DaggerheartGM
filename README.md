# DaggerheartGM

A GM tool for the Daggerheart tabletop RPG.

## Architecture

Express.js server serving a React SPA built from `src/client/`. Authentication is handled by Firebase (Google sign-in). Data persistence is backed by Postgres via Supabase. Client-side routing uses the History API (`src/client/lib/router.js`) so the browser back/forward buttons work across all views.

The nav bar user menu (click your name/email) provides Export JSON, Import JSON, and Sign Out.

```
DaggerheartGM/
├── .cursor/rules/project.mdc   # Cursor agent context (always applied)
├── data/                       # Generated SRD JSON (not committed — run npm run fetch:srd)
│   ├── srd-adversaries.json
│   └── srd-environments.json
├── migrations/                 # Numbered .sql migration files
│   ├── 001_create_items_table.sql
│   └── 002_add_is_public.sql
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
│   │   │   ├── forms/          # Item creation/edit forms (all include is_public toggle)
│   │   │   └── modals/         # Import modals (Rolz, FreshCutGrass) + ImportPreviewCard
│   │   └── lib/                # API client, helpers, constants, parsers, router
│   ├── db.js                   # Postgres pool + migration runner + query helpers
│   ├── fcg-scraper.js          # Puppeteer scraper for FreshCutGrass.app
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

Users can then toggle "Include SRD" in the Adversaries/Environments library views to show SRD content alongside their own items. SRD items are read-only; use "Clone to My Library" to make an editable copy.

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

### Adding API Routes

Add routes in `server.js` before the static middleware block:

```js
app.get('/api/example', (req, res) => {
  res.json({ message: 'Hello' });
});
```
