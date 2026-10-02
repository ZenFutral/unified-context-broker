import { createHash } from 'node:crypto';
import { ContextCandidate } from '@context-broker/contracts';

export class ContentHasher {
  /**
   * Computes SHA-256 hash of candidate content text.
   */
  hash(content: string): string {
    return createHash('sha256').update(content || '').digest('hex');
  }

  /**
   * Generates a short 8-character verification hash.
   */
  shortHash(content: string): string {
    return this.hash(content).substring(0, 8);
  }

  /**
   * Attaches SHA-256 contentHash to a ContextCandidate slice.
   */
  attachCandidateHash(candidate: ContextCandidate): ContextCandidate {
    const contentHash = this.hash(candidate.content);
    return {
      ...candidate,
      contentHash
    };
  }

  /**
   * Verifies candidate slice content integrity against stored contentHash.
   */
  verifyIntegrity(candidate: ContextCandidate): boolean {
    if (!candidate.contentHash) return true;
    return this.hash(candidate.content) === candidate.contentHash;
  }
}
