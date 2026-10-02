import { ContextCandidate } from '@context-broker/contracts';
import { getEncoding, Tiktoken } from 'js-tiktoken';
import { ASTOutlineExtractor } from './ast-outline.js';

export interface PackedContext {
  packedCandidates: ContextCandidate[];
  omittedCandidateCount: number;
  estimatedTokens: number;
  budgetUtilizationPct: number;
}

export interface PackOptions {
  outlineOnly?: boolean;
  enableASTFallback?: boolean;
  maxTokenBudget?: number;
}

export class TokenBudgetManager {
  private encoder: Tiktoken | null = null;
  private astExtractor: ASTOutlineExtractor;

  constructor() {
    try {
      this.encoder = getEncoding('cl100k_base');
    } catch {
      this.encoder = null;
    }
    this.astExtractor = new ASTOutlineExtractor();
  }

  /**
   * BPE Token Estimator using js-tiktoken (cl100k_base) with character heuristic fallback.
   */
  estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;
    if (this.encoder) {
      try {
        return this.encoder.encode(text).length;
      } catch {
        return Math.ceil(text.length / 3.8);
      }
    }
    return Math.ceil(text.length / 3.8);
  }

  /**
   * Deterministic Knapsack Packing fitting highest-priority candidates into a caller-specified tokenBudget.
   * Supports AST outline fallback when budget limits are approached or when outlineOnly is specified.
   */
  packCandidates(
    candidates: ContextCandidate[],
    tokenBudget: number,
    options: PackOptions = {}
  ): PackedContext {
    const effectiveBudget = options.maxTokenBudget
      ? Math.min(tokenBudget, options.maxTokenBudget)
      : Math.min(tokenBudget, 32000);

    let currentTokens = 0;
    const packed: ContextCandidate[] = [];
    let omitted = 0;
    const enableASTFallback = options.enableASTFallback ?? true;

    for (const rawCandidate of candidates) {
      let candidate = { ...rawCandidate };

      // Force AST outline if outlineOnly requested
      if (options.outlineOnly && candidate.content) {
        const outlineContent = this.astExtractor.extractOutline(candidate.content, candidate.filePath);
        candidate = {
          ...candidate,
          content: outlineContent,
          metadata: { ...candidate.metadata, outlineOnly: true }
        };
      }

      const candidateTokens = this.estimateTokens(candidate.content) + 15; // +15 overhead for header/citation

      if (currentTokens + candidateTokens <= effectiveBudget) {
        packed.push(candidate);
        currentTokens += candidateTokens;
      } else if (enableASTFallback && !options.outlineOnly && candidate.content) {
        // Try AST outline fallback to save tokens and fit candidate into remaining budget
        const outlineContent = this.astExtractor.extractOutline(candidate.content, candidate.filePath);
        const outlineTokens = this.estimateTokens(outlineContent) + 15;

        if (outlineTokens < candidateTokens && currentTokens + outlineTokens <= effectiveBudget) {
          packed.push({
            ...candidate,
            content: outlineContent,
            metadata: { ...candidate.metadata, outlineOnly: true, astFallbackApplied: true }
          });
          currentTokens += outlineTokens;
        } else {
          omitted++;
        }
      } else {
        omitted++;
      }
    }

    const utilization = effectiveBudget > 0
      ? Math.min(100, Number(((currentTokens / effectiveBudget) * 100).toFixed(2)))
      : 0;

    return {
      packedCandidates: packed,
      omittedCandidateCount: omitted,
      estimatedTokens: currentTokens,
      budgetUtilizationPct: utilization
    };
  }
}
