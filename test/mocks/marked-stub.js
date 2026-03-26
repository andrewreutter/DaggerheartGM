/** Vitest alias for CDN-only `marked` (esbuild external in app bundle). */
export class Marked {
  constructor() {
    this.use = () => this;
  }

  parse() {
    return '';
  }
}
