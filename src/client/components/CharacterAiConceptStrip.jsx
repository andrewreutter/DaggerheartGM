import { useCallback, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { conceptAiEnabled, postCharacterAiBuild } from '../lib/api.js';
import { useAiUiPreference } from '../lib/ai-ui-preference-context.jsx';
import { shouldShowConceptAiUi } from '../lib/ai-ui-visibility.js';
import { useCharacterSrdData } from '../lib/useCharacterSrdData.js';
import { recomputeCharacter } from '../lib/character-calc.js';
import { ConceptAiStrip } from './ConceptAiStrip.jsx';

/**
 * Character “describe a concept → Build with AI” UI. Ref exposes `{ cancel() }`.
 */
export const CharacterAiConceptStrip = forwardRef(function CharacterAiConceptStrip(
  {
    getMergeBase,
    onComplete,
    onAiBusyChange,
    variant = 'default',
    compactJustification = false,
    showOrSeparators = false,
    textareaRows,
    showBuildButtonSpinner = true,
    initialConcept,
    initialConceptKey,
    autoSubmitKey,
    onPendingConsumed,
  },
  ref,
) {
  const { hideAiUi } = useAiUiPreference();
  const { srdData, loading: srdLoading } = useCharacterSrdData();
  const stripRef = useRef(null);
  const [aiTargetLevel, setAiTargetLevel] = useState(1);

  const postBuildWithLevel = useCallback(
    (concept, opts) => postCharacterAiBuild(concept, { ...opts, targetLevel: aiTargetLevel }),
    [aiTargetLevel],
  );

  useImperativeHandle(ref, () => ({
    cancel: () => stripRef.current?.cancel(),
  }));

  const transformMerged = useCallback(
    (merged) => recomputeCharacter(merged, srdData),
    [srdData],
  );

  if (!shouldShowConceptAiUi(conceptAiEnabled, hideAiUi) || srdLoading) return null;

  return (
    <>
      <div className="rounded-lg border border-violet-800/35 bg-violet-950/15 px-3 py-2 mb-2 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-dh-muted">AI build target level</span>
          <span className="text-xs tabular-nums text-dh">
            {aiTargetLevel}
            <span className="text-dh-muted font-normal"> / 10</span>
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={aiTargetLevel}
          onChange={(e) => setAiTargetLevel(Number(e.target.value))}
          className="w-full h-1.5 accent-violet-500"
          aria-label="Target level for AI character build"
        />
        <p className="text-[11px] text-dh-muted leading-snug">
          The model builds toward this level (advancements, experience rows, gear tier). This is not the editor’s
          level preview slider on the table.
        </p>
      </div>
      <ConceptAiStrip
        ref={stripRef}
        postBuild={postBuildWithLevel}
      getMergeBase={getMergeBase}
      transformMerged={transformMerged}
      onComplete={onComplete}
      onAiBusyChange={onAiBusyChange}
      variant={variant}
      compactJustification={compactJustification}
      showOrSeparators={showOrSeparators}
      textareaRows={textareaRows}
      showBuildButtonSpinner={showBuildButtonSpinner}
      initialConcept={initialConcept}
      initialConceptKey={initialConceptKey}
      autoSubmitKey={autoSubmitKey}
      onPendingConsumed={onPendingConsumed}
      gateReady={!!srdData}
      labels={{
        title: "Describe a character concept, we'll match it as best as we can",
        placeholder:
          'e.g. A cheerful halfling thief who grew up in a library and wants to map the world…',
        buildButton: 'Build with AI',
        summaryTitle: 'AI picks summary',
      }}
    />
    </>
  );
});

CharacterAiConceptStrip.displayName = 'CharacterAiConceptStrip';
