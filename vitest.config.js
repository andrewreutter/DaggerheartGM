import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.js'],
    setupFiles: ['./test/vitest-setup-act.js'],
  },
});
