import { describe, it, expect } from 'vitest';
import { getContext, searchContext, getGlobalOrchestrator } from '../src/index.js';

describe('Programmatic In-Memory API', () => {
  it('executes getContext programmatically without active MCP server', async () => {
    const pkg = await getContext({
      query: 'test_query',
      tokenBudget: 2000,
      outlineOnly: false
    });

    expect(pkg).toBeDefined();
    expect(pkg.queryText).toBe('test_query');
    expect(pkg.candidates).toBeDefined();
    expect(Array.isArray(pkg.candidates)).toBe(true);
    expect(pkg.estimatedTokens).toBeGreaterThanOrEqual(0);
  });

  it('returns candidates via searchContext programmatic helper', async () => {
    const candidates = await searchContext('test_search', 3000, true);
    expect(Array.isArray(candidates)).toBe(true);
  });

  it('ensures output parity between getContext API and orchestrator.executeQuery', async () => {
    const orchestrator = getGlobalOrchestrator();

    const apiResult = await getContext({
      query: 'parity_check',
      tokenBudget: 4000
    });

    const orchestratorResult = await orchestrator.executeQuery({
      queryId: apiResult.queryId,
      query: 'parity_check',
      workspaceIds: [process.cwd()],
      tokenBudget: 4000,
      intent: 'hybrid',
      accessScope: ['workspace:read'],
      resultLimit: 25,
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    });

    expect(apiResult.intent).toBe(orchestratorResult.intent);
    expect(apiResult.candidates.length).toBe(orchestratorResult.candidates.length);
  });
});
