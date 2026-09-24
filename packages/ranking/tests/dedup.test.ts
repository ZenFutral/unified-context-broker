import { describe, it, expect } from 'vitest';
import { SpatialDeduplicator } from '../src/dedup.js';
import { ContextCandidate } from '@context-broker/contracts';

describe('SpatialDeduplicator', () => {
  const dedup = new SpatialDeduplicator();

  it('collapses overlapping candidates in the same file and merges multi-engine signals', () => {
    const compCandidate: ContextCandidate = {
      id: 'comp-hit-1',
      sourceBackend: 'comp',
      sourceType: 'code',
      filePath: 'src/services/call.ts',
      startLine: 10,
      endLine: 30,
      content: 'function extractCallId() { return "id"; }',
      lexicalScore: 0.85,
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: { engine: 'comp' }
    };

    const vectorCandidate: ContextCandidate = {
      id: 'vec-hit-1',
      sourceBackend: 'vector',
      sourceType: 'code',
      filePath: 'src/services/call.ts',
      startLine: 20,
      endLine: 45,
      content: 'function extractCallId() { return "id"; }\nfunction parseCall() {}',
      semanticScore: 0.92,
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: { engine: 'vector' }
    };

    const result = dedup.deduplicate([compCandidate, vectorCandidate]);
    expect(result.length).toBe(1);

    const merged = result[0]!;
    expect(merged.filePath).toBe('src/services/call.ts');
    expect(merged.startLine).toBe(10);
    expect(merged.endLine).toBe(45);
    expect(merged.lexicalScore).toBe(0.85);
    expect(merged.semanticScore).toBe(0.92);
    expect(merged.content).toContain('parseCall');
  });

  it('preserves disjoint non-overlapping candidates in different files', () => {
    const candidateA: ContextCandidate = {
      id: 'hit-a',
      sourceBackend: 'comp',
      sourceType: 'code',
      filePath: 'src/a.ts',
      startLine: 1,
      endLine: 10,
      content: 'const a = 1;',
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: {}
    };

    const candidateB: ContextCandidate = {
      id: 'hit-b',
      sourceBackend: 'vector',
      sourceType: 'code',
      filePath: 'src/b.ts',
      startLine: 1,
      endLine: 10,
      content: 'const b = 2;',
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: {}
    };

    const result = dedup.deduplicate([candidateA, candidateB]);
    expect(result.length).toBe(2);
  });
});
