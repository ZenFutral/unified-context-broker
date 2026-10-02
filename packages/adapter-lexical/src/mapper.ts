import { ContextCandidate, generateCandidateId } from '@context-broker/contracts';
import { CompSearchHit } from './types.js';

export function mapCompHitToCandidate(
  hit: CompSearchHit,
  maxBm25InSet: number
): ContextCandidate {
  // Normalize BM25 score to [0.0, 1.0]
  const normalizedLexicalScore = maxBm25InSet > 0
    ? Math.min(1.0, Math.max(0.0, hit.bm25_score / maxBm25InSet))
    : 0.5;

  const sourceType = hit.document_type === 'markdown' || hit.document_type === 'pdf' || hit.document_type === 'office'
    ? 'document'
    : 'code';

  const candidateId = generateCandidateId({
    sourceBackend: 'comp',
    filePath: hit.file_path,
    startLine: hit.start_line,
    endLine: hit.end_line,
    uniqueSuffix: hit.chunk_index !== undefined ? String(hit.chunk_index) : undefined
  });

  return {
    id: candidateId,
    sourceBackend: 'comp',
    sourceType,
    filePath: hit.file_path,
    startLine: hit.start_line,
    endLine: hit.end_line,
    content: hit.snippet,
    lexicalScore: Number(normalizedLexicalScore.toFixed(4)),
    freshness: 'indexed',
    modifiedAt: hit.last_modified_timestamp
      ? new Date(hit.last_modified_timestamp).toISOString()
      : undefined,
    permissions: ['workspace:read'],
    metadata: {
      rawDocId: hit.doc_id,
      rawBm25Score: hit.bm25_score,
      docType: hit.document_type
    }
  };
}

export function mapCompHitsToCandidates(hits: CompSearchHit[]): ContextCandidate[] {
  if (hits.length === 0) return [];
  const maxScore = Math.max(...hits.map((h) => h.bm25_score));
  return hits.map((hit) => mapCompHitToCandidate(hit, maxScore));
}
