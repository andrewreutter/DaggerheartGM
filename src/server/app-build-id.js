/**
 * Deploy identity used to cache-bust SPA HTML asset URLs and to tell open
 * tabs when Railway (or any host) has rolled a new process.
 *
 * Preference: Railway git SHA, then generic SOURCE_COMMIT, then deployment id.
 * Local / test / missing env falls back to `dev`.
 */

export const APP_BUILD_ID_FALLBACK = 'dev';
export const SPA_HTML_CACHE_CONTROL = 'no-cache, must-revalidate';

const BUILD_ID_SAFE = /^[A-Za-z0-9._-]+$/;
const BUILD_ID_MAX_LEN = 64;

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizeAppBuildId(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || !BUILD_ID_SAFE.test(trimmed)) return APP_BUILD_ID_FALLBACK;
  return trimmed.slice(0, BUILD_ID_MAX_LEN);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveAppBuildId(env = process.env) {
  return sanitizeAppBuildId(
    env.RAILWAY_GIT_COMMIT_SHA || env.SOURCE_COMMIT || env.RAILWAY_DEPLOYMENT_ID || '',
  );
}

/**
 * Stamp `/app.js` and `/styles.css` hrefs with `?v=<buildId>` so a cached
 * `index.html` is the only thing that can pin an old bundle — and HTML is
 * served with {@link SPA_HTML_CACHE_CONTROL}.
 *
 * @param {string} html
 * @param {string} buildId
 * @returns {string}
 */
export function applyAppBuildIdToSpaHtml(html, buildId) {
  const id = sanitizeAppBuildId(buildId);
  return String(html)
    .replace(/href="(\/styles\.css)(?:\?[^"]*)?"/g, `href="$1?v=${id}"`)
    .replace(/src="(\/app\.js)(?:\?[^"]*)?"/g, `src="$1?v=${id}"`);
}
