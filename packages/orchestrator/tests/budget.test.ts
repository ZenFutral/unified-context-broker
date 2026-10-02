import { describe, it, expect } from 'vitest';
import { TokenBudgetManager } from '../src/budget.js';

describe('TokenBudgetManager', () => {
  it('uses BPE tokenization to accurately estimate token counts', () => {
    const budgetManager = new TokenBudgetManager();
    const code = 'function calculateSum(a: number, b: number): number { return a + b; }';
    const tokenCount = budgetManager.estimateTokens(code);

    expect(tokenCount).toBeGreaterThan(0);
    expect(tokenCount).toBeLessThan(code.length);
  });

  it('gracefully handles empty strings', () => {
    const budgetManager = new TokenBudgetManager();
    expect(budgetManager.estimateTokens('')).toBe(0);
  });

  it('greedily packs candidates within specified token budget limits', () => {
    const budgetManager = new TokenBudgetManager();
    const candidates = [
      {
        id: '1',
        content: 'const x = 10;',
        sourceType: 'code' as const,
        sourceBackend: 'comp' as const
      },
      {
        id: '2',
        content: 'const y = 20;',
        sourceType: 'code' as const,
        sourceBackend: 'comp' as const
      }
    ];

    const packed = budgetManager.packCandidates(candidates, 50);
    expect(packed.packedCandidates.length).toBeGreaterThan(0);
    expect(packed.estimatedTokens).toBeLessThanOrEqual(50);
  });

  it('falls back to character estimation if BPE tokenizer is unavailable', () => {
    const budgetManager = new TokenBudgetManager();
    (budgetManager as unknown as { encoder: null }).encoder = null;

    const text = 'function exampleFallback() { return 42; }';
    const estimated = budgetManager.estimateTokens(text);

    expect(estimated).toBe(Math.ceil(text.length / 3.8));
  });
});
