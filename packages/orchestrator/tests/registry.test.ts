import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../src/registry.js';
import { ContextProvider, ContextCandidate } from '@context-broker/contracts';

const mockProvider: ContextProvider = {
  name: 'comp',
  version: async () => ({ name: 'comP', version: '0.4.2', protocolVersion: '1.0.0' }),
  health: async () => ({ status: 'healthy', indexedItemCount: 100, diagnostics: {} }),
  capabilities: async () => ({
    supportsLexicalSearch: true,
    supportsSemanticSearch: false,
    supportsGraphTraversal: false,
    supportsDocumentExtraction: true,
    supportsFreshnessCheck: true,
    supportsMutations: false,
    supportedSourceTypes: ['code', 'document']
  }),
  search: async () => []
};

describe('ProviderRegistry', () => {
  it('registers and retrieves active providers', () => {
    const registry = new ProviderRegistry();
    registry.register(mockProvider, true);

    expect(registry.get('comp')).toBeDefined();
    expect(registry.listActiveProviders().length).toBe(1);
  });

  it('handles dynamic disabling without unregistering', async () => {
    const registry = new ProviderRegistry();
    registry.register(mockProvider, true);

    registry.setEnabled('comp', false);
    expect(registry.get('comp')).toBeUndefined();
    expect(registry.listActiveProviders().length).toBe(0);

    const health = await registry.checkAllHealth();
    expect(health.comp?.enabled).toBe(false);
    expect(health.comp?.health.status).toBe('disabled');
  });

  it('runs health checks on all active providers', async () => {
    const registry = new ProviderRegistry();
    registry.register(mockProvider, true);

    const health = await registry.checkAllHealth();
    expect(health.comp?.enabled).toBe(true);
    expect(health.comp?.health.status).toBe('healthy');
    expect(health.comp?.version?.version).toBe('0.4.2');
  });
});
