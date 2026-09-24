import {
  ContextProvider,
  ProviderVersion,
  HealthResult,
  ProviderCapabilities,
  ContextQuery,
  ContextCandidate
} from '@context-broker/contracts';
import { MemoryStore, MemoryStoreConfig } from './store.js';
import { DecisionRecord } from './schema.js';
import { mapDecisionsToCandidates } from './mapper.js';

export class MemoryAdapter implements ContextProvider {
  public readonly name = 'memory' as const;
  private store: MemoryStore;

  constructor(config: MemoryStoreConfig = {}) {
    this.store = new MemoryStore(config);
  }

  async version(): Promise<ProviderVersion> {
    return {
      name: 'MemoryAdapter-Durable',
      version: '1.0.0',
      protocolVersion: '1.0.0'
    };
  }

  async health(): Promise<HealthResult> {
    try {
      const count = await this.store.getTotalCount();
      return {
        status: 'healthy',
        indexedItemCount: count,
        diagnostics: {
          totalDecisions: count,
          storage: 'structured-sqlite/jsonl'
        }
      };
    } catch (err: unknown) {
      return {
        status: 'unhealthy',
        message: err instanceof Error ? err.message : 'Memory store error',
        diagnostics: {}
      };
    }
  }

  async capabilities(): Promise<ProviderCapabilities> {
    return {
      supportsLexicalSearch: true,
      supportsSemanticSearch: false,
      supportsGraphTraversal: false,
      supportsDocumentExtraction: false,
      supportsFreshnessCheck: false,
      supportsMutations: true,
      supportedSourceTypes: ['memory']
    };
  }

  async search(query: ContextQuery): Promise<ContextCandidate[]> {
    const decisions = await this.store.searchDecisions(query.query, undefined, undefined, query.resultLimit ?? 10);
    return mapDecisionsToCandidates(decisions);
  }

  async recordDecision(data: Omit<DecisionRecord, 'id' | 'timestamp'>): Promise<DecisionRecord> {
    return this.store.recordDecision(data);
  }

  async recallDecisions(
    query: string,
    components?: string[],
    tags?: string[],
    limit = 10
  ): Promise<ContextCandidate[]> {
    const decisions = await this.store.searchDecisions(query, components, tags, limit);
    return mapDecisionsToCandidates(decisions);
  }
}
