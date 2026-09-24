import { QueryIntent, SourceBackend } from '@context-broker/contracts';

export interface PlannedRetrievalStep {
  provider: SourceBackend;
  operation: 'lexical_search' | 'semantic_search' | 'symbol_lookup' | 'impact_analysis' | 'memory_recall' | 'git_status';
  purpose: string;
}

export interface RetrievalExecutionPlan {
  intent: QueryIntent;
  steps: PlannedRetrievalStep[];
}

export class RetrievalPlanner {
  /**
   * Plans the sequence of provider invocations based on query intent.
   */
  createPlan(intent: QueryIntent, _queryText: string): RetrievalExecutionPlan {
    switch (intent) {
      case 'exact_lookup':
        return {
          intent,
          steps: [
            {
              provider: 'codegraphcontext',
              operation: 'symbol_lookup',
              purpose: 'Resolve exact symbol definition, line ranges, and references'
            },
            {
              provider: 'comp',
              operation: 'lexical_search',
              purpose: 'Locate exact textual occurrences across files'
            }
          ]
        };

      case 'dependency_analysis':
        return {
          intent,
          steps: [
            {
              provider: 'codegraphcontext',
              operation: 'symbol_lookup',
              purpose: 'Traverse caller and callee hierarchy graphs'
            },
            {
              provider: 'comp',
              operation: 'lexical_search',
              purpose: 'Retrieve surrounding implementation context'
            }
          ]
        };

      case 'impact_analysis':
        return {
          intent,
          steps: [
            {
              provider: 'codegraphcontext',
              operation: 'impact_analysis',
              purpose: 'Trace recursive downstream dependents and callers'
            },
            {
              provider: 'comp',
              operation: 'lexical_search',
              purpose: 'Locate component occurrences across documentation and code'
            },
            {
              provider: 'vector',
              operation: 'semantic_search',
              purpose: 'Identify conceptually linked components'
            }
          ]
        };

      case 'semantic_discovery':
      case 'implementation_search':
        return {
          intent,
          steps: [
            {
              provider: 'vector',
              operation: 'semantic_search',
              purpose: 'Locate conceptually similar implementations and patterns'
            },
            {
              provider: 'comp',
              operation: 'lexical_search',
              purpose: 'Match keyword terms and retrieve complete file chunks'
            }
          ]
        };

      case 'documentation_search':
        return {
          intent,
          steps: [
            {
              provider: 'comp',
              operation: 'lexical_search',
              purpose: 'Retrieve Markdown, docstrings, and specifications'
            },
            {
              provider: 'vector',
              operation: 'semantic_search',
              purpose: 'Match conceptual documentation topics'
            }
          ]
        };

      case 'decision_recall':
        return {
          intent,
          steps: [
            {
              provider: 'memory',
              operation: 'memory_recall',
              purpose: 'Retrieve durable architectural decisions and rationale'
            },
            {
              provider: 'comp',
              operation: 'lexical_search',
              purpose: 'Search ADR markdown files and commit notes'
            }
          ]
        };

      case 'hybrid':
      default:
        return {
          intent: 'hybrid',
          steps: [
            {
              provider: 'comp',
              operation: 'lexical_search',
              purpose: 'BM25 full-text keyword search'
            },
            {
              provider: 'vector',
              operation: 'semantic_search',
              purpose: 'Dense semantic code and documentation retrieval'
            },
            {
              provider: 'codegraphcontext',
              operation: 'symbol_lookup',
              purpose: 'Graph symbol matching and relationship extraction'
            }
          ]
        };
    }
  }
}
