import { describe, it, expect } from 'vitest';
import { CompAdapter } from '../src/index.js';
import { ContextCandidateSchema } from '@context-broker/contracts';

describe('CompAdapter', () => {
  const adapter = new CompAdapter({ mockMode: true });

  it('reports provider name and version correctly', async () => {
    expect(adapter.name).toBe('comp');
    const version = await adapter.version();
    expect(version.name).toBe('comP');
    expect(version.version).toBe('0.4.2-comp');
  });

  it('reports healthy status in mock mode', async () => {
    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.indexedItemCount).toBe(1420);
  });

  it('declares expected capabilities', async () => {
    const caps = await adapter.capabilities();
    expect(caps.supportsLexicalSearch).toBe(true);
    expect(caps.supportsDocumentExtraction).toBe(true);
    expect(caps.supportsGraphTraversal).toBe(false);
  });

  it('executes search and returns valid ContextCandidate list', async () => {
    const candidates = await adapter.search({
      queryId: 'test-q-1',
      query: 'CallRecordId',
      workspaceIds: ['/test/workspace'],
      intent: 'hybrid',
      tokenBudget: 4000,
      resultLimit: 20,
      accessScope: ['workspace:read'],
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    });

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      const parsed = ContextCandidateSchema.safeParse(candidate);
      expect(parsed.success).toBe(true);
      expect(candidate.sourceBackend).toBe('comp');
      expect(candidate.lexicalScore).toBeDefined();
      expect(candidate.lexicalScore).toBeGreaterThanOrEqual(0);
      expect(candidate.lexicalScore).toBeLessThanOrEqual(1);
    }
  });
});
