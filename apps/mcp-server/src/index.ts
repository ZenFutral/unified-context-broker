#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProviderRegistry, ContextOrchestrator } from '@context-broker/orchestrator';
import { LexicalAdapter } from '@context-broker/adapter-lexical';
import { CodeGraphAdapter } from '@context-broker/adapter-codegraph';
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

  // 1. Lexical adapter (BM25, full document parsing, workspace indexing)
  if (config.adapters.comp.enabled) {
    const lexicalAdapter = new LexicalAdapter({
      mockMode: isMock,
      daemonUrl: process.env['COMP_DAEMON_URL'] ?? config.adapters.comp.endpoint,
      sqlitePath: process.env['COMP_SQLITE_PATH'] ?? config.adapters.comp.dbPath
    });
    registry.register(lexicalAdapter, true, config.adapters.comp.timeoutMs);
  }

  // 2. CodeGraph adapter (structural code intelligence & impact)
  if (config.adapters.codegraphcontext.enabled) {
    const codeGraphAdapter = new CodeGraphAdapter({
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

  const cmd = process.argv[2];

  // CLI Command: --health / health
  if (cmd === '--health' || cmd === 'health') {
    const report = await orchestrator.getRegistry().checkAllHealth();
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // CLI Command: search "<query>" [--budget 8000]
  if (cmd === 'search') {
    const query = process.argv[3] || '';
    let budget = 8000;
    const budgetIdx = process.argv.indexOf('--budget');
    if (budgetIdx !== -1 && process.argv[budgetIdx + 1]) {
      budget = parseInt(process.argv[budgetIdx + 1]!, 10);
    }
    const pkg = await orchestrator.executeSearch({
      queryId: `cli-${Date.now()}`,
      query,
      workspaceIds: [process.cwd()],
      tokenBudget: budget,
      resultLimit: 25,
      intent: 'hybrid',
      accessScope: ['workspace:read'],
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    });
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }

  // CLI Command: symbol <name> [--file <path>]
  if (cmd === 'symbol') {
    const symbol = process.argv[3] || '';
    let filePath: string | undefined;
    const fileIdx = process.argv.indexOf('--file');
    if (fileIdx !== -1 && process.argv[fileIdx + 1]) {
      filePath = process.argv[fileIdx + 1];
    }
    const pkg = await orchestrator.executeSymbolLookup(symbol, filePath);
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }

  // CLI Command: digest [--ast] [--no-content]
  if (cmd === 'digest') {
    const pkg = await orchestrator.executeRepositoryMap();
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }

  // CLI Command: memory recall "<query>"
  if (cmd === 'memory') {
    const subCmd = process.argv[3];
    const query = subCmd === 'recall' ? process.argv[4] || '' : subCmd || '';
    const pkg = await orchestrator.executeDecisionRecall(query);
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }

  // Help output
  if (cmd === '--help' || cmd === '-h') {
    console.log(`Context Broker CLI & MCP Stdio Server

Usage:
  context-broker                        Start stdio JSON-RPC MCP Server (default)
  context-broker --health               Run backend health diagnostic
  context-broker search "<query>"       Search context with optional --budget <tokens>
  context-broker symbol <name>          Lookup symbol context with optional --file <path>
  context-broker digest                 Retrieve structural repository map digest
  context-broker memory recall "<q>"    Recall architectural decisions matching query
`);
    return;
  }

  // Default mode: Stdio MCP JSON-RPC Server
  const server = createMcpServer(orchestrator);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error running Context Broker MCP Server:', error);
  process.exit(1);
});

