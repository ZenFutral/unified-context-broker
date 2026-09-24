import { ContextCandidate } from '@context-broker/contracts';

export interface PackedContext {
  packedCandidates: ContextCandidate[];
  omittedCandidateCount: number;
  estimatedTokens: number;
  budgetUtilizationPct: number;
}

export class TokenBudgetManager {
  /**
   * Fast, conservative token estimator (~3.8 characters per token for code/markdown).
   */
  estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;
    return Math.ceil(text.length / 3.8);
  }

  /**
   * Greedily packs candidates up to the specified token budget.
   */
  packCandidates(candidates: ContextCandidate[], tokenBudget: number): PackedContext {
    let currentTokens = 0;
    const packed: ContextCandidate[] = [];
    let omitted = 0;

    for (const candidate of candidates) {
      const candidateTokens = this.estimateTokens(candidate.content) + 15; // +15 overhead for headers/citations
      if (currentTokens + candidateTokens <= tokenBudget) {
        packed.push(candidate);
        currentTokens += candidateTokens;
      } else {
        omitted++;
      }
    }

    const utilization = tokenBudget > 0
      ? Math.min(100, Number(((currentTokens / tokenBudget) * 100).toFixed(2)))
      : 0;

    return {
      packedCandidates: packed,
      omittedCandidateCount: omitted,
      estimatedTokens: currentTokens,
      budgetUtilizationPct: utilization
    };
  }
}
