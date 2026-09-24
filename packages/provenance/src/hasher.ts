import { createHash } from 'node:crypto';

export class ContentHasher {
  /**
   * Computes SHA-256 hash of candidate content text.
   */
  hash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generates a short 8-character verification hash.
   */
  shortHash(content: string): string {
    return this.hash(content).substring(0, 8);
  }
}
