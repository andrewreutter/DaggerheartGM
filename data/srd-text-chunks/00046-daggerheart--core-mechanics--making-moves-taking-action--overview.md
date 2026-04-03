---
breadcrumb: "DAGGERHEART › CORE MECHANICS › MAKING MOVES & TAKING ACTION › OVERVIEW"
breadcrumb_titles:
    - "DAGGERHEART"
    - "CORE MECHANICS"
    - "MAKING MOVES & TAKING ACTION"
    - "OVERVIEW"
chapter: "CORE MECHANICS"
heading_level: 5
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
# OVERVIEW

All action rolls require a pair of d12s called **Duality Dice.** These are two visually distinct twelve-sided dice, with one die representing Hope and the other representing Fear.

To make an action roll, you roll the Duality Dice, sum the results, apply any relevant modifiers, and compare the total to a Difficulty number to determine the outcome:

- **Success with Hope:** If your total meets or beats the Difficulty AND your Hope Die shows a higher result than your Fear Die, you rolled a "Success with Hope." You succeed and gain a Hope.
- **Success with Fear:** If your total meets or beats the Difficulty AND your Fear Die shows a higher result than your Hope Die, you rolled a "Success with Fear." You succeed with a cost or complication, but the GM gains a Fear.
- **Failure with Hope:** If your total is less than the Difficulty AND your Hope Die shows a higher result than your Fear Die, you rolled a "Failure with Hope." You fail with a minor consequence and gain a Hope, then the spotlight swings to the GM.
- **Failure with Fear:** If your total is less than the Difficulty AND your Fear Die shows a higher result than your Hope Die, you rolled a "Failure with Fear." You fail with a major consequence and the GM gains a Fear, then the spotlight swings to the GM.
- **Critical Success:** If the Duality Dice show matching results, you rolled a "Critical Success" ("Crit"). You automatically succeed with a bonus, gain a Hope, and clear a Stress. If this was an attack roll, you deal critical damage.
- _Note: A Critical Success counts as a roll "with Hope."_

After resolving the action roll, the table works together to weave the outcome into the narrative and play continues.
