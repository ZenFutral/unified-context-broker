import {
  ContextProvider,
  ProviderVersion,
  HealthResult,
  ProviderCapabilities,
  ContextQuery,
  ContextCandidate
} from '@context-broker/contracts';
import { VectorStore, VectorStoreConfig } from './store.js';
import { mapVectorMatchesToCandidates } from './mapper.js';

export class VectorAdapter implements ContextProvider {
  public readonly name = 'vector' as const;
  private store: VectorStore;

  constructor(config: VectorStoreConfig = {}) {
    this.store = new VectorStore(config);
  }

  async version(): Promise<ProviderVersion> {
    return {
      name: 'VectorAdapter-Local',
      version: '0.2.0',
      protocolVersion: '1.0.0'
    };
  }

  async health(): Promise<HealthResult> {
    try {
      const status = await this.store.getStatus();
      return {
        status: status.status === 'ready' ? 'healthy' : 'degraded',
        indexedItemCount: status.total_chunks,
        diagnostics: {
          engine: status.engine,
          dimension: status.embedding_dimension,
          model: status.model_name
        }
      };
    } catch (err: unknown) {
      return {
        status: 'unhealthy',
        message: err instanceof Error ? err.message : 'Vector store error',
        diagnostics: {}
      };
    }
  }

  async capabilities(): Promise<ProviderCapabilities> {
    return {
      supportsLexicalSearch: false,
      supportsSemanticSearch: true,
      supportsGraphTraversal: false,
      supportsDocumentExtraction: false,
      supportsFreshnessCheck: false,
      supportsMutations: true,
      supportedSourceTypes: ['code', 'document']
    };
  }

  async search(query: ContextQuery): Promise<ContextCandidate[]> {
    const limit = query.resultLimit ?? 15;
    const matches = await this.store.searchSimilar(query.query, limit);
    return mapVectorMatchesToCandidates(matches);
  }

  async indexCodeChunk(
    filePath: string,
    startLine: number,
    endLine: number,
    content: string,
    chunkType: 'code' | 'docstring' | 'markdown' | 'comment' = 'code'
  ): Promise<string> {
    return this.store.addChunk(filePath, startLine, endLine, content, chunkType);
  }
}
