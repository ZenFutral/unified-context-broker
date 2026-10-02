<!-- CONTEXT_BROKER_START -->
## Context Broker Retrieval Engine (Embedded)

This codebase embeds a self-contained context engine at `./unified-context-broker/`.
When inspecting, searching, navigating, or refactoring this repository, prioritize the embedded broker over brute-force file reads.

### Direct Retrieval Commands (Zero-Daemon CLI)

- **Hybrid Search:** `node ./packages/orchestrator/bin/cli.js search "<query>" --budget 8000` (or `node ./unified-context-broker/packages/orchestrator/bin/cli.js`)
- **Symbol Lookup:** `node ./packages/orchestrator/bin/cli.js symbol <name> [--file <path>]` (or `node ./unified-context-broker/packages/orchestrator/bin/cli.js`)
- **Repository Structure Digest:** `node ./packages/orchestrator/bin/cli.js digest`
- **Architectural Memory Recall:** `node ./packages/orchestrator/bin/cli.js memory recall "<query>"`
- **Persist Decision:** `node ./packages/orchestrator/bin/cli.js memory record --title "<title>" --decision "<decision>" --rationale "<rationale>"`
- **Engine Diagnostics:** `node ./packages/orchestrator/bin/cli.js --health`
- **Safe Source Mutation:** `node ./packages/orchestrator/bin/cli.js replace <file> --find "<target>" --replace "<replacement>"`

### MCP Integration (IDE & Multi-Agent Swarms)

- **MCP Server Binary:** `node ./apps/mcp-server/dist/bundle.js` (or `./unified-context-broker/apps/mcp-server/dist/bundle.js`)
- **Canonical Tools:** `search_context`, `get_symbol_context`, `lookup_symbol`, `get_impact_context`, `analyze_impact`, `get_repository_map`, `get_repo_map`, `recall_decisions`, `record_decision`, `explain_context`, `backend_health`, `check_health`, `search_and_replace`, `replace_in_file`, `patch_file`
<!-- CONTEXT_BROKER_END -->
