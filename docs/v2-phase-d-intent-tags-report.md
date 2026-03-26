# Phase D — Pre-roll intent tags (VTT)

Living checklist for **V2 `placement: 'intent'`** weapon (and related) tags wired through the Game Table **inline intent strip** (`collectV2WeaponIntentChips` / trait skeleton / `handlePreRollProceed`).

## Done

| Tag | VTT behavior | Notes |
|-----|----------------|-------|
| **Devastating** | `pending.meta.devastating`, `applyDevastatingDamageRewriteToRollText`, 1 Stress | `computeWeaponRenderHints` → `hideDevastatingCardToggle` |
| **Charged** | `pending.meta.chargedIntent`, `applyChargedProficiencyBonusToRollText` (`Charged [+1]` before damage), 1 Stress | `computeWeaponRenderHints` → `hideChargedVariantCard`; engine module uses +1 Proficiency (not extra damage die) on intent path |
| **Persuasive** | `rollWrapper.addRollBonus(2)` on proceed, 1 Stress | Requires `buildActionConfigFromRoll` / `buildV2BannerGameState` **`action.type === 'trait'`** for non-weapon pre-roll; shows on **Presence** trait / spellcast intent when weapon has Persuasive |

## Infrastructure (shared)

- **`buildActionConfigFromRoll`**: `type: 'attack'` when `_weaponRangeFt` / `_weaponId` **or** the roll already has a **damage** sub-item (banner payloads); otherwise **`trait`** (Presence / spellcast intent).
- **`buildV2BannerGameState`**: uses `actionConfig.type` and `weaponId`.
- **`buildV2PreRollTraitRollSkeleton`**: Hope / Fear / trait sub-items for non-weapon intent.
- **`collectV2WeaponIntentChips`**: weapon **or** trait pre-roll (`_intentPanelForActionRoll` + `_traitKey` when no weapon fields).

## Todo / not intent-phase (or deferred)

| Item | Status |
|------|--------|
| Other weapon tags (`reviewAction` only: Quick, Lucky, Bouncing, …) | Not in scope for **intent** strip — remain on post-roll `collectV2ReviewActionChips` |
| **Greedy** (gold) | No `intent` placement in registry — separate UX if added later |
| Full **Persuasive** engine `onUse` parity (`addStatic`) vs `addRollBonus(2)` | VTT uses flat +2 on final roll text via `getFinalRollText` — matches banner math for static bonus |
| Browser E2E for intent strip | Optional |

## Verification

- `npm run test:unit` — includes `weapon-roll-text`, `v2-action-loop-bridge`, `Charged` / `Devastating` weapon_property tests.

_Last updated: Phase D follow-up (Charged + Persuasive + trait action type)._
