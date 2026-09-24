import { z } from 'zod';
import { ContextCandidateSchema } from './candidate.js';
import { QueryIntentSchema } from './query.js';
import { SourceBackendSchema } from './candidate.js';

export const RetrievalStepTraceSchema = z.object({
  provider: SourceBackendSchema,
  operation: z.string(),
  durationMs: z.number().nonnegative(),
  candidatesReturned: z.number().int().nonnegative(),
  status: z.enum(['success', 'degraded', 'failed', 'skipped']),
  error: z.string().optional()
});
export type RetrievalStepTrace = z.infer<typeof RetrievalStepTraceSchema>;

export const ContextPackageSchema = z.object({
  queryId: z.string(),
  /** The original query text, preserved for debugging and provenance tracing. */
  queryText: z.string().optional(),
  intent: QueryIntentSchema,
  summary: z.string(),
  candidates: z.array(ContextCandidateSchema),
  omittedCandidateCount: z.number().int().nonnegative().default(0),
  estimatedTokens: z.number().int().nonnegative(),
  budgetUtilizationPct: z.number().min(0).max(100),
  warnings: z.array(z.string()).default([]),
  retrievalTrace: z.array(RetrievalStepTraceSchema),
  generatedAt: z.string().datetime()
});
export type ContextPackage = z.infer<typeof ContextPackageSchema>;
