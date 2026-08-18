# Foundryborne — Codebase Evaluation

Engineering assessment of the **Foundryborne** Daggerheart Foundry VTT system (`../Foundryborne`), for competitive and architectural comparison with Daggertop (`DaggerheartGM`).

Version sampled: system `2.7.4` (`system.json`). This is a static review of structure and patterns, not a security audit or runtime benchmark.

---

## 1. Snapshot

| Dimension | Finding |
|---|---|
| **Kind** | Foundry **system** (`id: daggerheart`), not a module |
| **Language** | ES modules (`.mjs`), Handlebars templates (`.hbs`), LESS → CSS |
| **Build** | Rollup → `build/daggerheart.js`; Gulp LESS; LDB ↔ YAML pack tools |
| **Dev quality gates** | ESLint + Husky / lint-staged; **no automated test suite** |
| **Scale** | Large UI/data surface (~2k tracked paths including packs/templates); application/dialog classes often 300–800+ LOC |
| **Runtime coupling** | Business logic deeply tied to Foundry globals (`game`, `CONFIG`, documents, sockets) |

---

## 2. Architecture strengths

### Modern Foundry ApplicationV2
Sheets, dialogs, combat tracker, countdowns, and item browser use `ApplicationV2` + `HandlebarsApplicationMixin` with declarative `PARTS`, `TABS`, and `actions`. That matches current Foundry conventions and keeps UI entry points consistent.

### Schema-driven data models
Actors, items, settings (Automation, Homebrew, VariantRules, Metagaming, Appearance), actions, and chat payloads use Foundry `DataModel` fields. Defaults, validation, and nested structures (e.g. action collections) are first-class.

### Composable actions
`ActionsField` / `ActionMixin` let items own typed workflows (attack, damage, healing, effect, beastform, countdown, macro, summon, transform) instead of one mega-handler per feature name. Triggers attach to actions and re-register when items/scenes change.

### Multi-client write pattern
Player-driven world settings (countdowns, Tag Team party state, etc.) route through `emitGMUpdate` / socket refresh events so mutations land under the GM client—necessary on Foundry and generally well factored as a cross-cutting concern.

### Content pipeline
`src/packs/` YAML/JSON → LevelDB packs; symlink + start scripts for local Foundry. Compendium browser settings and exclusion lists are productized, not ad hoc.

### Extensibility hooks
Named system hooks, enrichers (`Duality`, `Damage`, `Fate`, `Effect`, `Lookup`, …), and `CONFIG.DH` config trees give module authors and GMs extension points inside Foundry’s ecosystem.

---

## 3. Architecture weaknesses & risks

### No automated tests
No Vitest/Jest/Playwright (or equivalent) tree was found. Duality math, damage reduction, Tag Team sockets, level-up multiclass rules, and trigger registration are regression-prone without headless coverage. Quality relies on manual Foundry playtesting.

### Dynamic code execution
Triggers compile stored command strings with `foundry.utils.AsyncFunction`. Active-effect formulas use `new Function` + `with (sandbox)`. That is flexible for GMs but:

- Hard to statically analyze or unit-test.
- Error stacks are opaque (`triggerError` logging helps, but debugging remains painful).
- Raises trust boundaries for imported/compendium content that embeds scripts.

### Foundry lock-in
Mechanics are not separable from Foundry documents and UI. There is no portable “rules engine” layer that could power a web table, Discord bot, or shared SRD validator without Foundry.

### Side-effect-heavy dialogs
Some dialogs mutate roll/config objects during formula construction (e.g. critical-state workarounds in damage selection; Tag Team critical/damage join logic). That pattern is fragile under concurrent socket updates and re-renders.

### Large UI modules
`TagTeamDialog`, character level-up context builders, damage-reduction UI, and the item browser mix layout, networking, and rules in one class. Maintainability cost grows with every new multi-actor feature.

### Thin trigger surface
Registered triggers observed in config are few (`dualityRoll`, `fearRoll`, `postDamageReduction`). Much automation lives in actions, active effects, and one-off dialogs instead of a broad declarative hook model—powerful locally, uneven globally.

### TypeScript optional / partial
`.d.ts` stubs exist under documents/items, but the implementation is predominantly untyped JS. ESLint + stylistic rules help consistency; they do not replace mechanical tests.

---

## 4. Code organization (mental map)

```
Foundryborne/
  daggerheart.mjs          # system bootstrap / CONFIG registration
  system.json              # packs, documentTypes, compatibility
  module/
    applications/          # sheets, dialogs, combat, countdowns, browser, level-up
    canvas/                # tokens, rulers, templates, regions
    config/                # SYSTEM, settings menus, triggers, encounter BP, …
    data/                  # actor/item/action/settings/activeEffect models
    dice/                  # DualityRoll, damage, fate, …
    documents/             # Actor, Item, Combat, ChatMessage, ActiveEffect, …
    enrichers/             # inline roll/effect markup
    helpers/               # utils, Handlebars helpers
    systemRegistration/    # sockets, refresh events
  src/packs/               # source JSON for SRD-ish content
  templates/               # Handlebars UI
  tools/                   # start, symlink, LDB↔YAML, eslint config
```

This is a conventional Foundry system layout: clear layers, but “rules” and “VTT chrome” are interleaved.

---

## 5. Comparison to Daggertop

| Concern | Foundryborne | Daggertop |
|---|---|---|
| **Host** | Foundry server + client | Express SPA + Postgres + SSE |
| **Rules placement** | DataModels, actions, AEs, trigger strings, dialogs | Declarative V2 modules + feature-agnostic engine/bridges |
| **Testing** | Essentially none automated | Unit + browser + multi-actor + V2 preflight |
| **Realtime** | Foundry sockets + GM delegation | Server-authoritative ops + LISTEN/NOTIFY snapshots |
| **Content** | Static packs / browser | SRD submodule + DB cache + library/import |
| **AI prep** | Explicitly discouraged in project policy | Character / encounter / image builders |
| **Maps** | Full Foundry canvas (walls, vision, modules) | Custom battle map (tokens, overlays, cameras) |
| **Portability** | Foundry-only | Any modern browser; no Foundry license |

### What Foundryborne does especially well (steal ideas, not code)
- Damage-reduction armor marking UX (multi-source slots + stress trades).
- Death-move modal with clear automation toggles.
- Tag Team multi-player coordination UX.
- Countdown looping modes and formula-initialized clocks.
- In-system SRD item browser with filters and drag-drop.

### Where Daggertop is structurally ahead
- Testability and CI confidence.
- Feature-agnostic engine boundaries (avoid name-branching in shared layers).
- Zero-install multiplayer Game Table + billing/home product surface.
- AI-assisted prep and unified import.

---

## 6. Competitive takeaways

1. **Foundryborne is the deep VTT incumbent** for groups already committed to Foundry. Competing on walls/lighting/modules is the wrong fight; competing on **speed-to-table**, **mobile/player UX**, and **prep automation** is the right one.
2. **Their action + active-effect model** is mature for sheet-centric play. Daggertop’s V2 declarative approach is better positioned for long-term SRD coverage **if** engine boundaries stay clean and tests keep pace.
3. **Their automation gaps** (few triggers, string-eval commands, no tests) are openings: Daggertop can market reliability and transparent, data-driven features.
4. **UX gems** (armor reduction dialog, Tag Team, death moves, countdown loops) are product prompts for Daggertop’s Game Table—not reasons to copy Foundry’s architecture.

---

## Related

- [foundryborne-functionality.md](./foundryborne-functionality.md) — product/feature inventory
