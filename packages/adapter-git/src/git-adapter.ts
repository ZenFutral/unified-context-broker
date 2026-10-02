import {
  ContextProvider,
  ProviderVersion,
  HealthResult,
  ProviderCapabilities,
  ContextQuery,
  ContextCandidate
} from '@context-broker/contracts';
import { GitClient, GitClientConfig } from './client.js';
import { mapGitDiffToCandidate, mapGitStatusToCandidate } from './mapper.js';

export class GitAdapter implements ContextProvider {
  public readonly name = 'git' as const;
  private client: GitClient;

  constructor(config: GitClientConfig = {}) {
    this.client = new GitClient(config);
  }

  async version(): Promise<ProviderVersion> {
    return {
      name: 'GitAdapter',
      version: '2.44.0-adapter',
      protocolVersion: '1.0.0'
    };
  }

  async health(): Promise<HealthResult> {
    try {
      const status = await this.client.getStatus();
      return {
        status: 'healthy',
        message: `Branch: ${status.current_branch} @ ${status.commit_hash.substring(0, 7)}`,
        diagnostics: {
          branch: status.current_branch,
          clean: status.is_clean
        }
      };
    } catch (err: unknown) {
      return {
        status: 'unhealthy',
        message: err instanceof Error ? err.message : 'Git inspection failed',
        diagnostics: {}
      };
    }
  }

  async capabilities(): Promise<ProviderCapabilities> {
    return {
      supportsLexicalSearch: false,
      supportsSemanticSearch: false,
      supportsGraphTraversal: false,
      supportsDocumentExtraction: false,
      supportsFreshnessCheck: true,
      supportsMutations: false,
      supportedSourceTypes: ['git']
    };
  }

  async search(_query: ContextQuery): Promise<ContextCandidate[]> {
    const candidates: ContextCandidate[] = [];
    const status = await this.client.getStatus();
    candidates.push(mapGitStatusToCandidate(status));

    const diffs = await this.client.getDiffs();
    for (const diff of diffs) {
      candidates.push(mapGitDiffToCandidate(diff));
    }

    return candidates;
  }

  async checkFileFreshness(filePath: string, indexedAt?: string): Promise<'live' | 'stale' | 'indexed'> {
    return this.client.checkFreshness(filePath, indexedAt);
  }
}
