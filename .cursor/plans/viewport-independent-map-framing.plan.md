---
name: ""
overview: ""
todos: []
isProject: false
---

# Viewport-independent map framing (GM share / cameras / follow)

## Problem

Saved framing (`mapViewZoomRatio` / `mapViewPanNorm`) is normalized using **per-client** `minZoom` / `maxZoom` from `[computeMapZoomBounds](../../src/client/lib/battle-map-zoom.js)` and scroll ranges that depend on viewport size. The same values decode to **different visible rectangles** in map space on other screens, so players or thumbnails can see **more** than the GM’s window (or mis-framed content).

## Product requirement (authoritative)

**Recipients must see the entire map region the GM had in view when the framing was saved**—the full shared viewport in **inner-map coordinates**, not a cropped subset of it.

- **No “extra” map** outside what the GM could see: the displayed map region must not extend beyond the stored rectangle.
- **No dropping parts** of what the GM shared: the implementation must not zoom/pan in a way that **hides** portions of that rectangle (e.g. “contain the receiver’s viewport inside the GM rect” can crop the GM’s frame on the receiver and is **wrong** for this product goal).

When the receiver’s window has a **different aspect ratio** than the stored rectangle, the only way to show the **whole** GM rectangle without distortion is to **fit the entire rect** inside the viewport with **uniform scale** and accept **empty margin** (letterboxing / pillarboxing) around the map content—typically **black strips** or the same canvas background as the rest of the shell, explicitly acceptable for this feature.

**Not in scope:** stretching the GM’s frame to fill the viewport (that would distort). **In scope:** `object-fit: contain`–style behavior for the shared map region.

## Technical approach

### Store (viewport-independent)

Persist a normalized visible rectangle in inner-map space (same basis as today’s `renderedWidthPx` / `renderedHeightPx`):

- `innerLeft = scrollLeft / mapZoom`, `innerTop = scrollTop / mapZoom`
- `innerW = viewportW / mapZoom`, `innerH = viewportH / mapZoom`
- `mapViewVisibleNorm`: `{ x, y, w, h }` with `x = innerLeft/rw`, `y = innerTop/rh`, `w = innerW/rw`, `h = innerH/rh`

Optionally keep legacy `mapViewZoomRatio` / `mapViewPanNorm` for backward compatibility or migration.

### Decode (receiver / thumbnails)

Given `mapViewVisibleNorm` and the receiver’s `viewportW` × `viewportH`, `minZoom` / `maxZoom`, and rendered map size:

1. Compute the **stored rect** in inner px: `R = { left, top, width, height }` from the norm and `rw`/`rh`.
2. Choose **uniform** scale so the **entire** `R` fits in the viewport:
  `z_fit = min(viewportW / (width * zoomFactor?), viewportH / (height * ...))` — equivalently the smallest zoom level such that the **scaled** rect fits in the viewport (details in implementation: work in scroll/zoom space consistent with `[BattleMap.jsx](../../src/client/components/BattleMap.jsx)`).
3. **Clamp** `z_fit` to `[minZoom, maxZoom]`. If clamping prevents showing the full `R`, document behavior (e.g. best-effort + optional UI warning).
4. **Pan** so `R` is centered in the viewport; letterbox margins are implicit in the math (viewport larger than scaled rect on one axis).

UI: if the shell does not naturally show “empty” areas, add a **letterbox layer** (full viewport with background; map layer centered and sized so only the fitted region is drawn), or equivalent so users **see** the full GM frame with bars as needed.

### Legacy

If only `mapViewZoomRatio` / `mapViewPanNorm` exist, fall back to current `[decodeMapViewState](../../src/client/lib/map-view-sync.js)` until migrated.

## Files (same as prior outline)


| Area                                                                                                                                 | Change                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `[src/client/lib/map-view-sync.js](../../src/client/lib/map-view-sync.js)`                                                           | Encode `mapViewVisibleNorm`; decode path that **fits entire rect** + clamp; legacy decode      |
| `[src/client/components/BattleMap.jsx](../../src/client/components/BattleMap.jsx)`                                                   | Encode/decode all persist/hydrate paths; letterbox or background if needed for fit-entire-rect |
| `[src/client/app.jsx](../../src/client/app.jsx)`                                                                                     | `set-map-view` includes new field                                                              |
| `[src/client/lib/table-ops.js](../../src/client/lib/table-ops.js)` + `[map-table-state.js](../../src/client/lib/map-table-state.js)` | Plumb `mapViewVisibleNorm`                                                                     |
| DB / API                                                                                                                             | `personal_map_cameras` column + server + `api.js`                                              |


## Tests

- Cross-viewport: encoded rect from viewport A; decoded on B — **full** stored rect is visible (within epsilon), and **no** map sample outside the rect is visible (or document clamp edge cases).
- Legacy round-trip unchanged where applicable.

## Docs

Update `[.cursor/rules/project.mdc](../../.cursor/rules/project.mdc)` and `[README.md](../../README.md)` when adding migration/API fields.

## Todos

- `map-view-sync`: encode `mapViewVisibleNorm`; decode **fit-entire-rect** (uniform scale + center); legacy fallback
- `BattleMap`: wire encode/decode; letterbox/background so full GM region is visible on mismatched aspect ratio
- `table-ops` + `map-table-state`: persist visible norm on `gmMapView` / views / `mapConfig`
- `app.jsx`: `set-map-view` payload
- Migration + `db.js` + `server.js` personal cameras + `api.js`
- Unit tests + doc updates

