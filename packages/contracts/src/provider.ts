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

export interface ContextProvider {
  readonly name: z.infer<typeof SourceBackendSchema>;
  version(): Promise<ProviderVersion>;
  health(): Promise<HealthResult>;
  capabilities(): Promise<ProviderCapabilities>;
  search(query: ContextQuery): Promise<ContextCandidate[]>;
  dispose?(): Promise<void>;
}
