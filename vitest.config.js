import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      marked: resolve(__dirname, 'test/mocks/marked-stub.js'),
      'highlight.js': resolve(__dirname, 'test/mocks/highlight-stub.js'),
    },
  },
  test: {
    include: ['test/unit/**/*.test.js'],
    setupFiles: ['./test/vitest-setup-act.js'],
  },
});
