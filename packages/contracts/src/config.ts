import { z } from 'zod';

export const ScoringWeightsSchema = z.object({
  lexicalWeight: z.number().min(0).max(1).default(0.30),
  semanticWeight: z.number().min(0).max(1).default(0.35),
  graphWeight: z.number().min(0).max(1).default(0.20),
  recencyWeight: z.number().min(0).max(1).default(0.10),
  pathPriorityWeight: z.number().min(0).max(1).default(0.05),
  intentMatchBoost: z.number().min(0).max(1).default(0.15),
  stalePenalty: z.number().min(0).max(1).default(0.25),
  duplicatePenalty: z.number().min(0).max(1).default(0.10)
});
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;

export const AdapterSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  timeoutMs: z.number().int().positive().default(2000),
  endpoint: z.string().optional(),
  dbPath: z.string().optional(),
  options: z.record(z.unknown()).optional().default({})
});
export type AdapterSettings = z.infer<typeof AdapterSettingsSchema>;

export const BrokerConfigSchema = z.object({
  serverName: z.string().default('context-broker-mcp'),
  serverVersion: z.string().default('0.1.0'),
  defaultTokenBudget: z.number().int().positive().default(4000),
  maxTokenBudget: z.number().int().positive().default(32000),
  defaultResultLimit: z.number().int().positive().default(25),
  adapters: z.object({
    comp: AdapterSettingsSchema.default({ enabled: true, timeoutMs: 2000 }),
    codegraphcontext: AdapterSettingsSchema.default({ enabled: true, timeoutMs: 2000 }),
    vector: AdapterSettingsSchema.default({ enabled: true, timeoutMs: 3000 }),
    git: AdapterSettingsSchema.default({ enabled: true, timeoutMs: 1500 }),
    memory: AdapterSettingsSchema.default({ enabled: true, timeoutMs: 1500 })
  }).default({}),
  scoring: ScoringWeightsSchema.default({}),
  security: z.object({
    enablePathTraversalCheck: z.boolean().default(true),
    enableSecretScrubbing: z.boolean().default(true),
    excludedPatterns: z.array(z.string()).default([
      '**/.env*',
      '**/*.pem',
      '**/*.key',
      '**/id_rsa*',
      '**/node_modules/**',
      '**/.git/**'
    ])
  }).default({})
});
export type BrokerConfig = z.infer<typeof BrokerConfigSchema>;
