// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    include: [ 'client/**/test/**/*Test.mjs' ],
    exclude: ['node_modules/'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [ '**/*Test.mjs' ],
      exclude: ['node_modules/']
    }
  },
});
