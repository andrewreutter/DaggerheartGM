---
name: ""
overview: ""
todos: []
isProject: false
---

# Unified import — handoff plan (v2)

Successor to the initial unified-import sketch. This version incorporates product feedback and is ready for implementation handoff.

---

## Goals (unchanged)

One import tool: **full-window drop target**, **global paste/select**, **library save**, and **when on the Game Table — add to table** using the same flows. Merge strengths of: map drop/paste, Encounter page-regions + type choice, Library stat-block import.

---

## Parser reality: hotword registry per type

**Requirement:** Maintain an explicit **list of hotwords (and, where useful, regex patterns)** per destination type, not only ad‑hoc strings in `detectCollection`.

- **Today:** Adversary vs environment signals live inline in `[src/text-parse.js](src/text-parse.js)` (`detectCollection`: HP/Attack/Thresholds vs Impulses/Potential Adversaries, plus confidence from `parseStatBlock` for both collections).
- **Handoff work:** Extract and centralize these into a **documented module** (e.g. `src/import-type-hotwords.js` or a section in `text-parse.js` with clear exports) so implementers can:
  - See **all** signals for adversary and environment in one place.
  - **Add** hotwords and **type-specific field hints** for other collections as they become supported (e.g. weapon tags, armor thresholds, scene budget language — whatever is unique to that type).
- **Behavior:** Auto-detect / scoring uses this registry; user overrides still win in the unified UI.

If a type has **no** parser yet, the registry still lists **optional** keywords for future use or for “soft” suggestions in the UI.

---

## UX: always show “Additional text”

- The **optional Additional text** field is **always visible** in the unified import flow.
- It is **not** conditional on having uploaded images: text-only import (paste or typed) must work with **only** this field + commit.

---

## UX: crop-first for every image (primary use case)

- For **each** uploaded image, show the **region/crop editor** (reuse patterns from `[PageLayoutPreviewModal.jsx](src/client/components/modals/PageLayoutPreviewModal.jsx)`: rectangle, zoom/pan, optional OCR debounce per crop).
- **Order of operations:**  
  1. User sets crop (and optionally “ignore text” / OCR settings per slice).
  2. **Then** the app runs OCR/parse on the **cropped** result (or uses crop as image asset for map/note).
  3. **Then** the user chooses or confirms **what** to do (map, adversary, environment, note, generic library type, etc.).

**Product intent:** A common flow is **full-page screenshot** → **only one stat block** matters. Cropping must feel like the **first** step, not an advanced extra.

Implementation note: this may mean **N crop steps** for N images (wizard or list of thumbnails each opening crop before merge). Exact layout is up to implementer; the requirement is **crop before classification/commit** for every image.

---

## No “Create a Scene” toggle

- **Remove** the Library-only “Create a Scene” assembly path from `[ImageImportModal](src/client/components/modals/ImageImportModal.jsx)` in the unified design.
- **Replacement:** If the user wants adversaries/environments on the table together, they run import **from the Game Table** with **add to table** enabled so new library rows and table elements stay in sync. Scene graphs that reference those IDs can be built in the library afterward if needed (out of scope for this import unless a later feature adds it back explicitly).

---

## Game Table: “Add to table” always on by default

- When **context is the Game Table** (GM session on `/table/:tableId`), the **Add imported items to this table** control defaults to **on** and should **remain** on (no “default off” or easy accidental off). Wording can still allow turning it **off** for edge cases (e.g. library-only prep), but **default is always ON**.

---

## Other handoff notes (condensed)


| Topic                              | Direction                                                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **JSON backup import** (user menu) | **Keep separate** — not part of unified content import.                                                                             |
| **Daggerstack**                    | **Keep separate**; optional link “Sync character from Daggerstack” from unified modal.                                              |
| **Map paste/drop**                 | BattleMap’s immediate apply should yield to unified flow (crop + confirm “use as map”) per crop-first rule.                         |
| **APIs**                           | Reuse `POST /api/import/parse`, `encounter-drop`, `encounter-parse-text`, page-layout region OCR; add orchestration only if needed. |
| **Players**                        | Unified import **GM-only** (same as today’s map/encounter import).                                                                  |


---

## Suggested implementation todos

1. **Hotword registry** — Extract adversary/environment signals; add stub structure for future types + optional unique-field hints.
2. **UnifiedImport shell** — Global drop/paste, always-visible Additional text, GM-only.
3. **Per-image crop pipeline** — Crop → then OCR/parse → then type/destination; integrate with existing modals/helpers.
4. **Commit** — Library save; table branch with **add to table default ON** on Game Table; no Create a Scene.
5. **Remove legacy** — Retire duplicate Entry points (Library `ImageImportModal` only, Encounter strip, simplify BattleMap).
6. **Tests** — Unit tests for hotword helpers / ordering; regression for crop-then-parse.

---

## Files likely touched

- `[src/text-parse.js](src/text-parse.js)` (or new `import-type-hotwords.js`) — hotword registry.
- `[src/client/app.jsx](src/client/app.jsx)` — provider + global handlers.
- New unified modal + thin wrappers.
- `[src/client/components/GMTableView.jsx](src/client/components/GMTableView.jsx)`, `[BattleMap.jsx](src/client/components/BattleMap.jsx)`, `[LibraryView.jsx](src/client/components/LibraryView.jsx)` — entry points and callbacks.
- `[PageLayoutPreviewModal.jsx](src/client/components/modals/PageLayoutPreviewModal.jsx)` or extracted **crop** component — reuse for per-image crop-first.

