import { describe, it, expect } from 'vitest';
import { ProviderRegistry, ContextOrchestrator } from '../../packages/orchestrator/src/index.js';
import { ContextProvider, ContextCandidate } from '../../packages/contracts/src/index.js';

describe('Security Swarm: Sandbox Attacks & Secret Exfiltration', () => {
  it('rejects candidate paths breaking out of workspace jail', async () => {
    // Malicious mock provider returning candidates with path traversal payloads
    const attackingProvider: ContextProvider = {
      name: 'comp',
      version: async () => ({ name: 'mock', version: '1.0', protocolVersion: '1.0' }),
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
          id: 'evil-1',
          sourceBackend: 'comp',
          sourceType: 'code',
          filePath: '/workspace/app/../../etc/passwd',
          content: 'root:x:0:0:root:/root:/bin/bash',
          freshness: 'live',
          permissions: ['workspace:read'],
          metadata: {}
        },
        {
          id: 'evil-2',
          sourceBackend: 'comp',
          sourceType: 'code',
          filePath: '/workspace/app/secrets/.env.production',
          content: 'DATABASE_PASSWORD=supersecretpassword123',
          freshness: 'live',
          permissions: ['workspace:read'],
          metadata: {}
        },
        {
          id: 'safe-1',
          sourceBackend: 'comp',
          sourceType: 'code',
          filePath: '/workspace/app/src/safe.ts',
          content: 'const safe = true;',
          freshness: 'live',
          permissions: ['workspace:read'],
          metadata: {}
        }
      ]
    };

    const registry = new ProviderRegistry();
    registry.register(attackingProvider, true);

    const orchestrator = new ContextOrchestrator(registry);

    const pkg = await orchestrator.executeQuery({
      queryId: 'sec-q1',
      query: 'attack test',
      workspaceIds: ['/workspace/app'],
      intent: 'hybrid',
      tokenBudget: 4000,
      resultLimit: 20,
      accessScope: ['workspace:read'],
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    });

    // Both evil-1 (path traversal) and evil-2 (.env file) must be filtered out
    expect(pkg.candidates.length).toBe(1);
    expect(pkg.candidates[0]?.id).toBe('safe-1');
    expect(pkg.candidates[0]?.filePath).toBe('/workspace/app/src/safe.ts');
  });

  it('redacts sensitive API tokens embedded inside source code', async () => {
    const leakyProvider: ContextProvider = {
      name: 'comp',
      version: async () => ({ name: 'mock', version: '1.0', protocolVersion: '1.0' }),
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
          id: 'leak-1',
          sourceBackend: 'comp',
          sourceType: 'code',
          filePath: '/workspace/app/src/api.ts',
          content: 'const token = "sk-live-1234567890abcdef1234567890";\nconst pw = password = "mySuperSecretPassword123";',
          freshness: 'live',
          permissions: ['workspace:read'],
          metadata: {}
        }
      ]
    };

    const registry = new ProviderRegistry();
    registry.register(leakyProvider, true);

    const orchestrator = new ContextOrchestrator(registry);

    const pkg = await orchestrator.executeQuery({
      queryId: 'sec-q2',
      query: 'leak test',
      workspaceIds: ['/workspace/app'],
      intent: 'hybrid',
      tokenBudget: 4000,
      resultLimit: 20,
      accessScope: ['workspace:read'],
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    });

    expect(pkg.candidates.length).toBe(1);
    const candidate = pkg.candidates[0]!;
    expect(candidate.content).not.toContain('sk-live-1234567890abcdef1234567890');
    expect(candidate.content).toContain('[REDACTED_SECRET]');
  });
});
