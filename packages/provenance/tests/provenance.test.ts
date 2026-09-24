import { describe, it, expect } from 'vitest';
import { ContentHasher, CitationGenerator, ContextExplainer } from '../src/index.js';
import { ContextCandidate } from '@context-broker/contracts';

describe('Provenance Layer', () => {
  const hasher = new ContentHasher();
  const citationGen = new CitationGenerator();
  const explainer = new ContextExplainer();

  it('computes deterministic SHA-256 content hashes', () => {
    const text = 'export function test() {}';
    const hash1 = hasher.hash(text);
    const hash2 = hasher.hash(text);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
    expect(hasher.shortHash(text).length).toBe(8);
  });

  it('generates clickable markdown citations with file line ranges', () => {
    const candidate: ContextCandidate = {
      id: 'test-c1',
      sourceBackend: 'comp',
      sourceType: 'code',
      filePath: 'src/services/call-record.ts',
      startLine: 10,
      endLine: 25,
      content: 'function extract() {}',
      freshness: 'live',
      permissions: ['workspace:read'],
      metadata: {}
    };

    const citation = citationGen.generateMarkdownCitation(candidate);
    expect(citation).toBe('[call-record.ts#L10-L25](file:///src/services/call-record.ts#L10-L25)');

    const contextBlock = citationGen.formatContextBlock(candidate);
    expect(contextBlock).toContain('### [call-record.ts#L10-L25](file:///src/services/call-record.ts#L10-L25) [COMP]');
  });

  it('produces transparent score explanations', () => {
    const candidate: ContextCandidate = {
      id: 'test-c2',
      sourceBackend: 'codegraphcontext',
      sourceType: 'code',
      filePath: 'src/services/call-record.ts',
      symbol: 'extractCallRecordId',
      startLine: 15,
      content: 'export function extractCallRecordId() {}',
      lexicalScore: 0.85,
      graphDistance: 0,
      freshness: 'stale',
      compositeScore: 0.94,
      permissions: ['workspace:read'],
      metadata: {}
    };

    const explanation = explainer.explain(candidate);
    expect(explanation.location).toBe('src/services/call-record.ts:15');
    expect(explanation.rationale).toContain('Strong lexical keyword match');
    expect(explanation.rationale).toContain('Exact root seed symbol definition');
    expect(explanation.rationale).toContain('WARNING: File was modified locally in git after indexing');
  });
});
