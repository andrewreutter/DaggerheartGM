---
name: Phase 6 banner pipeline cleanup
overview: Finish the GMTableView banner pipeline by removing dead legacy hooks (feature.onBanner, bannerAction, chip acknowledge/cancel aliases), unifying banner-chip isVisible to chipContext, replacing weapon onBanner narration with declarative automated text, and updating docs plus a regression test. Refreshed against current app.jsx / GMTableView.jsx (effectiveIsPlayer / preview-as-player).
todos:
  - id: strip-dead-ancestry
    content: Remove feature.onBanner + bannerAction branches; gate ancestry reactions on hasBannerChips only; fix comments (~3918–4072 GMTableView.jsx)
    status: completed
  - id: isVisible-unified
    content: Banner chips — call chip.isVisible(chipContext) only; fix any tests/fixtures using (wr, entity)
    status: completed
  - id: remove-chip-aliases
    content: Drop chip.acknowledge / chip.cancel fallbacks (~2014, ~2176 GMTableView.jsx)
    status: completed
  - id: weapon-narration
    content: Replace weapon f.onBanner in getBannerNarration with automated (or explicit field); align CharacterHoverCard tag inclusion (~173–174)
    status: completed
  - id: docs-tests
    content: Update feature-cheatsheet (+ optional v2-code-conventions); add unit test for weapon automated narration merge
    status: completed
isProject: true
---

# Finish Phase 6: GMTableView banner pipeline (refreshed)

## Codebase context (refresh)

### `isPlayer` / preview-as-player

`[app.jsx](src/client/app.jsx)` does **not** pass a bare “route player” flag into `[GMTableView](src/client/components/GMTableView.jsx)`:

- `effectiveIsPlayer = isPlayer || isPreviewMode` (real invited player **or** GM previewing as a player).
- `effectivePlayerEmail` is `user?.email` for real players, or `previewAsPlayerEmail` in preview mode.
- `GMTableView` is called with `isPlayer={effectiveIsPlayer}` and `playerEmail={effectivePlayerEmail}`.

**Implication for this plan:** Ancestry banner reactions already filter with `if (isPlayer && char.assignedPlayerEmail !== playerEmail) continue` (~3933). That applies to **both** real players and GM preview — no extra branch for “preview” beyond those props. Phase 6 refactors should **keep** that filter and dependency array `[isPlayer, playerEmail, …]` correct; do not assume `!isPlayer` means “only GM” if the code must also behave for preview (it uses the same `isPlayer` true path as players).

Unrelated but good mental model: `[handleV2ReviewChip](src/client/components/GMTableView.jsx)` early-returns `if (isPlayer) return` (~3695), so **preview-as-player** also blocks GM-only V2 review activation — expected.

### Line anchors (current `GMTableView.jsx`)


| Area                                                                                       | Approx. lines |
| ------------------------------------------------------------------------------------------ | ------------- |
| `handleBannerAcknowledge` — `chip?.onBannerAck ?? chip?.acknowledge`                       | ~2014         |
| `handleBannerCancel` — `chip?.onBannerReject ?? chip?.cancel`                              | ~2176         |
| `ancestryBannerReactions` useMemo (onBanner, bannerAction, chips, `isVisible` dual branch) | ~3918–4072    |
| `getBannerNarration` (weapon `f.onBanner`)                                                 | ~4080–4104    |
| Preroll canvas `merged.isVisible` arity split (**separate** from banner chips)             | ~2978–2981    |
| Comment referencing “onBanner” on banner shell                                             | ~1335         |


Registry facts unchanged: no `onBanner` / `bannerAction` under `[src/features-v2/](src/features-v2)`; Bone **I See It Coming** lives in `[ISeeItComing.js](src/features-v2/abilities/Bone/ISeeItComing.js)`.

### Other wiring

- `[DiceRoller.jsx](src/client/components/DiceRoller.jsx)` exposes `setBannerReactionsFallback` (imperative handle); `[GMTableView](src/client/components/GMTableView.jsx)` calls it when syncing `ancestryBannerReactions` (~4177). Phase 6 cleanup should preserve that contract when editing reaction shape.

---

## Implementation steps

### 1. Strip dead ancestry reaction wiring

In `ancestryBannerReactions` (~3918+):

- Narrow the entry condition to `**hasBannerChips`** once `bannerAction` is confirmed unused in repo (still **zero** matches under `features-v2/`).
- Remove `feature.onBanner` call (~3967–3968) and the branch that only existed to support it.
- Remove `bannerAction` branch (~3971–3972) if still unused.
- Update header comment (~~3918) and any “same object passed to onBanner” comment (~~1335) if that path is deleted.

### 2. Collapse `isVisible` for **banner** chips only

- Replace ~4054–4056 with `**chip.isVisible(chipContext)`** (registry uses single-arg visibility where applicable).
- Grep tests/fixtures for two-arg banner `isVisible`; fix or document.

**Do not** conflate with preroll canvas (~2978–2981): that path still uses `(canvasContext)` vs `(rollWrapper, featureReader, canvasContext)` — optional follow-up, not required for Phase 6 banner completion.

### 3. Remove legacy chip property aliases

- `acknowledge` → use `onBannerAck` only (~2014).
- `cancel` → use `onBannerReject` only (~2176).

### 4. Replace weapon `onBanner` narration

- In `getBannerNarration` (~4090–4097): e.g. `if (f.automated) parts.push({ text: f.description, style: 'automated' })` (confirm against `[weapon_properties/](src/features-v2/weapon_properties)` `automated` usage).
- `[CharacterHoverCard.jsx](src/client/components/CharacterHoverCard.jsx)` ~173–174: replace `onBanner` check with the same rule as roll tags (`showTag` / `automated` or agreed field).

Keep **weapon `onBannerAck`** in `[game-table-mechanics.js](src/client/lib/game-table-mechanics.js)` and GMTableView weapon-ack path (~1725+).

### 5. Docs

- `[docs/feature-cheatsheet.md](docs/feature-cheatsheet.md)`: deprecate root `onBanner` for Game Table; document banner `**chips**` + `onBannerAck` / `onBannerReject`.
- Touch `[docs/v2-code-conventions.md](docs/v2-code-conventions.md)` only if it still references `onBanner` for UI.

### 6. Regression test

- Unit test for “weapon tag with `automated: true` yields automated narration part” (extract small pure helper if needed) — per project testing policy.

### 7. QA

- **Preview-as-player**: assigned character still gets ancestry banner reactions; unassigned characters still skipped.
- **I See It Coming** banner visibility unchanged.
- **Automated** weapon narration strip on banner.

---

## Out of scope

- Preroll `isVisible` dual signature migration.
- `banner-builder` / `[banner_and_roll_builder_interfaces.plan.md](.cursor/plans/banner_and_roll_builder_interfaces.plan.md)` — separate rearchitecture.

