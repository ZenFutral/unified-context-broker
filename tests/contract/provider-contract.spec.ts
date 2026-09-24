import { describe, it, expect } from 'vitest';
import { CompAdapter } from '../../adapters/comp/src/index.js';
import { CodeGraphContextAdapter } from '../../adapters/codegraphcontext/src/index.js';
import { VectorAdapter } from '../../adapters/vector/src/index.js';
import { GitAdapter } from '../../adapters/git/src/index.js';
import { MemoryAdapter } from '../../adapters/memory/src/index.js';
import {
  ContextProvider,
  ContextCandidateSchema,
  ProviderCapabilitiesSchema,
  HealthResultSchema,
  ProviderVersionSchema
} from '../../packages/contracts/src/index.js';

/**
 * Universal Contract Test Suite that EVERY adapter must pass.
 */
function runProviderContractTests(providerFactory: () => ContextProvider) {
  describe(`Contract Compliance: ${providerFactory().name}`, () => {
    const provider = providerFactory();

    it('returns a valid ProviderVersion schema', async () => {
      const version = await provider.version();
      const parsed = ProviderVersionSchema.safeParse(version);
      expect(parsed.success).toBe(true);
      expect(version.name.length).toBeGreaterThan(0);
      expect(version.version.length).toBeGreaterThan(0);
    });

    it('returns a valid HealthResult schema', async () => {
      const health = await provider.health();
      const parsed = HealthResultSchema.safeParse(health);
      expect(parsed.success).toBe(true);
      expect(['healthy', 'degraded', 'unhealthy', 'disabled']).toContain(health.status);
    });

    it('returns a valid ProviderCapabilities schema', async () => {
      const caps = await provider.capabilities();
      const parsed = ProviderCapabilitiesSchema.safeParse(caps);
      expect(parsed.success).toBe(true);
      expect(caps.supportedSourceTypes.length).toBeGreaterThan(0);
    });

    it('normalizes all search results to ContextCandidate without leaking native structures', async () => {
      const candidates = await provider.search({
        queryId: 'contract-test-query-1',
        query: 'test symbol identifier',
        workspaceIds: ['/test/mock-workspace'],
        intent: 'hybrid',
        tokenBudget: 4000,
        resultLimit: 20,
        accessScope: ['workspace:read'],
        includeHistory: false,
        freshnessRequirement: 'either',
        metadata: {}
      });

      expect(Array.isArray(candidates)).toBe(true);
      for (const candidate of candidates) {
        const parsed = ContextCandidateSchema.safeParse(candidate);
        expect(parsed.success).toBe(true);
        expect(candidate.sourceBackend).toBe(provider.name);
        expect(typeof candidate.id).toBe('string');
        expect(typeof candidate.content).toBe('string');
        expect(candidate.permissions).toBeDefined();
      }
    });
  });
}

// 1. comP adapter
runProviderContractTests(() => new CompAdapter({ mockMode: true }));

// 2. CodeGraphContext adapter
runProviderContractTests(() => new CodeGraphContextAdapter({ mockMode: true }));

// 3. Vector adapter
runProviderContractTests(() => new VectorAdapter({ mockMode: true }));

// 4. Git adapter
runProviderContractTests(() => new GitAdapter({ mockMode: true }));

// 5. Memory adapter
runProviderContractTests(() => new MemoryAdapter({ mockMode: true }));
