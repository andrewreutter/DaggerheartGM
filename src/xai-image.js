const DEFAULT_BASE = 'https://api.x.ai/v1';
const DEFAULT_MODEL = 'grok-imagine-image';

export const isConfigured = () => !!process.env.XAI_API_KEY;

function getApiKey() {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('XAI_API_KEY is not configured');
  return key;
}

function baseUrl() {
  return (process.env.XAI_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
}

function model() {
  return process.env.XAI_IMAGE_MODEL || DEFAULT_MODEL;
}

/** @param {Record<string, unknown>} body */
function optionalImageKnobs(body) {
  const ar = process.env.XAI_IMAGE_ASPECT_RATIO;
  if (ar && ar !== 'auto') body.aspect_ratio = ar;
  const res = process.env.XAI_IMAGE_RESOLUTION;
  if (res === '1k' || res === '2k') body.resolution = res;
}

async function readXaiError(res) {
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    const msg = j.error?.message || j.message || text;
    return typeof msg === 'string' ? msg : text;
  } catch {
    return text || res.statusText;
  }
}

/**
 * @param {unknown} json
 * @returns {{ imageUrl: string, usage: unknown }}
 */
function firstImageToDataUrl(json) {
  const row = json?.data?.[0];
  if (!row) throw new Error('x.ai image response missing data[0]');

  if (row.b64_json && typeof row.b64_json === 'string') {
    const mime = typeof row.mime_type === 'string' && row.mime_type.startsWith('image/')
      ? row.mime_type
      : 'image/png';
    return { imageUrl: `data:${mime};base64,${row.b64_json}`, usage: json?.usage ?? null };
  }

  if (row.url && typeof row.url === 'string') {
    return { imageUrl: row.url, usage: json?.usage ?? null };
  }

  throw new Error('x.ai image response has no b64_json or url');
}

/**
 * Generate an image from a text prompt via x.ai Grok Imagine.
 * Returns { imageUrl } — base64 data URL when response_format is b64_json.
 */
export async function generateImage(prompt) {
  const key = getApiKey();
  const body = {
    model: model(),
    prompt,
    response_format: 'b64_json',
  };
  optionalImageKnobs(body);

  const res = await fetch(`${baseUrl()}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await readXaiError(res);
    throw new Error(`x.ai image generation failed (${res.status}): ${detail}`);
  }

  const json = await res.json();
  const { imageUrl, usage } = firstImageToDataUrl(json);
  return { imageUrl, usage };
}

/**
 * Edit an image with a natural-language prompt.
 * @param {string} imageDataUrl — base64 data URL from the client
 */
export async function editImage(imageDataUrl, prompt) {
  const key = getApiKey();
  if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:')) {
    throw new Error('editImage expects a data: URL');
  }

  const body = {
    model: model(),
    prompt,
    response_format: 'b64_json',
    image: {
      url: imageDataUrl,
      type: 'image_url',
    },
  };
  optionalImageKnobs(body);

  const res = await fetch(`${baseUrl()}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await readXaiError(res);
    throw new Error(`x.ai image edit failed (${res.status}): ${detail}`);
  }

  const json = await res.json();
  const { imageUrl, usage } = firstImageToDataUrl(json);
  return { imageUrl, usage };
}
