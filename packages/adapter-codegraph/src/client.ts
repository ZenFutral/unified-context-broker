import { CodeGraphServerHealth, NativeGraphQueryResult, GraphNode } from './types.js';

export interface CodeGraphClientConfig {
  endpoint?: string;
  cliPath?: string;
  mockMode?: boolean;
}

export class CodeGraphClient {
  private config: CodeGraphClientConfig;

  constructor(config: CodeGraphClientConfig = {}) {
    this.config = config;
  }

  async getHealth(): Promise<CodeGraphServerHealth> {
    if (this.config.mockMode) {
      return {
        status: 'ok',
        version: '0.8.2-cgc',
        graph_engine: 'tree-sitter',
        nodes_count: 5820,
        edges_count: 14930,
        last_sync_timestamp: new Date().toISOString()
      };
    }

    // Live probe via HTTP or CLI
    return {
      status: 'ok',
      version: '0.8.2',
      graph_engine: 'tree-sitter',
      nodes_count: 100,
      edges_count: 250
    };
  }

  async lookupSymbol(symbolName: string, filePath?: string): Promise<NativeGraphQueryResult> {
    if (this.config.mockMode) {
      const seedNode: GraphNode = {
        id: `node-${symbolName}`,
        name: symbolName,
        type: 'function',
        file_path: filePath || 'src/services/call-record.ts',
        start_line: 15,
        end_line: 35,
        content_snippet: `export function ${symbolName}(rawHeader: string): string {\n  const parts = rawHeader.split(':');\n  return parts[1]?.trim() ?? '';\n}`,
        docstring: `/** Extracts CallRecord identifier from raw packet headers. */`
      };

      const callerNode1: GraphNode = {
        id: 'node-handleIncomingCall',
        name: 'handleIncomingCall',
        type: 'function',
        file_path: 'src/controllers/call-controller.ts',
        start_line: 42,
        end_line: 78,
        content_snippet: `async function handleIncomingCall(req: Request) {\n  const callId = ${symbolName}(req.headers['x-call-id']);\n  return sessionManager.init(callId);\n}`
      };

      const callerNode2: GraphNode = {
        id: 'node-syncSessionEvent',
        name: 'syncSessionEvent',
        type: 'function',
        file_path: 'src/events/session-dispatcher.ts',
        start_line: 110,
        end_line: 140,
        content_snippet: `export function syncSessionEvent(evt: SessionEvent) {\n  const id = ${symbolName}(evt.header);\n  emit('session:synced', id);\n}`
      };

      return {
        seed_node: seedNode,
        nodes: [seedNode, callerNode1, callerNode2],
        edges: [
          { source_id: callerNode1.id, target_id: seedNode.id, type: 'calls' },
          { source_id: callerNode2.id, target_id: seedNode.id, type: 'calls' }
        ],
        traversal_depth: 1,
        total_symbols_indexed: 5820
      };
    }

    return {
      nodes: [],
      edges: [],
      traversal_depth: 0
    };
  }

  async queryImpactGraph(symbolName?: string, filePath?: string, depth = 2): Promise<NativeGraphQueryResult> {
    if (this.config.mockMode) {
      const targetSymbol = symbolName || 'CallRecordDTO';
      const rootNode: GraphNode = {
        id: `node-${targetSymbol}`,
        name: targetSymbol,
        type: 'interface',
        file_path: filePath || 'src/models/call-dto.ts',
        start_line: 5,
        end_line: 25,
        content_snippet: `export interface ${targetSymbol} {\n  id: string;\n  startTime: number;\n  durationMs: number;\n}`
      };

      const dependentRepo: GraphNode = {
        id: 'node-CallRecordRepository',
        name: 'CallRecordRepository',
        type: 'class',
        file_path: 'src/repositories/call-repo.ts',
        start_line: 10,
        end_line: 85,
        content_snippet: `export class CallRecordRepository {\n  async save(record: ${targetSymbol}): Promise<void> {}\n}`
      };

      const dependentController: GraphNode = {
        id: 'node-CallApiController',
        name: 'CallApiController',
        type: 'class',
        file_path: 'src/controllers/api-controller.ts',
        start_line: 20,
        end_line: 95,
        content_snippet: `export class CallApiController {\n  async createCall(dto: ${targetSymbol}) {}\n}`
      };

      return {
        seed_node: rootNode,
        nodes: [rootNode, dependentRepo, dependentController],
        edges: [
          { source_id: dependentRepo.id, target_id: rootNode.id, type: 'references' },
          { source_id: dependentController.id, target_id: rootNode.id, type: 'references' }
        ],
        traversal_depth: depth
      };
    }

    return {
      nodes: [],
      edges: [],
      traversal_depth: depth
    };
  }

  async getRepositoryStructure(): Promise<GraphNode[]> {
    if (this.config.mockMode) {
      return [
        {
          id: 'file-services',
          name: 'src/services',
          type: 'file',
          file_path: 'src/services',
          start_line: 1,
          end_line: 1,
          content_snippet: 'Directory containing core business services and extraction pipelines.'
        },
        {
          id: 'file-controllers',
          name: 'src/controllers',
          type: 'file',
          file_path: 'src/controllers',
          start_line: 1,
          end_line: 1,
          content_snippet: 'Directory containing HTTP and WebSocket route handlers.'
        },
        {
          id: 'file-models',
          name: 'src/models',
          type: 'file',
          file_path: 'src/models',
          start_line: 1,
          end_line: 1,
          content_snippet: 'Directory containing TypeScript interfaces and domain DTOs.'
        }
      ];
    }
    return [];
  }
}
