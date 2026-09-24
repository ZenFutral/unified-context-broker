import { describe, it, expect } from 'vitest';
import { validatePatchEntry } from '../scripts/validate-patches.js';

describe('Patch Ledger Governance Linter', () => {
  it('passes a fully compliant patch entry', () => {
    const validPatch = {
      patch_id: 'PATCH-CGC-001',
      component: 'codegraphcontext',
      target_version: 'v0.8.2',
      reason: 'Upstream HTTP API does not expose caller line numbers in response',
      upstream_issue: 'https://github.com/upstream/codegraphcontext/issues/142',
      introduced_against: 'commit 4f1a9b2',
      owner: 'Architecture Team',
      removal_condition: 'Remove when upstream release v0.9.0 exposes caller line numbers',
      covered_by: ['tests/contract/provider-contract.spec.ts']
    };

    const result = validatePatchEntry(validPatch);
    expect(result.valid).toBe(true);
  });

  it('rejects patch without removal condition or invalid ID', () => {
    const invalidPatch = {
      patch_id: 'invalid-id-format',
      component: 'comp',
      target_version: 'v0.4.2',
      reason: 'short',
      upstream_issue: 'not-a-url',
      introduced_against: 'commit 123',
      owner: 'Dev',
      removal_condition: '', // Empty removal condition
      covered_by: []
    };

    const result = validatePatchEntry(invalidPatch);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes('patch_id'))).toBe(true);
    expect(result.errors?.some((e) => e.includes('removal_condition'))).toBe(true);
  });
});
