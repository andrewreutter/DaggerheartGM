---
breadcrumb: "DAGGERHEART › CORE MECHANICS › ATTACKING › RESISTANCE, IMMUNITY, AND DIRECT DAMAGE"
breadcrumb_titles:
    - "DAGGERHEART"
    - "CORE MECHANICS"
    - "ATTACKING"
    - "RESISTANCE, IMMUNITY, AND DIRECT DAMAGE"
chapter: "CORE MECHANICS"
heading_level: 6
source_file: daggerheart-srd/README.md
---

<!--
  Breadcrumb context: Storing the section path (chapter › heading › …) helps RAG and
  humans disambiguate short or generic excerpts — retrieval may surface a paragraph
  because it matches a keyword, while the real signal is "this is under Stress" or
  "Leveling Up". Downsides: extra tokens per chunk; redundant if your embedder already
  sees parent sections. Hybrid approach: keep breadcrumbs in metadata only and prepend
  a one-line summary to the embedded text at index time.
-->
# RESISTANCE, IMMUNITY, AND DIRECT DAMAGE

If a target has **resistance** to a damage type, then they reduce incoming damage of that type by half before comparing it to their Hit Point Thresholds. If the target has additional ways of reducing incoming damage, such as marking Armor Slots, they apply the resistance effect first. The effects of multiple resistances to the same damage type do not stack.

If a target has **immunity** to a damage type, they ignore incoming damage of that type.

If an attack deals both physical and magic damage, a character can only benefit from resistance or immunity if they are resistant or immune to both damage types.

**Direct damage** is damage that can't be reduced by marking Armor Slots.
