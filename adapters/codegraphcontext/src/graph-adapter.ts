import {
  ContextProvider,
  ProviderVersion,
  HealthResult,
  ProviderCapabilities,
  ContextQuery,
  ContextCandidate
} from '@context-broker/contracts';
import { CodeGraphClient, CodeGraphClientConfig } from './client.js';
import { mapGraphResultToCandidates, mapGraphNodeToCandidate } from './mapper.js';

export class CodeGraphContextAdapter implements ContextProvider {
  public readonly name = 'codegraphcontext' as const;
  private client: CodeGraphClient;

  constructor(config: CodeGraphClientConfig = {}) {
    this.client = new CodeGraphClient(config);
  }

  async version(): Promise<ProviderVersion> {
    const health = await this.client.getHealth();
    return {
      name: 'CodeGraphContext',
      version: health.version || '0.8.2',
      protocolVersion: '1.0.0'
    };
  }

  async health(): Promise<HealthResult> {
    try {
      const health = await this.client.getHealth();
      return {
        status: health.status === 'ok' ? 'healthy' : 'degraded',
        indexedItemCount: health.nodes_count,
        lastSyncTimestamp: health.last_sync_timestamp,
        diagnostics: {
          nodesCount: health.nodes_count,
          edgesCount: health.edges_count,
          engine: health.graph_engine
        }
      };
    } catch (err: unknown) {
      return {
        status: 'unhealthy',
        message: err instanceof Error ? err.message : 'Failed to query CodeGraphContext health',
        diagnostics: {}
      };
    }
  }

  async capabilities(): Promise<ProviderCapabilities> {
    return {
      supportsLexicalSearch: false,
      supportsSemanticSearch: false,
      supportsGraphTraversal: true,
      supportsDocumentExtraction: false,
      supportsFreshnessCheck: true,
      supportsMutations: false,
      supportedSourceTypes: ['code', 'graph']
    };
  }

  async search(query: ContextQuery): Promise<ContextCandidate[]> {
    if (query.intent === 'impact_analysis') {
      const impactResult = await this.client.queryImpactGraph(query.query);
      return mapGraphResultToCandidates(impactResult);
    }

    // Default symbol & dependency lookup
    const symbolResult = await this.client.lookupSymbol(query.query);
    return mapGraphResultToCandidates(symbolResult);
  }

  // Specialized adapter methods for direct tool invocation
  async getSymbolContext(symbolName: string, filePath?: string): Promise<ContextCandidate[]> {
    const result = await this.client.lookupSymbol(symbolName, filePath);
    return mapGraphResultToCandidates(result);
  }

  async getImpactContext(symbolName?: string, filePath?: string, depth = 2): Promise<ContextCandidate[]> {
    const result = await this.client.queryImpactGraph(symbolName, filePath, depth);
    return mapGraphResultToCandidates(result);
  }

  async getRepositoryMap(): Promise<ContextCandidate[]> {
    const nodes = await this.client.getRepositoryStructure();
    return nodes.map((node) => mapGraphNodeToCandidate(node, 0, false));
  }
}
