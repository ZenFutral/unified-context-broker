<!-- CONTEXT_BROKER_START -->
## Context Broker Retrieval Engine

Context Broker provides ultra-fast hybrid retrieval (lexical + vector + AST code graph + git freshness) and durable memory.
When inspecting, navigating, or modifying this repository, prioritize calling the Context Broker MCP tools over brute-force file reads.

### Canonical MCP Tools
- `search_context(query, tokenBudget?)` — Hybrid search across code, docs, and git changes.
- `get_symbol_context(symbol)` — Exact symbol definition, signature, callers, and references.
- `get_impact_context(symbol)` — Blast radius and downstream callers before refactoring.
- `get_repository_map()` — High-level architecture map and entry points.
- `recall_decisions(query)` — Historical architectural decision memory (ADRs).
- `record_decision(title, decision, rationale)` — Persist architectural choices to durable memory.
- `backend_health()` — Health diagnostics across all 5 adapters (comP, CodeGraph, Vector, Git, Memory).
- `search_and_replace(path, find, replace)` — Safe atomic AST-verified mutation with secret scrubbing.

### MCP Server Location
`node "c:/Users/Zen/.antigravity-ide/extensions/unified-context-broker.unified-context-broker-0.3.2/server/server.mjs"`
<!-- CONTEXT_BROKER_END -->
