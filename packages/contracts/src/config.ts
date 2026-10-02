import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

export const PolicyExclusionsSchema = z.object({
  secretScrubbingPatterns: z.array(z.string()).default([
    "(?:bearer\\s+|token\\s+|api[_-]?key\\s*[:=]\\s*['\"]?)(\\w{20,})",
    "(?:password\\s*[:=]\\s*['\"]?)([^'\"]+)",
    "-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"
  ]),
  pathExclusions: z.array(z.string()).default([
    "**/.env*",
    "**/*.pem",
    "**/*.key",
    "**/*.p12",
    "**/id_rsa*",
    "**/id_ed25519*",
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**"
  ])
});
export type PolicyExclusions = z.infer<typeof PolicyExclusionsSchema>;

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

/**
 * Resolves the root directory of the context broker monorepo / package.
 */
export function getBrokerRoot(startDir?: string): string {
  let curr = startDir;
  if (!curr) {
    if (typeof __dirname !== 'undefined') {
      curr = __dirname;
    } else {
      curr = process.cwd();
    }
  }

  while (curr && curr !== path.dirname(curr)) {
    if (
      fs.existsSync(path.join(curr, 'pnpm-workspace.yaml')) ||
      (fs.existsSync(path.join(curr, 'package.json')) &&
        fs.existsSync(path.join(curr, 'packages')) &&
        ['unified-context-broker', 'context-broker-monorepo'].includes(
          JSON.parse(fs.readFileSync(path.join(curr, 'package.json'), 'utf8')).name
        ))
    ) {
      return curr;
    }
    curr = path.dirname(curr);
  }

  return path.resolve(startDir || process.cwd(), '../..');
}

/**
 * Loads BrokerConfig from a JSON file path, environment variable, or returns defaults.
 */
export function loadBrokerConfig(configPath?: string, cwd: string = process.cwd()): BrokerConfig {
  const envPath = process.env['CONTEXT_BROKER_CONFIG'];
  const targetPath = configPath || envPath || path.join(cwd, 'config', 'defaults', 'broker.json');

  let config: BrokerConfig;
  if (targetPath && fs.existsSync(targetPath)) {
    try {
      const raw = fs.readFileSync(targetPath, 'utf8');
      const json = JSON.parse(raw);
      config = BrokerConfigSchema.parse(json);
    } catch {
      config = BrokerConfigSchema.parse({});
    }
  } else {
    config = BrokerConfigSchema.parse({});
  }

  if (!config.adapters.memory.dbPath) {
    config.adapters.memory.dbPath = process.env['MEMORY_DB_PATH'] || path.join(getBrokerRoot(cwd), '.data', 'memory', 'decisions.jsonl');
  }

  return config;
}

/**
 * Loads PolicyExclusions from a JSON file path, environment variable, or returns defaults.
 */
export function loadPolicyExclusions(policyPath?: string, cwd: string = process.cwd()): PolicyExclusions {
  const envPath = process.env['CONTEXT_BROKER_EXCLUSIONS'];
  const targetPath = policyPath || envPath || path.join(cwd, 'config', 'policies', 'exclusions.json');


  if (targetPath && fs.existsSync(targetPath)) {
    try {
      const raw = fs.readFileSync(targetPath, 'utf8');
      const json = JSON.parse(raw);
      return PolicyExclusionsSchema.parse(json);
    } catch {
      // Fallback to defaults on parse/read error
    }
  }

  return PolicyExclusionsSchema.parse({});
}
