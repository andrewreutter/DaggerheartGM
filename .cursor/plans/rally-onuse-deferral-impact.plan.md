# Rally `onUse` timing, `table.feature` / `table.source`, and defer-until-ack

## Original question (summary)

- **Grant Rally Dice**: user wants mechanical effects (or consistency with “used”) aligned with GM ack.
- **Would deferring `onUse` break other features?** Only if done globally; Rally-scoped defer is safe if ack replays engine work (see below).

## `table.feature` / `table.source` are already mutations

In [`src/features-v2/engine/table.js`](src/features-v2/engine/table.js):

- **`buildFeatureStore`** (`table.feature`): `set(key, value)` does `state[key] = value` **and** `addMutation(mutations, 'setFeatureState', { featureKey, key, value })`.
- **`buildSourceFacade`** (`table.source`): `set` writes `gameState.featureState[sourceScopeKey][key]` **and** the same **`setFeatureState`** mutation.

So persistent bags are **already** modeled as a mutation stream. Client apply path: [`applyV2LifecycleMutations`](src/client/lib/table-ops.js) → [`applyV2BannerMutations`](src/client/lib/table-ops.js) for `setFeatureState`.

The gap for **Rally defer** is not “missing mutation types” — it is that **`gameTableDeferUntilBannerAck` skips `activateChip` / `onUse` entirely** until ack ([`activateV2OwnedCardChip`](src/client/lib/v2-cross-sheet-lifecycle.js)), so **no mutations are produced on click**. Extending mutation modeling does not by itself fix that; you still need an **ack-time** path that runs the same activation with `forceApply` (or replays collected mutations).

## “Only apply those get/sets on ack” — would that break other features?

**Depends what “only apply” means.**

### A) Defer **server persistence** (`postTableOp`) but still run `onUse` and collect mutations locally

- Same-session **`get` after `set` inside one `onUse`** still works today because the store mutates in-memory before enqueueing.
- **Risk**: Other clients / GM UI that only re-read from **authoritative SSE state** would see stale `featureState` until ack. Any feature assuming **immediate cross-player visibility** of `setFeatureState` would look wrong until ack.
- **Partial defer** (defer only `setFeatureState`, apply `spendHope` / `markStress` immediately) → **inconsistent** partial state unless carefully designed.

### B) Defer running **`onUse` entirely** until ack (current `gameTableDeferUntilBannerAck` behavior)

- No mutations until ack → **no** `partyDice` until ack — intended for Rally if product wants that.
- **Other chips** unchanged unless they opt into defer.
- Ack must **run engine again** (toggle path uses [`applyDeferredV2ToggleOnAckFromRoll`](src/client/lib/v2-owned-card-chip-table.js)); non-toggle defers need a **general replay** or feature-specific ack (cf. **Life Support** in [`GMTableView.jsx`](src/client/components/GMTableView.jsx)).

### C) Generalize: all “state storage” APIs (`table.feature`, `table.source`, …) defer together

- **`table.source` and `table.feature` already share `setFeatureState`** — no new mutation **type** is required for persistence shape.
- Other APIs on `table` enqueue different mutation types (`spendHope`, `markStress`, `addNarration`, roll helpers, etc.). **Bundling “defer all storage writes”** implies either:
  - **Defer the whole `activateChip` mutation batch** until ack (same as B), or
  - **Split semantics** per mutation kind → high risk of bugs (e.g. Hope spent locally but `partyDice` deferred).

**Conclusion:** Deferring **only** `setFeatureState` application without deferring the whole activation is usually **unsafe** unless every feature author reasons about mixed timelines. Deferring **entire chip activation output** until ack is coherent and is already the direction of `gameTableDeferUntilBannerAck`.

## Impact on other features (short)

| Change | Risk to other features |
|--------|-------------------------|
| Rally-only: `gameTableDeferUntilBannerAck` on Grant + ack runs `forceApply` / full mutation apply | **Low** — scoped. Troubadour / spend chips wait until grant applies on ack. |
| Global: delay **application** of all `setFeatureState` to GM ack | **High** — anything needing immediate shared `featureState` breaks or needs optimistic UI. |
| “Model `get/set` as mutations” (already true) + replay queue | **Medium** — engineering effort; behavior same as B if replay == run `onUse` again. |

## Implementation todos (when executing)

1. **Rally Grant**: opt-in defer + ack path that applies **full** `activateV2OwnedCardChip` result (not `applyFeatureResources` alone — that marks usage/costs but does not run `rallySessionGrant`).
2. **Optional**: unify **non-toggle** deferred ack handling (beyond toggles + Life Support special cases).
3. **If desync “dice before used” persists without defer**: audit **`featureUsage` key** alignment ([`GuideFeatureCard`](src/client/components/features/GuideFeatureCard.jsx) `effectiveKey` vs [`applyV2OwnedCardChipEngineResultToTable`](src/client/lib/v2-owned-card-chip-table.js) `usageKey`).

---

## Todos

- [ ] If UI still shows dice before “used”, trace `featureUsage` key vs `entry.key` and single `postTableOp` payload
- [ ] Optional: Grant chip `gameTableDeferUntilBannerAck` + GM ack `forceApply` + tests in [`test/unit/features-v2/classes/Bard.test.js`](test/unit/features-v2/classes/Bard.test.js)
