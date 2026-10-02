export interface DiffLine {
  type: 'equal' | 'delete' | 'insert';
  text: string;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

/**
 * Computes edit script between oldLines and newLines using LCS algorithm.
 */
export function computeLineEdits(oldLines: string[], newLines: string[]): DiffLine[] {
  const n = oldLines.length;
  const m = newLines.length;

  // Optimized LCS dynamic programming
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1]![j + 1] = dp[i]![j]! + 1;
      } else {
        dp[i + 1]![j + 1] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }
  }

  const edits: DiffLine[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      edits.unshift({ type: 'equal', text: oldLines[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      edits.unshift({ type: 'insert', text: newLines[j - 1]! });
      j--;
    } else if (i > 0) {
      edits.unshift({ type: 'delete', text: oldLines[i - 1]! });
      i--;
    }
  }

  return edits;
}

/**
 * Groups diff lines into standard unified diff hunks with context lines.
 */
export function createHunks(edits: DiffLine[], contextSize = 3): DiffHunk[] {
  const hunks: DiffHunk[] = [];

  // Find change indices
  const changeIndices: number[] = [];
  for (let idx = 0; idx < edits.length; idx++) {
    if (edits[idx]!.type !== 'equal') {
      changeIndices.push(idx);
    }
  }

  if (changeIndices.length === 0) {
    return [];
  }

  // Group changes that are within 2 * contextSize of each other
  const ranges: Array<{ start: number; end: number }> = [];
  let rangeStart = Math.max(0, changeIndices[0]! - contextSize);
  let rangeEnd = Math.min(edits.length - 1, changeIndices[0]! + contextSize);

  for (let i = 1; i < changeIndices.length; i++) {
    const chIdx = changeIndices[i]!;
    const nextStart = Math.max(0, chIdx - contextSize);
    const nextEnd = Math.min(edits.length - 1, chIdx + contextSize);

    if (nextStart <= rangeEnd) {
      rangeEnd = Math.max(rangeEnd, nextEnd);
    } else {
      ranges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = nextStart;
      rangeEnd = nextEnd;
    }
  }
  ranges.push({ start: rangeStart, end: rangeEnd });

  // Map ranges to hunks
  let editIdx = 0;
  let curOld = 1;
  let curNew = 1;

  for (const range of ranges) {
    while (editIdx < range.start) {
      const e = edits[editIdx]!;
      if (e.type === 'equal' || e.type === 'delete') curOld++;
      if (e.type === 'equal' || e.type === 'insert') curNew++;
      editIdx++;
    }

    const hunkOldStart = curOld;
    const hunkNewStart = curNew;
    let hunkOldCount = 0;
    let hunkNewCount = 0;
    const hunkLines: DiffLine[] = [];

    while (editIdx <= range.end) {
      const e = edits[editIdx]!;
      hunkLines.push(e);
      if (e.type === 'equal') {
        hunkOldCount++;
        hunkNewCount++;
        curOld++;
        curNew++;
      } else if (e.type === 'delete') {
        hunkOldCount++;
        curOld++;
      } else if (e.type === 'insert') {
        hunkNewCount++;
        curNew++;
      }
      editIdx++;
    }

    hunks.push({
      oldStart: hunkOldStart,
      oldCount: hunkOldCount,
      newStart: hunkNewStart,
      newCount: hunkNewCount,
      lines: hunkLines
    });
  }

  return hunks;
}

/**
 * Generates unified diff string between oldContent and newContent.
 */
export function generateUnifiedDiff(
  filePath: string,
  oldContent: string,
  newContent: string,
  contextSize = 3
): string {
  if (oldContent === newContent) {
    return '';
  }

  const oldLines = oldContent.split(/\r?\n/);
  const newLines = newContent.split(/\r?\n/);

  const edits = computeLineEdits(oldLines, newLines);
  const hunks = createHunks(edits, contextSize);

  if (hunks.length === 0) {
    return '';
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  const header = `--- a/${normalizedPath}\n+++ b/${normalizedPath}\n`;
  const hunkStrings = hunks.map((hunk) => {
    const hunkHeader = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
    const linesStr = hunk.lines
      .map((l) => {
        const prefix = l.type === 'delete' ? '-' : l.type === 'insert' ? '+' : ' ';
        return `${prefix}${l.text}`;
      })
      .join('\n');
    return hunkHeader + linesStr;
  });

  return header + hunkStrings.join('\n') + '\n';
}
