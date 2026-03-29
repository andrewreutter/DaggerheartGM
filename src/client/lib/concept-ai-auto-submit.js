/**
 * Whether ConceptAiStrip should trigger one automatic “Build with AI” after seeding the textarea
 * (e.g. Encounter / Add picker → editor with pending concept). Pure guard for tests + strip.
 */
export function shouldAttemptConceptAiAutoSubmit({
  autoSubmitKey,
  aiConceptTrimmed,
  gateReady,
  prerequisitesReady,
  aiLoading,
  alreadyFiredForKey,
}) {
  if (!autoSubmitKey || !gateReady || !prerequisitesReady || aiLoading) return false;
  if (!aiConceptTrimmed) return false;
  if (alreadyFiredForKey === autoSubmitKey) return false;
  return true;
}
