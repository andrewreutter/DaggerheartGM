/**
 * Same net effect as saving from {@link MapAiImageBuilderPanel}: HF generate → upload → set-map.
 */

import { generateImage, postMapImageFile } from './api.js';
import { buildBattleMapDefaultPrompt, stripMd } from './ai-image-prompts.js';
import { imageSrcToDataUrlForApi, loadImageNaturalSizeFromUrl } from './map-image-data-url.js';

/**
 * @param {object} mapConfig — mapSizeFt, mapDimension, mapImageNaturalWidth, mapImageNaturalHeight, …
 * @param {string} [encounterConcept] — optional user text (e.g. encounter builder textarea)
 * @param {(config: object, resetTokenPositions?: boolean) => void} onMapConfigChange
 */
export async function generateAndApplyBattleMapQuietly(mapConfig, encounterConcept, onMapConfigChange) {
  const basePrompt = buildBattleMapDefaultPrompt(mapConfig || {});
  const extra = encounterConcept && String(encounterConcept).trim();
  const prompt = extra
    ? `Orthographic top-down view, dark fantasy TTRPG battle map. ${stripMd(extra)}. ${basePrompt}`
    : basePrompt;
  const { imageUrl } = await generateImage(prompt);
  const dataUrl = await imageSrcToDataUrlForApi(imageUrl);
  const { width, height } = await loadImageNaturalSizeFromUrl(dataUrl);
  const blob = await fetch(dataUrl).then((r) => r.blob());
  const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
  const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
  const file = new File([blob], `battle-map.${ext}`, { type: mime });
  const { url } = await postMapImageFile(file);
  if (!url) throw new Error('Upload did not return a URL');
  onMapConfigChange(
    {
      mapImageUrl: url,
      mapImageNaturalWidth: width,
      mapImageNaturalHeight: height,
      mapAiImagePrompt: prompt.trim() || null,
    },
    true,
  );
}
