import { ContextOrchestrator } from '@context-broker/orchestrator';

export const backendHealthToolDefinition = {
  name: 'backend_health',
  description: 'Inspect the operational health, version, index state, and item counts of all registered Context Broker backend adapters.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
};

export async function handleBackendHealth(orchestrator: ContextOrchestrator) {
  const healthReport = await orchestrator.getRegistry().checkAllHealth();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(healthReport, null, 2)
      }
    ]
  };
}
