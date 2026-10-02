import { z } from 'zod';
import { SourceBackendSchema, SourceTypeSchema, ContextCandidate } from './candidate.js';
import { ContextQuery } from './query.js';

export const ProviderVersionSchema = z.object({
  name: z.string(),
  version: z.string(),
  protocolVersion: z.string(),
  commitHash: z.string().optional()
});
export type ProviderVersion = z.infer<typeof ProviderVersionSchema>;

export const HealthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy', 'disabled']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const HealthResultSchema = z.object({
  status: HealthStatusSchema,
  message: z.string().optional(),
  lastSyncTimestamp: z.string().datetime().optional(),
  indexedItemCount: z.number().int().nonnegative().optional(),
  diagnostics: z.record(z.unknown()).optional().default({})
});
export type HealthResult = z.infer<typeof HealthResultSchema>;

export const ProviderCapabilitiesSchema = z.object({
  supportsLexicalSearch: z.boolean(),
  supportsSemanticSearch: z.boolean(),
  supportsGraphTraversal: z.boolean(),
  supportsDocumentExtraction: z.boolean(),
  supportsFreshnessCheck: z.boolean(),
  supportsMutations: z.boolean(),
  supportedSourceTypes: z.array(SourceTypeSchema)
});
export type ProviderCapabilities = z.infer<typeof ProviderCapabilitiesSchema>;

export const DecisionInputSchema = z.object({
  title: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string().min(1),
  rejectedAlternatives: z.array(z.string()).optional().default([]),
  affectedComponents: z.array(z.string()).optional().default([]),
  author: z.string().optional().default('AI Agent / Architect'),
  tags: z.array(z.string()).optional().default([]),
  sourceFile: z.string().optional()
});
export type DecisionInput = z.infer<typeof DecisionInputSchema>;

export const DecisionRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string().min(1),
  rejectedAlternatives: z.array(z.string()).default([]),
  affectedComponents: z.array(z.string()).default([]),
  author: z.string().default('AI Agent / Architect'),
  timestamp: z.string(),
  tags: z.array(z.string()).default([]),
  sourceFile: z.string().optional()
});
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

export interface ContextProvider {
  readonly name: z.infer<typeof SourceBackendSchema>;
  version(): Promise<ProviderVersion>;
  health(): Promise<HealthResult>;
  capabilities(): Promise<ProviderCapabilities>;
  search(query: ContextQuery): Promise<ContextCandidate[]>;
  dispose?(): Promise<void>;
}

export interface SymbolProvider extends ContextProvider {
  getSymbolContext(symbol: string, filePath?: string): Promise<ContextCandidate[]>;
}

export interface ImpactAnalysisProvider extends ContextProvider {
  getImpactContext(symbol?: string, filePath?: string, depth?: number): Promise<ContextCandidate[]>;
}

export interface RepositoryMapProvider extends ContextProvider {
  getRepositoryStructure(options?: { outlineOnly?: boolean }): Promise<ContextCandidate[]>;
}

export interface DurableMemoryProvider extends ContextProvider {
  recordDecision(data: DecisionInput): Promise<DecisionRecord>;
  recallDecisions(query: string, components?: string[], tags?: string[], limit?: number): Promise<ContextCandidate[]>;
}
