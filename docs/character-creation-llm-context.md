# Daggerheart level 1 character creation (app-aligned)

Facts the model should respect when proposing a **level 1** player character for this app:

- **Class** defines starting HP, base evasion, hope feature, **two class domains** (for domain spell cards), and a **suggested trait spread** (six integers that sum to the standard Daggerheart pool). You will choose this based on the abilities it provides and the domain cards it gives you access to, and how well those match the character concept.
- **Subclass** must belong to the chosen class (each class lists valid subclass names in SRD data).
- **Ancestry** and **community** are single picks in the character editor (one ancestry id, one community id).
- **Traits**: at creation, the six base trait modifiers must match the allowed pool exactly (one +2, two +1, two 0, one −1) unless the editor applies the class suggested spread.
- **Equipment at level 1**: weapons and armor are typically **tier 1** options in the SRD list the app exposes at this level.
- **Domain cards**: exactly **two** distinct level-1 **domain abilities** taken **only** from that class’s two domains (the catalog lists legal options per class as `level1DomainCards`). Do not choose a card from another domain just because the name fits the concept.
- **Experiences**: **two** free-form phrases (not a closed list). At creation each usually has score **2** (range 0–3). Good spread: one phrase that fits **fights, danger, or pressure** (when you spend Hope on those kinds of rolls), and one for **exploration, people, places, or craft** — see `experienceExamples` in the API catalog for tone.
- **Weapons**: if the primary weapon is **two-handed**, there is **no** secondary weapon in the app.
- **Beastbound** (ranger subclass): includes an optional **companion** object (name, species, attack label, evasion, stress track, companion experiences).
- **Experience bonus**: some ancestries grant +1 to one experience; the app stores this as `experienceBonusChoices` mapping the **ancestry feature name** to the chosen **experience row id** after experiences are created.

Output ids must match SRD rows from the provided catalog (`srd-*` ids). The server resolver also accepts **names** and maps them to ids when possible.
