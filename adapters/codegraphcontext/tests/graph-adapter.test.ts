import { describe, it, expect } from 'vitest';
import { CodeGraphContextAdapter } from '../src/index.js';
import { ContextCandidateSchema } from '@context-broker/contracts';

describe('CodeGraphContextAdapter', () => {
  const adapter = new CodeGraphContextAdapter({ mockMode: true });

  it('reports provider name and version correctly', async () => {
    expect(adapter.name).toBe('codegraphcontext');
    const version = await adapter.version();
    expect(version.name).toBe('CodeGraphContext');
    expect(version.version).toBe('0.8.2-cgc');
  });

  it('reports healthy status and indexed graph node counts', async () => {
    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.indexedItemCount).toBe(5820);
    expect(health.diagnostics?.edgesCount).toBe(14930);
  });

  it('declares graph traversal capabilities', async () => {
    const caps = await adapter.capabilities();
    expect(caps.supportsGraphTraversal).toBe(true);
    expect(caps.supportsLexicalSearch).toBe(false);
    expect(caps.supportedSourceTypes).toContain('graph');
  });

  it('retrieves symbol context including callers and definitions', async () => {
    const candidates = await adapter.getSymbolContext('extractCallRecordId');
    expect(candidates.length).toBe(3); // Seed definition + 2 callers

    const seed = candidates.find((c) => c.graphDistance === 0);
    expect(seed).toBeDefined();
    expect(seed?.symbol).toBe('extractCallRecordId');
    expect(seed?.compositeScore).toBe(0.95);

    for (const candidate of candidates) {
      const parsed = ContextCandidateSchema.safeParse(candidate);
      expect(parsed.success).toBe(true);
      expect(candidate.sourceBackend).toBe('codegraphcontext');
    }
  });

  it('retrieves impact context with blast radius dependents', async () => {
    const candidates = await adapter.getImpactContext('CallRecordDTO');
    expect(candidates.length).toBeGreaterThan(1);

    for (const candidate of candidates) {
      expect(candidate.sourceBackend).toBe('codegraphcontext');
      expect(candidate.graphDistance).toBeDefined();
    }
  });

  it('generates repository structure map', async () => {
    const mapCandidates = await adapter.getRepositoryMap();
    expect(mapCandidates.length).toBe(3);
    expect(mapCandidates[0]?.filePath).toBe('src/services');
  });
});
