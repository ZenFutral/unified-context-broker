import { z } from 'zod';

export const QueryIntentSchema = z.enum([
  'exact_lookup',
  'semantic_discovery',
  'dependency_analysis',
  'impact_analysis',
  'implementation_search',
  'documentation_search',
  'decision_recall',
  'hybrid'
]);

export type QueryIntent = z.infer<typeof QueryIntentSchema>;

export const FreshnessRequirementSchema = z.enum(['live', 'indexed', 'either']);
export type FreshnessRequirement = z.infer<typeof FreshnessRequirementSchema>;

export const ContextQuerySchema = z.object({
  queryId: z.string().min(1),
  query: z.string().min(1),
  workspaceIds: z.array(z.string()).min(1),
  repositoryIds: z.array(z.string()).optional(),
  intent: QueryIntentSchema.optional().default('hybrid'),
  tokenBudget: z.number().int().positive().default(4000),
  resultLimit: z.number().int().positive().optional().default(25),
  accessScope: z.array(z.string()).default(['workspace:read']),
  includeHistory: z.boolean().optional().default(false),
  freshnessRequirement: FreshnessRequirementSchema.optional().default('either'),
  metadata: z.record(z.unknown()).optional().default({})
});

export type ContextQuery = z.infer<typeof ContextQuerySchema>;
