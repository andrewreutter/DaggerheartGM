---
name: SRD RAG + tool loop
overview: Index `data/srd-text-chunks` into pgvector, expose a small `searchSrdRag` module for in-process use, clean chunk files (no HTML comments), and document Chat Completions + tool definition + instructions (no Custom GPT or public tool-secret endpoint required).
todos:
  - id: chunks-cleanup
    content: Remove HTML comments from chunk-srd-readme.mjs; regenerate data/srd-text-chunks
    status: pending
  - id: db-migration
    content: Add pgvector migration + srd_rag_chunks table + index
    status: pending
  - id: index-script
    content: Implement index-srd-rag.mjs (parse YAML, embed Context+body, upsert)
    status: pending
  - id: search-module
    content: Add src module searchSrdRag(query) + embed query; used by tool executor in same process
    status: pending
  - id: docs-tool-loop
    content: Add short docs (e.g. docs/srd-rag-tool.md) with tool JSON schema, system prompt hints, Chat Completions tool loop pseudocode
    status: pending
  - id: project-readme
    content: Update README.md and .cursor/rules/project.mdc for env vars, index script, and doc link
    status: pending
  - id: tests
    content: Unit test(s) for embed-string builder and/or search helper
    status: pending
isProject: true
---

# SRD RAG (simplified): index + local search + Chat Completions tools

## Goal

Support **your code** calling OpenAI **Chat Completions** (or Responses API) with a **`lookup_srd`-style tool** in the request body, plus **system/developer instructions**. When the model returns `tool_calls`, **your server executes search in-process** (same Node process) — no Custom GPT, no Assistants API requirement, no public HTTPS endpoint that OpenAI calls.

Optional later: a **debug** `POST` route behind `requireAuth` that wraps the same function (not required for the tool loop).

---

## 1. Chunk files: remove noise, keep metadata

- Edit [`scripts/chunk-srd-readme.mjs`](scripts/chunk-srd-readme.mjs): **remove** the HTML comment block from `buildFileContent`. Keep YAML frontmatter + markdown body.
- Shorten the script file header comment if needed.
- Run `npm run chunk:srd` to regenerate [`data/srd-text-chunks/`](data/srd-text-chunks/).

---

## 2. Indexing pipeline

**Embedding model (default):** `text-embedding-3-small` (1536 dims); use existing `OPENAI_API_KEY` + `fetch` pattern ([`src/llm-character-builder.js`](src/llm-character-builder.js)).

**String to embed per chunk:**

```text
Context: <breadcrumb from YAML>

<body markdown>
```

**DB:** Migration: enable **pgvector** + table `srd_rag_chunks` (`id`, `embedding vector(1536)`, JSONB or text columns for breadcrumb, body, source filename, part fields). Add a vector index (HNSW/IVFFlat per host support).

**Script:** `scripts/index-srd-rag.mjs` + `npm run index:srd-rag` — read all chunk files, upsert idempotently.

**Env:** `OPENAI_API_KEY`, optional `OPENAI_EMBEDDING_MODEL`, `DATABASE_URL`.

---

## 3. Runtime search (core deliverable)

Implement **`searchSrdRag(query, { topK, chapter? })`** in e.g. [`src/srd-rag/`](src/srd-rag/) or [`src/server/srd-rag.js`](src/server/srd-rag.js):

1. Embed `query` with the **same** model as indexing.
2. Query Postgres for nearest neighbors; return ranked rows with breadcrumb, body (or excerpt), optional score.

**Tool execution path:** whatever code handles your agent loop calls **`searchSrdRag`** directly when the model requests `lookup_srd` — **no** round-trip to a public URL for OpenAI.

---

## 4. Documentation (minimal)

Add something like [`docs/srd-rag-tool.md`](docs/srd-rag-tool.md):

1. **Tool definition** — JSON Schema for `lookup_srd` (`query`, optional `top_k`) to paste into `tools` in Chat Completions.
2. **Instructions** — short system prompt guidance (use tool for rules text; prefer citing retrieved content).
3. **Tool loop** — pseudocode: `messages` + `tools` → if `tool_calls`, run `searchSrdRag`, append `tool` messages, call again until final `content`.

No Custom GPT / Assistants / Actions sections unless you add them yourself later.

---

## 5. Tests + project docs

- Unit tests: embed-string construction from a fixture chunk; optional search with mocked DB.
- Update [`README.md`](README.md) and [`.cursor/rules/project.mdc`](.cursor/rules/project.mdc): `index:srd-rag`, env vars, link to `docs/srd-rag-tool.md`.

---

## Architecture

```mermaid
flowchart TB
  subgraph index [Offline]
    Chunks[data/srd-text-chunks]
    IndexScript[index-srd-rag.mjs]
    EmbedAPI[OpenAI Embeddings]
    PG[(Postgres pgvector)]
    Chunks --> IndexScript --> EmbedAPI --> PG
  end
  subgraph app [Your app]
    AgentLoop[Chat Completions + tools]
    ToolExec[Execute lookup_srd]
    Search[searchSrdRag]
    PG --> Search
    AgentLoop -->|tool_calls| ToolExec --> Search --> AgentLoop
  end
```

---

## Optional later

- Hybrid BM25 + vector.
- Authenticated HTTP search route for manual testing only.
- Public endpoint + secret only if a **remote** caller must hit search (not needed for the in-process tool loop).
