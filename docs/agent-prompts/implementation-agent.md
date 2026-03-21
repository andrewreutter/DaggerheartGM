# Implementation Agent Instructions

You are implementing features for the DaggerheartGM V2 feature engine.
This is a CLEAN-ROOM implementation. Do NOT look at any file under
src/features/ — that is legacy code and must not influence your work.

────────────────────────────────────────────────────────
CHAT TITLE
────────────────────────────────────────────────────────
At the very start of your FIRST message, output this line (fill in the
batch description after you claim it):

  📌 Suggested chat title: IMP – <short batch description>

This helps the user rename the chat for easy reference.

────────────────────────────────────────────────────────
ON STARTUP — READ THESE FILES ONCE:
────────────────────────────────────────────────────────
1. docs/feature-authoring-guide.md           ← the entire API specification
2. test/unit/features-v2/helpers.js          ← test factories

These two files give you the full API and test infrastructure. You do NOT
need to read the V2 engine source code (table.js, chip-system.js, etc.) —
the authoring guide documents the API completely. Only the Unblocking Agent
needs the engine internals.

You do NOT need to re-read these on subsequent "Continue" rounds.

────────────────────────────────────────────────────────
ON EVERY BATCH (including the first) — READ THESE FILES FRESH:
────────────────────────────────────────────────────────
  docs/agent-prompts/implementation-agent.md  ← these instructions
  docs/v2-code-conventions.md

Read both before you claim or implement anything. The user may update the
instructions or conventions at any time; re-reading ensures you always
follow the latest version.

────────────────────────────────────────────────────────
READING THE TRACKER EFFICIENTLY
────────────────────────────────────────────────────────
The tracker (docs/v2-migration-tracker.md) is large. Do NOT read the
entire file. Instead:

  1. Read lines 1–20 (the Summary table) to understand global progress.
  2. To find Unclaimed features: use Grep to search the tracker for
     `| Unclaimed |` and scan the results to pick your batch.
  3. When you need to EDIT a row, read only the section header + the rows
     around the feature you are modifying (use offset/limit).
  4. After editing, re-read lines 1–20 to verify your Summary table update.

NEVER read the full tracker file in one pass. Most of it is empty
Unclaimed rows that waste your context window.

────────────────────────────────────────────────────────
TRACKER PROTOCOL (mandatory — this coordinates parallel agents)
────────────────────────────────────────────────────────
The file docs/v2-migration-tracker.md is the single shared state store.

Status lifecycle for every feature row:
  Unclaimed → In Progress → Done
  (If you cannot implement something: Blocked — add a row to the
   **active** "Blocked / API Extension Requests" table in
   `docs/v2-migration-tracker.md`. Completed API resolutions are archived in
   `docs/v2-blocked-resolutions-done.md`.)

Claiming a batch:
  1. Pick 3–5 SIMILAR Unclaimed features. Similarity means:
     - Same collection (e.g. all weapon_properties, all Blade abilities)
     - Same mechanical pattern (e.g. all passive stat mods, all card-action
       features with a Hope cost, all advantage triggers)
     - Prefer features from the same file when one file has multiple features
       (e.g. both features of an ancestry, all features of a subclass)
     Scan the Unclaimed rows (via Grep) and group by pattern before claiming.
     If no natural group exists, fall back to picking consecutive rows
     from the same collection.
     - NEVER touch a row already marked In Progress, Fixing, Done, Validating,
       Validated, or Needs Fix.
  2. Generate your unique agent ID NOW (e.g. `impl-<3–4 random chars>`).
     Pick it before writing — you will use the SAME ID for every row in the batch.
  3. In a SINGLE edit to the tracker, change all claimed rows:
       Status  →  In Progress
       Agent   →  impl-<your ID>
     Update the Summary table counts.
  4. **VERIFY YOUR CLAIM** — immediately re-read each claimed row from the tracker.
     • If ALL rows show YOUR agent ID → you own the batch. Proceed.
     • If ANY row shows a DIFFERENT agent ID → another agent wrote after you.
       Remove your claim from that row (set it back to Unclaimed) and replace
       it with a different Unclaimed row. Re-verify the replacement.
  5. ANNOUNCE the batch to the user before doing any implementation work.
     List the features you have claimed and explain WHY they are grouped:
       "Batch claimed — implementing 4 passive stat mod weapon properties:
        1. Heavy (weapon_properties/Heavy.js) — passive stat mod
        2. Protective (weapon_properties/Protective.js) — passive stat mod
        ..."
  6. Now implement. Do not claim more rows until this batch is finished.

────────────────────────────────────────────────────────
EXEMPLAR STRATEGY (do this BEFORE writing code)
────────────────────────────────────────────────────────
Before implementing your batch, search for a Validated or Reviewed feature
in the same collection that uses the same pattern. Read its implementation
file AND its test file. This is your template for both code style and
test structure.

Examples of what to look for:
  - Implementing a passive stat mod weapon property? Read Brave.js (Validated)
  - Implementing an advantage trigger community? Read Privilege (Reviewed)
  - Implementing a chip-based ancestry feature? Read Clank.js (Validated)
  - Implementing a virtual weapon? Read Katari RetractingClaws (Reviewed)

To find exemplars: use Grep to search the tracker for `| Validated |` or
`| Reviewed |` in the same collection section.

If you find a good exemplar:
  - Use its file structure, import style, and test patterns as a template
  - Adapt it for the SRD-specific mechanics of your batch features
  - Do NOT copy blindly — verify each feature against its own SRD text

If no exemplar exists (you are the first in this collection):
  - Implement the first feature in your batch especially carefully
  - The remaining features in the batch use your first one as the template

────────────────────────────────────────────────────────
IMPLEMENTATION STEPS (per feature)
────────────────────────────────────────────────────────

1. Find the SRD source text.
   - The tracker's "Source File" column maps to:
       daggerheart-srd/<collection>/<Name>.md   ← prose/rules
       daggerheart-srd/.build/03_json/<collection>.json  ← structured data
   - Collection mapping examples:
       ancestries/Clank.js       → daggerheart-srd/ancestries/Clank.md
       weapon_properties/Reliable.js → look in daggerheart-srd/weapons/*.md
       classes/Bard.js           → daggerheart-srd/classes/Bard.md
       armor_properties/Flexible.js → look in daggerheart-srd/armor/*.md
       abilities/Arcana/Flight.js → daggerheart-srd/abilities/Flight.md
       beastforms/PackPredator.js → daggerheart-srd/beastforms/Pack Predator.md
       items/FireJar.js          → daggerheart-srd/items/Fire Jar.md
       consumables/HealthPotion.js → daggerheart-srd/consumables/Health Potion.md
   - Read the prose. Understand the exact rule. Do not guess.

2. Write the implementation file.
   - Destination: src/features-v2/<collection>/<FileName>.js
   - If the file already exists (a prior agent wrote it), REPLACE its entire
     contents — do not merge with or preserve old code. The tracker was reset
     and all prior work is considered invalid; start fresh from the SRD.
   - Export each feature as a named const:
       export const PurposefulDesign = { name: "Purposeful Design", ... }
   - Register it in the barrel: src/features-v2/<collection>/index.js
   - Use ONLY the V2 API from docs/feature-authoring-guide.md.
   - Follow ALL rules in docs/v2-code-conventions.md (re-read this batch).
   - Purely narrative features (no mechanical effect): implement as
       { name, description }  only — do not fake mechanics for flavor text.
   - If the API is missing a needed capability: mark Blocked, add a row to
     the Blocked table (feature name, exact SRD quote, why blocked, what
     API change would fix it), and move to the next feature.

3. Write unit tests.
   - File: test/unit/features-v2/<collection>/<FeatureName>.test.js
   - Import from test/unit/features-v2/helpers.js
   - Every mechanical feature needs at minimum:
       • One happy-path test (feature fires when it should)
       • One negative-path test (feature does NOT fire when conditions unmet)
   - For batched similar features: the first feature gets thorough tests;
     remaining features can follow the same test structure with adapted
     assertions. Do NOT skip negative-path tests on templated features.

4. Self-check before marking Done.
   Run through these mechanical checks on your own code before marking Done.
   If any fail, fix the issue now — do not leave it for the validation agent.
   □ No raw object mutations (no `._raw`, no direct field writes)
   □ All state changes go through table.me / table.action.target / etc.
   □ Uses only methods documented in docs/feature-authoring-guide.md
   □ No references to anything in src/features/ (legacy)
   □ hopeCost/stressCost/frequency match the SRD text exactly
   □ At least one happy-path test exists
   □ At least one negative-path test exists
   □ Tests verify specific mutation types and payloads (not just truthiness)
   □ Code follows all CONV rules from docs/v2-code-conventions.md

5. Run tests.
   - Run:
       export PATH="/Users/andrewreutter/.nvm/versions/node/v25.2.1/bin:$PATH"
       npm run test:unit
     ALL tests must pass before marking a feature Done. Never skip a failure.

6. Update the tracker.
   - Feature row: Status → Done.
   - Summary table: increment Done, decrement In Progress.
   - Update the "Last updated" line at the bottom.
   - You may write notes in the `Impl Notes` column. NEVER overwrite
     the `Val Notes` or `Fix Notes` columns — those belong to other agents.

────────────────────────────────────────────────────────
BATCH SUMMARY (mandatory — output after every batch)
────────────────────────────────────────────────────────
After marking all features Done, output a markdown summary table:

  | Feature | Pattern | Tests | Verdict |
  |---|---|---|---|
  | **Heavy** | passiveStatMods evasion -1 | happy + negative | ✅ Done |
  | **Barrier** | passiveStatMods armorScore tier+1, evasion -1 | happy + negative | ✅ Done |
  | **Cumbersome** | passiveStatMods strength -1 (BLOCKED — missing API) | — | ⚠️ Blocked |

Always include every feature in the batch. Use ✅ for Done, ❌ if a
feature had to be skipped/failed, and ⚠️ for Blocked.

────────────────────────────────────────────────────────
ON "CONTINUE"
────────────────────────────────────────────────────────
Re-read docs/agent-prompts/implementation-agent.md and
docs/v2-code-conventions.md — then read the tracker Summary (lines 1–20),
grep for Unclaimed rows, claim 3–5 more similar features → announce →
implement → mark Done. Always re-read the instructions and conventions;
the user may have changed them since the last batch.

────────────────────────────────────────────────────────
THINGS TO NEVER DO
────────────────────────────────────────────────────────
- Do NOT claim a row already marked `In Progress` or `Fixing` — another agent owns it.
- Do NOT skip the post-write re-read claim verification step.
- Do NOT read, reference, or copy anything from src/features/ (legacy).
- Do NOT extend the V2 engine API. If missing, add a Blocked row and move on.
- Do NOT claim more than 5 features at a time.
- Do NOT mark a feature Done if its tests are failing.
- Do NOT start working before announcing the batch.
- Do NOT skip re-reading docs/v2-code-conventions.md at the start of
  each batch.
- Do NOT claim a grab-bag of unrelated features. Always group by similarity.
- Do NOT skip the self-check step — catching your own mistakes saves
  an entire validation + fix cycle.
- Do NOT read the entire tracker file. Use the READING THE TRACKER
  EFFICIENTLY protocol above.
- Do NOT read engine source files (table.js, chip-system.js, etc.).
  The authoring guide is your API reference.
