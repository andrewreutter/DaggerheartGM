# V1 → V2 Game Table — remaining backlog

**Purpose:** Single checklist of **unfinished** cutover work. Supersedes `docs/v2-v1-cutover.md` and `.cursor/plans/v2-game-table-cutover-completion.plan.md` (removed).

**North star & phases:** [`docs/v2-game-table-polestar.md`](v2-game-table-polestar.md)

**SRD content coverage** (Unclaimed rows, not the same as wiring): [`docs/v2-migration-tracker-snapshot.md`](v2-migration-tracker-snapshot.md) (GitHub `v2-migration`)

**Framework rule:** Engine (`src/features-v2/engine/`), shared bridges (`src/client/lib/v2-*.js`), and `table-ops.js` apply paths stay **feature-agnostic** — no SRD names or `srd-*` ids in shared layers ([`.cursor/rules/v2-framework-boundaries.mdc`](../.cursor/rules/v2-framework-boundaries.mdc), CONV-029 in [`docs/v2-code-conventions.md`](v2-code-conventions.md)). Per-feature behavior belongs in `src/features-v2/**` modules.

---

## Remaining items

1. **Sorcerer — domain loadout / vault on the live table**  
   Persist `domainLoadout` (and vault semantics) on character elements; apply Channel Raw Power long-rest mutations end-to-end through normal table / `featureState` flows (engine resolution **channel-raw-power-domain** is Done — VTT hydration is not).

2. **Unified phased banner shell (UX)**  
   One vertical surface: **intent** (top) + **pending roll / review** (below). Today the intent strip and `DiceRoller`/`ResultBanner` are separate; merge **presentation** only (shared logic, no duplicate phases).

3. **Session vs scene lifecycle**  
   Product alignment for when shared table state (e.g. Bard Rally `partyDice`, root `table_state.featureState`) clears relative to **scene end** vs **session end**; optional `hooks.onSceneEnd` vs session hooks. Detail also in tracker **Tech Debt**.

4. **Banner chip mutation router**  
   Every V2 chip mutation type must either apply via `partitionV2BannerChipMutations` / `applyV2BannerMutations`, route to server follow-ups, or be explicitly **unsupported** with unit tests — avoid silent default skips for unknown types.

5. **Thin host; no new feature-specific branches**  
   Continue migrating remaining `runCharacterHook` / `wrapEntity` / imperative `GMTableView` edges toward registry-driven phases and declarative metadata. **Do not** add feature-name or `srd-*` branching in bridges when extending behavior.

6. **Weapon row UI**  
   Prefer merged `weaponRenderHints` / `isDisabled` / `onRender` over any leftover name-based gates in sheet components ([`docs/feature-authoring-guide.md`](feature-authoring-guide.md) host UI note).

7. **Damage-commit `reviewOutcome` (known limitation)**  
   Victim-scoped `setFeatureStateOwnerId` on damage apply; attacker-scoped `setFeatureState` from that path is still limited until a generic multi-actor contract exists (extend carefully without coupling the bridge to one card).

---

## Related checklists (narrow scope)

- Intent-tag Game Table coverage: [`docs/v2-phase-d-intent-tags-report.md`](v2-phase-d-intent-tags-report.md)
- Rest / consumable adjacency: [`docs/rest-adjacent-audit.md`](rest-adjacent-audit.md) (if present) and tracker

---

## Tracker-linked debt (detail in Issues / snapshot)

Pulled from the old polestar §5 — still tracked under **Tech Debt** in the migration snapshot: `substituteArmorForHope` / armor slot generalization, Camaraderie / Tag Team table flows, pending-damage helper consistency, beastform-aware consolidation.
