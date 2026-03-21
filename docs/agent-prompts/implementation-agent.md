# Implementation Agent Instructions

You are implementing features for the DaggerheartGM V2 feature engine.
This is a CLEAN-ROOM implementation. Do NOT look at any file under
src/features/ — that is legacy code and must not influence your work.

────────────────────────────────────────────────────────
ON STARTUP — READ THESE FILES ONCE:
────────────────────────────────────────────────────────
1. docs/feature-authoring-guide.md           ← the entire API specification
2. src/features-v2/engine/table.js           ← the table snapshot / mutation system
3. src/features-v2/engine/when.js            ← when() / isActing / isTargeted helpers
4. src/features-v2/engine/action-loop.js     ← phase runner
5. src/features-v2/engine/chip-system.js     ← chip lifecycle
6. test/unit/features-v2/helpers.js          ← test factories
7. test/unit/features-v2/engine/table.test.js ← example test style

You do NOT need to re-read these on subsequent "Continue" rounds.

────────────────────────────────────────────────────────
ON EVERY BATCH (including the first) — READ THESE FILES FRESH:
────────────────────────────────────────────────────────
  docs/agent-prompts/implementation-agent.md  ← these instructions
  docs/v2-code-conventions.md
  docs/v2-migration-tracker.md

Read all three at the start of every batch, before you claim or implement
anything. The user may update the instructions or conventions at any time;
re-reading them ensures you always follow the latest version.

────────────────────────────────────────────────────────
TRACKER PROTOCOL (mandatory — this coordinates parallel agents)
────────────────────────────────────────────────────────
The file docs/v2-migration-tracker.md is the single shared state store.

Status lifecycle for every feature row:
  Unclaimed → In Progress → Done
  (If you cannot implement something: Blocked — add a row to the
   "Blocked / API Extension Requests" table at the bottom of the tracker.)

Claiming a batch:
  1. Find the first 5 features whose Status is `Unclaimed`.
     - Pick from any collection — order does not matter.
     - NEVER touch a row already marked In Progress, Done, Validating,
       Validated, or Needs Fix.
  2. In a SINGLE edit to the tracker, change all 5 rows:
       Status  →  In Progress
       Agent   →  impl-<something short and unique>
     Update the Summary table counts.
  3. ANNOUNCE the batch to the user before doing any implementation work.
     List the 5 features you have claimed, e.g.:
       "Batch claimed — implementing:
        1. Purposeful Design (ancestries/Clank.js)
        2. Efficient (ancestries/Clank.js)
        ..."
  4. Now implement. Do not claim more rows until this batch is finished.

Finishing a feature:
  After its unit tests pass, change that row's Status to Done.
  Do this one row at a time, immediately after the tests pass.
  Update the Summary table counts and the "Last updated" line.
  You may write notes in the `Impl Notes` column. NEVER overwrite
  the `Val Notes` or `Fix Notes` columns — those belong to other agents.

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
   - Run:
       export PATH="/Users/andrewreutter/.nvm/versions/node/v25.2.1/bin:$PATH"
       npm run test:unit
     ALL tests must pass before marking a feature Done. Never skip a failure.

4. Update the tracker.
   - Feature row: Status → Done.
   - Summary table: increment Done, decrement In Progress.
   - Update the "Last updated" line at the bottom.

────────────────────────────────────────────────────────
ON "CONTINUE"
────────────────────────────────────────────────────────
Re-read docs/agent-prompts/implementation-agent.md, docs/v2-code-conventions.md,
and docs/v2-migration-tracker.md — then claim 5 more Unclaimed rows →
announce → implement → mark Done. Always re-read all three; the user may
have changed the instructions or conventions since the last batch.

────────────────────────────────────────────────────────
THINGS TO NEVER DO
────────────────────────────────────────────────────────
- Do NOT read, reference, or copy anything from src/features/ (legacy).
- Do NOT extend the V2 engine API. If missing, add a Blocked row and move on.
- Do NOT implement Subclasses or Abilities — those are Phase 4.
  Skip them if you encounter them; pick the next Unclaimed row instead.
- Do NOT claim more than 5 features at a time.
- Do NOT mark a feature Done if its tests are failing.
- Do NOT start working before announcing the batch.
- Do NOT skip re-reading docs/v2-code-conventions.md at the start of
  each batch.
