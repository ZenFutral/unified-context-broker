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
  searchAndReplaceToolDefinition,
  handleSearchAndReplace
} from './tools/replace.js';
import {
  emitToolExecutionEvent,
  calculateTokenMetrics,
  formatArgsSummary
} from './telemetryEmitter.js';

export const lookupSymbolToolDefinition = {
  ...getSymbolContextToolDefinition,
  name: 'lookup_symbol',
  description: 'Alias for get_symbol_context. Retrieve detailed signature, AST outline, callers, and references for a specific code symbol.'
};

export const analyzeImpactToolDefinition = {
  ...getImpactContextToolDefinition,
  name: 'analyze_impact',
  description: 'Alias for get_impact_context. Perform blast radius analysis for a proposed change to a symbol or file.'
};

export const getRepoMapToolDefinition = {
  ...getRepositoryMapToolDefinition,
  name: 'get_repo_map',
  description: 'Alias for get_repository_map. Generate high-level directory outline and module centrality topology digest.'
};

export const checkHealthToolDefinition = {
  ...backendHealthToolDefinition,
  name: 'check_health',
  description: 'Alias for backend_health. Run quick diagnostic and report health status of all registered context providers.'
};

export const replaceInFileToolDefinition = {
  ...searchAndReplaceToolDefinition,
  name: 'replace_in_file',
  description: 'Alias for search_and_replace. Safely execute atomic file replacements.'
};

export const patchFileToolDefinition = {
  ...searchAndReplaceToolDefinition,
  name: 'patch_file',
  description: 'Alias for search_and_replace. Apply structured patch chunks to a file.'
};

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

  // Expose the unified MCP tools plus canonical action-verb aliases
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        searchContextToolDefinition,
        getSymbolContextToolDefinition,
        lookupSymbolToolDefinition,
        getImpactContextToolDefinition,
        analyzeImpactToolDefinition,
        getRepositoryMapToolDefinition,
        getRepoMapToolDefinition,
        recallDecisionsToolDefinition,
        recordDecisionToolDefinition,
        explainContextToolDefinition,
        backendHealthToolDefinition,
        checkHealthToolDefinition,
        searchAndReplaceToolDefinition,
        replaceInFileToolDefinition,
        patchFileToolDefinition
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
        case 'check_health':
        case 'backend_health':
          result = await handleBackendHealth(orchestrator);
          break;

        case 'search_context':
          result = await handleSearchContext(orchestrator, args);
          break;

        case 'lookup_symbol':
        case 'get_symbol_context':
          result = await handleGetSymbolContext(orchestrator, args);
          break;

        case 'analyze_impact':
        case 'get_impact_context':
          result = await handleGetImpactContext(orchestrator, args);
          break;

        case 'get_repo_map':
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

        case 'search_and_replace':
        case 'replace_in_file':
        case 'patch_file':
          result = await handleSearchAndReplace(orchestrator, args);
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

      let responsePayload: unknown = result;
      try {
        if (result?.content?.[0]?.text) {
          responsePayload = JSON.parse(result.content[0].text);
        }
      } catch {
        responsePayload = result;
      }

      emitToolExecutionEvent({
        id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tool: name,
        args: argsSummary,
        latency,
        tokensSaved: metrics.tokensSaved,
        timestamp: new Date().toISOString(),
        status,
        requestPayload: safeArgs ?? {},
        responsePayload,
        details: {
          ...metrics.details,
          requestPayload: safeArgs ?? {},
          responsePayload
        }
      }).catch(() => {});
    }
  });

  return server;
}
