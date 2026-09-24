import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*',
  'adapters/*',
  'apps/*',
  'tests/vitest.config.ts'
]);
