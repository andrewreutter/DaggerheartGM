# Rest-adjacent mechanics audit (Tier 2)

Companion to **Rest banner Phase F** and **`runV2RestHooksForTable`** / **`placement: 'rest'`** work. Summarizes how rest-related SRD-tagged consumables and items are modeled and whether a **`placement: 'rest'`** chip is appropriate.

## Engine / VTT plumbing (reference)

| Mechanism | Role |
|-----------|------|
| **`placement: 'rest'`** | Declarative chip on the Short/Long Rest banner (before GM ack); **player choice** during rest (e.g. drink potion, consume moss). |
| **`hooks.onRest`** + **`runV2RestHooksForTable`** | Runs on rest **acknowledge** when clearing `rest` cycles; synthetic `action.type` is **`shortRest`** or **`longRest`** matching the banner. |
| **`onRest` / `when(isRestAction)` on consumables** | Usually **automatic** buff expiry or cleanup on **short or long** rest ack — not a second banner chip. |
| **`setFeatureState` mutations** | May include **`payload.instanceId`** (feature owner) when queued from `table.feature.set`; **`applyV2BannerMutations`** prefers the outer chip/banner owner when set, else `payload.instanceId` (lifecycle). |

## Consumables (`src/features-v2/consumables/`)

| Item | Rest-adjacent behavior | Placement / mechanism | Migrate to `rest`? |
|------|------------------------|------------------------|-------------------|
| **Potion of Stability** | Extra downtime move when drunk during rest | `placement: 'rest'` + CONV-011 | Done (Phase F) |
| **Sweet Moss** | Consume during rest → **clear 1d10 HP or Stress** | `placement: 'rest'` + `when(isRestAction)` | Done (this pass) |
| **Major \* Potions** (Attune, Bolster, Charm, Control, Enlighten, Stride) | Stat buff until next rest; cleared on `onRest` | `onRest: when(...)` | No — automatic on ack |
| **Attune / Bolster / Charm / Control / Enlighten / Stride** (non-Major) | Same pattern | `onRest` | No |
| **Growing / Shrinking** | Form until next rest; `onRest` clears | `onRest` + card `placement` for drop form | No |
| **Death Tea** | Die on long rest if no crit | `onRest` longRest only | No |
| **Morphing Clay** | `refreshOn: 'rest'` | Modifier refresh via table cycles | No |
| **Ogre Musk** | `refreshOn: 'rest'` | Same | No |
| **Replication Parchment** | `onRest` | Copy refresh | No |
| **Sleeping Sap** | Narrative full night’s rest | No V2 automation | No |
| **BridgeSeed** | Vines until next rest | Narrative / no chip | No |
| **Vial of Moondrip** | See in darkness until next rest | No rest chip | No |
| **Stardrop** / **Sun Tree Sap** / etc. | Mostly on-use or review | Not rest-banner | No |

## Items (sample, `src/features-v2/items/`)

| Item | Notes | `placement: 'rest'`? |
|------|--------|------------------------|
| **Premium Bedroll** | `hooks.onRest` → clear Stress (automatic during downtime) | No |
| **Fire Jar** | Narrative regen long rest | No (stub) |
| **Airblade Charm** / **Piercing Arrows** | `onRest` resets uses | No |

## Conclusion

Only **explicit “during this rest”** consumable actions that need a banner affordance belong on **`placement: 'rest'`**. Most **until your next rest** / **on rest clear** effects stay **`onRest`** or **`refreshOn`** + table cycle clears.
