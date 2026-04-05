# Daggerheart character creation (app-aligned, levels 1–10)

This file is loaded into the **character concept AI** system prompt as supplemental **creation context**, together with a **compact JSON catalog** from `buildCompactCharacterAiCatalog` and server-side legality tools. The live session uses OpenAI **tool calling**; the current server workflow is:

1. Choose a primary package from the compact catalog.
2. Call `fetch_character_build_profile` to get the legal domain cards, advancement rows, multiclass candidates, and tier-capped gear for that build package.
3. Rank domain cards globally by concept fit, rank advancement pick types by importance, and draft the core character using only ids returned by the compact catalog or build profile.
4. Call `validate_character_build_draft` only for core/package sanity checks when useful.
5. Return the final ranking JSON. The server turns those rankings into one or more legal builds.

## Class domains — where domain spells may come from (critical)

Each **class** lists exactly **two domains** in the catalog (`classes[].domains`). The resolver **only** allows domain spell cards (`srd-abl-*`) whose **domain** matches one of the character’s allowed domains: the **primary class’s two domains**, plus (when multiclassing) the **multiclass domain** per `multiclassDomain` / advancement rules.

**Hard rule for committed picks:** Every `abilityIds`, `advancements[L].domainCardId`, `domain_card` pick, and `domainTrade` id must come from the currently fetched **legal build profile** for the chosen class/subclass package. For multiclass-level cards, use the multiclass domain returned by that same build profile — see Multiclass section.

**Do not** commit domain cards from any global SRD ability list. If a card id did not come from the fetched build profile, it is illegal for that character and should not be used.

**Concept → class:** If the character concept calls for spells from specific magical domains, **choose a class whose two `domains` include those schools** (or plan **multiclass at level 5+** with `multiclassClassId`, `multiclassSubclassId`, and `multiclassDomain` so an extra domain becomes legal). Do not assign a class with e.g. Bone + Sage and then pick Arcana or Codex cards — they will be rejected.

**Subclass:** Must be one of the **exact subclass names** (or matching id) listed under **`catalog.classes[<your class>].subclasses`** for that class. Do not invent or import subclass names from other games.

## OpenAI session workflow

1. **Compact catalog** (JSON in the system message): browse candidates and pick canonical **`srd-*` ids** for classes, subclasses, ancestries, communities, armor, and weapons.

### Two different id namespaces (do not mix them)

| Use | Id shape | Where it appears |
|-----|----------|------------------|
| **Domain spell cards** (abilities) | `srd-abl-*` | `abilityIds` (level 1 only, from that class’s two domains), `advancements[L].domainCardId`, `domain_card` picks’ `abilityId`, optional `domainTrade` |
| **Experience rows** (free-text backgrounds) | Each row’s own `id` string (often a UUID) **or** exact `name` — **never** `srd-abl-*` | `character.experiences[]`, `experience` advancement picks’ `experienceIds`, `experienceBonusChoices` values |

Putting a domain ability id into an experience pick is always wrong and is rejected.

2. **`fetch_character_build_profile` tool**: Before choosing any domain cards or advancement rows, call this tool with  
   `{ "classId": "<srd-cls-...>", "subclassId": "<srd-sub-...>", "targetLevel": N, "multiclassClassId?": "...", "multiclassSubclassId?": "...", "multiclassDomain?": "..." }`.  
   The server returns the legal build profile for that package: class/subclass feature summaries, `startingAbilityOptions`, grouped domain cards, exact legal advancement rows through `targetLevel`, tier-capped gear, experience row count, and multiclass candidates when applicable.
   Use `advancementBandBudgets` in that payload for the shared per-band slot budgets; `advancementRows[L].allowedPickTypes` is only the row-level allowlist, not the full budget rule.

3. **`validate_character_build_draft` tool**: Draft the core `character` object, call the validator when you want a sanity check, and repair package/core issues if needed. The server, not the model, distributes final advancements.

4. **Final assistant message**: Return **only** one JSON object matching the server `OUTPUT_SCHEMA` in `src/llm-character-builder.js`: `justification`, `primaryPackage`, optional `alternatePackage`, `domainCardRanking`, optional `rankedCardRationale`, `startingCardRanking`, `advancementPickTypeRanking`, and `character`. **No** markdown code fences.

**Tool rules:**

- `fetch_character_build_profile` is the source of truth for legal domain cards and legal advancement-row choices.
- `validate_character_build_draft` is the source of truth for whether a draft is legal and complete.
- If `targetLevel` is below 5, stay single-class and explain the closest legal fit when the concept wants off-domain magic.
- If `targetLevel` is 5 or higher, consider a legal multiclass package before accepting off-domain fantasy compromises.

## User target level (`targetLevel`)

The API and UI pass **`targetLevel`** (integer **1–10**, default **1**). The catalog’s gear tier cap and class domain-card hints follow this value. The model should set **`character.level`** to the same number. The resolver **clamps** a draft level above `targetLevel` down to `targetLevel` with a warning.

## Level 1 rules (always)

- **Class** defines starting HP, base evasion, hope feature, **two class domains** (for domain spell cards), and a **suggested trait spread**.
- **Subclass** must belong to the chosen class — use **only** a name (or id) from **`catalog.classes[<chosen class>].subclasses`**.
- **Ancestry** and **community**: one each in the editor.
- **Traits**: six base modifiers must match the standard pool (one +2, two +1, two 0, one −1) unless the class suggested spread is used.
- **Starting domain cards**: exactly **two** distinct **level-1** abilities from the fetched profile’s `startingAbilityOptions` only.
- **Experiences**: row count follows **`expectedExperienceRowCount(level)`** in `src/client/lib/advancement-rules.js` (two base rows plus one per tier-entry level **2, 5, 8** at or below character level). Examples: level **1** → 2 rows; level **4** → 3 rows; level **10** → **5 rows**. Do not emit extra rows (they are trimmed). Each row: `name` + `score` (often 2 at creation). Give each row a **stable string `id`** if you will reference it from `advancements` (or reference rows by **exact `name`** only).
- When the level includes a **tier-entry** experience row (levels **2, 5, 8**), prefer giving that added row a concept-relevant name instead of leaving it blank. If you truly do not know yet, the server can fall back to a generic placeholder.
- **Weapons**: if primary is **two-handed**, no secondary weapon.
- **Beastbound**: optional **companion** object.
- **Experience bonus**: `experienceBonusChoices` maps ancestry feature **name** → experience row **id** or **exact name** (same namespace as experience rows — **not** `srd-abl-*`).

## Levels 2–10: advancements and gear

- **Armor/weapons**: use ids from the fetched profile’s `armorOptions` / `weaponOptions`, which are already tier-limited.
- **`advancements`**: map with string keys **`"2"` … `"N"`** where `N` = `character.level`. Each row:
  - **`domainCardId`**: one new domain spell card for that level-up (must be a legal domain for the character—primary class domains plus **multiclass domain** when multiclassing). For **primary** class domains, the card’s **spell level must be ≤ `L`** where `L` is that level-up row’s key (e.g. level **4** row: spell level ≤ 4). Multiclass domain caps follow `maxSelectableDomainCardLevelForRow` in `advancement-rules.js`.
  - **`picks`**: two advancement picks, **except** when the first pick is **`proficiency`** or **`multiclass`** (those use **both** slots—only `picks[0]` is set).
  - **`domainTrade`** (optional): `{ fromId, toId }` — `fromId` must be a card the character **owned after completing level `L−1`**. `toId` must be a legal replacement per `buildDomainTradeReplacementOptions` (same rules as the editor).
- **Pick `type`** values: `traits`, `hp`, `stress`, `evasion`, `experience`, `proficiency`, `domain_card`, `subclass_upgrade`, `multiclass`. Invalid types are dropped with a warning.
- **Tier bands** (align with `advancement-rules.js` / `CharacterForm`): **Levels 2–4 (band A)** — no `proficiency`, `subclass_upgrade`, or `multiclass`. **`multiclass`** only at **level 5+**. Band slot budgets (`SLOT_BUDGET_PER_BAND`) apply; the resolver drops picks that exceed remaining slots with a warning.
- **Band budgets are shared across the whole band**, not per row. Example: band A allows only **one** `experience` pick total across levels 2, 3, and 4 combined, and only **one** `domain_card` pick total across that same band.
- **`traits` pick**: `{ type: "traits", traits: [traitKey, traitKey] }` — two **distinct** keys among agility, strength, finesse, instinct, presence, knowledge.
- **`experience` pick**: `{ type: "experience", experienceIds: [id, id] }` — two **distinct** references to rows in `character.experiences`: each value is that row’s **`id`** or **exact `name`** string. **Never** use `srd-abl-*` here (those are domain cards).

Example (level 3 character with three experience rows `e1`, `e2`, `e3`):

```json
"advancements": {
  "2": { "domainCardId": "srd-abl-…", "picks": [{ "type": "experience", "experienceIds": ["e1", "e2"] }, { "type": "hp" }] },
  "3": { "domainCardId": "srd-abl-…", "picks": [{ "type": "stress" }, { "type": "evasion" }] }
}
```

(Use real ids from your `experiences` array, or two distinct **names** instead of ids.)
- **`domain_card` pick**: `{ type: "domain_card", abilityId }` — same domain/spell-level rules as `domainCardId`; must not duplicate a card the character already owns at that point.

## Multiclass (character-level fields)

When the sheet includes a **`multiclass`** advancement pick (typically tier B/C, level 5+), also set:

- **`multiclassClassId`**, **`multiclassSubclassId`** — second class and a subclass that belongs to it (ids or names; resolver normalizes).
- **`multiclassDomain`** — if the multiclass class has **two** domains, set this to the **exact domain name** the player uses for multiclass spell access. If the class has only one domain, omit / null.

The resolver clears multiclass fields if they contradict each other or the primary class.

## Resolver output (`resolveCharacterAiDraft`)

- Merges **`sheetDisplayNames.weapons`** / **`.abilities`** / **`.features`** only when keys match resolved equipment, **owned** domain card ids (including cards from advancements and trades), and **guide feature keys** for this build (see below), via `collectOwnedDomainAbilityIds` + `recomputeCharacter` + `buildAllowedFeatureSheetDisplayNameKeys`.
- Appends human-readable gaps from **`missingLevelAdvancementChoices`** as warnings (`Advancement incomplete: …`).
- Sets **`advancementChoicesLockedThroughLevel`** to **`character.level`** when there are no gaps, otherwise **`1`** so the editor level-up flow can still apply.

## Optional sheet display names

- **`character.sheetDisplayNames.weapons`**: keys = weapon id or `slot-primary:<id>` / `slot-secondary:<id>`.
- **`character.sheetDisplayNames.abilities`**: keys = `ability-<srd-abl-id>` for any **owned** domain card at that level. Use this when a legal card is mechanically right but its printed name is off-theme for the concept, so the sheet can show a flavor alias instead.
- **`character.sheetDisplayNames.features`**: optional nicknames for **guide** class / subclass / ancestry / community / beastform features (not domain cards — those use `abilities`).
  - **Allowed keys** = each guide row’s `entry.key` after `recomputeCharacter` (e.g. `class-Rally-0`, `sub-…`, `anc-…`) **plus** squashed keys `feat__<source_slug>__<feature_slug>` from the same rows’ SRD source name + feature name (`makeFeatureSheetDisplayKey` / `finalizeFeatureSheetDisplayKeys` in `sheet-display-names.js`). If two rows would collide on the base `feat__…` string, the resolver and UI append `__` + a short hash so keys stay unique.
  - **Slug rules** (must match the app): lowercase; **only** letters, digits, and **underscores** between words — not hyphens. Punctuation and spaces in the feature name become underscores (e.g. **Ranger's Focus** → `feat__ranger__ranger_s_focus`, **Hold Them Off** → `feat__ranger__hold_them_off`). Prefer copying **`entry.key`** from hydrated data when possible.

## Static prefix / caching

System instructions, this doc, and the compact catalog shape are designed to stay **stable** across requests so OpenAI **prompt caching** can apply to the large shared prefix; **user concept**, **`targetLevel`**, and **tool results** vary per call.
