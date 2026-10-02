import { ContextCandidate, generateCandidateId } from '@context-broker/contracts';
import { DecisionRecord } from './schema.js';

export function mapDecisionToCandidate(record: DecisionRecord): ContextCandidate {
  const candidateId = generateCandidateId({
    sourceBackend: 'memory',
    filePath: record.sourceFile,
    symbol: record.id
  });

  const content = [
    `> [!NOTE] ARCHITECTURAL DECISION RECORD (${record.id}): ${record.title}`,
    `> **Status**: Verified Historical Decision`,
    `> **Decision**: ${record.decision}`,
    `> **Rationale**: ${record.rationale}`,
    record.rejectedAlternatives.length > 0
      ? `> **Rejected Alternatives**: ${record.rejectedAlternatives.join('; ')}`
      : '',
    `> **Affected Components**: ${record.affectedComponents.join(', ')}`,
    `> **Recorded By**: ${record.author} on ${record.timestamp}`
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: candidateId,
    sourceBackend: 'memory',
    sourceType: 'memory',
    filePath: record.sourceFile,
    symbol: record.id,
    content,
    compositeScore: 0.92,
    freshness: 'live',
    permissions: ['workspace:read'],
    metadata: {
      decisionId: record.id,
      title: record.title,
      author: record.author,
      tags: record.tags,
      isDurableMemory: true
    }
  };
}

export function mapDecisionsToCandidates(records: DecisionRecord[]): ContextCandidate[] {
  return records.map(mapDecisionToCandidate);
}
