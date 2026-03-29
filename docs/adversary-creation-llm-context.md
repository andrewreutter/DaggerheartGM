# Daggerheart adversary creation (app-aligned)

## Scaling and stats (authoritative)

- **Use the app’s guide baselines**, not SRD book numbers. The API injects `guideBaselines` per `tier:role` from the same RightKnight-style tables as the adversary editor (`src/client/lib/adversary-defaults.js`). SRD examples in the catalog are for **tone, feature count, and phrasing**; if an SRD line disagrees with `guideBaselines`, **trust the baselines**.
- **Primary SRD examples:** same **tier and role** (e.g. Tier 2 bruisers) — full stat-block shape.
- **Secondary SRD examples:** same tier (all roles) or same role (all tiers) — **features and experiences only**; do not copy combat numbers from a different role.

## Roles and tiers

- Roles: bruiser, horde, leader, minion, ranged, skulk, social, solo, standard, support.
- Tiers 1–4. Minions use **no** damage thresholds (0 / 0) and very low HP.

## Output shape

- One attack line with range, modifier, trait (Phy/Mag/Dir), and damage dice string.
- Experiences: name + modifier (typically 1–3).
- Features: action / reaction / passive with markdown-friendly descriptions.
