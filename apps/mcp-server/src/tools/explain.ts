import { ContextOrchestrator } from '@context-broker/orchestrator';
import { ContextExplainer } from '@context-broker/provenance';
import { ContextCandidate } from '@context-broker/contracts';

export const explainContextToolDefinition = {
  name: 'explain_context',
  description: 'Provide a transparent score breakdown, retrieval rationale, and provenance audit for retrieved context candidates.',
  inputSchema: {
    type: 'object',
    properties: {
      candidates: {
        type: 'array',
        description: 'Array of ContextCandidate objects to inspect and explain'
      }
    },
    required: ['candidates']
  }
};

export async function handleExplainContext(
  _orchestrator: ContextOrchestrator,
  args: unknown
) {
  const params = args as { candidates?: ContextCandidate[] };
  if (!params || !Array.isArray(params.candidates)) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Invalid arguments: "candidates" array is required.'
        }
      ]
    };
  }

  const explainer = new ContextExplainer();
  const explanations = explainer.explainAll(params.candidates);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          totalExplained: explanations.length,
          explanations
        }, null, 2)
      }
    ]
  };
}
