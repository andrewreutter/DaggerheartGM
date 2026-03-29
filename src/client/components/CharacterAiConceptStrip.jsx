import { useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
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

  useImperativeHandle(ref, () => ({
    cancel: () => stripRef.current?.cancel(),
  }));

  const transformMerged = useCallback(
    (merged) => recomputeCharacter(merged, srdData),
    [srdData],
  );

  if (!shouldShowConceptAiUi(conceptAiEnabled, hideAiUi) || srdLoading) return null;

  return (
    <ConceptAiStrip
      ref={stripRef}
      postBuild={postCharacterAiBuild}
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
  );
});

CharacterAiConceptStrip.displayName = 'CharacterAiConceptStrip';
