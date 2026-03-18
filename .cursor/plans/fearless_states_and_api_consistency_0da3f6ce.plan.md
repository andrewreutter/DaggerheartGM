# Fearless: pre-ack display hook, hope-in-system, character naming

## 1. Pre-ack display: feature-driven, not hardcoded (onBannerRender + roll display API)

**Goal**: Banner color (hope vs fear) for “converted” rolls should be decided by the feature, not by the system checking `isConverted` / `derivedIds` / Fearless by name.

**Approach**: Add a new lifecycle hook that runs before the banner is rendered and gives the feature a chance to set display-only state on the roll.

- **New hook**: `onBannerRender(roll, character)` (or similar name). Called once per matching ancestry banner reaction, before ResultBanner uses the roll for layout/color. The feature can call into the **roll wrapper** to change how the roll is displayed (e.g. “treat as Hope for this banner”).
- **Roll wrapper display API**: Add something like `roll.setHope()` (or `roll.setDominantForDisplay('hope')`) on the roll wrapper. This is a pre-ack, display-only override: it does not change server state or ack behavior; it only affects the banner’s effective dominant for color/scheme.
- **Implementation detail**: The raw roll is immutable. So the wrapper must write to a **mutable store** keyed by roll id (e.g. `displayOverridesByRollId[roll._rollDbId] = { dominantForDisplay: 'hope' }`). When creating the roll wrapper for the render pass, pass that store in (e.g. `wrapRoll(roll, displayOverridesStore)`). ResultBanner (or the code that builds its props) then uses `effectiveDominant = displayOverridesStore[roll._rollDbId]?.dominantForDisplay ?? roll.dominant` and no longer references `fearlessReaction` / `derivedIds` / `isConverted` for color.
- **Fearless in Infernis.js**: In `onBannerRender`, if the character has `_fearlessToggle === roll._rollDbId`, call `roll.setHope()` (or equivalent). No other feature needs to know about “converted” state; the feature owns the rule.

Remove the hardcoded Fearless/`isConverted`/`derivedIds` color logic from DiceRoller ResultBanner.

---

## 2. Wrapper pattern: what’s good and what’s tricky

**Why the pattern is good**: Single place to call (`roll.setHope()`, `entity.markStress()`), clear API for feature authors, and the wrapper can enforce rules (e.g. caps, validation).

**Problems / tradeoffs**:

- **Mutable side effects**: The roll is immutable server data. So `roll.setHope()` can’t change the roll itself; it has to write to a store or callback. The wrapper therefore needs a second argument (e.g. a store or an `applyDisplayOverride` callback) when used in the render path. That’s a bit more setup than a pure read-only wrapper.
- **Lifecycle and identity**: The roll wrapper is often recreated per use (`wrapRoll(roll)`). Without a shared store keyed by `roll._rollDbId`, there’s no place for `setHope()` to persist. So the render flow must create one store per “batch” of banner render and pass it into `wrapRoll(roll, store)` for each roll.
- **Precedence**: If multiple features call `roll.setHope()` (or different overrides) for the same banner, the system needs a rule (e.g. last write wins, or first wins). Document the chosen rule.
- **Testing**: Wrappers that take a store/callback are slightly harder to unit test than pure functions, but still straightforward by passing a mock store.

None of these are blockers; they’re things to wire up once (store + pass into wrapRoll, single precedence rule) and document.

---

## 3. Hope gain in the system (grantHopeToAttacker)

- Add a return option from `onBannerAcknowledge`, e.g. `grantHopeToAttacker: 1`.
- In GMTableView `handleBannerAcknowledge`, after the ancestry loop, if any reaction returned `grantHopeToAttacker: n`, apply hope to the roll’s attacker via `roll._attackerInstanceId` (or `roll.attacker?.id`).
- In Infernis.js, remove `entity.gainHope(1)` and return `{ skipFearIncrement: true, grantHopeToAttacker: 1 }` when the banner was converted.

---

## 4. entity vs character in ancestry banner hooks

- For ancestry banner lifecycle hooks only, pass the **wrapped** entity as `character` and the raw element as `characterRaw`.
- In GMTableView, change the acknowledge/cancel (and any activate) context to pass `character: wrapEntity(charEl, updateActiveElement)` and `characterRaw: charEl`.
- Update Infernis.js and Faun.js to destructure `character` instead of `entity`. Update Katari.js to use `character` (wrapped) and `characterRaw` if it needs the raw element.

---

## Summary

| Item | Action |
|------|--------|
| Pre-ack color | Add `onBannerRender(roll, character)`; add `roll.setHope()` (or `setDominantForDisplay('hope')`) on the roll wrapper with a mutable store keyed by roll id; ResultBanner uses store for `effectiveDominant`; remove Fearless-specific `isConverted`/`derivedIds` color logic. |
| Wrapper tradeoffs | Document/store the above (mutable store, precedence, lifecycle). |
| Hope on ack | Return `grantHopeToAttacker: 1` from Infernis; GMTableView applies hope to attacker. |
| Naming | Pass wrapped as `character`, raw as `characterRaw`; update Infernis, Faun, Katari. |

After implementation, update docs (e.g. `docs/srd-implementation.md`, `.cursor/rules/project.mdc`) if they describe the Fearless flow or banner-reaction context.
