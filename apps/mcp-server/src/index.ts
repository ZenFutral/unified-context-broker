#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProviderRegistry, ContextOrchestrator } from '@context-broker/orchestrator';
import { CompAdapter } from '@context-broker/adapter-comp';
import { CodeGraphContextAdapter } from '@context-broker/adapter-codegraphcontext';
import { VectorAdapter } from '@context-broker/adapter-vector';
import { GitAdapter } from '@context-broker/adapter-git';
import { MemoryAdapter } from '@context-broker/adapter-memory';
import { BrokerConfigSchema } from '@context-broker/contracts';
import { createMcpServer } from './server.js';
import { initializeCodebase } from './init.js';

/**
 * Loads broker configuration from the CONTEXT_BROKER_CONFIG JSON file path
 * or falls back to safe defaults. Individual settings can be overridden with
 * environment variables:
 *   CONTEXT_BROKER_MOCK=true    — Force all adapters into mock/test mode
 *   COMP_DAEMON_URL             — comP HTTP daemon endpoint
 *   COMP_SQLITE_PATH            — Path to comP SQLite database
 *   CGC_ENDPOINT                — CodeGraphContext service URL
 *   VECTOR_DB_PATH              — Local vector store DB path
 *   MEMORY_DB_PATH              — Memory adapter SQLite/JSONL path
 */
function loadConfig(): ReturnType<typeof BrokerConfigSchema.parse> {
  const configPath = process.env['CONTEXT_BROKER_CONFIG'];
  let rawConfig: Record<string, unknown> = {};

  if (configPath) {
    try {
      rawConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (err) {
      process.stderr.write(
        `[context-broker] Warning: Could not load config from ${configPath}: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  }

  return BrokerConfigSchema.parse(rawConfig);
}

async function main() {
  if (process.argv[2] === 'init') {
    initializeCodebase(process.argv[3]);
    return;
  }

  const config = loadConfig();
  const isMock = process.env['CONTEXT_BROKER_MOCK'] === 'true';

  const registry = new ProviderRegistry();

  // 1. comP adapter (BM25, full document parsing, workspace indexing)
  if (config.adapters.comp.enabled) {
    const compAdapter = new CompAdapter({
      mockMode: isMock,
      daemonUrl: process.env['COMP_DAEMON_URL'] ?? config.adapters.comp.endpoint,
      sqlitePath: process.env['COMP_SQLITE_PATH'] ?? config.adapters.comp.dbPath
    });
    registry.register(compAdapter, true, config.adapters.comp.timeoutMs);
  }

  // 2. CodeGraphContext adapter (structural code intelligence & impact)
  if (config.adapters.codegraphcontext.enabled) {
    const codeGraphAdapter = new CodeGraphContextAdapter({
      mockMode: isMock,
      endpoint: process.env['CGC_ENDPOINT'] ?? config.adapters.codegraphcontext.endpoint
    });
    registry.register(codeGraphAdapter, true, config.adapters.codegraphcontext.timeoutMs);
  }

  // 3. Vector adapter (local embeddings & dense semantic similarity)
  if (config.adapters.vector.enabled) {
    const vectorAdapter = new VectorAdapter({
      mockMode: isMock,
      dbPath: process.env['VECTOR_DB_PATH'] ?? config.adapters.vector.dbPath
    });
    registry.register(vectorAdapter, true, config.adapters.vector.timeoutMs);
  }

  // 4. Git adapter (branch status, diffs, blame, freshness detection)
  if (config.adapters.git.enabled) {
    const gitAdapter = new GitAdapter({ mockMode: isMock });
    registry.register(gitAdapter, true, config.adapters.git.timeoutMs);
  }

  // 5. Memory adapter (durable architectural decisions & verified facts)
  if (config.adapters.memory.enabled) {
    const memoryAdapter = new MemoryAdapter({
      mockMode: isMock,
      dbPath: process.env['MEMORY_DB_PATH'] ?? config.adapters.memory.dbPath
    });
    registry.register(memoryAdapter, true, config.adapters.memory.timeoutMs);
  }

  const orchestrator = new ContextOrchestrator(registry, {
    serverName: config.serverName,
    serverVersion: config.serverVersion,
    defaultTokenBudget: config.defaultTokenBudget,
    maxTokenBudget: config.maxTokenBudget,
    scoring: config.scoring,
    security: config.security
  });

  const server = createMcpServer(orchestrator);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error running Context Broker MCP Server:', error);
  process.exit(1);
});

