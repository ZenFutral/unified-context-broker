import { ContextOrchestrator } from '@context-broker/orchestrator';
import { SearchReplaceRequestSchema } from '@context-broker/contracts';

export const searchAndReplaceToolDefinition = {
  name: 'search_and_replace',
  description: 'Safely execute atomic search and replace file edits with boundary containment, secret detection, and dry-run preview.',
  inputSchema: {
    type: 'object',
    properties: {
      targetFile: {
        type: 'string',
        description: 'Relative or absolute path to the target file to modify'
      },
      replacements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            targetContent: {
              type: 'string',
              description: 'Exact string or regex pattern to search for'
            },
            replacementContent: {
              type: 'string',
              description: 'Replacement content'
            },
            startLine: {
              type: 'number',
              description: 'Optional 1-indexed start line boundary'
            },
            endLine: {
              type: 'number',
              description: 'Optional 1-indexed end line boundary'
            },
            allowMultiple: {
              type: 'boolean',
              description: 'Allow replacing multiple occurrences without ambiguity error (default: false)'
            }
          },
          required: ['targetContent', 'replacementContent']
        },
        description: 'Array of replacement chunks to apply'
      },
      find: {
        type: 'string',
        description: 'Shorthand target string for single-chunk replacement'
      },
      replace: {
        type: 'string',
        description: 'Shorthand replacement string for single-chunk replacement'
      },
      dryRun: {
        type: 'boolean',
        description: 'When true, compute unified diff and token delta without writing to disk (default: false)'
      },
      isRegex: {
        type: 'boolean',
        description: 'Treat targetContent as regular expression (default: false)'
      },
      matchCase: {
        type: 'boolean',
        description: 'Match case sensitively (default: true)'
      },
      workspaceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Target workspace roots'
      }
    },
    required: ['targetFile']
  }
};

export async function handleSearchAndReplace(
  orchestrator: ContextOrchestrator,
  rawArgs: unknown
) {
  const args = typeof rawArgs === 'object' && rawArgs !== null ? (rawArgs as Record<string, any>) : {};

  // Normalize single-chunk shorthand (find/replace) into replacements array if needed
  let replacements = args['replacements'];
  if (!Array.isArray(replacements) || replacements.length === 0) {
    const target = args['targetContent'] ?? args['find'];
    const rep = args['replacementContent'] ?? args['replace'];

    if (typeof target === 'string' && typeof rep === 'string') {
      replacements = [
        {
          targetContent: target,
          replacementContent: rep,
          startLine: args['startLine'],
          endLine: args['endLine'],
          allowMultiple: Boolean(args['allowMultiple'])
        }
      ];
    }
  }

  const normalized = {
    ...args,
    replacements
  };

  const parsed = SearchReplaceRequestSchema.safeParse(normalized);
  if (!parsed.success) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Invalid search_and_replace arguments: ${parsed.error.message}`
        }
      ]
    };
  }

  try {
    const result = await orchestrator.executeSearchReplace(parsed.data);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Search and replace failed: ${errMsg}`
        }
      ]
    };
  }
}
