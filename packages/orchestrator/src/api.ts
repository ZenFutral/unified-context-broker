import {
  ContextQuery,
  ContextPackage,
  ContextCandidate,
  BrokerConfig,
  loadBrokerConfig
} from '@context-broker/contracts';
import { ContextOrchestrator } from './orchestrator.js';
import { ProviderRegistry } from './registry.js';

export interface GetContextOptions {
  query: string;
  workspacePath?: string;
  workspaceIds?: string[];
  tokenBudget?: number;
  maxTokens?: number;
  outlineOnly?: boolean;
  intent?: ContextQuery['intent'];
  accessScope?: string[];
}

let defaultOrchestrator: ContextOrchestrator | null = null;

/**
 * Creates and initializes a default ContextOrchestrator loaded with local adapters.
 */
export async function createDefaultOrchestrator(
  workspaceRoot: string = process.cwd(),
  customConfig: Partial<BrokerConfig> = {}
): Promise<ContextOrchestrator> {
  const config = { ...loadBrokerConfig(undefined, workspaceRoot), ...customConfig };
  const registry = new ProviderRegistry();
  const isMock = process.env['CONTEXT_BROKER_MOCK'] === 'true' || true;

  try {
    const { LexicalAdapter, CompAdapter } = await import('@context-broker/adapter-lexical');
    const AdapterClass = LexicalAdapter || CompAdapter;
    if (config.adapters.comp.enabled) {
      registry.register(new AdapterClass({ mockMode: isMock }), true, config.adapters.comp.timeoutMs);
    }
  } catch {
    // Graceful fallback if dynamic import unresolvable
  }

  try {
    const { CodeGraphAdapter, CodeGraphContextAdapter } = await import('@context-broker/adapter-codegraph');
    const AdapterClass = CodeGraphAdapter || CodeGraphContextAdapter;
    if (config.adapters.codegraphcontext.enabled) {
      registry.register(new AdapterClass({ mockMode: isMock }), true, config.adapters.codegraphcontext.timeoutMs);
    }
  } catch {
    // Graceful fallback if dynamic import unresolvable
  }

  try {
    const { GitAdapter } = await import('@context-broker/adapter-git');
    if (config.adapters.git.enabled) {
      registry.register(new GitAdapter({ mockMode: isMock }), true, config.adapters.git.timeoutMs);
    }
  } catch {
    // Graceful fallback if dynamic import unresolvable
  }

  try {
    const { MemoryAdapter } = await import('@context-broker/adapter-memory');
    if (config.adapters.memory.enabled) {
      registry.register(new MemoryAdapter({ mockMode: isMock }), true, config.adapters.memory.timeoutMs);
    }
  } catch {
    // Graceful fallback if dynamic import unresolvable
  }

  return new ContextOrchestrator(registry, config);
}

export function getGlobalOrchestrator(): ContextOrchestrator {
  if (!defaultOrchestrator) {
    const registry = new ProviderRegistry();
    defaultOrchestrator = new ContextOrchestrator(registry);
  }
  return defaultOrchestrator;
}

export function setGlobalOrchestrator(orchestrator: ContextOrchestrator): void {
  defaultOrchestrator = orchestrator;
}

/**
 * Clean, in-memory programmatic entry point for LLM agent scripts and custom extensions.
 * Executes ranked context retrieval directly without starting an MCP stdio/SSE server daemon.
 */
export async function getContext(options: GetContextOptions): Promise<ContextPackage> {
  const orchestrator = getGlobalOrchestrator();
  const workspaceId = options.workspacePath || process.cwd();

  const query: ContextQuery = {
    queryId: `api-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    query: options.query,
    workspaceIds: options.workspaceIds || [workspaceId],
    tokenBudget: options.tokenBudget || 4000,
    maxTokens: options.maxTokens,
    outlineOnly: options.outlineOnly ?? false,
    intent: options.intent || 'hybrid',
    accessScope: options.accessScope || ['workspace:read'],
    resultLimit: 25,
    includeHistory: false,
    freshnessRequirement: 'either',
    metadata: {}
  };

  return orchestrator.executeQuery(query);
}

/**
 * Programmatic convenience alias for search queries.
 */
export async function searchContext(
  queryText: string,
  tokenBudget = 4000,
  outlineOnly = false
): Promise<ContextCandidate[]> {
  const result = await getContext({
    query: queryText,
    tokenBudget,
    outlineOnly
  });
  return result.candidates;
}
