/**
 * Whether concept-AI “Build with AI” UI should show (server flag + user opt-out).
 */
export function shouldShowConceptAiUi(conceptAiEnabled, hideAiUi) {
  return conceptAiEnabled && !hideAiUi;
}

/**
 * Whether image-gen “Generate with AI” UI should show.
 */
export function shouldShowImageGenAiUi(imageGenEnabled, hideAiUi) {
  return imageGenEnabled && !hideAiUi;
}
