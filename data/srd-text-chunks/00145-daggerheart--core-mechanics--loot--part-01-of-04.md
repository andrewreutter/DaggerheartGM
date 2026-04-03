---
breadcrumb: "DAGGERHEART › CORE MECHANICS › LOOT"
breadcrumb_titles:
    - "DAGGERHEART"
    - "CORE MECHANICS"
    - "LOOT"
chapter: "CORE MECHANICS"
heading_level: 3
source_file: daggerheart-srd/README.md
chunk_part: 1
chunk_part_total: 4
---

<!--
  Breadcrumb context: Storing the section path (chapter › heading › …) helps RAG and
  humans disambiguate short or generic excerpts — retrieval may surface a paragraph
  because it matches a keyword, while the real signal is "this is under Stress" or
  "Leveling Up". Downsides: extra tokens per chunk; redundant if your embedder already
  sees parent sections. Hybrid approach: keep breadcrumbs in metadata only and prepend
  a one-line summary to the embedded text at index time.
-->
# LOOT

**Loot** comprises any consumables or reusable items the party acquires.

**Items** can be used until sold, discarded, or lost.

To generate a random item, choose a rarity, roll the designated dice, and match the total to the item in the table:

- **Common:** 1d12 or 2d12
- **Uncommon:** 2d12 or 3d12
- **Rare:** 3d12 or 4d12
- **Legendary:** 4d12 or 5d12
