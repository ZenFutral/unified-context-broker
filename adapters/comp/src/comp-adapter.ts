import {
  ContextProvider,
  ProviderVersion,
  HealthResult,
  ProviderCapabilities,
  ContextQuery,
  ContextCandidate
} from '@context-broker/contracts';
import { CompClient, CompClientConfig } from './client.js';
import { mapCompHitsToCandidates } from './mapper.js';

export class CompAdapter implements ContextProvider {
  public readonly name = 'comp' as const;
  private client: CompClient;

  constructor(config: CompClientConfig = {}) {
    this.client = new CompClient(config);
  }

  async version(): Promise<ProviderVersion> {
    const status = await this.client.getStatus();
    return {
      name: 'comP',
      version: status.version || '0.4.2',
      protocolVersion: '1.0.0'
    };
  }

  async health(): Promise<HealthResult> {
    try {
      const status = await this.client.getStatus();
      if (!status.running) {
        return {
          status: 'unhealthy',
          message: 'comP daemon is not running',
          diagnostics: {}
        };
      }
      return {
        status: 'healthy',
        indexedItemCount: status.total_indexed_documents ?? 0,
        lastSyncTimestamp: status.last_index_time,
        diagnostics: {
          dbPath: status.db_path,
          memoryUsage: status.memory_usage_bytes
        }
      };
    } catch (err: unknown) {
      return {
        status: 'unhealthy',
        message: err instanceof Error ? err.message : 'Failed to query comP health',
        diagnostics: {}
      };
    }
  }

  async capabilities(): Promise<ProviderCapabilities> {
    return {
      supportsLexicalSearch: true,
      supportsSemanticSearch: false,
      supportsGraphTraversal: false,
      supportsDocumentExtraction: true,
      supportsFreshnessCheck: true,
      supportsMutations: false,
      supportedSourceTypes: ['code', 'document']
    };
  }

  async search(query: ContextQuery): Promise<ContextCandidate[]> {
    const hits = await this.client.searchBM25(
      query.query,
      query.workspaceIds,
      query.resultLimit ?? 25
    );
    return mapCompHitsToCandidates(hits);
  }
}
