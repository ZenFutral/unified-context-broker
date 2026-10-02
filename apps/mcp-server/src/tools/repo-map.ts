import { ContextOrchestrator } from '@context-broker/orchestrator';

export const getRepositoryMapToolDefinition = {
  name: 'get_repository_map',
  description: 'Generate a concise structural overview of key modules, directories, and entry points in the workspace.',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Target workspace directories to summarize'
      }
    }
  }
};

export async function handleGetRepositoryMap(
  orchestrator: ContextOrchestrator,
  args: unknown
) {
  const params = (args || {}) as { workspaceIds?: string[] };

  try {
    const pkg = await orchestrator.executeRepositoryMap({
      workspaceIds: params.workspaceIds
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'Repository structural map generated successfully.',
            modulesCount: pkg.candidates.length,
            entries: pkg.candidates,
            estimatedTokens: pkg.estimatedTokens
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
          text: `Error generating repository map: ${err instanceof Error ? err.message : String(err)}`
        }
      ]
    };
  }
}
