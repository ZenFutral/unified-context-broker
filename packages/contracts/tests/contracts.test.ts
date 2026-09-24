import { describe, it, expect } from 'vitest';
import {
  ContextQuerySchema,
  ContextCandidateSchema,
  generateCandidateId,
  ContextPackageSchema,
  HealthResultSchema,
  BrokerConfigSchema
} from '../src/index.js';

describe('Canonical Contracts Validation', () => {
  it('validates a valid ContextQuery', () => {
    const validQuery = {
      queryId: 'q-101',
      query: 'Find CallRecordId extraction logic',
      workspaceIds: ['/workspace/app'],
      intent: 'impact_analysis',
      tokenBudget: 5000
    };

    const parsed = ContextQuerySchema.safeParse(validQuery);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.accessScope).toEqual(['workspace:read']);
      expect(parsed.data.freshnessRequirement).toBe('either');
    }
  });

  it('rejects invalid ContextQuery with missing workspaceIds', () => {
    const invalidQuery = {
      queryId: 'q-102',
      query: 'test query',
      workspaceIds: []
    };

    const parsed = ContextQuerySchema.safeParse(invalidQuery);
    expect(parsed.success).toBe(false);
  });

  it('validates and generates a deterministic ContextCandidate', () => {
    const candidateId = generateCandidateId({
      sourceBackend: 'comp',
      filePath: 'src/services/call.ts',
      startLine: 10,
      endLine: 45,
      symbol: 'CallRecordId'
    });

    expect(candidateId).toBe('comp::src/services/call.ts::10::45::CallRecordId');

    const candidate = {
      id: candidateId,
      sourceBackend: 'comp',
      sourceType: 'code',
      filePath: 'src/services/call.ts',
      startLine: 10,
      endLine: 45,
      content: 'export function CallRecordId() { return "id"; }',
      lexicalScore: 0.92,
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: { indexedWith: 'bm25' }
    };

    const parsed = ContextCandidateSchema.safeParse(candidate);
    expect(parsed.success).toBe(true);
  });

  it('validates ContextPackage structure', () => {
    const pkg = {
      queryId: 'q-103',
      intent: 'exact_lookup',
      summary: 'Retrieved 1 symbol candidate',
      candidates: [
        {
          id: 'comp::file.ts::1::10',
          sourceBackend: 'comp',
          sourceType: 'code',
          content: 'const x = 1;',
          freshness: 'live',
          permissions: ['workspace:read'],
          metadata: {}
        }
      ],
      omittedCandidateCount: 0,
      estimatedTokens: 120,
      budgetUtilizationPct: 12.0,
      warnings: [],
      retrievalTrace: [
        {
          provider: 'comp',
          operation: 'lexical_search',
          durationMs: 45,
          candidatesReturned: 1,
          status: 'success'
        }
      ],
      generatedAt: new Date().toISOString()
    };

    const parsed = ContextPackageSchema.safeParse(pkg);
    expect(parsed.success).toBe(true);
  });

  it('loads default BrokerConfig correctly', () => {
    const parsed = BrokerConfigSchema.parse({});
    expect(parsed.serverName).toBe('context-broker-mcp');
    expect(parsed.adapters.comp.enabled).toBe(true);
    expect(parsed.scoring.lexicalWeight).toBe(0.30);
    expect(parsed.scoring.semanticWeight).toBe(0.35);
  });
});
