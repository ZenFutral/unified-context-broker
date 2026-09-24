import { ContextCandidate } from '@context-broker/contracts';

export interface GraphExpansionOptions {
  alpha?: number;             // Decay rate parameter (default: 0.5)
  maxExpandedNodes?: number;  // Safety limit on total expanded nodes (default: 15)
  minRelevanceThreshold?: number; // Prune nodes below this relevance (default: 0.2)
}

export class GraphExpansionEngine {
  private alpha: number;
  private maxExpandedNodes: number;
  private minRelevanceThreshold: number;

  constructor(options: GraphExpansionOptions = {}) {
    this.alpha = options.alpha ?? 0.5;
    this.maxExpandedNodes = options.maxExpandedNodes ?? 15;
    this.minRelevanceThreshold = options.minRelevanceThreshold ?? 0.2;
  }

  /**
   * Calculates decaying graph relevance based on distance from seed.
   * Formula: 1 / (1 + alpha * distance)
   */
  calculateRelevance(distance: number): number {
    if (distance <= 0) return 1.0;
    const relevance = 1 / (1 + this.alpha * distance);
    return Number(relevance.toFixed(4));
  }

  /**
   * Expands and re-scores graph candidates around verified seed candidates.
   */
  expandAndScore(
    seedCandidates: ContextCandidate[],
    neighborCandidates: ContextCandidate[]
  ): ContextCandidate[] {
    if (seedCandidates.length === 0) {
      // Safeguard: Without seed candidate, suppress loose ungrounded graph nodes
      return [];
    }

    const scoredNeighbors: ContextCandidate[] = [];

    for (const neighbor of neighborCandidates) {
      const distance = neighbor.graphDistance ?? 1;
      const relevance = this.calculateRelevance(distance);

      if (relevance < this.minRelevanceThreshold) {
        continue;
      }

      scoredNeighbors.push({
        ...neighbor,
        graphRelevance: relevance,
        compositeScore: Number((relevance * 0.85).toFixed(4))
      });

      if (scoredNeighbors.length >= this.maxExpandedNodes) {
        break;
      }
    }

    // Return combined seeds (relevance 1.0) and ranked neighbor nodes
    const enrichedSeeds = seedCandidates.map((seed) => ({
      ...seed,
      graphRelevance: 1.0,
      graphDistance: 0,
      compositeScore: seed.compositeScore ?? 0.95
    }));

    return [...enrichedSeeds, ...scoredNeighbors];
  }
}
