import { ContextOrchestrator } from '@context-broker/orchestrator';
import { CodeGraphContextAdapter } from '@context-broker/adapter-codegraphcontext';

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
  _args: unknown
) {
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
    const mapCandidates = await graphAdapter.getRepositoryMap();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'Repository structural map generated successfully.',
            modulesCount: mapCandidates.length,
            entries: mapCandidates
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
