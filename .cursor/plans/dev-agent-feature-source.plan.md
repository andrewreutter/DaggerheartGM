---
name: ""
overview: ""
todos: []
isProject: false
---

# Dev agent: Feature Source chatbox (final plan)

Consolidates the original Feature Source viewer chatbox design with later decisions: **GitHub Issues** as the queue/status store (no local JSON queue file), and **starting the worker from `npm run dev`**.

## Goals

- Admin-only UI at the bottom of `**[FeatureSourceModal](../../src/client/components/features/FeatureSourceModal.jsx)**` (local dev / sandbox): kind **bug | feature | other**, free-text request, submit.
- **Cursor CLI** drives work: `cursor agent --print --trust --force --model` (default `**composer-2`**; confirm with `cursor agent --list-models`), `**--workspace`** repo root — same invocation style as `[scripts/lib/cursor-agent-runner.mjs](../../scripts/lib/cursor-agent-runner.mjs)`.
- Pipeline: enqueue → worker processes **one job at a time** → **git branch** off `main` → implement / validate / fix loop (single-word state tokens) → **open PR** → human review/merge.
- **GitHub Issues** are the durable record: no `.dev-agent-queue/state.json`. Visiting the same feature path again shows status by **listing/filtering issues** that carry a structured `path` in the body.
- `**npm run dev`** launches the worker **alongside** the existing watched server, Tailwind, and esbuild (see **Dev script** below).

## Non-goals

- Production enablement (guard with env + admin only).
- Cloud Cursor Agents API for this flow (that remains `[scripts/orchestrate.js](../../scripts/orchestrate.js)`); this path is **local CLI + Issues**.

---

## GitHub Issues (source of truth)

### Labels

Use a small, documented set (create once via script or manual UI):


| Label                     | Role                            |
| ------------------------- | ------------------------------- |
| `dh-dev-agent`            | Marks issues owned by this tool |
| `dh-agent-queued`         | Waiting for worker              |
| `dh-agent-running`        | Worker claimed                  |
| `dh-agent-awaiting-human` | PR open, needs merge/review     |
| `dh-agent-failed`         | Terminal error                  |


Swap **exactly one** state label (`dh-agent-*` state) per transition.

### Issue body

- Machine-readable JSON block (comment or fenced json): `{ "v": 1, "path": "abilities/…/File.js", "kind": "bug"\|"feature"\|"other", "submittedAt": "ISO-8601" }`
- `path` = normalized segment under `src/features-v2/` (same validation as `[GET /api/features-v2/source](../../server.js)` via `safeResolveUnderFeaturesRoot`).
- Below: user message (markdown).

### Repo identity

- `**GITHUB_REPOSITORY`** = `owner/repo` (standard; used by server + worker).
- Worker may fall back to `git remote get-url origin` if unset (dev tree always has `.git`).

### Token

- Reuse `**GITHUB_TOKEN` / `GH_TOKEN`** from [orchestrate PR flow](../../scripts/orchestrate.js). Scope must include **Issues** read/write (classic `repo` is enough).

### Worker loop (no local queue file)

1. Poll `**GET /repos/{owner}/{repo}/issues?labels=dh-dev-agent,dh-agent-queued&state=open`**, sort by `created_at` ascending, take first.
2. **Claim**: PATCH labels — remove `dh-agent-queued`, add `dh-agent-running` (retry if race).
3. Run git + `cursor agent` pipeline on branch `dev-agent/<issueNumber>-<shortid>`.
4. Push; create PR (reuse `**createPullRequest`** pattern from orchestrate or shared `scripts/lib/github-pr.mjs`).
5. Comment on issue with PR URL/number; set `**dh-agent-awaiting-human`**, remove `dh-agent-running`.
6. Poll PR merge; on merge, comment + **close** issue (or add `dh-agent-done` + close).

### Merge / status for UI

- **GET** handler lists issues with label `dh-dev-agent`, filters by parsed `path` in body; returns issue URL, state labels, PR URL/number, merged when known (poll `GET /repos/.../pulls/{number}` on read if token present).

---

## Express API

- `**requireAuth` + `requireAdmin`** + `**DEV_AGENT_QUEUE_ENABLED=1`** (return 404/503 if off).
- `**POST /api/dev-agent/queue**` — body `{ path, kind, message }` → `**POST /repos/.../issues**` with title e.g. `[dh-dev-agent] {kind}: {path}`, labels `dh-dev-agent`, `dh-agent-queued`.
- `**GET /api/dev-agent/issues?path=**` — list/filter by path for modal status + links.

---

## Cursor + prompts

- Shared runner: `cursor agent --print --trust --force --model ${DEV_AGENT_MODEL:-composer-2} --workspace <REPO> <prompt>` (see [Cursor CLI parameters](https://cursor.com/docs/cli/reference/parameters)).
- **feature** → excerpt from `[docs/agent-prompts/implementation-agent.md](../../docs/agent-prompts/implementation-agent.md)` + user text + path.
- **bug** → excerpt from `[docs/agent-prompts/fixit-agent.md](../../docs/agent-prompts/fixit-agent.md)` + user text + path.
- **other** → neutral task template.
- Last-line **single-word state** contract aligned with `[scripts/lib/cursor-agent-state.mjs](../../scripts/lib/cursor-agent-state.mjs)` / `parseStateWithFallback` in `cursor-agent-runner.mjs` (`Done`, `Validated`, `NeedsFix`, `AwaitingHuman`, …).

---

## Client UI (`[FeatureSourceModal.jsx](../../src/client/components/features/FeatureSourceModal.jsx)`)

- Layout: flex column — scrollable code area `min-h-0`, **fixed footer** with kind control, textarea, submit, **status** (phase, links to Issue + PR).
- **Admin only**: pass `isAdmin` from parents or `fetchMe()` when modal opens.
- Poll GET every **10–15s** while open.

---

## Dev script (`[package.json](../../package.json)`)

Current:

`dev`: `node --env-file=.env --watch server.js & npm run dev:css & npm run dev:js`

**Add** (same line, fourth background job):

`node --env-file=.env scripts/dev-agent-queue-worker.mjs &`

Worker **exits 0 immediately** if `DEV_AGENT_QUEUE_ENABLED` is not `1` or `GITHUB_TOKEN`/`GH_TOKEN` missing (quiet dev for contributors without the feature). Optional `**DEV_AGENT_WORKER=0`** skips spawning the worker without editing the script.

---

## Tests

- Vitest: parse issue body JSON, path filter, label transition helpers (no live GitHub).

---

## Documentation

- Update `**[.cursor/rules/project.mdc](../../.cursor/rules/project.mdc)`** and `**[README.md](../../README.md)**`: env vars, labels, `npm run dev` (four processes), `DEV_AGENT_WORKER=0`, token scopes, **public repo** caveat for issue visibility.

---

## Implementation todos

1. GitHub helpers: Issues create/list/PATCH labels/comment; PR create (factor from orchestrate); PR merge check.
2. Optional `scripts/setup-dev-agent-labels.mjs` or README one-time setup.
3. `scripts/dev-agent-queue-worker.mjs` — poll Issues, claim, git branch, cursor loop, PR, merge detection.
4. Server routes: POST queue, GET status (admin + flag).
5. `FeatureSourceModal` footer UI + polling.
6. Extend `package.json` `**dev`** script to start worker.
7. Unit tests + doc updates.

