import { ContextCandidate } from '@context-broker/contracts';

export class CitationGenerator {
  /**
   * Generates a clickable markdown link with file:// scheme and line range.
   * e.g., [call-record.ts#L10-L45](file:///path/to/src/services/call-record.ts#L10-L45)
   */
  generateMarkdownCitation(candidate: ContextCandidate): string {
    if (!candidate.filePath) {
      return candidate.symbol ? `[Symbol: ${candidate.symbol}]` : `[Source: ${candidate.sourceBackend}]`;
    }

    const basename = candidate.filePath.split(/[/\\]/).pop() || candidate.filePath;
    const lineFragment = candidate.startLine !== undefined && candidate.endLine !== undefined
      ? `#L${candidate.startLine}-L${candidate.endLine}`
      : candidate.startLine !== undefined
      ? `#L${candidate.startLine}`
      : '';

    const label = `${basename}${lineFragment}`;
    const uri = `file:///${candidate.filePath.replace(/\\/g, '/')}${lineFragment}`;

    return `[${label}](${uri})`;
  }

  /**
   * Formats a complete contextual code block with provenance header.
   */
  formatContextBlock(candidate: ContextCandidate): string {
    const citation = this.generateMarkdownCitation(candidate);
    const backendBadge = `[${candidate.sourceBackend.toUpperCase()}]`;
    const freshnessBadge = candidate.freshness !== 'live' && candidate.freshness !== 'unknown'
      ? `(${candidate.freshness.toUpperCase()})`
      : '';

    const header = `### ${citation} ${backendBadge} ${freshnessBadge}`.trim();
    return `${header}\n\`\`\`${candidate.sourceType === 'document' ? 'markdown' : 'typescript'}\n${candidate.content}\n\`\`\``;
  }
}
