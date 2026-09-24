import { describe, it, expect } from 'vitest';
import { VectorAdapter } from '../src/index.js';
import { ContextCandidateSchema } from '@context-broker/contracts';

describe('VectorAdapter', () => {
  const adapter = new VectorAdapter({ mockMode: true });

  it('reports provider name and version correctly', async () => {
    expect(adapter.name).toBe('vector');
    const version = await adapter.version();
    expect(version.name).toBe('VectorAdapter-Local');
  });

  it('reports healthy status and indexed chunk counts', async () => {
    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.indexedItemCount).toBeGreaterThan(0);
  });

  it('declares semantic search capabilities', async () => {
    const caps = await adapter.capabilities();
    expect(caps.supportsSemanticSearch).toBe(true);
    expect(caps.supportsLexicalSearch).toBe(false);
  });

  it('executes semantic search and returns normalized candidates with semantic scores', async () => {
    const candidates = await adapter.search({
      queryId: 'test-vec-q1',
      query: 'audio stream buffering and jitter synchronization',
      workspaceIds: ['/workspace'],
      intent: 'semantic_discovery',
      tokenBudget: 4000,
      resultLimit: 20,
      accessScope: ['workspace:read'],
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    });

    expect(candidates.length).toBeGreaterThan(0);
    const topHit = candidates[0]!;
    expect(topHit.sourceBackend).toBe('vector');
    expect(topHit.semanticScore).toBeDefined();
    expect(topHit.semanticScore).toBeGreaterThan(0.5);

    for (const candidate of candidates) {
      const parsed = ContextCandidateSchema.safeParse(candidate);
      expect(parsed.success).toBe(true);
    }
  });

  it('allows indexing new code chunks dynamically', async () => {
    const chunkId = await adapter.indexCodeChunk(
      'src/utils/metrics.ts',
      1,
      20,
      'export function trackLatency(start: number): number { return Date.now() - start; }'
    );
    expect(chunkId).toBeDefined();

    const health = await adapter.health();
    expect(health.indexedItemCount).toBe(4);
  });
});
