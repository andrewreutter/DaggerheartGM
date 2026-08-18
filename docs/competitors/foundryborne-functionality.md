# Foundryborne — Functionality Overview

Competitive analysis of the **Foundryborne** Daggerheart system for Foundry VTT (`Foundryborne/daggerheart`, system id `daggerheart`, version ~2.7.4). Source: sibling checkout at `../Foundryborne`.

Foundryborne is an unofficial Foundry VTT **system** (not a module) that implements Daggerheart as a full tabletop VTT experience: character sheets, combat spotlight, dice, SRD compendiums, and canvas integration.

---

## Product positioning

| Aspect | Detail |
|---|---|
| **Platform** | Foundry VTT (compatibility minimum ~14.364, verified ~14.365) |
| **Install** | Manifest install from GitHub releases (`system.zip`) |
| **License / content** | Unofficial SRD-oriented implementation; ships LevelDB/YAML packs |
| **Docs** | GitHub wiki; README includes an explicit anti-AI contribution policy |
| **Primary audience** | Groups already running Foundry (maps, lighting, vision, module ecosystem) |

---

## 1. Dice & duality engine

### Duality rolls
- Hope and Fear dice (default d12s) with Hope / Fear / Critical (doubles) outcomes.
- Advantage / disadvantage dice (configurable faces).
- Rally die support from class/subclass features.
- Guaranteed-critical path (e.g. Blaze of Glory).
- Reaction rolls that suppress Hope/Fear resource automation.
- Chat roll modes (public, private GM, blind, self).
- Dice So Nice integration (colors / SFX for Hope, Fear, adv/disadv, crit).

### Other roll types
- **Adversary rolls** — d20 + natural-20 critical handling.
- **Damage rolls** — physical/magical, multi-target, crit extras, horde/group-attack scaling.
- **Fate rolls** — Hope/Fear d12 for death moves and narrative luck.
- **Resource rolls** — pool-tied die rolls.

Interactive pre-roll dialogs configure formulas, modifiers, effects, and message mode before the chat card lands.

---

## 2. Actors

| Type | Role |
|---|---|
| **Character** | Full PC: traits, evasion, armor, thresholds, HP/Stress/Hope/scars, experiences, gold (base-9), loadout vs vault, class/subclass/ancestry/community, companion link |
| **Adversary** | Tier, role (including horde), difficulty, thresholds, motives/tactics, horde HP scaling via active effects |
| **Companion** | Beastbound companion stress/traits |
| **Environment** | Tier, type, impulses, potential adversaries, scene-linked features |
| **Party** | Party members, shared gold, Tag Team config, group-roll state |
| **NPC** | Lightweight non-combat / social actor |

Character sheets expose inventory, features, domain cards, rest buttons, and level-up flows.

---

## 3. Items & actions

### Item types
Ancestry, community, class, subclass, feature, domain card, weapon, armor, consumable, loot, beastform.

### Action framework
Items host a collection of typed actions (attack, damage, healing, effect, beastform, countdown, macro, summon, transform). Actions own workflows (`use` / chat / resource costs / triggers), so feature automation is composed as data + action steps rather than one hard-coded UI path per ability.

Weapons and armor support tags, range, burden, attachments, and equip-gated effect transfer. Domain cards track vault vs loadout and recall costs.

---

## 4. Combat & encounter tools

### Spotlight combat tracker
Replaces classic initiative:
- GM toggles spotlight onto a combatant.
- Optional player **request spotlight** queue (FIFO).
- Spotlight changes can progress countdowns, expire “on act” effects, and consume action tokens (variant rule).

### Battle Points
Live BP budget from party size + adversary composition, with extended-battle modifier toggles.

### Fear
World/GM Fear resource with dedicated UI and automation hooks (Hope/Fear display for GM vs players).

### Defeated / conditions
Configurable defeated overlays by actor type; condition immunities and scrolling feedback on immune applications.

---

## 5. Countdowns

Floating GM/player-aware countdown HUD:
- Types: encounter / narrative / misc (user-toggleable filters).
- Looping: none, reset, increasing, decreasing.
- Optional dice formula for start max.
- Automation on spotlight / roll events when enabled.
- Per-countdown visibility and ownership.

---

## 6. Major interactive workflows

### Damage & armor
- Damage dialog: formulas, crit toggle, group-attack attacker count from token targets.
- Damage reduction dialog: mark armor slots across sources, stress-for-armor extras, stress severity reductions, threshold immunities; resolve to final HP marks.

### Downtime
Short/long rest move picker with homebrewable move lists, choice caps, chat summary, and automatic refresh of rest-recoverable action uses / item resources / effects.

### Death moves
Avoid Death (Hope fate vs level → scars / unconscious / permanent death), Risk It All (reaction duality with recovery or death), Blaze of Glory (guaranteed crit effect then death). Per-move automation toggles.

### Tag Team
Two party members: initiator Hope cost, parallel trait/ability rolls (and optional damage), live socket sync, pick which duality result to keep, combined damage chat message, Hope/Fear automation on finish.

### Group rolls
Multi-character checks with shared difficulty / leadership UX.

### Beastform
Tier browser; evolved and hybrid drag-drop composition; trait bonus modifications; token/portrait swap including dynamic token-ring art.

### Level-up
Guided advancement: traits, experiences, domain cards, subclass feature state, multiclass domain/subclass picks, proficiency/HP/stress/evasion summary.

---

## 7. Content & discovery

### Compendium packs
Classes, subclasses, domains, ancestries, communities, weapons, armors, consumables, loot, adversaries, environments, journals, rolltables, beastforms (~1,100+ source JSON entries under `src/packs/`).

### Item browser
Foldered SRD browser with search, column filters, sort, drag onto sheet/canvas, and GM pack-exclusion settings. Sidebar inject buttons on Actors / Items / Compendium tabs.

---

## 8. Canvas & Foundry integration

- Custom token / ruler / measured-template behavior for Daggerheart range bands (variant rule).
- Token size from homebrew size tables; placement preview helpers.
- Scene flags for environment features and trigger registration.
- Socket-enabled system (`"socket": true`) for multi-client refresh and GM-delegated writes.
- Custom chat message types: duality, fate, adversary, damage, ability use, tag team, system messages.
- Text enrichers for inline Duality / Damage / Fate / Effect / Lookup / table embeds in descriptions and journals.
- Appearance settings: Fear UI placement, pip display, Dice So Nice themes, expanded roll messages, attribution hiding.

---

## 9. Settings surface (high level)

| Category | Examples |
|---|---|
| **Automation** | Hope/Fear display, vulnerable-on-max-stress, countdowns, level-up, action points, horde damage, range effects, damage reduction defaults, death moves, defeated icons |
| **Variant rules** | Action tokens, range measurement distances, massive damage |
| **Metagaming** | Hide observer permissions in chat; hide party stats |
| **Homebrew** | Max Hope/Fear, loadout/domains, trait array, token sizes, currency, custom rest moves, domains, adversary types, weapon/armor features |
| **Appearance** | Resource/Fear/countdown UI, Dice So Nice, description expansion |

---

## 10. Feature map vs Daggertop (summary)

Foundryborne’s strengths are **in-Foundry depth**: canvas range, full sheet/item editing, Tag Team, death-move automation, damage-reduction UX, SRD browser, and the Foundry module ecosystem.

Daggertop’s complementary strengths are **browser-first table play** without Foundry: multiplayer Game Table + battle map, library/import/AI prep, subscription/home lobby, and a declarative V2 feature engine with automated tests.

See also: [foundryborne-codebase-evaluation.md](./foundryborne-codebase-evaluation.md).
