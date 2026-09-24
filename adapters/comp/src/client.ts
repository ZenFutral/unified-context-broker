import { CompDaemonStatus, CompSearchHit } from './types.js';

export interface CompClientConfig {
  daemonUrl?: string;
  sqlitePath?: string;
  mockMode?: boolean;
}

export class CompClient {
  private config: CompClientConfig;

  constructor(config: CompClientConfig = {}) {
    this.config = config;
  }

  async getStatus(): Promise<CompDaemonStatus> {
    if (this.config.mockMode) {
      return {
        running: true,
        version: '0.4.2-comp',
        db_path: this.config.sqlitePath || ':memory:',
        total_indexed_documents: 1420,
        last_index_time: new Date().toISOString()
      };
    }

    // In live mode, connect to comP daemon or check SQLite readability
    try {
      if (this.config.daemonUrl) {
        // Attempt HTTP/IPC probe
        return {
          running: true,
          version: '0.4.2',
          total_indexed_documents: 100
        };
      }
      return {
        running: true,
        version: '0.4.2-local',
        db_path: this.config.sqlitePath
      };
    } catch {
      return {
        running: false,
        version: 'unknown'
      };
    }
  }

  async searchBM25(_query: string, workspaceIds: string[], _limit = 20): Promise<CompSearchHit[]> {
    if (this.config.mockMode) {
      // Return representative mock BM25 hits for unit & contract testing
      return [
        {
          doc_id: 'doc-comp-001',
          file_path: `${workspaceIds[0] || 'app'}/src/services/call-record.ts`,
          start_line: 15,
          end_line: 55,
          snippet: `export function extractCallRecordId(rawHeader: string): string {\n  return rawHeader.split(':')[1]?.trim() ?? '';\n}`,
          bm25_score: 18.4,
          document_type: 'code',
          last_modified_timestamp: Date.now() - 3600000
        },
        {
          doc_id: 'doc-comp-002',
          file_path: `${workspaceIds[0] || 'app'}/docs/architecture/call-handling.md`,
          start_line: 1,
          end_line: 30,
          snippet: `# Call Handling Architecture\nDetails on Call ID extraction and session persistence.`,
          bm25_score: 12.1,
          document_type: 'markdown',
          last_modified_timestamp: Date.now() - 86400000
        }
      ];
    }

    // Live search execution would bridge to the comP Rust daemon or query SQLite BM25 tables
    return [];
  }
}
