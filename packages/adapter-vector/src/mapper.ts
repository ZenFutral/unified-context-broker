import { ContextCandidate, generateCandidateId } from '@context-broker/contracts';
import { VectorSearchMatch } from './types.js';

export function mapVectorMatchToCandidate(match: VectorSearchMatch): ContextCandidate {
  const { record, similarity_score } = match;

  const candidateId = generateCandidateId({
    sourceBackend: 'vector',
    filePath: record.file_path,
    startLine: record.start_line,
    endLine: record.end_line,
    uniqueSuffix: record.id
  });

  const sourceType = record.chunk_type === 'markdown' ? 'document' : 'code';

  return {
    id: candidateId,
    sourceBackend: 'vector',
    sourceType,
    filePath: record.file_path,
    startLine: record.start_line,
    endLine: record.end_line,
    content: record.text_content,
    semanticScore: similarity_score,
    compositeScore: similarity_score * 0.85,
    freshness: 'indexed',
    permissions: ['workspace:read'],
    metadata: {
      chunkId: record.id,
      chunkType: record.chunk_type,
      rawSimilarity: similarity_score
    }
  };
}

export function mapVectorMatchesToCandidates(matches: VectorSearchMatch[]): ContextCandidate[] {
  return matches.map(mapVectorMatchToCandidate);
}
