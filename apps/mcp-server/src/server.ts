import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { ContextOrchestrator } from '@context-broker/orchestrator';
import {
  backendHealthToolDefinition,
  handleBackendHealth
} from './tools/health.js';
import {
  searchContextToolDefinition,
  handleSearchContext
} from './tools/search.js';
import {
  getSymbolContextToolDefinition,
  handleGetSymbolContext
} from './tools/symbol.js';
import {
  getImpactContextToolDefinition,
  handleGetImpactContext
} from './tools/impact.js';
import {
  getRepositoryMapToolDefinition,
  handleGetRepositoryMap
} from './tools/repo-map.js';
import {
  recordDecisionToolDefinition,
  recallDecisionsToolDefinition,
  handleRecordDecision,
  handleRecallDecisions
} from './tools/memory.js';
import {
  explainContextToolDefinition,
  handleExplainContext
} from './tools/explain.js';
import {
  emitToolExecutionEvent,
  calculateTokenMetrics,
  formatArgsSummary
} from './telemetryEmitter.js';

export function createMcpServer(orchestrator: ContextOrchestrator): Server {
  const server = new Server(
    {
      name: 'context-broker',
      version: '0.1.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Expose the 8 unified MCP tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        searchContextToolDefinition,
        getSymbolContextToolDefinition,
        getImpactContextToolDefinition,
        getRepositoryMapToolDefinition,
        recallDecisionsToolDefinition,
        recordDecisionToolDefinition,
        explainContextToolDefinition,
        backendHealthToolDefinition
      ]
    };
  });

  // Handle all tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let result: any;

    try {
      switch (name) {
        case 'backend_health':
          result = await handleBackendHealth(orchestrator);
          break;

        case 'search_context':
          result = await handleSearchContext(orchestrator, args);
          break;

        case 'get_symbol_context':
          result = await handleGetSymbolContext(orchestrator, args);
          break;

        case 'get_impact_context':
          result = await handleGetImpactContext(orchestrator, args);
          break;

        case 'get_repository_map':
          result = await handleGetRepositoryMap(orchestrator, args);
          break;

        case 'record_decision':
          result = await handleRecordDecision(orchestrator, args);
          break;

        case 'recall_decisions':
          result = await handleRecallDecisions(orchestrator, args);
          break;

        case 'explain_context':
          result = await handleExplainContext(orchestrator, args);
          break;

        default:
          result = {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`
              }
            ]
          };
          status = 'error';
      }

      if (result?.isError) {
        status = 'error';
      }

      return result;
    } catch (err: unknown) {
      status = 'error';
      const errMsg = err instanceof Error ? err.message : String(err);
      result = {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${errMsg}`
          }
        ]
      };
      return result;
    } finally {
      const latency = Math.max(1, Date.now() - startTime);
      const safeArgs = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : undefined;
      const metrics = calculateTokenMetrics(name, safeArgs, result);
      const argsSummary = formatArgsSummary(name, safeArgs);

      emitToolExecutionEvent({
        id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tool: name,
        args: argsSummary,
        latency,
        tokensSaved: metrics.tokensSaved,
        timestamp: new Date().toISOString(),
        status,
        details: metrics.details
      }).catch(() => {});
    }
  });

  return server;
}
