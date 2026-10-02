import { describe, it, expect } from 'vitest';
import { RankFusionEngine } from '../src/fusion.js';
import { ContextCandidate } from '@context-broker/contracts';

describe('RankFusionEngine', () => {
  const fusion = new RankFusionEngine();

  it('guarantees exact symbol match override outranks loose semantic matches', () => {
    const looseSemanticMatch: ContextCandidate = {
      id: 'hit-loose-semantic',
      sourceBackend: 'vector',
      sourceType: 'code',
      filePath: 'src/utils/general.ts',
      content: 'function generalHelper() {}',
      semanticScore: 0.98,
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: {}
    };

    const exactSymbolMatch: ContextCandidate = {
      id: 'hit-exact-symbol',
      sourceBackend: 'codegraphcontext',
      sourceType: 'code',
      filePath: 'src/services/call-record.ts',
      symbol: 'extractCallRecordId',
      content: 'export function extractCallRecordId() {}',
      lexicalScore: 0.60,
      graphDistance: 0,
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: {}
    };

    const ranked = fusion.fuseAndRank(
      [looseSemanticMatch, exactSymbolMatch],
      'extractCallRecordId',
      'exact_lookup'
    );

    expect(ranked[0]?.id).toBe('hit-exact-symbol');
    expect(ranked[0]?.compositeScore).toBeGreaterThanOrEqual(1.5);
  });

  it('penalizes stale context candidates', () => {
    const liveCandidate: ContextCandidate = {
      id: 'hit-live',
      sourceBackend: 'comp',
      sourceType: 'code',
      content: 'const live = true;',
      lexicalScore: 0.8,
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: {}
    };

    const staleCandidate: ContextCandidate = {
      id: 'hit-stale',
      sourceBackend: 'comp',
      sourceType: 'code',
      content: 'const stale = true;',
      lexicalScore: 0.8,
      freshness: 'stale',
      permissions: ['workspace:read'],
      metadata: {}
    };

    const ranked = fusion.fuseAndRank([staleCandidate, liveCandidate], 'test', 'hybrid');
    expect(ranked[0]?.id).toBe('hit-live');
    expect(ranked[0]?.compositeScore).toBeGreaterThan(ranked[1]?.compositeScore ?? 0);
  });

  it('performs multi-list RRF fusion across distinct provider streams', () => {
    const lexicalCandidate: ContextCandidate = {
      id: 'doc-1',
      sourceBackend: 'comp',
      sourceType: 'code',
      filePath: 'src/index.ts',
      content: 'function main() {}',
      lexicalScore: 0.9,
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: {}
    };

    const semanticCandidate: ContextCandidate = {
      id: 'doc-2',
      sourceBackend: 'vector',
      sourceType: 'code',
      filePath: 'src/server.ts',
      content: 'function startServer() {}',
      semanticScore: 0.85,
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: {}
    };

    const providerMap = new Map<string, ContextCandidate[]>([
      ['comp', [lexicalCandidate]],
      ['vector', [semanticCandidate]]
    ]);

    const fused = fusion.fuseMultiList(providerMap, 'main server', 'hybrid');
    expect(fused.length).toBe(2);
    expect(fused[0]?.compositeScore).toBeGreaterThan(0);
  });
});
