---
name: ""
overview: ""
todos: []
isProject: false
---

*Historical note:* This plan predates the removal of `src/features/classes/`. Druid / beastform work lives under **`src/features-v2/`** (see `docs/feature-authoring-guide.md`).

# Druid: Beastform and Evolution

## Context

The SRD beastform data is already normalized and served via `GET /api/srd/beastforms` (shape: `{ id, name, tier, examples, trait_bonus, evasion_bonus, attack, advantages, features }`). [useCharacterSrdData.js](src/client/lib/useCharacterSrdData.js) does not yet fetch beastforms. No `Druid.js` class feature file exists. The Druid "Beastform" and "Evolution" features are currently display/announce-only.

---

## Entry: Beastform vs Evolution

Both features put the character into the same beastform state. Only entry differs:


|                                  | Beastform (class feature)            | Evolution (Hope ability)          |
| -------------------------------- | ------------------------------------ | --------------------------------- |
| Cost                             | 1 Stress                             | 3 Hope (no Stress)                |
| Pending cost on banner           | "Mark 1 Stress"                      | "Spend 3 Hope"                    |
| Frequency                        | Once per rest/session (featureUsage) | Hope ability (no extra frequency) |
| Sets `activeBeastform` on GM ack | Yes                                  | Yes                               |
| Drop Out / last HP / Fragile     | Same                                 | Same                              |
| While in beastform behavior      | Same                                 | Same                              |


**One shared beastform selection**: `selectedBeastformId` (HoverCard state) is used by both Beastform Use and Evolution Use. One `CustomSelect` dropdown on the Beastform feature card drives both.

---

## 1. Data: load beastforms into the SRD hook

In [src/client/lib/useCharacterSrdData.js](src/client/lib/useCharacterSrdData.js), add `beastforms` to the parallel fetch list and return `beastforms` + `beastformsById` from the hook.

---

## 2. Runtime state

Add two keys to `CHARACTER_RUNTIME_KEYS` in [src/client/lib/table-ops.js](src/client/lib/table-ops.js):

- `activeBeastform` — the full beastform object (or `null`); set when the GM acks Use, cleared on Drop Out / last HP / Fragile.
- `selectedBeastformAdvantage` — string (one advantage name) or `null`; mutually exclusive chip selection.

---

## 3. BeastformFeatureCard (CharacterDisplay.jsx)

Add a new `BeastformFeatureCard` component in [src/client/components/CharacterDisplay.jsx](src/client/components/CharacterDisplay.jsx). `CharacterFeatureList` accepts an optional `beastformProps` object; when the feature is "Beastform" and class is "Druid", it renders `BeastformFeatureCard` instead of `FeatureChip`.

`**BeastformFeatureCard` contents (when not in beastform):**

- Feature description (same as FeatureChip).
- `CustomSelect` dropdown: options = beastforms filtered to `tier <= el.tier` (or strict tier equality per SRD), `getOptionLabel(b) => b.name`, `getOptionDescription(b)` builds a tooltip string from tier, trait_bonus, evasion_bonus, attack, advantages, and features.
- `CostBadgeStrip` showing "1 Stress".
- "Use" button — calls `onUseBeastform(selectedBeastform)`.

**When `activeBeastform` is set (in beastform):**

- Show beastform name and stats summary.
- Replace "Use" with "Drop Out of Beastform" button — calls `onDropOutBeastform()`.

The same beastform dropdown also drives Evolution: the HoverCard's `selectedBeastformId` state is shared (see §5).

---

## 4. Druid class feature file

New file [src/features/classes/Druid.js](src/features/classes/Druid.js):

```js
export default {
  name: 'Druid',
  onFeatureActivated({ featureName, roll, selfEl, updateActiveElement }) {
    if ((featureName === 'Beastform' || featureName === 'Evolution') && roll._beastform) {
      updateActiveElement(selfEl.instanceId, { activeBeastform: roll._beastform });
    }
  },
};
```

Register Druid in [src/features/classes/index.js](src/features/classes/index.js).

---

## 5. CharacterHoverCard.jsx

- Call `useCharacterSrdData()` to get `srdData.beastforms` and `beastformsById`.
- State: `selectedBeastformId` (string | null).
- Derive `availableBeastforms = beastforms.filter(b => b.tier <= (el.tier ?? 1))`.
- Pass `beastformProps = { beastforms: availableBeastforms, selectedBeastformId, onBeastformSelect: setSelectedBeastformId, activeBeastform: el.activeBeastform, onUseBeastform, onDropOutBeastform }` into `CharacterFeatureList`.

`**onUseBeastform(beastform)**` — builds an action notification using the normal feature path:

- Uses `parseFeatureAction(Beastform feature description)` so `stressCost: 1` → `tags` automatically includes `{ name: 'StressCost', text: 'Mark 1 Stress' }`. The banner shows "Mark 1 Stress" as the pending cost before the GM acks.
- Payload includes `_featureUse: true`, `_attackerInstanceId`, `_stressCost: 1`, `_featureKey`, `_frequency`, and `_beastform: beastform`.

**Evolution (Hope ability) click** — when `el.class === 'Druid'` and the hope feature is Evolution, override the standard hope click:

- Build the notification explicitly with `_hopeCost: 3`, **no** `_stressCost`.
- Set `tags: [{ name: 'HopeCost', text: 'Spend 3 Hope' }]` only (no StressCost). The banner shows only "Spend 3 Hope".
- Include `_beastform: beastformsById[selectedBeastformId]` (uses same dropdown selection).
- Include `_featureUse: true`, `_attackerInstanceId: el.instanceId`, `_featureName: 'Evolution'`.

`**onDropOutBeastform()`**:

1. Broadcast an action notification: `{ _action: true, rollUser: el.name, actionName: 'Drop out of Beastform', actionText: '...' }`.
2. Call `updateFn(el.instanceId, { activeBeastform: null, selectedBeastformAdvantage: null })`.
3. Post table op to sync all clients.

**Beastform attack roll** — when `el.activeBeastform` is set, wire up an attack click. Parse `activeBeastform.attack` (e.g. `"Melee Agility d4 phy"`) to extract: `traitKey` (agility), `damage` (d4), `type` (phy), `range` (Melee). Build roll text:

```
"{charName} {beastformName} {traitName} Hope [d12] Fear [d12] {traitName} [{traitScore+beastformBonus}] damage [{damage}] {type} {range}"
```

If `el.selectedBeastformAdvantage` is set, append `{beastformAdvantage name} [d6]` to the roll. This follows the same pattern as `buildWeaponRollText` and companion attack rolls (no d20).

---

## 6. While in beastform (CharacterDisplay.jsx)

All behavior changes key off `el.activeBeastform != null`.

- **Weapons disabled**: In `CharacterWeaponList`, when `activeBeastform` is set, render weapons as greyed-out (opacity-40, no click handlers) with a "Beastform active" badge, or hide them entirely — per the requirement "Their weapon attacks are disabled."
- **Beastform attack row**: Render a single attack card (same visual style as a weapon card) showing the beastform's attack line (trait, damage, range). Click calls `onBeastformAttack` from HoverCard (§5). Place this above or instead of the weapon list.
- **Advantages as mutually exclusive chips**: Parse `activeBeastform.advantages` (comma-separated string) into an array. Render chips — one selectable at a time — stored in `el.selectedBeastformAdvantage`. Use emerald or teal color to distinguish from other modifier chips. Click to select; clicking the selected one deselects. When an advantage is selected, the beastform attack roll includes a d6 bonus.
- **Domain cards disabled**: In `CharacterAbilityList`, when `activeBeastform` is set, render the section greyed out (opacity-40, non-interactive) with a "Beastform active" label.
- **Trait bonus visible**: In `CharacterTraitGrid`, when `activeBeastform` is set, parse `activeBeastform.trait_bonus` (e.g. "Agility +1") to get the trait and delta; show the boosted value for that trait with a green `+N` indicator or tooltip "Beastform: Agility +1".
- **Evasion bonus visible**: In `CharacterDefenseRow`, when `activeBeastform` is set, parse `activeBeastform.evasion_bonus` (e.g. "Evasion +2") to get the delta; add it to the displayed evasion value with the same indicator style.

**Props threading**: `CharacterWeaponList`, `CharacterAbilityList`, `CharacterTraitGrid`, and `CharacterDefenseRow` each already receive `el`, so `el.activeBeastform` and `el.selectedBeastformAdvantage` are available directly. `CharacterWeaponList` needs an additional `onBeastformAttack` prop (from HoverCard via `CharacterDetailPane`).

---

## 7. Auto drop-out: last HP and Fragile (GMTableView.jsx)

After all hooks run in `applyDamageToTarget`, add a check: if the target is a character with `activeBeastform` set:

- **Last HP**: `entityTarget.currentHp === 0` → clear beastform.
- **Fragile**: `hpLoss >= 2` (Major or greater) AND `activeBeastform.features` contains a feature named "Fragile" (or whose description matches "Major or greater") → clear beastform.

In either case: `updateActiveElement(target.instanceId, { activeBeastform: null, selectedBeastformAdvantage: null })`, broadcast an action notification (`"{name} drops out of Beastform."`), and post a table op so all clients update.

---

## 8. Files to touch


| File                                                                                         | Changes                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/client/lib/useCharacterSrdData.js](src/client/lib/useCharacterSrdData.js)               | Add `beastforms` fetch + `beastformsById` lookup.                                                                                                                                                                                                                                                                             |
| [src/client/lib/table-ops.js](src/client/lib/table-ops.js)                                   | Add `activeBeastform`, `selectedBeastformAdvantage` to `CHARACTER_RUNTIME_KEYS`.                                                                                                                                                                                                                                              |
| [src/features/classes/Druid.js](src/features/classes/Druid.js)                               | **New.** `onFeatureActivated` sets `activeBeastform` for both Beastform and Evolution.                                                                                                                                                                                                                                        |
| [src/features/classes/index.js](src/features/classes/index.js)                               | Register `Druid`.                                                                                                                                                                                                                                                                                                             |
| [src/client/components/CharacterDisplay.jsx](src/client/components/CharacterDisplay.jsx)     | `BeastformFeatureCard` (dropdown + Use/DropOut); `CharacterFeatureList` accepts `beastformProps`; `CharacterWeaponList` disables weapons + adds beastform attack row + advantage chips; `CharacterAbilityList` disables when in beastform; `CharacterTraitGrid` shows trait bonus; `CharacterDefenseRow` shows evasion bonus. |
| [src/client/components/CharacterHoverCard.jsx](src/client/components/CharacterHoverCard.jsx) | `useCharacterSrdData`; `selectedBeastformId` state; `beastformProps`; `onUseBeastform` (Stress cost path, `_beastform`); Evolution Hope click (Hope cost only, no Stress, `_beastform`); `onDropOutBeastform`; beastform attack roll builder (Hope [d12] Fear [d12] + trait + damage).                                        |
| [src/client/components/GMTableView.jsx](src/client/components/GMTableView.jsx)               | Auto drop-out in `applyDamageToTarget` on last HP or Fragile.                                                                                                                                                                                                                                                                 |
| [docs/srd-implementation.md](docs/srd-implementation.md)                                     | Set Beastforms to Done/Partial; update Druid row (Beastform + Evolution Done).                                                                                                                                                                                                                                                |
| [.cursor/rules/project.mdc](.cursor/rules/project.mdc)                                       | Add `activeBeastform`, `selectedBeastformAdvantage` to CHARACTER_RUNTIME_KEYS bullet; add Beastform/Evolution flow note.                                                                                                                                                                                                      |


---

## Edge cases

- **Tier filtering**: `availableBeastforms = beastforms.filter(b => b.tier <= el.tier ?? 1)`. If the SRD intends strict equality (tier 1 only sees tier 1), change to `b.tier === el.tier`.
- **No selection**: If the player opens "Use Beastform" or Evolution without a beastform selected (e.g. the dropdown is still null), disable the Use button until a selection is made.
- **Evolution without selection**: If the Evolution Hope button is clicked and `selectedBeastformId` is null, either show a short message or disable the Evolution button until a beastform is selected on the Beastform feature card.
- **Trait bonus parsing**: `trait_bonus` strings like "Agility +1" or "Strength +2" — split on space, trim. `evasion_bonus` like "Evasion +2" — same pattern. Use a small helper (e.g. `parseBeastformBonus(str) → { stat, delta }`).
- **Beastform attack parsing**: `attack` strings like "Melee Agility d4 phy" — split on space: index 0 = range, index 1 = trait, index 2 = damage dice, index 3 = type. Use a small helper (e.g. `parseBeastformAttack(str) → { range, traitKey, damage, type }`).
- **Advantage bonus in attack**: When `selectedBeastformAdvantage` is set during a beastform attack roll, append e.g. `Deceive [d6]` to the roll text (the advantage name as the label, d6 as the dice). If a trait bonus is active, use the boosted trait score in the roll.

