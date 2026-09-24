import { z } from 'zod';
import { ContextOrchestrator } from '@context-broker/orchestrator';
import { MemoryAdapter } from '@context-broker/adapter-memory';

// ----- Argument schemas -----

const RecordDecisionArgsSchema = z.object({
  title: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string().min(1),
  rejectedAlternatives: z.array(z.string()).optional().default([]),
  affectedComponents: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([])
});

const RecallDecisionsArgsSchema = z.object({
  query: z.string().min(1),
  components: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional().default(10)
});

export const recordDecisionToolDefinition = {
  name: 'record_decision',
  description: 'Explicitly persist a reviewed architectural decision, rationale, and rejected alternatives into durable repository memory.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short, descriptive title of the architectural decision'
      },
      decision: {
        type: 'string',
        description: 'What was decided'
      },
      rationale: {
        type: 'string',
        description: 'Why this option was chosen'
      },
      rejectedAlternatives: {
        type: 'array',
        items: { type: 'string' },
        description: 'Alternative approaches that were considered and rejected'
      },
      affectedComponents: {
        type: 'array',
        items: { type: 'string' },
        description: 'Modules, repositories, or services impacted by this decision'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Categorization tags (e.g. ["auth", "database", "mcp"])'
      }
    },
    required: ['title', 'decision', 'rationale']
  }
};

export const recallDecisionsToolDefinition = {
  name: 'recall_decisions',
  description: 'Retrieve durable architectural decisions, historical rationale, and rejected alternatives matching keywords, components, or tags.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Keywords or natural language query describing the architectural topic'
      },
      components: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by affected components or modules'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of decisions to return (default: 10)'
      }
    },
    required: ['query']
  }
};

export async function handleRecordDecision(
  orchestrator: ContextOrchestrator,
  args: unknown
) {
  const parsed = RecordDecisionArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Invalid record_decision arguments: ${parsed.error.message}`
        }
      ]
    };
  }

  const params = parsed.data;

  const memoryAdapter = orchestrator.getRegistry().get('memory') as MemoryAdapter | undefined;
  if (!memoryAdapter) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Memory adapter is not registered or is currently disabled.'
        }
      ]
    };
  }

  try {
    const record = await memoryAdapter.recordDecision({
      title: params.title,
      decision: params.decision,
      rationale: params.rationale,
      rejectedAlternatives: params.rejectedAlternatives,
      affectedComponents: params.affectedComponents,
      author: 'AI Agent / User',
      tags: params.tags
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message: `Decision successfully persisted as ${record.id}`,
            decisionRecord: record
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
          text: `Failed to record decision: ${err instanceof Error ? err.message : String(err)}`
        }
      ]
    };
  }
}

export async function handleRecallDecisions(
  orchestrator: ContextOrchestrator,
  args: unknown
) {
  const parsed = RecallDecisionsArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Invalid recall_decisions arguments: ${parsed.error.message}`
        }
      ]
    };
  }

  const params = parsed.data;

  const memoryAdapter = orchestrator.getRegistry().get('memory') as MemoryAdapter | undefined;
  if (!memoryAdapter) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Memory adapter is not registered or is currently disabled.'
        }
      ]
    };
  }

  try {
    const candidates = await memoryAdapter.recallDecisions(
      params.query,
      params.components,
      params.tags,
      params.limit
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query: params.query,
            totalRetrieved: candidates.length,
            decisions: candidates
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
          text: `Failed to recall decisions: ${err instanceof Error ? err.message : String(err)}`
        }
      ]
    };
  }
}
