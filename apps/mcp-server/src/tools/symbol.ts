import { ContextOrchestrator } from '@context-broker/orchestrator';
import { CodeGraphContextAdapter } from '@context-broker/adapter-codegraphcontext';

export const getSymbolContextToolDefinition = {
  name: 'get_symbol_context',
  description: 'Retrieve definition, docstrings, references, callers, and related file context for a specific symbol or identifier.',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'The identifier, function, class, or type name to inspect'
      },
      filePath: {
        type: 'string',
        description: 'Optional file path hint to disambiguate identical symbol names'
      },
      includeCallers: {
        type: 'boolean',
        description: 'Whether to include upstream callers in the returned context (default: true)'
      },
      includeReferences: {
        type: 'boolean',
        description: 'Whether to include downstream references (default: true)'
      }
    },
    required: ['symbol']
  }
};

export async function handleGetSymbolContext(
  orchestrator: ContextOrchestrator,
  args: unknown
) {
  const params = args as { symbol?: string; filePath?: string };
  if (!params || !params.symbol || typeof params.symbol !== 'string') {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Invalid arguments: "symbol" string parameter is required.'
        }
      ]
    };
  }

  const graphAdapter = orchestrator.getRegistry().get('codegraphcontext') as CodeGraphContextAdapter | undefined;
  if (!graphAdapter) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'CodeGraphContext adapter is not registered or is currently disabled.'
        }
      ]
    };
  }

  try {
    const candidates = await graphAdapter.getSymbolContext(params.symbol, params.filePath);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            symbol: params.symbol,
            filePath: params.filePath,
            totalCandidates: candidates.length,
            candidates
          }, null, 2)
        }
      ]
    };
  } catch (err: unknown) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error resolving symbol context: ${err instanceof Error ? err.message : String(err)}`
        }
      ]
    };
  }
}
