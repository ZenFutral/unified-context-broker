import { ContextOrchestrator } from '@context-broker/orchestrator';
import { CodeGraphContextAdapter } from '@context-broker/adapter-codegraphcontext';

export const getImpactContextToolDefinition = {
  name: 'get_impact_context',
  description: 'Analyze downstream dependents, upstream callers, and blast radius affected by changing a symbol or file.',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Symbol or component name to analyze for impact blast radius'
      },
      filePath: {
        type: 'string',
        description: 'Target file path if analyzing a file-level change'
      },
      depth: {
        type: 'number',
        description: 'Graph traversal depth for dependency analysis (default: 2)'
      }
    }
  }
};

export async function handleGetImpactContext(
  orchestrator: ContextOrchestrator,
  args: unknown
) {
  const params = args as { symbol?: string; filePath?: string; depth?: number };
  if (!params || (!params.symbol && !params.filePath)) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Invalid arguments: Either "symbol" or "filePath" must be provided.'
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
    const candidates = await graphAdapter.getImpactContext(
      params.symbol,
      params.filePath,
      params.depth ?? 2
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            target: params.symbol || params.filePath,
            depth: params.depth ?? 2,
            affectedComponentsCount: candidates.length,
            impactCandidates: candidates
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
          text: `Error analyzing impact context: ${err instanceof Error ? err.message : String(err)}`
        }
      ]
    };
  }
}
