import * as path from 'node:path';

export interface TreeVisualizerOptions {
  maxDepth?: number;
  showMetrics?: boolean;
}

export class ASTOutlineExtractor {
  /**
   * Transforms code or document content into an outline view according to language rules.
   */
  extractOutline(content: string, filePath?: string): string {
    if (!content || content.trim().length === 0) return content;

    const ext = filePath ? path.extname(filePath).toLowerCase() : '';

    if (ext === '.py') {
      return this.extractPythonOutline(content);
    }
    if (ext === '.json') {
      return this.extractJsonOutline(content);
    }
    if (ext === '.md' || ext === '.markdown') {
      return this.extractMarkdownOutline(content);
    }

    // Default: TS/JS/C#/Java syntax outline
    return this.extractTsJsOutline(content);
  }

  /**
   * Language-aware outline extraction for TypeScript / JavaScript.
   */
  private extractTsJsOutline(content: string): string {
    const lines = content.split(/\r?\n/);
    const outlineLines: string[] = [];
    let functionBraceDepth = 0;
    let inMultilinedoc = false;
    let insideFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const trimmed = line.trim();

      // Preserve docstrings & comments
      if (trimmed.startsWith('/**') || trimmed.startsWith('/*')) {
        inMultilinedoc = true;
        outlineLines.push(line);
        if (trimmed.endsWith('*/')) inMultilinedoc = false;
        continue;
      }
      if (inMultilinedoc) {
        outlineLines.push(line);
        if (trimmed.endsWith('*/')) inMultilinedoc = false;
        continue;
      }
      if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
        outlineLines.push(line);
        continue;
      }

      // Detect function/method declarations
      const isFunctionDeclaration =
        /^(export\s+)?(default\s+)?(async\s+)?(function|def|pub\s+fn|fn)\b/.test(trimmed) ||
        /^(public|private|protected|readonly|static|override|async|get|set)?\s*[\w$]+\s*\(.*?\)\s*(:\s*[\w$<>[\]]+)?\s*\{/.test(
          trimmed
        );

      if (isFunctionDeclaration) {
        if (trimmed.endsWith('{')) {
          outlineLines.push(line + ' /* [implementation omitted] */ }');
          insideFunction = true;
          functionBraceDepth = 1;
        } else if (trimmed.includes('{') && trimmed.includes('}')) {
          outlineLines.push(line.replace(/\{.*?\}/, '{ /* [implementation omitted] */ }'));
        } else {
          outlineLines.push(line);
        }
        continue;
      }

      if (insideFunction) {
        for (const char of line) {
          if (char === '{') functionBraceDepth++;
          else if (char === '}') functionBraceDepth--;
        }
        if (functionBraceDepth <= 0) {
          insideFunction = false;
        }
        continue;
      }

      // Preserve non-function lines (imports, interfaces, types, classes, properties)
      outlineLines.push(line);
    }

    return outlineLines.length > 0 ? outlineLines.join('\n') : content;
  }

  /**
   * Language-aware outline extraction for Python.
   */
  private extractPythonOutline(content: string): string {
    const lines = content.split(/\r?\n/);
    const outlineLines: string[] = [];
    let inDocstring = false;
    let docstringDelim = '';
    let insideFuncIndent = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const indentMatch = /^(\s*)/.exec(line);
      const currentIndent = indentMatch ? indentMatch[1]!.length : 0;
      const trimmed = line.trim();

      // Handle multiline docstrings
      if (!inDocstring && (trimmed.startsWith('"""') || trimmed.startsWith("'''"))) {
        inDocstring = true;
        docstringDelim = trimmed.startsWith('"""') ? '"""' : "'''";
        outlineLines.push(line);
        if (trimmed.length > 3 && trimmed.endsWith(docstringDelim)) inDocstring = false;
        continue;
      }
      if (inDocstring) {
        outlineLines.push(line);
        if (trimmed.endsWith(docstringDelim)) inDocstring = false;
        continue;
      }

      // Python class and def statements
      if (/^(class|def|async\s+def)\b/.test(trimmed)) {
        outlineLines.push(line);
        if (trimmed.startsWith('def') || trimmed.startsWith('async def')) {
          outlineLines.push(`${' '.repeat(currentIndent + 4)}...  # [implementation omitted]`);
          insideFuncIndent = currentIndent;
        }
        continue;
      }

      // Skip lines inside function body
      if (insideFuncIndent >= 0) {
        if (trimmed.length > 0 && currentIndent <= insideFuncIndent) {
          insideFuncIndent = -1; // Exited function body
        } else {
          continue;
        }
      }

      // Preserve imports, comments, decorators
      if (
        trimmed.startsWith('import ') ||
        trimmed.startsWith('from ') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('@') ||
        trimmed.length === 0
      ) {
        outlineLines.push(line);
      }
    }

    return outlineLines.length > 0 ? outlineLines.join('\n') : content;
  }

  /**
   * JSON structure outline generator.
   */
  private extractJsonOutline(content: string): string {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed !== 'object' || parsed === null) return content;

      const summarize = (obj: unknown, depth = 0): unknown => {
        if (depth > 2) return typeof obj;
        if (Array.isArray(obj)) {
          return `[Array(${obj.length})]`;
        }
        if (typeof obj === 'object' && obj !== null) {
          const res: Record<string, unknown> = {};
          for (const key of Object.keys(obj)) {
            res[key] = summarize((obj as Record<string, unknown>)[key], depth + 1);
          }
          return res;
        }
        return typeof obj;
      };

      return JSON.stringify(summarize(parsed), null, 2);
    } catch {
      return content;
    }
  }

  /**
   * Markdown structure outline generator.
   */
  private extractMarkdownOutline(content: string): string {
    const lines = content.split(/\r?\n/);
    const outlineLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('#') ||
        trimmed.startsWith('|') ||
        trimmed.startsWith('```') ||
        trimmed.startsWith('>') ||
        trimmed.startsWith('- [')
      ) {
        outlineLines.push(line);
      }
    }

    return outlineLines.length > 0 ? outlineLines.join('\n') : content;
  }

  /**
   * Renders a clean ASCII directory tree representation with metrics.
   */
  renderDirectoryTree(
    _workspaceRoot: string,
    filePaths: string[],
    options: TreeVisualizerOptions = {}
  ): string {
    if (!filePaths || filePaths.length === 0) return 'No files to visualize.';

    const maxDepth = options.maxDepth ?? 5;
    const tree: Record<string, unknown> = {};

    for (const rawPath of filePaths) {
      const clean = rawPath.replace(/\\/g, '/');
      const parts = clean.split('/').filter(Boolean);
      let current = tree;

      for (let i = 0; i < Math.min(parts.length, maxDepth); i++) {
        const part = parts[i]!;
        if (!current[part]) {
          current[part] = (i === parts.length - 1) ? null : {};
        }
        if (typeof current[part] === 'object' && current[part] !== null) {
          current = current[part] as Record<string, unknown>;
        }
      }
    }

    const formatTree = (node: Record<string, unknown>, prefix = ''): string[] => {
      const keys = Object.keys(node);
      const lines: string[] = [];

      keys.forEach((key, index) => {
        const isLast = index === keys.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';
        const value = node[key];

        if (value === null) {
          lines.push(`${prefix}${connector}${key}`);
        } else {
          lines.push(`${prefix}${connector}${key}/`);
          lines.push(...formatTree(value as Record<string, unknown>, `${prefix}${childPrefix}`));
        }
      });

      return lines;
    };

    return [`Workspace Repository Map (${filePaths.length} files):`, ...formatTree(tree)].join('\n');
  }
}
