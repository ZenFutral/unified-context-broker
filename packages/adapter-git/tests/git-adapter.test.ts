import { describe, it, expect } from 'vitest';
import { GitAdapter } from '../src/index.js';
import { ContextCandidateSchema } from '@context-broker/contracts';

describe('GitAdapter', () => {
  const adapter = new GitAdapter({ mockMode: true });

  it('reports provider name and version correctly', async () => {
    expect(adapter.name).toBe('git');
    const version = await adapter.version();
    expect(version.name).toBe('GitAdapter');
  });

  it('reports healthy status with branch and commit hash', async () => {
    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.message).toContain('main');
  });

  it('returns normalized candidates for branch status and uncommitted diffs', async () => {
    const candidates = await adapter.search({
      queryId: 'test-git-q',
      query: 'status',
      workspaceIds: ['/workspace'],
      tokenBudget: 4000,
      accessScope: ['workspace:read']
    });

    expect(candidates.length).toBeGreaterThanOrEqual(2);
    for (const candidate of candidates) {
      const parsed = ContextCandidateSchema.safeParse(candidate);
      expect(parsed.success).toBe(true);
      expect(candidate.sourceBackend).toBe('git');
      expect(candidate.sourceType).toBe('git');
    }
  });

  it('checks freshness correctly for modified files', async () => {
    const freshnessStale = await adapter.checkFileFreshness(
      'src/services/call-record.ts',
      new Date(Date.now() - 86400000).toISOString()
    );
    expect(freshnessStale).toBe('stale');

    const freshnessLive = await adapter.checkFileFreshness(
      'src/unmodified-file.ts',
      new Date().toISOString()
    );
    expect(freshnessLive).toBe('live');
  });
});
