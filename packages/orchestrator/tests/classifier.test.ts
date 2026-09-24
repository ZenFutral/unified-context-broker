import { describe, it, expect } from 'vitest';
import { QueryClassifier } from '../src/classifier.js';

describe('QueryClassifier', () => {
  const classifier = new QueryClassifier();

  it('classifies exact identifier lookups', () => {
    expect(classifier.classify('extractCallRecordId')).toBe('exact_lookup');
    expect(classifier.classify('TokenPayload.verify')).toBe('exact_lookup');
    expect(classifier.classify('definition of extractCallRecordId')).toBe('exact_lookup');
  });

  it('classifies dependency queries', () => {
    expect(classifier.classify('who calls extractCallRecordId')).toBe('dependency_analysis');
    expect(classifier.classify('where is EventDispatcher used')).toBe('dependency_analysis');
    expect(classifier.classify('find references to AuthService')).toBe('dependency_analysis');
  });

  it('classifies impact queries', () => {
    expect(classifier.classify('what breaks if CallRecordDTO changes?')).toBe('impact_analysis');
    expect(classifier.classify('blast radius of changing SessionManager')).toBe('impact_analysis');
  });

  it('classifies decision recall queries', () => {
    expect(classifier.classify('why did we choose SQLite over Redis?')).toBe('decision_recall');
    expect(classifier.classify('architectural decision for authentication')).toBe('decision_recall');
  });

  it('classifies documentation queries', () => {
    expect(classifier.classify('how to configure OAuth provider')).toBe('documentation_search');
    expect(classifier.classify('readme for context broker')).toBe('documentation_search');
  });

  it('defaults ambiguous queries to hybrid', () => {
    expect(classifier.classify('something general about the project')).toBe('hybrid');
  });
});
