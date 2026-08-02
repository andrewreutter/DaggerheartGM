# V2 Automation Scope Policy

Status: **Locked** — see `docs/plans/productize-daggertop-subscription-decisions.md` §3 ("Automation depth").

This policy exists so V2 migration prioritization (implementation agents, `npm run v2:queue`, orchestrator runs)
optimizes for the mechanics that actually matter for a paid product, instead of chasing 100% SRD automation
coverage as an implicit goal.

## The rule

**Hybrid automation depth.** Two permanent tiers, not a temporary backlog ordering:

1. **Core loop — must reach and stay at `Done`.** Anything that touches:
   - Dice rolling and roll math (attack/damage/reaction rolls, advantage/disadvantage, Hope/Fear/Duality).
   - Resource tracks: HP, Stress, Hope, Armor (marking, clearing, thresholds, death/defeat).
   - Map and range (token position, range bands, range-gated targeting).
   - Weapon and armor properties (the shared feature lists in `docs/srd-implementation.md`).

   These are the mechanics every table touches every session. A gap here is a **bug**, not a backlog item.

2. **Narrative / flavor cards — `Display` is a permanent, deliberate end state, not a TODO.** Most
   ancestry/community features, many class/subclass features, and any card whose effect is fundamentally a
   GM-adjudicated fictional outcome (not a number on the sheet) are **done** once they render correctly on
   the character sheet with accurate text. There is no obligation to ever automate them further. Marking one
   `Display` is not "V2 migration incomplete" — it is the correct, final status for that row.

`Partial` remains a legitimate transitional status (some aspects automated, others intentionally left to the
GM) — it does not need to become `Done` unless the un-automated aspect falls in tier 1.

**"GM Acknowledge" behavior is preserved as-is.** For anything already at `Done`/`Partial`, acknowledging a
banner already includes automatic resource mutation (HP/Stress/Hope/Armor, Fear, etc.). This policy does not
change that — it only clarifies which *new* work is worth doing.

## What this means for prioritization

- Implementation/validation/fixit agents (`docs/agent-prompts/*.md`) should treat tier-1 gaps as
  higher-priority than tier-2 "flesh out a Display-only ancestry feature into Done" work, all else equal.
- A tier-2 row sitting at `Display` forever is **not** a signal to open a Blocked/API resolution or route it
  through the human approval queue — it is expected steady state.
- The **Released ability tier ceiling** (`RELEASED_ABILITY_TIER_CEILING` in `src/game-constants.js`, gated in
  `src/client/lib/build-feature-card-model.js`) is a separate, orthogonal mechanism: it controls which
  *already-automated* domain-card tiers are exposed as interactive chips in the product, independent of how
  much of the SRD is automated overall. Raising it is a product/QA decision (see the ceiling's own doc
  comment), not a V2-migration-completeness signal.
- The V2 engine migration itself (`src/features-v2/`) continues as an independent, unblocked parallel track —
  freezing *monetization-scope* mechanics does not freeze that migration; it only changes what "high value"
  means when agents pick the next row.

## Non-goals

- This policy does not downgrade anything currently `Done` back to `Display`.
- This policy does not mean tier-2 features can be *incorrect* — text and stat display must still be accurate.
  It only means their *mechanical automation* is optional forever.
