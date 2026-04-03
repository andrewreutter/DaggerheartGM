---
breadcrumb: "DAGGERHEART › RUNNING AN ADVENTURE › CORE GM MECHANICS › COUNTDOWNS"
breadcrumb_titles:
    - "DAGGERHEART"
    - "RUNNING AN ADVENTURE"
    - "CORE GM MECHANICS"
    - "COUNTDOWNS"
chapter: "RUNNING AN ADVENTURE"
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
# COUNTDOWNS

**Countdowns** represent a period of time or series of events preceding a future effect. A countdown begins at a starting value. When a countdown **advances,** it's reduced by 1. The countdown's effect is triggered when the countdown reaches 0.

> _**Note:** You can track countdowns by "spinning down" dice or ticking off boxes._

**Standard countdowns** advance every time a player makes an action roll. If an adversary or environment ability refers to a "Countdown [n]," then it means a standard countdown with a starting value of n.

**Dynamic countdowns** advance by up to 3 depending on the outcomes of action rolls. **Consequence countdowns** are dynamic countdowns to negative effects. **Progress countdowns** are dynamic countdowns to positive effects. Dynamic countdowns advance according to this chart:
