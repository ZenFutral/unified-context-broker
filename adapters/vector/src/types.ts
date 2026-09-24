/**
 * Native Vector storage and embedding data structures.
 * These types MUST NOT be exported outside of the @context-broker/adapter-vector package.
 */

export interface VectorChunkRecord {
  id: string;
  file_path: string;
  repository_id?: string;
  start_line: number;
  end_line: number;
  text_content: string;
  embedding: number[];
  chunk_type: 'code' | 'docstring' | 'markdown' | 'comment';
  created_timestamp: number;
}

export interface VectorSearchMatch {
  record: VectorChunkRecord;
  similarity_score: number; // Cosine similarity in range [0.0, 1.0]
}

export interface VectorStoreStatus {
  status: 'ready' | 'indexing' | 'uninitialized';
  engine: 'lancedb' | 'sqlite-vec' | 'in-memory-onnx';
  total_chunks: number;
  embedding_dimension: number;
  model_name: string;
}
