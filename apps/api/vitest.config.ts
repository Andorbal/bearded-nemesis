import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Exclude integration tests by default (they require running API server)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.test.ts',
    ],
    // Environment configuration
    environment: 'node',
    // Enable globals (optional)
    globals: true,
  },
});
