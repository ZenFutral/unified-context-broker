import { describe, it, expect } from 'vitest';
import { ProviderRegistry, ContextOrchestrator } from '@context-broker/orchestrator';
import { LexicalAdapter } from '@context-broker/adapter-lexical';
import { CodeGraphAdapter } from '@context-broker/adapter-codegraph';
import { VectorAdapter } from '@context-broker/adapter-vector';
import { GitAdapter } from '@context-broker/adapter-git';
import { MemoryAdapter } from '@context-broker/adapter-memory';
import benchmarkCases from './goldens/benchmark-cases.json';

describe('Retrieval Evaluation Swarm (Benchmark Harness)', () => {
  const registry = new ProviderRegistry();
  registry.register(new LexicalAdapter({ mockMode: true }), true);
  registry.register(new CodeGraphAdapter({ mockMode: true }), true);
  registry.register(new VectorAdapter({ mockMode: true }), true);
  registry.register(new GitAdapter({ mockMode: true }), true);
  registry.register(new MemoryAdapter({ mockMode: true }), true);

  const orchestrator = new ContextOrchestrator(registry, {
    defaultTokenBudget: 4000
  });

  for (const tc of benchmarkCases) {
    it(`Evaluates [${tc.id}] ${tc.name}`, async () => {
      const pkg = await orchestrator.executeQuery({
        queryId: `bench-${tc.id}`,
        query: tc.query,
        workspaceIds: ['/workspace'],
        intent: tc.intent as any,
        tokenBudget: 4000,
        accessScope: ['workspace:read']
      });

      expect(pkg.candidates.length).toBeGreaterThan(0);
      expect(pkg.estimatedTokens).toBeLessThanOrEqual(4000);

      // TC-01: Exact Symbol Lookup
      if (tc.id === 'TC-01') {
        const topCandidate = pkg.candidates[0]!;
        expect(topCandidate.symbol).toBe(tc.expectedTopSymbol);
        expect(topCandidate.sourceBackend).toBe(tc.expectedSourceBackend);
      }

      // TC-02: Concept Discovery
      if (tc.id === 'TC-02') {
        const matchingCandidate = pkg.candidates.find((c) =>
          c.filePath?.includes(tc.expectedTopFile!)
        );
        expect(matchingCandidate).toBeDefined();
        expect(matchingCandidate?.semanticScore).toBeGreaterThan(0.5);
      }

      // TC-03: Dependency Analysis
      if (tc.id === 'TC-03') {
        const callers = pkg.candidates.map((c) => c.symbol).filter(Boolean);
        for (const expectedCaller of tc.expectedCallersFound!) {
          expect(callers).toContain(expectedCaller);
        }
      }

      // TC-04: Impact Blast Radius
      if (tc.id === 'TC-04') {
        const foundSymbols = pkg.candidates.map((c) => c.symbol).filter(Boolean);
        for (const expectedDep of tc.expectedDependents!) {
          expect(foundSymbols).toContain(expectedDep);
        }
      }

      // TC-06: Prior Decision Recall
      if (tc.id === 'TC-06') {
        const topCandidate = pkg.candidates[0]!;
        expect(topCandidate.symbol).toBe(tc.expectedSymbol);
        expect(topCandidate.sourceBackend).toBe('memory');
      }
    });
  }
});
