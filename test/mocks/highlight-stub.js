/** Vitest alias for CDN-only `highlight.js`. */
export default {
  highlight: (text) => ({ value: text }),
  highlightAuto: (code) => ({ value: code }),
  getLanguage: () => false,
};
