import { InferenceClient } from '@huggingface/inference';

const DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell';
const DEFAULT_EDIT_MODEL = 'black-forest-labs/FLUX.1-Kontext-dev';
const DEFAULT_PROVIDER = 'replicate';

export const isConfigured = () => !!process.env.HF_TOKEN;

function getClient() {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error('HF_TOKEN is not configured');
  return new InferenceClient(token);
}

async function blobToDataUrl(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = blob.type || 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Generate an image from a text prompt using the Hugging Face Inference router.
 * Provider is configurable via HF_PROVIDER (default: replicate).
 * Returns { imageUrl } where imageUrl is a base64-encoded data URL.
 */
export async function generateImage(prompt) {
  const client = getClient();
  const model = process.env.HF_MODEL || DEFAULT_MODEL;
  const provider = process.env.HF_PROVIDER || DEFAULT_PROVIDER;

  const blob = await client.textToImage({
    provider,
    model,
    inputs: prompt,
    parameters: { num_inference_steps: 4 },
  });

  return { imageUrl: await blobToDataUrl(blob) };
}

/**
 * Edit an existing image using a natural language instruction.
 * Accepts the current image as a base64 data URL.
 * Model is configurable via HF_EDIT_MODEL (default: FLUX.1-Kontext-dev).
 * Returns { imageUrl } where imageUrl is a base64-encoded data URL.
 */
export async function editImage(imageDataUrl, prompt) {
  const client = getClient();
  const model = process.env.HF_EDIT_MODEL || DEFAULT_EDIT_MODEL;
  const provider = process.env.HF_PROVIDER || DEFAULT_PROVIDER;

  // Convert base64 data URL to a Buffer then wrap in a Blob for the SDK
  const base64 = imageDataUrl.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const mimeType = (imageDataUrl.match(/^data:([^;]+);/) || [])[1] || 'image/jpeg';
  const blob = new Blob([buffer], { type: mimeType });

  const resultBlob = await client.imageToImage({
    provider,
    model,
    inputs: blob,
    parameters: { prompt },
  });

  return { imageUrl: await blobToDataUrl(resultBlob) };
}
