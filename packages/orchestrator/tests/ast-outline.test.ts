import { describe, it, expect } from 'vitest';
import { ASTOutlineExtractor } from '../src/ast-outline.js';

describe('ASTOutlineExtractor', () => {
  it('strips function bodies while preserving signatures', () => {
    const extractor = new ASTOutlineExtractor();
    const sampleCode = `
export function add(a: number, b: number): number {
  const result = a + b;
  console.log("Adding numbers", result);
  return result;
}
    `.trim();

    const outline = extractor.extractOutline(sampleCode);
    expect(outline).toContain('export function add');
    expect(outline).toContain('/* [implementation omitted] */');
    expect(outline).not.toContain('console.log("Adding numbers", result);');
  });

  it('handles empty, malformed, or unparseable input gracefully', () => {
    const extractor = new ASTOutlineExtractor();
    expect(extractor.extractOutline('')).toBe('');
    expect(extractor.extractOutline('   ')).toBe('   ');
    expect(extractor.extractOutline('// plain comment')).toContain('// plain comment');
  });
});
