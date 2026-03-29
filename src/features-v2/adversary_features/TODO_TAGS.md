# Adversary feature `TODO` reference

Bracket tags in JSDoc (`TODO <SCOPE> [<TAG>]: …`) are for **grep and batch planning** only. **Nothing in the repo regenerates these lines** — edit them by hand when implementation status changes.

## Scaffolding (optional)

- **`scripts/gen-adversary-action-stubs.mjs`** / **`scripts/gen-adversary-reaction-stubs.mjs`** — create missing action/reaction modules from built SRD JSON.
- **`scripts/gen-missing-adversary-feature-stubs.mjs`** — **`npm run gen:missing-adversary-stubs`** — fills any remaining SRD `name::type` gaps; regenerates `index.js`.
- **`npm run gen:adversary-feature-inventory`** — writes **`src/features-v2/generated/adversary-feature-inventory.json`** (coverage vs SRD).

## Line format

Each TODO line looks like:

`TODO <SCOPE> [<TAG>]: <note>`

| Scope | Use |
| --- | --- |
| **PASSIVE** | `type: 'passive'` |
| **ACTION** | `type: 'action'` |
| **REACTION** | `type: 'reaction'` |

Grep examples: `TODO PASSIVE [DAMAGE]`, `TODO ACTION [FEAR_SPEND]`, `TODO REACTION [TRIGGER]`.

## Fear track (any scope)

| Tag | Grep | Use |
| --- | --- | --- |
| **FEAR_SPEND** | `TODO … [FEAR_SPEND]` | GM spends Fear (costs, spotlight-linked spends). |
| **FEAR_GAIN** | `TODO … [FEAR_GAIN]` | GM gains Fear from a trigger. |

## Action-only shape buckets

| Tag | Grep | Use |
| --- | --- | --- |
| **ATTACKSHAPED_RANGE** | `[ATTACKSHAPED_RANGE]` | Compact or range-scoped attack wiring (`adversary-roll-descriptors.js`). |
| **ATTACKSHAPED_DAMAGE** | `[ATTACKSHAPED_DAMAGE]` | Standard / shared / multi-target attacks. |
| **ACTIONSECONDARY** | `[ACTIONSECONDARY]` | Secondary dice, saves, pools (`clientHoverUseRoll`, banner chips). |

## Reaction-only

| Tag | Grep | Use |
| --- | --- | --- |
| **TRIGGER** | `[TRIGGER]` | “When …” reaction window and ordering. |
| **ATTACK** | `[ATTACK]` | Standard attack from statblock inside a reaction. |

## Narrative / GM prompts

| Tag | Grep | Use |
| --- | --- | --- |
| **NARRATIVE_BANNER** | `[NARRATIVE_BANNER]` | Purely narrative text, “describe …”, or reminder clauses — surface via action-notification / banner with no dice. |

## Shared mechanic tags (`[TAG]`)

The same bracket tags appear under PASSIVE / ACTION / REACTION where the description calls for them:

| Tag | Use for |
| --- | --- |
| **AFFINITY** | Resist / immune / vulnerable; `damageAffinities` + damage pipeline. |
| **ARMOR** | Armor slot marks without benefit, extra HP when none, shredding. |
| **DAMAGE** | Damage dealt/taken: replacement strings, double damage, +dice, thresholds, “direct damage”, half damage. |
| **HORDE** | At half+ HP marked, standard attack uses Horde dice (name `Horde (…)`). |
| **MINION** | Defeat on any damage; spill rules (name `Minion (…)`). |
| **RELENTLESS** | Extra spotlights per GM turn (name `Relentless (…)`). |
| **COUNTDOWN** | Spotlight countdowns, ticks, max, on-trigger effects. |
| **RESOURCE** | Hope / Stress / generic resource (not Fear-specific — use **FEAR_** tags for Fear). |
| **AURA** | Range-limited ongoing effects on PCs. |
| **ROLL** | Advantage/disadvantage, halve evasion, reaction rolls, fixed DCs. |
| **MOVEMENT** | Teleport, flight, knockback, phasing, climb, forced movement. |
| **CONDITION** | Apply/remove Restrained, Vulnerable, Hidden, _Poisoned_, etc. |
| **MULTI_TARGET** | Multi-target or sweep attacks. |
| **SUMMON** | Summon adversaries or adds. |
| **SPOTLIGHT** | Spotlight / Fear interactions. |
| **TOKEN** | Physical token on stat block (Slow, Slow Firing). |
| **SOCIAL** | Social / Presence context modifiers. |
| **GOLD** | Gold pools, disadvantage bypass, HP-for-gold. |
| **DIFFICULTY** | Bonus to adversary Difficulty. |
| **EVASION** | Halve / ignore Evasion. |
| **ENVIRONMENT** | Arena hazards, rubble, environmental damage. |
| **HEAD** | Many-Headed Menace (heads). |
| **CONSTRUCT** | Construct-specific HP rules. |
| **TRACK** | UI toggle / bookkeeping only. |
| **DEFER** | Explicit GM fiat; automation unlikely. |
| **SRD** | Fallback when no matcher fired (review full description). |

## Registry name collision

`Overwhelm` exists as both **passive** and **reaction**. The reaction module is `OverwhelmReaction.js`; the registry exposes **`'Overwhelm::reaction'`** while the passive stays **`[Overwhelm.name]`**. Loader resolves `Name::type` first, then plain `name` (`adversary-feature-loader.js`).
