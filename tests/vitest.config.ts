import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration-tests',
    environment: 'node',
    globals: false,
    // Allow JSON imports (for benchmark-cases.json)
    server: {
      deps: {
        inline: ['@context-broker/contracts', '@context-broker/orchestrator']
      }
    },
    // Chaos injection test has a 5s deliberate delay; set per-test timeout
    testTimeout: 15000,
    include: ['**/*.spec.ts'],
    reporters: ['verbose']
  }
});
