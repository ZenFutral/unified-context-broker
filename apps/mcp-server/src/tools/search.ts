import { ContextOrchestrator } from '@context-broker/orchestrator';
import { ContextQuerySchema } from '@context-broker/contracts';

export const searchContextToolDefinition = {
  name: 'search_context',
  description: 'Execute ranked, source-grounded context search across all active repository adapters within a token budget.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query or natural language question'
      },
      workspaceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Target workspace root directories'
      },
      tokenBudget: {
        type: 'number',
        description: 'Maximum token budget for returned candidate context (default: 4000)'
      },
      intent: {
        type: 'string',
        enum: [
          'exact_lookup',
          'semantic_discovery',
          'dependency_analysis',
          'impact_analysis',
          'implementation_search',
          'documentation_search',
          'decision_recall',
          'hybrid'
        ],
        description: 'Explicit query intent override (optional)'
      },
      freshnessRequirement: {
        type: 'string',
        enum: ['live', 'indexed', 'either'],
        description: 'Freshness constraint for results'
      }
    },
    required: ['query', 'workspaceIds']
  }
};

export async function handleSearchContext(
  orchestrator: ContextOrchestrator,
  args: unknown
) {
  const queryId = `query-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const parsed = ContextQuerySchema.safeParse({
    ...(typeof args === 'object' && args !== null ? args : {}),
    queryId
  });

  if (!parsed.success) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Invalid search_context arguments: ${parsed.error.message}`
        }
      ]
    };
  }

  const resultPackage = await orchestrator.executeQuery(parsed.data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(resultPackage, null, 2)
      }
    ]
  };
}
