import { ContextCandidate } from '@context-broker/contracts';

export interface CandidateExplanation {
  candidateId: string;
  sourceBackend: string;
  sourceType: string;
  location: string;
  compositeScore?: number;
  scoreBreakdown: {
    lexicalScore?: number;
    semanticScore?: number;
    graphDistance?: number;
    graphRelevance?: number;
  };
  freshness: string;
  rationale: string;
}

export class ContextExplainer {
  explain(candidate: ContextCandidate): CandidateExplanation {
    const reasons: string[] = [];

    if (candidate.lexicalScore && candidate.lexicalScore > 0.5) {
      reasons.push(`Strong lexical keyword match (BM25: ${(candidate.lexicalScore * 100).toFixed(0)}%)`);
    }
    if (candidate.semanticScore && candidate.semanticScore > 0.6) {
      reasons.push(`High conceptual cosine similarity (${(candidate.semanticScore * 100).toFixed(0)}%)`);
    }
    if (candidate.graphDistance === 0) {
      reasons.push('Exact root seed symbol definition');
    } else if (candidate.graphDistance !== undefined) {
      reasons.push(`${candidate.graphDistance}-hop structural dependency neighbor`);
    }
    if (candidate.freshness === 'stale') {
      reasons.push('WARNING: File was modified locally in git after indexing');
    }

    const location = candidate.filePath
      ? `${candidate.filePath}${candidate.startLine !== undefined ? `:${candidate.startLine}` : ''}`
      : candidate.symbol || 'Global Context';

    return {
      candidateId: candidate.id,
      sourceBackend: candidate.sourceBackend,
      sourceType: candidate.sourceType,
      location,
      compositeScore: candidate.compositeScore,
      scoreBreakdown: {
        lexicalScore: candidate.lexicalScore,
        semanticScore: candidate.semanticScore,
        graphDistance: candidate.graphDistance,
        graphRelevance: candidate.graphRelevance
      },
      freshness: candidate.freshness,
      rationale: reasons.join('; ') || 'Matched baseline project context'
    };
  }

  explainAll(candidates: ContextCandidate[]): CandidateExplanation[] {
    return candidates.map((c) => this.explain(c));
  }
}
