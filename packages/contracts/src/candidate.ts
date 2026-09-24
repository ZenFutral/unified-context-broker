import { z } from 'zod';

export const SourceBackendSchema = z.enum([
  'comp',
  'codegraphcontext',
  'vector',
  'git',
  'memory'
]);
export type SourceBackend = z.infer<typeof SourceBackendSchema>;

export const SourceTypeSchema = z.enum([
  'code',
  'document',
  'graph',
  'memory',
  'git'
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const FreshnessStatusSchema = z.enum([
  'live',
  'indexed',
  'stale',
  'unknown'
]);
export type FreshnessStatus = z.infer<typeof FreshnessStatusSchema>;

export const ContextCandidateSchema = z.object({
  id: z.string().min(1),
  sourceBackend: SourceBackendSchema,
  sourceType: SourceTypeSchema,
  repositoryId: z.string().optional(),
  filePath: z.string().optional(),
  symbol: z.string().optional(),
  startLine: z.number().int().nonnegative().optional(),
  endLine: z.number().int().nonnegative().optional(),
  content: z.string(),

  // Scoring signals
  lexicalScore: z.number().min(0).max(1).optional(),
  semanticScore: z.number().min(0).max(1).optional(),
  graphDistance: z.number().int().nonnegative().optional(),
  graphRelevance: z.number().min(0).max(1).optional(),
  /**
   * Final fused ranking score. NOT normalized to [0, 1] — it is an unbounded ranking signal.
   * Typical values are 0.0–1.1 (sum of weighted signals) but exact symbol overrides may reach 1.5.
   * Used only for descending sort order; do not interpret as a probability.
   */
  compositeScore: z.number().optional(),

  // Freshness & Provenance
  freshness: FreshnessStatusSchema.default('unknown'),
  contentHash: z.string().optional(),
  indexedAt: z.string().datetime().optional(),
  modifiedAt: z.string().datetime().optional(),

  // Security & Permissions
  permissions: z.array(z.string()).default(['workspace:read']),
  metadata: z.record(z.unknown()).default({})
});

export type ContextCandidate = z.infer<typeof ContextCandidateSchema>;

/**
 * Generates a stable, canonical candidate ID based on backend and file location/content.
 */
export function generateCandidateId(params: {
  sourceBackend: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  symbol?: string;
  uniqueSuffix?: string;
}): string {
  const parts = [
    params.sourceBackend,
    params.filePath || 'global',
    params.startLine !== undefined ? String(params.startLine) : '0',
    params.endLine !== undefined ? String(params.endLine) : '0',
    params.symbol || '',
    params.uniqueSuffix || ''
  ];
  return parts.filter(Boolean).join('::');
}
