import {
  ContextCandidate,
  QueryIntent,
  ScoringWeights
} from '@context-broker/contracts';
import { defaultScoringWeights } from './weights.js';

export interface FusionOptions {
  weights?: Partial<ScoringWeights>;
  enableRRF?: boolean;
  rrfK?: number; // Smoothing parameter for RRF (default: 60)
}

export class RankFusionEngine {
  private weights: ScoringWeights;
  private enableRRF: boolean;
  private rrfK: number;

  constructor(options: FusionOptions = {}) {
    this.weights = { ...defaultScoringWeights, ...options.weights };
    this.enableRRF = options.enableRRF ?? false;
    this.rrfK = options.rrfK ?? 60;
  }

  /**
   * Applies multi-signal rank fusion to candidates.
   */
  fuseAndRank(
    candidates: ContextCandidate[],
    queryText: string,
    intent: QueryIntent
  ): ContextCandidate[] {
    if (candidates.length === 0) return [];

    const isExactIdentifierQuery = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(queryText.trim());
    const querySymbolLower = queryText.trim().toLowerCase();

    const scored = candidates.map((candidate) => {
      const lexical = candidate.lexicalScore ?? 0;
      const semantic = candidate.semanticScore ?? 0;
      const graph = candidate.graphRelevance ?? (candidate.graphDistance !== undefined ? 1 / (1 + candidate.graphDistance) : 0);

      // Freshness calculation
      const isStale = candidate.freshness === 'stale';
      const isLive = candidate.freshness === 'live';
      const recencyScore = isLive ? 1.0 : isStale ? 0.2 : 0.6;
      const stalePenalty = isStale ? this.weights.stalePenalty : 0;

      // Intent alignment boost
      let intentBoost = 0;
      if (
        (intent === 'exact_lookup' && candidate.symbol) ||
        (intent === 'semantic_discovery' && candidate.semanticScore !== undefined) ||
        (intent === 'dependency_analysis' && candidate.sourceBackend === 'codegraphcontext') ||
        (intent === 'documentation_search' && candidate.sourceType === 'document') ||
        (intent === 'decision_recall' && candidate.sourceBackend === 'memory')
      ) {
        intentBoost = this.weights.intentMatchBoost;
      }

      // Linear Weighted Score
      let finalScore =
        this.weights.lexicalWeight * lexical +
        this.weights.semanticWeight * semantic +
        this.weights.graphWeight * graph +
        this.weights.recencyWeight * recencyScore +
        intentBoost -
        stalePenalty;

      // Safeguard 1: Exact symbol match hard-override
      if (
        (isExactIdentifierQuery || intent === 'exact_lookup') &&
        candidate.symbol &&
        candidate.symbol.toLowerCase() === querySymbolLower
      ) {
        finalScore = Math.max(finalScore, 1.5); // Hard boost to ensure top rank
      }

      // Safeguard 2: Memory decision recall override
      if (intent === 'decision_recall' && candidate.sourceBackend === 'memory') {
        finalScore = Math.max(finalScore, 2.0); // Hard boost to ensure memory ADR is ranked #1
      }

      return {
        ...candidate,
        compositeScore: Number(finalScore.toFixed(4))
      };
    });

    // Sort descending by compositeScore
    scored.sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

    // Optional Reciprocal Rank Fusion adjustment
    if (this.enableRRF) {
      return this.applyRRF(scored);
    }

    return scored;
  }

  /**
   * Reciprocal Rank Fusion (RRF) implementation: RRF(d) = sum( 1 / (k + rank) )
   */
  private applyRRF(candidates: ContextCandidate[]): ContextCandidate[] {
    return candidates.map((candidate, index) => {
      const rrfScore = 1 / (this.rrfK + index + 1);
      return {
        ...candidate,
        compositeScore: Number(rrfScore.toFixed(6))
      };
    });
  }
}
