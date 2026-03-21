---
name: Orchestrator Cloud Agents cost estimator
overview: Add cost tracking/estimation to scripts/orchestrate.js for Cursor Cloud Agents runs, using API usage when available and configurable per-model USD fallbacks (defaults aligned to --model / --val-model).
todos:
  - id: inspect-cursor-agent-payload
    content: Extend checkAgent (or one-off log) to capture full GET /v0/agents/:id JSON; document which fields (usage, cost, tokens) Cursor exposes
    status: pending
  - id: cost-module-or-inline
    content: Add estimateOrchestratorCost({ model, agentPayload, durationMs }) with env overrides ORCHESTRATOR_MODEL_COST_USD_JSON
    status: pending
  - id: wire-completions
    content: On FINISHED (and recovery path), record cost in completionHistory + log line; optional session total in final report
    status: pending
  - id: docs-env
    content: Document .env.example + orchestrator header comment for pricing env vars
    status: pending
  - id: unit-tests
    content: test/unit/orchestrator-cost.test.js for pure cost math (fake payloads)
    status: pending
isProject: true
---

# Orchestrator cost estimator (Cursor Cloud Agents only)

## Scope

- **In scope**: `[scripts/orchestrate.js](scripts/orchestrate.js)` — agents launched via `POST /v0/agents` with `CURSOR_API_KEY`, using CLI models:
  - `--model` (default `claude-4.6-opus-high-thinking`) for impl / fix / unblock
  - `--val-model` (default `claude-4.6-opus-high-thinking-fast`) for val
- **Out of scope**: `[src/llm-parse.js](src/llm-parse.js)`, OpenAI/Gemini app keys, Hugging Face — unless you add a separate plan later.

## Why two layers

1. **Best case**: Cursor’s `GET /v0/agents/:id` response includes usage or billed cost fields. Then `checkAgent` should return the **full agent object** (or merge documented billing fields) and we compute or display **actual** usage-derived cost when present.
2. **Fallback**: If the API does not expose token/cost data, use **your** numbers: env-based **USD per completed agent** (or per model id string), e.g. `ORCHESTRATOR_MODEL_COST_USD_JSON='{"claude-4.6-opus-high-thinking":0.42,"claude-4.6-opus-high-thinking-fast":0.15}'` so overnight runs still show a **rough session estimate** you control from dashboard/budget notes.

## Implementation sketch

1. `**checkAgent`**: Stop discarding the full JSON; return `{ ...normalized, raw: agent }` or at least pass through any `usage` / `cost` / `billing`-like keys Cursor documents. Add a one-time `ORCHESTRATOR_DEBUG_AGENT_PAYLOAD=1` log of keys (optional) to verify shape without committing secrets.
2. `**estimateOrchestratorCost(entry, result)`** (small helper in same file or `scripts/orchestrator-cost.js`):
  - Input: `entry` (has `mode`; infer model from impl/val/fix/unblock vs `VAL_MODEL` / `MODEL` stored on entry at launch — **store `model` on each in-flight entry** when calling `launchAgent` so recovery and PR paths know the model).
  - Prefer API-reported cost/usage when present.
  - Else: lookup `entry.model` in env JSON map; else `0` with a console warning once per unknown model.
3. **Hooks**: Wherever an agent reaches `FINISHED` (main pool loop, `pollAgents`, `recoverInFlightAgents`), after PR/merge logic, call `recordCompletion` (already exists) **extended** with `model`, `estimatedCostUsd`, and optional `costSource: 'api' | 'env' | 'unknown'`.
4. **Reporting**: Append to `[formatTimingStats](scripts/orchestrate.js)` or a sibling line: `est. session cost ~$X.XX` from sum of `completionHistory` in this process (and optionally persist rolling total in state file — careful not to double-count across restarts; prefer **session-only** sum unless you add `runId`).
5. **Tests**: Pure functions only in `test/unit/orchestrator-cost.test.js` — JSON map lookup, fallback, fake API payload shapes.
6. **Docs**: `[.env.example](.env.example)` — `ORCHESTRATOR_MODEL_COST_USD_JSON`, optional debug flag; README or orchestrator JSDoc block pointing to Cursor pricing/dashboard for updating defaults.

## Note on “Composer 2”

Cursor IDE Composer quota is separate from Cloud Agents API billing; this plan only estimates **Cloud Agent** runs driven by `orchestrate.js`.