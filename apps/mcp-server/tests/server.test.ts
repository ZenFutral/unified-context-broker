import { describe, it, expect } from 'vitest';
import { ProviderRegistry, ContextOrchestrator } from '@context-broker/orchestrator';
import { CompAdapter } from '@context-broker/adapter-comp';
import { CodeGraphContextAdapter } from '@context-broker/adapter-codegraphcontext';
import { VectorAdapter } from '@context-broker/adapter-vector';
import { GitAdapter } from '@context-broker/adapter-git';
import { MemoryAdapter } from '@context-broker/adapter-memory';
import { handleBackendHealth } from '../src/tools/health.js';
import { handleSearchContext } from '../src/tools/search.js';
import { handleGetSymbolContext } from '../src/tools/symbol.js';
import { handleGetImpactContext } from '../src/tools/impact.js';
import { handleGetRepositoryMap } from '../src/tools/repo-map.js';
import { handleRecordDecision, handleRecallDecisions } from '../src/tools/memory.js';
import { handleExplainContext } from '../src/tools/explain.js';

describe('MCP Server Surface (Milestone 4 - All 8 Tools)', () => {
  const registry = new ProviderRegistry();
  const compAdapter = new CompAdapter({ mockMode: true });
  const codeGraphAdapter = new CodeGraphContextAdapter({ mockMode: true });
  const vectorAdapter = new VectorAdapter({ mockMode: true });
  const gitAdapter = new GitAdapter({ mockMode: true });
  const memoryAdapter = new MemoryAdapter({ mockMode: true });

  registry.register(compAdapter, true);
  registry.register(codeGraphAdapter, true);
  registry.register(vectorAdapter, true);
  registry.register(gitAdapter, true);
  registry.register(memoryAdapter, true);

  const orchestrator = new ContextOrchestrator(registry);

  it('1. backend_health reports all 5 registered adapters as healthy', async () => {
    const result = await handleBackendHealth(orchestrator);
    const parsed = JSON.parse(result.content[0]?.text || '{}');
    expect(parsed.comp?.health.status).toBe('healthy');
    expect(parsed.codegraphcontext?.health.status).toBe('healthy');
    expect(parsed.vector?.health.status).toBe('healthy');
    expect(parsed.git?.health.status).toBe('healthy');
    expect(parsed.memory?.health.status).toBe('healthy');
  });

  it('2. search_context executes hybrid multi-engine query', async () => {
    const result = await handleSearchContext(orchestrator, {
      query: 'audio stream buffer synchronization',
      workspaceIds: ['/workspace']
    });
    const parsed = JSON.parse(result.content[0]?.text || '{}');
    expect(parsed.candidates.length).toBeGreaterThan(0);
  });

  it('3. get_symbol_context retrieves exact symbol definition and callers', async () => {
    const result = await handleGetSymbolContext(orchestrator, {
      symbol: 'extractCallRecordId'
    });
    const parsed = JSON.parse(result.content[0]?.text || '{}');
    expect(parsed.symbol).toBe('extractCallRecordId');
    expect(parsed.totalCandidates).toBe(3);
  });

  it('4. get_impact_context analyzes blast radius and callers', async () => {
    const result = await handleGetImpactContext(orchestrator, {
      symbol: 'CallRecordDTO'
    });
    const parsed = JSON.parse(result.content[0]?.text || '{}');
    expect(parsed.affectedComponentsCount).toBeGreaterThan(1);
  });

  it('5. get_repository_map outputs structural directory layout', async () => {
    const result = await handleGetRepositoryMap(orchestrator, {});
    const parsed = JSON.parse(result.content[0]?.text || '{}');
    expect(parsed.modulesCount).toBe(3);
  });

  it('6 & 7. record_decision persists and recall_decisions retrieves decisions', async () => {
    // Record
    const recResult = await handleRecordDecision(orchestrator, {
      title: 'Adopt SQLite for Local Indexing',
      decision: 'Use SQLite for local metadata indexing and memory.',
      rationale: 'Zero configuration, embedded, fast transactions.',
      rejectedAlternatives: ['PostgreSQL container', 'Embedded LevelDB'],
      affectedComponents: ['adapters/comp', 'adapters/memory'],
      tags: ['database', 'sqlite', 'local-first']
    });
    const recParsed = JSON.parse(recResult.content[0]?.text || '{}');
    expect(recParsed.decisionRecord.id).toBeDefined();

    // Recall
    const recallResult = await handleRecallDecisions(orchestrator, {
      query: 'SQLite for Local Indexing'
    });
    const recallParsed = JSON.parse(recallResult.content[0]?.text || '{}');
    expect(recallParsed.totalRetrieved).toBeGreaterThanOrEqual(1);
  });

  it('8. explain_context outputs transparent scoring rationale', async () => {
    const searchResult = await handleSearchContext(orchestrator, {
      query: 'extractCallRecordId',
      workspaceIds: ['/workspace']
    });
    const searchParsed = JSON.parse(searchResult.content[0]?.text || '{}');

    const explainResult = await handleExplainContext(orchestrator, {
      candidates: searchParsed.candidates
    });
    const explainParsed = JSON.parse(explainResult.content[0]?.text || '{}');
    expect(explainParsed.totalExplained).toBeGreaterThan(0);
    expect(explainParsed.explanations[0].rationale).toBeDefined();
  });
});

describe('Token Savings Calculation (Target Files Total minus MCP Response)', () => {
  it('sums token counts across multiple involved files and subtracts MCP response', async () => {
    const { calculateTokenMetrics } = await import('../src/telemetryEmitter.js');

    // Simulate an MCP response containing slices from 2 distinct files
    const mockMcpResult = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            candidates: [
              {
                id: 'cand-1',
                filePath: 'packages/contracts/src/candidate.ts',
                content: 'export interface ContextCandidate {}'
              },
              {
                id: 'cand-2',
                filePath: 'packages/contracts/src/provider.ts',
                content: 'export interface ContextProvider {}'
              }
            ]
          })
        }
      ]
    };

    const metrics = calculateTokenMetrics('search_context', { workspaceIds: [process.cwd()] }, mockMcpResult);

    expect(metrics.filesCount).toBe(2);
    expect(metrics.files).toContain('packages/contracts/src/candidate.ts');
    expect(metrics.files).toContain('packages/contracts/src/provider.ts');

    // Target files total must be greater than zero and equal the sum of each file's tokens
    expect(metrics.targetFilesTotalTokens).toBeGreaterThan(0);
    expect(metrics.mcpResponseTokens).toBeGreaterThan(0);

    // Difference formula: tokensSaved = targetFilesTotalTokens - mcpResponseTokens
    expect(metrics.tokensSaved).toBe(metrics.targetFilesTotalTokens - metrics.mcpResponseTokens);
    expect(metrics.reductionPct).toBeGreaterThan(50);
  });

  it('persists telemetry events to shared directories for real-time IDE GUI pickup', async () => {
    const { emitToolExecutionEvent } = await import('../src/telemetryEmitter.js');

    const testEvent = {
      id: `test-event-${Date.now()}`,
      tool: 'search_context',
      args: 'query: "test query"',
      latency: 14,
      tokensSaved: 3840,
      timestamp: new Date().toISOString(),
      status: 'success' as const,
      details: {
        targetFilesTotalTokens: 4200,
        mcpResponseTokens: 360,
        filesCount: 2,
        reductionPct: 91.4
      }
    };

    await emitToolExecutionEvent(testEvent);

    // Verify TelemetryBridge reads this event back
    const { TelemetryBridge } = await import('../../vscode-extension/src/telemetryBridge.js');
    const bridge = new TelemetryBridge([process.cwd()]);
    const history = bridge.getRecentHistory(10);
    bridge.dispose();

    expect(history.length).toBeGreaterThan(0);
    const found = history.find((e) => e.id === testEvent.id);
    expect(found).toBeDefined();
    expect(found?.tokensSaved).toBe(3840);
    expect(found?.details?.['targetFilesTotalTokens']).toBe(4200);
  });
});


