import { ContextCandidate } from '@context-broker/contracts';

export interface SpatialDeduplicatorOptions {
  /** Number of lines within which two candidates are considered adjacent and merged. Default: 5 */
  proximityWindowLines?: number;
}

export class SpatialDeduplicator {
  private proximityWindowLines: number;

  constructor(options: SpatialDeduplicatorOptions = {}) {
    this.proximityWindowLines = options.proximityWindowLines ?? 5;
  }
  /**
   * Identifies and merges overlapping candidates covering the same file and line span.
   */
  deduplicate(candidates: ContextCandidate[]): ContextCandidate[] {
    const fileGroups = new Map<string, ContextCandidate[]>();

    // Group by filePath (or global if undefined)
    for (const candidate of candidates) {
      const key = candidate.filePath || 'global-unscoped';
      const list = fileGroups.get(key) || [];
      list.push(candidate);
      fileGroups.set(key, list);
    }

    const deduplicated: ContextCandidate[] = [];

    for (const [_filePath, items] of fileGroups.entries()) {
      if (items.length === 1) {
        deduplicated.push(items[0]!);
        continue;
      }

      // Sort items by startLine
      items.sort((a, b) => (a.startLine ?? 0) - (b.startLine ?? 0));

      const mergedGroup: ContextCandidate[] = [];
      let current = { ...items[0]! };

      for (let i = 1; i < items.length; i++) {
        const next = items[i]!;
        const currentStart = current.startLine ?? 0;
        const currentEnd = current.endLine ?? currentStart + 20;
        const nextStart = next.startLine ?? 0;
        const nextEnd = next.endLine ?? nextStart + 20;

        // Check for spatial overlap: next starts before or at current end + proximity window
        const isOverlapping = nextStart <= currentEnd + this.proximityWindowLines;

        if (isOverlapping) {
          // Merge signals into current
          current.startLine = Math.min(currentStart, nextStart);
          current.endLine = Math.max(currentEnd, nextEnd);

          // Merge longest content snippet
          if (next.content.length > current.content.length) {
            current.content = next.content;
          }

          // Combine multi-engine signals
          if (next.lexicalScore !== undefined) {
            current.lexicalScore = Math.max(current.lexicalScore ?? 0, next.lexicalScore);
          }
          if (next.semanticScore !== undefined) {
            current.semanticScore = Math.max(current.semanticScore ?? 0, next.semanticScore);
          }
          if (next.graphDistance !== undefined) {
            current.graphDistance = Math.min(current.graphDistance ?? 99, next.graphDistance);
          }
          if (next.graphRelevance !== undefined) {
            current.graphRelevance = Math.max(current.graphRelevance ?? 0, next.graphRelevance);
          }
          if (next.symbol && !current.symbol) {
            current.symbol = next.symbol;
          }

          current.metadata = {
            ...current.metadata,
            ...next.metadata,
            mergedSources: [
              ...(Array.isArray(current.metadata['mergedSources']) ? current.metadata['mergedSources'] as string[] : [current.sourceBackend]),
              next.sourceBackend
            ]
          };
        } else {
          mergedGroup.push(current);
          current = { ...next };
        }
      }
      mergedGroup.push(current);
      deduplicated.push(...mergedGroup);
    }

    return deduplicated;
  }
}
