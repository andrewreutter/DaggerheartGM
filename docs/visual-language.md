# Visual language (DaggerheartGM)

This document separates **semantic signals** (game meaning) from **theme chrome** (neutral UI surfaces). Chrome is implemented as CSS custom properties on `:root` in `src/input.css`; see that file for token names and values. The app uses a fixed dark palette — there is no light mode.

**Implementation note:** Tailwind `@theme` colors for `dh-*` must use a real alpha channel (e.g. `rgb(var(--dh-surface) / 1)`). A literal `<alpha-value>` placeholder in compiled CSS is invalid in browsers and will make `bg-dh-*` / `text-dh` appear transparent or missing.

## Semantic signals

These communicate **mechanics and provenance**. They intentionally use fixed Tailwind hues (amber, red, cyan, sky, violet, etc.) so switching light/dark does not change what “Hope” or “HP” means.

### Resources & combat

| Signal | Typical Tailwind hues | Icon (when used) | Notes |
|--------|-------------------------|------------------|--------|
| **Hope** | Amber (`amber-*`) | — | Hope counter, Hope die, rest banners, Hope-cost UI, `Loader2` often amber on rest flows |
| **Stress** | Orange / amber | — | Stress tracks, orange token dots |
| **HP / damage** | Red (`red-*`) | — | HP tracks, damage dice, damage lines, severe/major thresholds |
| **Armor** | Cyan / teal (`cyan-*`) | `Shield` (Stress/Armor/HP stat chips; defense row) | Armor score, armor slots, armor dots on map tokens |
| **Fear** | Purple (`purple-*`) | — | Fear die, Fear counter, Fear-related banners |
| **Evasion** (shell) | Same cyan ring/label chrome as Armor (`ring-cyan-*`, `text-cyan-300/90`, `Shield`) | `Shield` | Graphical stat block + defense row: **numeric evasion stays sky** (`text-sky-*`) so the score reads separately from armor’s cyan number |

### Magic (spellcast, domains)

Single semantic family so spell buttons, domain picks, and domain UI read as one system. Implemented as **violet** RGB tokens in `src/input.css` (distinct from **Fear** purple and from **trait/attack** sky).

| Role | CSS utilities | Notes |
|------|----------------|--------|
| **Magic surfaces** | `.dh-tint-magic-strip`, `.dh-tint-magic-feature-card` | Sheet header strip under identity; **domain** `GuideFeatureCard` shells (`tone="domain"`). Aliases: `.dh-tint-spellcast-strip` → same vars as magic strip. |
| **Magic controls / chips** | `.dh-tint-magic-label`, `.dh-magic-chip`, `.dh-magic-source-badge` | **Spellcast** trait button (trait grid): `.dh-tint-spellcast-label` (alias of `.dh-tint-magic-label`). **Domain** name chips in `CharacterIdentitySourceBadges`: `.dh-magic-chip`. Domain source pill on feature cards: `.dh-magic-source-badge`. |
| **Magic typography / icons** | `.dh-text-magic-header`, `.dh-text-magic-header-sub`, `.dh-text-magic-icon` | Character name + secondary lines on magic-styled headers; **User** icon on identity header. Aliases: `.dh-text-spellcast-header` / `.dh-text-spellcast-header-sub` → same as magic header vars. |

### Dice, traits & rolls

| Signal | Typical Tailwind hues | Icon | Notes |
|--------|-------------------------|------|--------|
| **Trait scores / attacks** | Sky (`sky-*`) | `Dices` on trait/weapon rows | Primary d20 / trait emphasis |
| **Spellcast** | **Magic** (`violet-*` via `.dh-tint-spellcast-label` / `.dh-tint-magic-label`) | `Sparkles` (`w-4 h-4`) | Trait-grid chip: **`dh-tint-spellcast-label`**; label **`text-[13px]`** uppercase; icon uses **`text-current`** on the magic label |
| **Roll “just rolled” / success flash** | Green (`green-*`) | `Dices` animates green | Micro-feedback on trait/weapon |
| **Neutral / review banner** | Sky border (`sky-*`) | — | Some V2 review banners use a sky-framed “card” scheme |
| **Rest / downtime** | Amber shell (`amber-*`) | `Info` on action tags | Rest banner chrome |

### Data sources (library)

| Source | Badge styling | Icon | Notes |
|--------|---------------|------|--------|
| **Mine** | `.dh-badge-mine` (theme RGB vars in `src/input.css`) | — | User-owned items |
| **SRD** | `.dh-badge-srd` | — | Core SRD rows |
| **DT** | `.dh-badge-dt` | — | Official starter scenes (teal; distinct from SRD purple) |
| **Public** | `.dh-badge-public` | — | Community public |

`SOURCE_BADGE` in `src/client/lib/constants.js` applies `dh-badge` + per-source classes.

### Character identity (sheet header chips)

Single-row chrome lives in `CharacterIdentityTitleRow` (used by `CharacterIdentityHeader` and the Game Table character editor header).

| Field | Tailwind hues | Notes |
|-------|---------------|--------|
| **Tier / Level** | Hex shield + round level badge | `TierShieldBadge`, `LevelBadge` |
| **Class** | Sky | Small bordered chip |
| **Subclass** | Indigo | Small bordered chip |
| **Ancestry** | Amber | Chip |
| **Community** | Emerald | Chip |
| **Domains** | **Magic** — `.dh-magic-chip` (violet tokens) | Domain spell sources; same family as Spellcast / domain cards |

### Map & table tokens

| Role | Colors | Notes |
|------|--------|--------|
| **Characters & companions** | Rotating cool-family palette (`ALLY_TOKEN_PALETTE` in `BattleMap.jsx`): sky-600, emerald-600, cyan-400, blue-700, teal-500, green-600, blue-400, teal-800, green-800, cyan-700 | One distinct color per character/companion, assigned in table order; same assignment for every viewer. Keeps allies in the blue→green family so good vs bad guys stay readable at a glance |
| **Character (fallback)** | Sky / blue (`bg-sky-700`); own assigned PC green (`bg-green-700`) | Only used on render paths without a palette assignment |
| **Companion / board token** | Rotating palette + emerald ring (`ring-emerald-400/90`); fallback `bg-emerald-900` | The emerald ring remains the companion marker |
| **Adversary — solo** | Red (`bg-red-800`) | |
| **Adversary — bruiser** | Orange (`bg-orange-700`) | |
| **Adversary — standard** | Amber (`bg-amber-800`) | Default fallback for unknown roles |
| **Adversary — leader** | Yellow (`bg-yellow-500`) | |
| **Adversary — ranged** | Lime (`bg-lime-500`) | |
| **Adversary — skulk** | Violet (`bg-violet-700`) | |
| **Adversary — horde** | Purple (`bg-purple-600`) | |
| **Adversary — support** | Fuchsia (`bg-fuchsia-500`) | |
| **Adversary — social** | Pink (`bg-pink-500`) | |
| **Adversary — minion** | Rose (`bg-rose-400`) | Lighter; minions are common/weak |
| **Defeated adversary** | Black | |
| **Conditions** | Dark circular marks with name-stable text glyphs (`*` `†` `‡` `§` …) | Extra group on the token border pip ring at the same pip radius as HP / Stress / Armor; omitted when the token has no conditions. Glyph is keyed by condition name (not per-character order). Instant tooltip shows the condition name. Same glyphs are left-hand icons on `ConditionsEditor` chips and suggestion rows |

**Image-border rule**: when a token has a portrait image, its border adopts the *role/type color* above (e.g. `border-red-800` for a solo adversary) instead of the default `border-black`. Defeated adversaries always keep a black border.

### App chrome & brand (semantic, not theme tokens)

| Element | Color | Icon | Notes |
|---------|-------|------|--------|
| **App title “DAGGERTOP”** | `text-red-500` | `Swords` | Nav brand |
| **Library nav** | Active uses `dh` chrome + red accent on tabs | `BookOpen` | |
| **Game Table nav** | Same | `LayoutDashboard` | |
| **Admin-only controls** | Red scheme (`bg-red-*`, etc.) | `ShieldOff` (per project rules) | Destructive / admin |

Optional tweaks later: if a badge fails contrast on a white panel, adjust only that badge’s shade—**do not** remap Hope/HP colors to “neutral” grays.

## Theme chrome

| Token (Tailwind) | Role |
|------------------|------|
| `bg-dh-canvas` | Page / outer shell |
| `bg-dh-surface` | Main content background |
| `bg-dh-raised` | Panels, dropdowns, cards |
| `bg-dh-hover` | Hover rows |
| `bg-dh-map-blank` | Battle map empty canvas |
| `border-dh-border` | Default borders |
| `border-dh-strong` | Stronger dividers |
| `text-dh` | Primary text (`--color-dh` → `dh-text` RGB) |
| `text-dh-muted` | Secondary / helper text |
| `text-dh-link` | Markdown links (`.dh-md` / `.reddit-md`) |
| `bg-dh-inset` | Nested panels / stat blocks (replaces ad-hoc `slate-950` stacks) |
| `bg-dh-chip-bg` / `border-dh-chip-border` | Optional neutral chip shell |
| `fill-dh-tier-shield` / `stroke-dh-tier-shield-stroke` / `text-dh-tier-shield-text` | `TierShieldBadge` hex SVG |
| `bg-dh-level-badge-*` / `text-dh-level-badge-text` / `border-dh-level-badge-border` | `LevelBadge` |
| `.dh-tint-*` utilities | Character sheet semantic tints (trait positive, roll flash, spellcast strip, violet/amber weapon cards, sky row for experiences/tabs) — see `src/input.css` |

Chrome variables are defined in `:root` in `src/input.css` and apply globally — there is no runtime switching. Dark surfaces use light text for all neutral content.

**Convention:** use `bg-dh-*`, `text-dh`, `border-dh-*`, and the `.dh-badge-*` / `.dh-tint-*` classes for neutral surfaces and library chrome. Avoid raw Tailwind `slate-*` for theme-able UI (semantic hues like Hope/amber are unchanged).

## Markdown & code

Rendered item text uses `.dh-md` and Reddit `.reddit-md`. Colors use chrome variables. **Syntax highlighting** (highlight.js) uses `github-dark-dimmed`.

## Theming coverage (phased)

- **Phase A (done):** App shell, nav, loading, sign-in hero, user menu (`app.jsx`, `NavBtn`, `public/index.html` bootstrap).
- **Phase B (done):** `FullPageOverlay`, `ItemDetailModal`, `LibraryView` chrome.
- **Phase C (done):** Game table stack — `GMTableView`, `BattleMap` (blank map uses `bg-dh-map-blank`), `DiceRoller`, `CharacterHoverCard`, plus `ActionLog` for the center column. The 3D dice canvas remains its own WebGL surface (not fully theme-tinted).
- **Phase D (done):** Cards and chips end-to-end — `DetailCardContent`, `LibraryItemDisplayContent`, forms/modals/pickers, `SOURCE_BADGE` + `LevelBadge` + `TierShieldBadge`, and character sheet tints (`.dh-tint-*` + **magic** / spellcast header variables). Manual spot-check: Library card + item detail + character sheet.



## Non-color cues

Elevation: edge contrast via `dh-border` / `dh-raised`. Typography scale and spacing patterns are consistent across the entire UI.
