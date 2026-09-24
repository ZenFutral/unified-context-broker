import { describe, it, expect } from 'vitest';
import { ProviderRegistry, ContextOrchestrator } from '../../packages/orchestrator/src/index.js';
import { ContextProvider } from '../../packages/contracts/src/index.js';

describe('Chaos & Failure Injection Swarm', () => {
  it('gracefully degrades when one provider crashes and another times out', async () => {
    // 1. Healthy provider
    const healthyProvider: ContextProvider = {
      name: 'comp',
      version: async () => ({ name: 'comp', version: '1.0', protocolVersion: '1.0' }),
      health: async () => ({ status: 'healthy', diagnostics: {} }),
      capabilities: async () => ({
        supportsLexicalSearch: true,
        supportsSemanticSearch: false,
        supportsGraphTraversal: false,
        supportsDocumentExtraction: true,
        supportsFreshnessCheck: true,
        supportsMutations: false,
        supportedSourceTypes: ['code']
      }),
      search: async () => [
        {
          id: 'healthy-1',
          sourceBackend: 'comp',
          sourceType: 'code',
          filePath: '/workspace/src/fallback.ts',
          content: 'export function fallbackService() {}',
          freshness: 'live',
          permissions: ['workspace:read'],
          metadata: {}
        }
      ]
    };

    // 2. Crashing provider (simulating CodeGraph HTTP 500)
    const crashingProvider: ContextProvider = {
      name: 'codegraphcontext',
      version: async () => ({ name: 'cgc', version: '1.0', protocolVersion: '1.0' }),
      health: async () => ({ status: 'unhealthy', message: 'Internal Server Error 500', diagnostics: {} }),
      capabilities: async () => ({
        supportsLexicalSearch: false,
        supportsSemanticSearch: false,
        supportsGraphTraversal: true,
        supportsDocumentExtraction: false,
        supportsFreshnessCheck: false,
        supportsMutations: false,
        supportedSourceTypes: ['graph']
      }),
      search: async () => {
        throw new Error('ECONNREFUSED 127.0.0.1:8080 - CodeGraph service is offline');
      }
    };

    // 3. Timing out provider (simulating slow vector DB)
    const slowProvider: ContextProvider = {
      name: 'vector',
      version: async () => ({ name: 'vector', version: '1.0', protocolVersion: '1.0' }),
      health: async () => ({ status: 'degraded', diagnostics: {} }),
      capabilities: async () => ({
        supportsLexicalSearch: false,
        supportsSemanticSearch: true,
        supportsGraphTraversal: false,
        supportsDocumentExtraction: false,
        supportsFreshnessCheck: false,
        supportsMutations: false,
        supportedSourceTypes: ['code']
      }),
      search: async () => {
        // Sleep longer than timeout (e.g. 5000ms)
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return [];
      }
    };

    const registry = new ProviderRegistry();
    registry.register(healthyProvider, true, 1000);
    registry.register(crashingProvider, true, 1000);
    registry.register(slowProvider, true, 100); // 100ms timeout for test

    const orchestrator = new ContextOrchestrator(registry);

    const pkg = await orchestrator.executeQuery({
      queryId: 'chaos-q1',
      query: 'fallback test',
      workspaceIds: ['/workspace'],
      intent: 'hybrid',
      tokenBudget: 4000,
      resultLimit: 20,
      accessScope: ['workspace:read'],
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    });

    // Verify broker remained online and returned degraded results
    expect(pkg.candidates.length).toBe(1);
    expect(pkg.candidates[0]?.id).toBe('healthy-1');

    // Verify warnings were recorded for failed & timed out providers
    expect(pkg.warnings.length).toBe(2);
    expect(pkg.warnings.some((w) => w.includes('codegraphcontext'))).toBe(true);
    expect(pkg.warnings.some((w) => w.includes('vector'))).toBe(true);

    // Verify traces recorded degraded statuses
    const cgcTrace = pkg.retrievalTrace.find((t) => t.provider === 'codegraphcontext');
    expect(cgcTrace?.status).toBe('degraded');
    expect(cgcTrace?.error).toContain('ECONNREFUSED');

    const vectorTrace = pkg.retrievalTrace.find((t) => t.provider === 'vector');
    expect(vectorTrace?.status).toBe('degraded');
    expect(vectorTrace?.error).toContain('Timed out');
  });
});
