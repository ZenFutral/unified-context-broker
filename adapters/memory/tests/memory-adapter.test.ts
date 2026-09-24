import { describe, it, expect } from 'vitest';
import { MemoryAdapter } from '../src/index.js';
import { ContextCandidateSchema } from '@context-broker/contracts';

describe('MemoryAdapter', () => {
  const adapter = new MemoryAdapter({ mockMode: true });

  it('reports provider name and version correctly', async () => {
    expect(adapter.name).toBe('memory');
    const version = await adapter.version();
    expect(version.name).toBe('MemoryAdapter-Durable');
  });

  it('reports healthy status and initial decision counts', async () => {
    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.indexedItemCount).toBe(2);
  });

  it('recalls decisions matching keywords', async () => {
    const candidates = await adapter.recallDecisions('thin context broker');
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]?.symbol).toBe('ADR-001');
    expect(candidates[0]?.content).toContain('ARCHITECTURAL DECISION RECORD');

    for (const candidate of candidates) {
      const parsed = ContextCandidateSchema.safeParse(candidate);
      expect(parsed.success).toBe(true);
      expect(candidate.sourceBackend).toBe('memory');
    }
  });

  it('records new architectural decisions durably', async () => {
    const record = await adapter.recordDecision({
      title: 'Adopt Vitest for Multi-Package Testing',
      decision: 'Use Vitest workspace configuration across all packages and adapters.',
      rationale: 'Instant TypeScript execution and fast ESM module support.',
      rejectedAlternatives: ['Jest with ts-jest', 'Mocha'],
      affectedComponents: ['tests/contract', 'packages/contracts'],
      author: 'Test Coordinator Agent',
      tags: ['testing', 'vitest', 'ci']
    });

    expect(record.id).toBe('ADR-003');

    const health = await adapter.health();
    expect(health.indexedItemCount).toBe(3);

    const retrieved = await adapter.recallDecisions('Vitest');
    expect(retrieved.length).toBe(1);
    expect(retrieved[0]?.symbol).toBe('ADR-003');
  });
});
