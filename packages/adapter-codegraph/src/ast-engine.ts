import { ContextCandidate } from '@context-broker/contracts';

export interface LocalSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'const' | 'module';
  filePath: string;
  startLine: number;
  endLine: number;
  docstring?: string;
  signature?: string;
  body: string;
}

export class LocalASTEngine {
  /**
   * Scans a file's content to extract AST symbol definitions, signatures, and docstrings.
   */
  extractSymbols(content: string, filePath: string): LocalSymbol[] {
    if (!content || content.trim().length === 0) return [];

    const lines = content.split(/\r?\n/);
    const symbols: LocalSymbol[] = [];
    let currentDocstring = '';
    let inDoc = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      const trimmed = line.trim();

      // Collect docstrings
      if (trimmed.startsWith('/**') || trimmed.startsWith('/*')) {
        inDoc = true;
        currentDocstring = line;
        if (trimmed.endsWith('*/')) inDoc = false;
        continue;
      }
      if (inDoc) {
        currentDocstring += '\n' + line;
        if (trimmed.endsWith('*/')) inDoc = false;
        continue;
      }

      // Match TS/JS/Python symbol headers
      const symbolMatch =
        /^(export\s+)?(default\s+)?(async\s+)?(class|interface|type|enum|function|def|const)\s+([\w$]+)/.exec(
          trimmed
        );

      if (symbolMatch) {
        const kindRaw = symbolMatch[4] || 'function';
        const name = symbolMatch[5] || 'anonymous';
        const kind: LocalSymbol['kind'] =
          kindRaw === 'class'
            ? 'class'
            : kindRaw === 'interface'
            ? 'interface'
            : kindRaw === 'type'
            ? 'type'
            : kindRaw === 'const'
            ? 'const'
            : 'function';

        symbols.push({
          name,
          kind,
          filePath,
          startLine: i + 1,
          endLine: Math.min(i + 15, lines.length),
          signature: trimmed,
          docstring: currentDocstring || undefined,
          body: line
        });

        currentDocstring = '';
      } else if (!trimmed.startsWith('//') && !trimmed.startsWith('#')) {
        currentDocstring = '';
      }
    }

    return symbols;
  }

  /**
   * Converts local AST symbols into ContextCandidates.
   */
  symbolsToCandidates(symbols: LocalSymbol[]): ContextCandidate[] {
    return symbols.map((sym, index) => ({
      id: `local-ast-${sym.name}-${sym.filePath}-${index}`,
      symbol: sym.name,
      filePath: sym.filePath,
      startLine: sym.startLine,
      endLine: sym.endLine,
      content: sym.docstring ? `${sym.docstring}\n${sym.signature}` : sym.signature || sym.body,
      compositeScore: 0.9,
      sourceType: 'code',
      sourceBackend: 'codegraphcontext',
      providerName: 'codegraphcontext',
      freshness: 'indexed',
      permissions: ['workspace:read'],
      graphDistance: 0,
      metadata: {
        symbolKind: sym.kind,
        localAST: true
      }
    }));
  }
}
