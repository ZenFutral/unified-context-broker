import { describe, it, expect } from 'vitest';
import { GraphExpansionEngine } from '../src/graph-expansion.js';
import { ContextCandidate } from '@context-broker/contracts';

describe('GraphExpansionEngine', () => {
  const engine = new GraphExpansionEngine({ alpha: 0.5, maxExpandedNodes: 10 });

  it('calculates decaying graph relevance properly', () => {
    expect(engine.calculateRelevance(0)).toBe(1.0);
    expect(engine.calculateRelevance(1)).toBe(0.6667); // 1 / (1 + 0.5 * 1) = 1/1.5
    expect(engine.calculateRelevance(2)).toBe(0.5);      // 1 / (1 + 0.5 * 2) = 1/2
    expect(engine.calculateRelevance(4)).toBe(0.3333);   // 1 / (1 + 0.5 * 4) = 1/3
  });

  it('suppresses neighbor nodes if no valid seed is present', () => {
    const neighbors: ContextCandidate[] = [
      {
        id: 'node-caller1',
        sourceBackend: 'codegraphcontext',
        sourceType: 'graph',
        content: 'function caller() {}',
        graphDistance: 1,
        freshness: 'live',
        permissions: ['workspace:read'],
        metadata: {}
      }
    ];

    const result = engine.expandAndScore([], neighbors);
    expect(result.length).toBe(0);
  });

  it('expands and scores neighbors when seed candidate is present', () => {
    const seed: ContextCandidate = {
      id: 'node-seed',
      sourceBackend: 'codegraphcontext',
      sourceType: 'graph',
      content: 'function targetSymbol() {}',
      graphDistance: 0,
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: {}
    };

    const neighbor: ContextCandidate = {
      id: 'node-caller1',
      sourceBackend: 'codegraphcontext',
      sourceType: 'graph',
      content: 'function caller() { targetSymbol(); }',
      graphDistance: 1,
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: {}
    };

    const result = engine.expandAndScore([seed], [neighbor]);
    expect(result.length).toBe(2);
    expect(result[0]?.id).toBe('node-seed');
    expect(result[0]?.graphRelevance).toBe(1.0);
    expect(result[1]?.id).toBe('node-caller1');
    expect(result[1]?.graphRelevance).toBe(0.6667);
  });
});
