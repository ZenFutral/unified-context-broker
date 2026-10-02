export const DEFAULT_CONTEXT_BROKER_RULE = `# Context Broker MCP — Directive & Discovery Rules

**MANDATORY:** Prioritize \`context-broker\` MCP tools over raw file reads or unbounded searches.

## Directives
1. **Search Context:** ALWAYS call \`search_context(query)\` before searching files. Never run unbounded file greps.
2. **Symbol Lookup:** ALWAYS call \`get_symbol_context(symbol)\` to view definitions/signatures instead of loading full files.
3. **Blast Radius Check:** ALWAYS call \`get_impact_context(symbol)\` before refactoring or removing code.
4. **Architecture Map:** ALWAYS call \`get_repository_map()\` to explore project layout.
5. **Architectural Memory:** ALWAYS call \`recall_decisions(query)\` before making structural changes, and \`record_decision(title, decision, rationale)\` after architectural consensus.
6. **Provider Health:** Call \`backend_health()\` to verify provider status.
7. **Safe Mutation:** Use \`search_and_replace(path, find, replace)\` for atomic file edits.

## Quick Lookup Table
| Intent | Tool |
| :--- | :--- |
| Find code / concepts | \`search_context\` |
| Inspect symbol definition | \`get_symbol_context\` |
| Check change impact | \`get_impact_context\` |
| Overview codebase | \`get_repository_map\` |
| Check / record ADRs | \`recall_decisions\` / \`record_decision\` |
| Edit files safely | \`search_and_replace\` |

## Forbidden
- NO reading entire files for single symbol lookups.
- NO modifying shared APIs without \`get_impact_context\`.
- NO ignoring recorded ADRs.
`;

export const CONTEXT_BROKER_RULE_CONTENT = DEFAULT_CONTEXT_BROKER_RULE;

