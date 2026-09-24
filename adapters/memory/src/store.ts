import { DecisionRecord, DecisionRecordSchema } from './schema.js';

export interface MemoryStoreConfig {
  dbPath?: string;
  mockMode?: boolean;
}

export class MemoryStore {
  private records: DecisionRecord[] = [];
  private config: MemoryStoreConfig;

  constructor(config: MemoryStoreConfig = {}) {
    this.config = config;
    if (this.config.mockMode) {
      this.populateMockDecisions();
    }
  }

  private populateMockDecisions() {
    this.records.push({
      id: 'ADR-001',
      title: 'Thin Context Broker Architecture',
      decision: 'Build context broker as a thin orchestration layer with replaceable upstream adapters rather than a monolith.',
      rationale: 'Avoids fork divergence and simplifies consuming upstream releases of comP and CodeGraphContext.',
      rejectedAlternatives: [
        'Vendoring full comP source and patching it directly',
        'Merging tree-sitter graph into comP SQLite schema'
      ],
      affectedComponents: ['context-broker', 'adapters/comp', 'adapters/codegraphcontext'],
      author: 'Architecture Team',
      timestamp: new Date().toISOString(),
      tags: ['architecture', 'mcp', 'adapters'],
      sourceFile: 'docs/decisions/ADR-001-thin-broker.md'
    });

    this.records.push({
      id: 'ADR-002',
      title: 'Local ONNX Embedding Generation',
      decision: 'Use quantized local ONNX models for vector search instead of external cloud embedding APIs.',
      rationale: 'Preserves privacy, eliminates cloud latency, and allows full offline operation.',
      rejectedAlternatives: ['OpenAI text-embedding-3-small', 'Cloud hosted endpoint'],
      affectedComponents: ['adapters/vector'],
      author: 'Security & ML Team',
      timestamp: new Date().toISOString(),
      tags: ['vector', 'security', 'onnx'],
      sourceFile: 'docs/decisions/ADR-002-local-embeddings.md'
    });
  }

  async recordDecision(data: Omit<DecisionRecord, 'id' | 'timestamp'>): Promise<DecisionRecord> {
    const id = `ADR-${String(this.records.length + 1).padStart(3, '0')}`;
    const fullRecord: DecisionRecord = DecisionRecordSchema.parse({
      ...data,
      id,
      timestamp: new Date().toISOString()
    });

    this.records.push(fullRecord);
    return fullRecord;
  }

  async searchDecisions(
    queryText: string,
    components?: string[],
    tags?: string[],
    limit = 10
  ): Promise<DecisionRecord[]> {
    const qLower = queryText ? queryText.toLowerCase().trim() : '';

    const eligible = this.records.filter((rec) => {
      // Filter by components if specified
      if (components && components.length > 0) {
        const matchesComp = components.some((c) =>
          rec.affectedComponents.some((ac) => ac.toLowerCase().includes(c.toLowerCase()))
        );
        if (!matchesComp) return false;
      }

      // Filter by tags if specified
      if (tags && tags.length > 0) {
        const matchesTag = tags.some((t) =>
          rec.tags.some((rt) => rt.toLowerCase() === t.toLowerCase())
        );
        if (!matchesTag) return false;
      }

      return true;
    });

    if (!qLower || qLower === '*' || qLower === 'status') {
      return eligible.slice(0, limit);
    }

    const words = qLower.split(/\s+/).filter((w) => w.length > 2);

    const scored = eligible
      .map((rec) => {
        const fullText = `${rec.title} ${rec.decision} ${rec.rationale} ${rec.tags.join(' ')}`.toLowerCase();
        let matchScore = 0;

        if (fullText.includes(qLower)) {
          matchScore += 100;
        }

        if (words.length > 0) {
          const matchedWords = words.filter((w) => fullText.includes(w));
          matchScore += matchedWords.length * 10;
        }

        return { rec, matchScore };
      })
      .filter(({ matchScore }) => matchScore > 0);

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored.map(({ rec }) => rec).slice(0, limit);
  }

  async getTotalCount(): Promise<number> {
    return this.records.length;
  }
}
