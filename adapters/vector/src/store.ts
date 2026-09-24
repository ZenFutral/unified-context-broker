import { VectorChunkRecord, VectorSearchMatch, VectorStoreStatus } from './types.js';
import { LocalEmbedder } from './embedder.js';

export interface VectorStoreConfig {
  dbPath?: string;
  mockMode?: boolean;
}

export class VectorStore {
  private embedder: LocalEmbedder;
  private records: VectorChunkRecord[] = [];
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig = {}) {
    this.config = config;
    this.embedder = new LocalEmbedder();
    if (this.config.mockMode) {
      this.populateMockData();
    }
  }

  private async populateMockData() {
    const mockChunks = [
      {
        id: 'chunk-vec-1',
        file_path: 'src/services/call-record.ts',
        start_line: 10,
        end_line: 60,
        text_content: 'export function extractCallRecordId(rawHeader: string): string {\n  // Audio streaming packet parsing\n  const parts = rawHeader.split(":");\n  return parts[1]?.trim() ?? "";\n}',
        chunk_type: 'code' as const
      },
      {
        id: 'chunk-vec-2',
        file_path: 'src/services/audio-stream.ts',
        start_line: 1,
        end_line: 45,
        text_content: 'export class AudioStreamBuffer {\n  // audio streaming buffer synchronization and jitter correction\n  synchronize(buffer: Buffer) {}\n}',
        chunk_type: 'code' as const
      },
      {
        id: 'chunk-vec-3',
        file_path: 'docs/architecture/oauth-flow.md',
        start_line: 1,
        end_line: 50,
        text_content: '# OAuth 2.0 Token Refresh Flow\nStep-by-step guide on how to configure OAuth provider and refresh tokens.',
        chunk_type: 'markdown' as const
      }
    ];

    for (const item of mockChunks) {
      const embedding = await this.embedder.embed(item.text_content);
      this.records.push({
        ...item,
        embedding,
        created_timestamp: Date.now()
      });
    }
  }

  async getStatus(): Promise<VectorStoreStatus> {
    return {
      status: 'ready',
      engine: 'in-memory-onnx',
      total_chunks: this.records.length,
      embedding_dimension: this.embedder.getDimension(),
      model_name: 'all-MiniLM-L6-v2-quantized'
    };
  }

  async searchSimilar(queryText: string, limit = 10): Promise<VectorSearchMatch[]> {
    const queryEmbedding = await this.embedder.embed(queryText);
    const matches: VectorSearchMatch[] = [];

    for (const record of this.records) {
      const score = this.embedder.cosineSimilarity(queryEmbedding, record.embedding);
      matches.push({
        record,
        similarity_score: Number(score.toFixed(4))
      });
    }

    // Sort descending by similarity score
    matches.sort((a, b) => b.similarity_score - a.similarity_score);
    return matches.slice(0, limit);
  }

  async addChunk(
    filePath: string,
    startLine: number,
    endLine: number,
    textContent: string,
    chunkType: 'code' | 'docstring' | 'markdown' | 'comment' = 'code'
  ): Promise<string> {
    const id = `chunk-vec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const embedding = await this.embedder.embed(textContent);
    this.records.push({
      id,
      file_path: filePath,
      start_line: startLine,
      end_line: endLine,
      text_content: textContent,
      embedding,
      chunk_type: chunkType,
      created_timestamp: Date.now()
    });
    return id;
  }
}
