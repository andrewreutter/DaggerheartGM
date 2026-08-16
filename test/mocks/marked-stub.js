/** Vitest alias for CDN-only `marked` (esbuild external in app bundle). */
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class Marked {
  constructor() {
    this.use = () => this;
  }

  parse(text) {
    const escaped = escapeHtml(text);
    const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return withBold ? `<p>${withBold}</p>` : '';
  }
}
