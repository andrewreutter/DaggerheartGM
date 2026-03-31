# Encounter builder (LLM)

- **Base budget:** `(3 × party size) + 2` Battle Points (BP).
- **Modifiers:** The Game Table can apply the same auto modifiers as scenes (e.g. lower-tier adversaries vs party tier, 2+ solos, no heavy roles) plus optional table battle modifiers — the client sends the **remaining BP** to spend after those rules.
- **Costs (non-minion):** Social/Support 1 BP each; Horde/Ranged/Skulk/Standard 2; Leader 3; Bruiser 4; Solo 5 — **per individual** adversary.
- **Minions:** Add all minion counts in the encounter, then **minion BP = ceil(total minions ÷ party size)** (groups of party size cost 1 BP). Example: party size 4 and 8 minions total → ceil(8÷4) = **2 BP**, not 8 BP.
- **Environments:** Do not cost BP. Aim for at least one environment on the table when none are present.
- **Picks:** Use only `id` values from the provided catalog JSON; prefer adversaries whose **tier** matches the party’s tier before using lower-tier entries.
- **Spend target:** The encounter planner must spend **exactly** the **remaining BP** the user chose (catalog `adversaryAdds` + `needsSyntheticAdversaries` combined). Environments are still 0 BP. If remaining BP is 0, do not add new adversary BP (empty adversary picks are fine; environments may still be added).
- **Justification:** Explain **why** the encounter fits the GM’s stated concept (tone, terrain, types of threats). Reference the **ids and counts** you chose so the narrative matches the JSON. Do not narrate budget retries or step-by-step edits.
