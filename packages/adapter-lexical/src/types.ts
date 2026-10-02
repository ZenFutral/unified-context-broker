/**
 * Native comP API responses and daemon data types.
 * These types MUST NOT be exported outside of the @context-broker/adapter-comp package.
 */

export interface CompSearchHit {
  doc_id: string;
  file_path: string;
  chunk_index?: number;
  start_line?: number;
  end_line?: number;
  snippet: string;
  bm25_score: number;
  file_extension?: string;
  document_type?: 'code' | 'markdown' | 'pdf' | 'office' | 'parquet' | 'text';
  last_modified_timestamp?: number;
}

export interface CompDaemonStatus {
  running: boolean;
  version: string;
  db_path?: string;
  total_indexed_documents?: number;
  last_index_time?: string;
  memory_usage_bytes?: number;
}
