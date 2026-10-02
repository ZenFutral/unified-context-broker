/**
 * Native CodeGraphContext graph types and schemas.
 * These types MUST NOT be exported outside of the @context-broker/adapter-codegraphcontext package.
 */

export type GraphNodeType = 'file' | 'symbol' | 'class' | 'function' | 'interface' | 'variable';
export type GraphEdgeType = 'defines' | 'calls' | 'called_by' | 'imports' | 'imported_by' | 'implements' | 'extends' | 'references';

export interface GraphNode {
  id: string;
  name: string;
  type: GraphNodeType;
  file_path: string;
  start_line: number;
  end_line: number;
  content_snippet?: string;
  docstring?: string;
  container_symbol?: string;
}

export interface GraphEdge {
  source_id: string;
  target_id: string;
  type: GraphEdgeType;
  weight?: number;
}

export interface NativeGraphQueryResult {
  seed_node?: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  traversal_depth: number;
  total_symbols_indexed?: number;
}

export interface CodeGraphServerHealth {
  status: 'ok' | 'indexing' | 'error';
  version: string;
  graph_engine: 'tree-sitter' | 'scip' | 'hybrid';
  nodes_count: number;
  edges_count: number;
  last_sync_timestamp?: string;
}
