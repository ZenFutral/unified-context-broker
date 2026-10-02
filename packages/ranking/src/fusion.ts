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
   * Applies multi-signal rank fusion to a flat list of candidates.
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
   * Performs true Multi-List Reciprocal Rank Fusion (RRF) across distinct candidate streams
   * from disparate search adapters: RRF(d) = sum_m ( w_m / (k + rank_m(d)) )
   */
  fuseMultiList(
    providerLists: Map<string, ContextCandidate[]>,
    queryText: string,
    intent: QueryIntent
  ): ContextCandidate[] {
    const candidateMap = new Map<string, ContextCandidate>();
    const rrfScores = new Map<string, number>();

    for (const [backend, list] of providerLists.entries()) {
      if (!list || list.length === 0) continue;

      let listWeight = 1.0;
      if (backend === 'comp') listWeight = this.weights.lexicalWeight;
      else if (backend === 'vector') listWeight = this.weights.semanticWeight;
      else if (backend === 'codegraphcontext') listWeight = this.weights.graphWeight;
      else if (backend === 'git') listWeight = this.weights.recencyWeight;

      list.forEach((candidate, rankIndex) => {
        const id = candidate.id;
        if (!candidateMap.has(id)) {
          candidateMap.set(id, { ...candidate });
        } else {
          // Merge metadata & scores from alternative stream
          const existing = candidateMap.get(id)!;
          candidateMap.set(id, {
            ...existing,
            lexicalScore: candidate.lexicalScore ?? existing.lexicalScore,
            semanticScore: candidate.semanticScore ?? existing.semanticScore,
            graphRelevance: candidate.graphRelevance ?? existing.graphRelevance,
            graphDistance: candidate.graphDistance ?? existing.graphDistance
          });
        }

        const rank = rankIndex + 1;
        const rrfIncrement = (listWeight * 10) / (this.rrfK + rank);
        rrfScores.set(id, (rrfScores.get(id) ?? 0) + rrfIncrement);
      });
    }

    const mergedCandidates = Array.from(candidateMap.values());

    // Fuse and add RRF scores to linear weighted scores
    const fused = this.fuseAndRank(mergedCandidates, queryText, intent);

    return fused.map((c) => {
      const rrf = rrfScores.get(c.id) ?? 0;
      const combinedScore = (c.compositeScore ?? 0) + rrf;
      return {
        ...c,
        compositeScore: Number(combinedScore.toFixed(4))
      };
    }).sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  }

  /**
   * Reciprocal Rank Fusion (RRF) single-list fallback implementation.
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
