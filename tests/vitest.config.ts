import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@context-broker/contracts': path.resolve(__dirname, '../packages/contracts/src/index.ts'),
      '@context-broker/orchestrator': path.resolve(__dirname, '../packages/orchestrator/src/index.ts'),
      '@context-broker/ranking': path.resolve(__dirname, '../packages/ranking/src/index.ts'),
      '@context-broker/security': path.resolve(__dirname, '../packages/security/src/index.ts'),
      '@context-broker/provenance': path.resolve(__dirname, '../packages/provenance/src/index.ts'),
      '@context-broker/adapter-lexical': path.resolve(__dirname, '../packages/adapter-lexical/src/index.ts'),
      '@context-broker/adapter-codegraph': path.resolve(__dirname, '../packages/adapter-codegraph/src/index.ts'),
      '@context-broker/adapter-vector': path.resolve(__dirname, '../packages/adapter-vector/src/index.ts'),
      '@context-broker/adapter-git': path.resolve(__dirname, '../packages/adapter-git/src/index.ts'),
      '@context-broker/adapter-memory': path.resolve(__dirname, '../packages/adapter-memory/src/index.ts')
    }
  },
  test: {
    name: 'integration-tests',
    environment: 'node',
    globals: false,
    testTimeout: 15000,
    include: ['**/*.spec.ts'],
    reporters: ['verbose']
  }
});
