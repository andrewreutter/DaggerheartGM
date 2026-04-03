---
breadcrumb: "DAGGERHEART › CORE MECHANICS › COMBAT › HIT POINTS & DAMAGE THRESHOLDS"
breadcrumb_titles:
    - "DAGGERHEART"
    - "CORE MECHANICS"
    - "COMBAT"
    - "HIT POINTS & DAMAGE THRESHOLDS"
chapter: "CORE MECHANICS"
heading_level: 4
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
# HIT POINTS & DAMAGE THRESHOLDS

**Hit Points (HP)** represent a character's ability to withstand physical injury. When a character takes damage, they mark 1 to 3 HP, based on their **damage thresholds:**

- If the final damage is at or above the character's Severe damage threshold, they mark 3 HP.
- If the final damage is at or above the character's Major damage threshold but below their Severe damage threshold, they mark 2 HP.
- If the final damage is below the character's Major damage threshold, they mark 1 HP.
- If incoming damage is ever reduced to 0 or less, no HP is marked.

You'll be able to increase the number of Hit Point slots you have available as you level up, to a maximum of 12.

A PC's damage thresholds are calculated by adding their level to the listed damage thresholds of their equipped armor. A PC's starting HP is based on their class, but they can gain additional Hit Points through advancements, features, and other effects.

An adversary's Damage Thresholds and HP are listed in their stat blocks.

When a character marks their last Hit Point, they fall. If a PC falls, they make a death move.

Characters can clear Hit Points by taking downtime moves (see: Downtime) or by activating relevant special abilities or effects.

> _**Optional Rule: Massive Damage**_
>
> If a character ever takes damage equal to twice their Severe threshold, they mark 4 HP instead of 3.
