import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../src/registry.js';
import { ContextOrchestrator } from '../src/orchestrator.js';
import {
  SymbolProvider,
  ImpactAnalysisProvider,
  RepositoryMapProvider,
  DurableMemoryProvider,
  ContextCandidate,
  DecisionInput,
  DecisionRecord
} from '@context-broker/contracts';

class TestFullCapabilityProvider implements SymbolProvider, ImpactAnalysisProvider, RepositoryMapProvider, DurableMemoryProvider {
  readonly name = 'codegraphcontext' as const;
  private memoryRecords: DecisionRecord[] = [];

  async version() {
    return { name: 'TestProvider', version: '1.0.0', protocolVersion: '1.0.0' };
  }
  async health() {
    return { status: 'healthy' as const };
  }
  async capabilities() {
    return {
      supportsLexicalSearch: true,
      supportsSemanticSearch: false,
      supportsGraphTraversal: true,
      supportsDocumentExtraction: false,
      supportsFreshnessCheck: true,
      supportsMutations: true,
      supportedSourceTypes: ['code' as const, 'memory' as const]
    };
  }
  async search(): Promise<ContextCandidate[]> {
    return [];
  }
  async getSymbolContext(symbol: string): Promise<ContextCandidate[]> {
    return [
      {
        id: `sym-${symbol}`,
        sourceBackend: 'codegraphcontext',
        sourceType: 'code',
        symbol,
        filePath: 'src/core/engine.ts',
        content: `export function ${symbol}() { const apiKey = "sk-1234567890abcdef1234567890"; return "ok"; }`,
        freshness: 'live',
        permissions: ['workspace:read'],
        metadata: {}
      }
    ];
  }
  async getImpactContext(symbol?: string): Promise<ContextCandidate[]> {
    return [
      {
        id: `impact-${symbol}`,
        sourceBackend: 'codegraphcontext',
        sourceType: 'code',
        symbol,
        filePath: 'src/core/caller.ts',
        content: `function caller() { ${symbol}(); }`,
        freshness: 'live',
        permissions: ['workspace:read'],
        metadata: {}
      }
    ];
  }
  async getRepositoryStructure(): Promise<ContextCandidate[]> {
    return [
      {
        id: 'repo-map-1',
        sourceBackend: 'codegraphcontext',
        sourceType: 'code',
        filePath: 'src/index.ts',
        content: 'export * from "./core";',
        freshness: 'live',
        permissions: ['workspace:read'],
        metadata: {}
      }
    ];
  }
  async recordDecision(data: DecisionInput): Promise<DecisionRecord> {
    const record: DecisionRecord = {
      ...data,
      id: `adr-${this.memoryRecords.length + 1}`,
      timestamp: new Date().toISOString(),
      author: data.author || 'Architect',
      rejectedAlternatives: data.rejectedAlternatives || [],
      affectedComponents: data.affectedComponents || [],
      tags: data.tags || []
    };
    this.memoryRecords.push(record);
    return record;
  }
  async recallDecisions(query: string): Promise<ContextCandidate[]> {
    return this.memoryRecords
      .filter((r) => r.title.includes(query) || r.decision.includes(query))
      .map((r) => ({
        id: r.id,
        sourceBackend: 'memory' as const,
        sourceType: 'memory' as const,
        content: `ADR: ${r.title}\nDecision: ${r.decision}`,
        freshness: 'live' as const,
        permissions: ['workspace:read'],
        metadata: {}
      }));
  }
}

describe('ContextOrchestrator Universal Routing', () => {
  const registry = new ProviderRegistry();
  const testProvider = new TestFullCapabilityProvider();
  registry.register(testProvider, true);

  const orchestrator = new ContextOrchestrator(registry);

  it('routes executeSymbolLookup through capability interface and scrubs secrets', async () => {
    const pkg = await orchestrator.executeSymbolLookup('engineMain');
    expect(pkg.candidates.length).toBe(1);
    expect(pkg.candidates[0]?.content).not.toContain('sk-1234567890abcdef1234567890');
    expect(pkg.candidates[0]?.content).toContain('[REDACTED_SECRET]');
  });

  it('routes executeImpactAnalysis through capability interface', async () => {
    const pkg = await orchestrator.executeImpactAnalysis('engineMain');
    expect(pkg.candidates.length).toBe(1);
    expect(pkg.candidates[0]?.id).toBe('impact-engineMain');
  });

  it('routes executeRepositoryMap through capability interface', async () => {
    const pkg = await orchestrator.executeRepositoryMap();
    expect(pkg.candidates.length).toBe(1);
    expect(pkg.candidates[0]?.id).toBe('repo-map-1');
  });

  it('routes executeDecisionRecord and executeDecisionRecall through capability interface', async () => {
    const record = await orchestrator.executeDecisionRecord({
      title: 'Adopt Layer 3 Routing',
      decision: 'Eliminate direct tool bypasses',
      rationale: 'Enforce security and budget caps across all 8 tools'
    });
    expect(record.id).toBe('adr-1');

    const recallPkg = await orchestrator.executeDecisionRecall('Layer 3');
    expect(recallPkg.candidates.length).toBe(1);
    expect(recallPkg.candidates[0]?.content).toContain('Eliminate direct tool bypasses');
  });
});
