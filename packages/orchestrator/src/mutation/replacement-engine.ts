import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  SearchReplaceRequest,
  SearchReplaceRequestSchema,
  SearchReplaceResult
} from '@context-broker/contracts';
import { WorkspaceBoundaryGuard, SecretScrubber } from '@context-broker/security';
import { ASTOutlineExtractor } from '../ast-outline.js';
import { TokenBudgetManager } from '../budget.js';
import { generateUnifiedDiff } from './diff.js';

export interface FileReplacementEngineOptions {
  boundaryGuard?: WorkspaceBoundaryGuard;
  secretScrubber?: SecretScrubber;
  astOutlineExtractor?: ASTOutlineExtractor;
  budgetManager?: TokenBudgetManager;
  workspaceRoots?: string[];
}

interface ReplacementMatch {
  startOffset: number;
  endOffset: number;
  replacementContent: string;
}

export class FileReplacementEngine {
  private boundaryGuard: WorkspaceBoundaryGuard;
  private secretScrubber: SecretScrubber;
  private astOutlineExtractor: ASTOutlineExtractor;
  private budgetManager: TokenBudgetManager;
  private workspaceRoots: string[];

  constructor(options: FileReplacementEngineOptions = {}) {
    this.boundaryGuard = options.boundaryGuard ?? new WorkspaceBoundaryGuard();
    this.secretScrubber = options.secretScrubber ?? new SecretScrubber();
    this.astOutlineExtractor = options.astOutlineExtractor ?? new ASTOutlineExtractor();
    this.budgetManager = options.budgetManager ?? new TokenBudgetManager();
    this.workspaceRoots = options.workspaceRoots ?? [process.cwd()];
  }

  /**
   * Resolves target file path against available workspace roots.
   */
  private resolveTargetFilePath(targetFile: string, workspaceIds: string[]): string {
    const clean = targetFile.trim();

    if (path.isAbsolute(clean)) {
      return path.normalize(clean);
    }

    for (const ws of workspaceIds) {
      const candidate = path.resolve(ws, clean);
      if (fs.existsSync(candidate)) {
        return path.normalize(candidate);
      }
    }

    // Default to first workspace root or cwd
    const baseDir = workspaceIds[0] || process.cwd();
    return path.normalize(path.resolve(baseDir, clean));
  }

  /**
   * Calculates character offsets for each line in the text.
   */
  private computeLineOffsets(lines: string[], lineEnding: string): Array<{ start: number; end: number }> {
    const offsets: Array<{ start: number; end: number }> = [];
    let currentOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      offsets.push({
        start: currentOffset,
        end: currentOffset + line.length
      });
      currentOffset += line.length + (i < lines.length - 1 ? lineEnding.length : 0);
    }

    return offsets;
  }

  /**
   * Executes atomic search and replace mutation.
   */
  async replace(request: SearchReplaceRequest): Promise<SearchReplaceResult> {
    const parsed = SearchReplaceRequestSchema.parse(request);
    const workspaceIds = parsed.workspaceIds && parsed.workspaceIds.length > 0
      ? parsed.workspaceIds
      : this.workspaceRoots;

    const resolvedPath = this.resolveTargetFilePath(parsed.targetFile, workspaceIds);

    // 1. Boundary Guard Check
    const isPermitted = this.boundaryGuard.isPathPermitted(resolvedPath, workspaceIds);
    if (!isPermitted) {
      throw new Error(
        `Path security violation: target file '${parsed.targetFile}' is outside permitted workspace boundaries or matches an excluded path.`
      );
    }

    // 2. File Existence Check
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Target file not found: ${parsed.targetFile}`);
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      throw new Error(`Target path is not a regular file: ${parsed.targetFile}`);
    }

    // 3. Secret Scrubber Inspection on replacement contents
    for (const chunk of parsed.replacements) {
      const scrubResult = this.secretScrubber.scrubText(chunk.replacementContent);
      if (scrubResult.secretsDetectedCount > 0) {
        throw new Error(
          `Security rejection: replacementContent contains detected secret credential (${scrubResult.secretsDetectedCount} found). Edit blocked.`
        );
      }
    }

    // 4. Read File Content and Detect Line Ending
    const originalContent = fs.readFileSync(resolvedPath, 'utf8');
    const lineEnding = originalContent.includes('\r\n') ? '\r\n' : '\n';
    const lines = originalContent.split(/\r?\n/);
    const lineOffsets = this.computeLineOffsets(lines, lineEnding);

    const matchesToApply: ReplacementMatch[] = [];

    // 5. Match and Validate Each Chunk
    for (let chunkIdx = 0; chunkIdx < parsed.replacements.length; chunkIdx++) {
      const chunk = parsed.replacements[chunkIdx]!;

      // Determine search window offsets
      let windowStartOffset = 0;
      let windowEndOffset = originalContent.length;

      if (chunk.startLine !== undefined || chunk.endLine !== undefined) {
        if (
          chunk.startLine !== undefined &&
          chunk.endLine !== undefined &&
          chunk.startLine > chunk.endLine
        ) {
          throw new Error(
            `Invalid line range: startLine (${chunk.startLine}) > endLine (${chunk.endLine}) in ${parsed.targetFile}`
          );
        }

        const startIdx = chunk.startLine !== undefined
          ? Math.max(0, Math.min(lines.length - 1, chunk.startLine - 1))
          : 0;

        const endIdx = chunk.endLine !== undefined
          ? Math.max(0, Math.min(lines.length - 1, chunk.endLine - 1))
          : lines.length - 1;

        windowStartOffset = lineOffsets[startIdx]?.start ?? 0;
        windowEndOffset = lineOffsets[endIdx]?.end ?? originalContent.length;
      }

      const chunkMatches: Array<{ start: number; end: number }> = [];

      if (parsed.isRegex) {
        const flags = (parsed.matchCase ? 'g' : 'gi');
        const regex = new RegExp(chunk.targetContent, flags);
        const searchScope = originalContent.slice(windowStartOffset, windowEndOffset);

        let match: RegExpExecArray | null;
        while ((match = regex.exec(searchScope)) !== null) {
          const matchStart = windowStartOffset + match.index;
          const matchEnd = matchStart + match[0].length;
          chunkMatches.push({ start: matchStart, end: matchEnd });

          if (!regex.global) break;
          if (match[0].length === 0) {
            regex.lastIndex++;
          }
        }
      } else {
        const targetStr = chunk.targetContent;
        const targetLen = targetStr.length;
        const searchScope = originalContent.slice(windowStartOffset, windowEndOffset);

        if (parsed.matchCase) {
          let pos = searchScope.indexOf(targetStr);
          while (pos !== -1) {
            chunkMatches.push({
              start: windowStartOffset + pos,
              end: windowStartOffset + pos + targetLen
            });
            pos = searchScope.indexOf(targetStr, pos + targetLen);
          }
        } else {
          const lowerScope = searchScope.toLowerCase();
          const lowerTarget = targetStr.toLowerCase();
          let pos = lowerScope.indexOf(lowerTarget);
          while (pos !== -1) {
            chunkMatches.push({
              start: windowStartOffset + pos,
              end: windowStartOffset + pos + targetLen
            });
            pos = lowerScope.indexOf(lowerTarget, pos + targetLen);
          }
        }
      }

      if (chunkMatches.length === 0) {
        const lineInfo = chunk.startLine
          ? ` within lines ${chunk.startLine}-${chunk.endLine ?? lines.length}`
          : '';
        throw new Error(`Target content not found in ${parsed.targetFile}${lineInfo}.`);
      }

      if (chunkMatches.length > 1 && !chunk.allowMultiple) {
        throw new Error(
          `Ambiguous match: target content found ${chunkMatches.length} times in ${parsed.targetFile}. Set allowMultiple to true to replace all occurrences.`
        );
      }

      for (const m of chunkMatches) {
        matchesToApply.push({
          startOffset: m.start,
          endOffset: m.end,
          replacementContent: chunk.replacementContent
        });
      }
    }

    // 6. Check for Overlapping Matches Across Chunks
    matchesToApply.sort((a, b) => a.startOffset - b.startOffset);
    for (let i = 0; i < matchesToApply.length - 1; i++) {
      const cur = matchesToApply[i]!;
      const next = matchesToApply[i + 1]!;
      if (cur.endOffset > next.startOffset) {
        throw new Error(`Overlapping replacement chunks detected in ${parsed.targetFile}.`);
      }
    }

    // 7. Apply Replacements from End to Beginning (to keep offsets stable)
    matchesToApply.sort((a, b) => b.startOffset - a.startOffset);
    let modifiedContent = originalContent;
    for (const m of matchesToApply) {
      modifiedContent =
        modifiedContent.slice(0, m.startOffset) +
        m.replacementContent +
        modifiedContent.slice(m.endOffset);
    }

    // 8. Generate Diff & Relative File Path
    const rootForDisplay = workspaceIds[0] || process.cwd();
    const relativeDisplayPath = path.relative(rootForDisplay, resolvedPath).replace(/\\/g, '/') || parsed.targetFile;
    const unifiedDiff = generateUnifiedDiff(relativeDisplayPath, originalContent, modifiedContent);

    // 9. Token Delta Estimation
    const originalTokens = this.budgetManager.estimateTokens(originalContent);
    const modifiedTokens = this.budgetManager.estimateTokens(modifiedContent);
    const tokensDelta = modifiedTokens - originalTokens;

    // 10. Syntax and Structural Integrity Warnings
    const warnings: string[] = [];
    const ext = path.extname(resolvedPath).toLowerCase();

    if (ext === '.json') {
      try {
        JSON.parse(modifiedContent);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Warning: Modified content is not valid JSON (${msg}).`);
      }
    } else if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      const countChar = (str: string, ch: string) => {
        let count = 0;
        for (let i = 0; i < str.length; i++) {
          if (str[i] === ch) count++;
        }
        return count;
      };

      const openBraces = countChar(modifiedContent, '{') - countChar(modifiedContent, '}');
      const openParens = countChar(modifiedContent, '(') - countChar(modifiedContent, ')');

      if (openBraces !== 0) {
        warnings.push(
          `Warning: Replacement may have unbalanced braces (${openBraces > 0 ? 'unclosed {' : 'extra }'}).`
        );
      }
      if (openParens !== 0) {
        warnings.push(
          `Warning: Replacement may have unbalanced parentheses (${openParens > 0 ? 'unclosed (' : 'extra )'}).`
        );
      }

      try {
        const modOutline = this.astOutlineExtractor.extractOutline(modifiedContent, resolvedPath);
        if (!modOutline && originalContent.length > 50) {
          warnings.push('Warning: AST outline extraction yielded empty structure after modification.');
        }
      } catch {
        warnings.push('Warning: AST outline parsing encountered an issue after replacement.');
      }
    }

    // 11. Atomic Disk Write if Not Dry Run
    const isModified = originalContent !== modifiedContent;
    if (!parsed.dryRun && isModified) {
      const dir = path.dirname(resolvedPath);
      const tempPath = path.join(
        dir,
        `.tmp.${path.basename(resolvedPath)}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`
      );

      fs.writeFileSync(tempPath, modifiedContent, 'utf8');

      try {
        fs.renameSync(tempPath, resolvedPath);
      } catch {
        // Fallback for Windows cross-device or locking edge cases
        fs.writeFileSync(resolvedPath, modifiedContent, 'utf8');
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // Ignore temp cleanup error
        }
      }
    }

    return {
      targetFile: relativeDisplayPath,
      modified: !parsed.dryRun && isModified,
      chunksApplied: parsed.replacements.length,
      unifiedDiff,
      tokensDelta,
      warnings,
      secretsDetected: 0
    };
  }
}
