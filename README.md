# Unified Context Broker (MCP)

A thin, local-first, backend-neutral Model Context Protocol (MCP) context broker that serves ranked, source-grounded code and documentation context to AI agents.

## Architecture

```
Agent / IDE / VS Code Extension
    |
    v (stdio / SSE / JSON-RPC)
+-------------------------------------------------------------------------------+
|                          Unified MCP Context Broker                           |
|  - MCP Server Surface (@modelcontextprotocol/sdk)                             |
|  - Query Classification & Retrieval Planner                                   |
|  - Multi-Provider Parallel Executor & Error Boundary                          |
|  - Spatial Candidate Deduplication & Overlap Merging                          |
|  - Workspace Boundary Guard (jail enforcement & exclusion rules)              |
|  - Secret Scrubber (regex detection & redaction for keys/tokens/PEMs)          |
|  - Permission Policy & RBAC Scope Validator                                   |
|  - Graph Neighborhood Expansion (distance decay: 1 / (1 + α·d))               |
|  - Staged Rank Fusion (Weighted Linear Scoring & Reciprocal Rank Fusion)       |
|  - Token Budget Manager & Greedy Knapsack Packing                             |
|  - Provenance Layer (SHA-256 Hashing, Clickable Citations, Explainer)         |
+---+-------------------+-------------------+-------------------+---------------+
    |                   |                   |                   |               |
    v                   v                   v                   v               v
+----------+   +-------------------+   +----------+        +----------+   +------------+
|   comP   |   | CodeGraphContext  |   |  Vector  |        |   Git    |   |   Memory   |
| Adapter  |   |     Adapter       |   | Adapter  |        | Adapter  |   |  Adapter   |
+----+-----+   +--------+----------+   +----+-----+        +----+-----+   +-----+------+
     |                  |                   |                   |               |
     v                  v                   v                   v               v
 [Rust/BM25/        [Tree-sitter/       [Local Vector       [Local Git      [SQLite /
  Docs/SQLite]       SCIP / Graph]       LanceDB/ONNX]       Repository]     JSON-L]
```

## Monorepo Layout

```text
context-broker/
├── apps/
│   ├── mcp-server/                   # MCP stdio & SSE server application & CLI binary
│   └── vscode-extension/             # VS Code companion client extension
├── packages/
│   ├── contracts/                    # Canonical Zod schemas and TypeScript interfaces
│   ├── orchestrator/                 # Planner, parallel executor, classifier, budgeter
│   ├── ranking/                      # Spatial deduplicator, graph expansion, rank fusion
│   ├── provenance/                   # SHA-256 hashing, markdown citations, score explainer
│   └── security/                     # Boundary jail, secret scrubber, scope validator
├── adapters/
│   ├── comp/                         # Adapter for comP (BM25, document extraction)
│   ├── codegraphcontext/             # Adapter for CodeGraphContext (symbols, call graphs)
│   ├── vector/                       # Adapter for local embeddings & vector store
│   ├── git/                          # Adapter for Git state, diffs, blame, freshness
│   └── memory/                       # Adapter for durable decisions (ADRs) & facts
├── config/
│   ├── defaults/broker.json          # Default scoring weights & adapter timeouts
│   └── policies/exclusions.json      # Secret scrubbing patterns & path exclusions
├── upstream/
│   ├── manifests/upstream.json       # Version, commit, license & capability registry
│   ├── patches/                      # Patch ledger documentation & overlays
│   ├── scripts/validate-patches.ts   # Patch ledger governance linter
│   └── compatibility/                # Automated upstream compatibility test harness
├── tests/                            # 4-Agent Verification Swarm
│   ├── contract/                     # Provider contract compliance suite
│   ├── retrieval/                    # 8-Case golden benchmark suite
│   ├── security/                     # Directory traversal & secret exfiltration attacks
│   └── failure/                      # Chaos injection & graceful degradation tests
└── .github/workflows/                # Upstream compatibility & CI pipelines
```

## The 8 Unified MCP Tools

| Tool Name | Operation Type | Primary Purpose |
| :--- | :--- | :--- |
| `search_context` | Read-only | Multi-engine hybrid ranked retrieval adhering strictly to token budget |
| `get_symbol_context` | Read-only | Exact symbol definitions, docstrings, references, and callers |
| `get_impact_context` | Read-only | Upstream and downstream blast radius analysis for symbols or files |
| `get_repository_map` | Read-only | Architectural overview of workspace modules and entry points |
| `recall_decisions` | Read-only | Retrieve durable architectural decisions (ADRs), rationale, and alternatives |
| `record_decision` | Mutation | Explicitly persist a reviewed architectural decision into durable memory |
| `explain_context` | Read-only | Inspect transparent scoring breakdowns, rationale, and provenance traces |
| `backend_health` | Read-only | Operational status, version, and indexed counts across all 5 adapters |

## Client Environments & IDE Configuration

### Primary / Default Environments (Official Support)

#### 1. AntiGravity IDE (Default)
The broker is pre-configured for the Antigravity Agentic IDE via workspace customizations in [`.agents/mcp_config.json`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/ContextMCP/.agents/mcp_config.json):
```json
{
  "mcpServers": {
    "context-broker": {
      "command": "node",
      "args": ["c:/Users/ZenFutral/OneDrive - Platform Accounting Group-Subs/Documents/ContextMCP/context-broker/apps/mcp-server/dist/index.js"],
      "env": { "CONTEXT_BROKER_MOCK": "true" }
    }
  }
}
```
- **Rule Enforcement (`.agents/rules/context-broker.md`):** Automatically populates an authoritative agent rule that forces all AI agents to use the 8 Context Broker MCP tools (hybrid search, symbol lookup, blast radius impact, and architectural memory) instead of raw grep or massive file reads.

#### 2. Visual Studio Code (Default)
Pre-configured via workspace configuration in [`.vscode/mcp.json`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/ContextMCP/.vscode/mcp.json) and supported by the companion extension in [`apps/vscode-extension/`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/ContextMCP/context-broker/apps/vscode-extension):
- **Automatic Initialization:** On extension activation, automatically detects if the workspace has `context-broker.md` and auto-populates it.
- **Command Palette:** Run `Context Broker: Initialize / Populate Workspace Rules (context-broker.md)` anytime to scaffold or refresh rules.
- **Status Bar & Menus:** Interactive quick pick with one-click workspace initialization and live telemetry.
- **AI Tool Calling:** Native discovery for GitHub Copilot, Continue, and Cline.

### Initializing Into Any Codebase
You can initialize Context Broker and auto-populate `context-broker.md` into any new or existing codebase in three ways:
1. **VS Code / AntiGravity IDE Extension:** Automatically runs upon opening the folder, or trigger `Context Broker: Initialize / Populate Workspace Rules (context-broker.md)` from the Command Palette.
2. **CLI Initialization:** Run `node apps/mcp-server/dist/index.js init [targetPath]` or `npx context-broker-mcp init [targetPath]`.
3. **PowerShell Script:** Run `powershell -ExecutionPolicy Bypass -File scripts\init-codebase.ps1 -Target "C:\path\to\codebase"`.

---

### Non-Default / Alternative Clients (Secondary)

* **Cursor AI:** Pre-configured via [`.cursor/mcp.json`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/ContextMCP/.cursor/mcp.json).
* **Claude Desktop:** Copy snippet from [`mcp-client-config.json`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/ContextMCP/context-broker/mcp-client-config.json) to `%APPDATA%\Claude\claude_desktop_config.json`.
* **Generic CLI / Stdio Host:** Run `start-broker.ps1` or `start-broker.cmd` directly.

## Completed Milestones (1 - 6)

- **Milestone 1: Core Foundation & comP Adapter** — Monorepo setup, canonical typed contracts (`packages/contracts`), comP adapter (`adapters/comp`), dynamic registry, and MCP server shell.
- **Milestone 2: CodeGraphContext Adapter & Structural Intelligence** — Graph adapter (`adapters/codegraphcontext`), neighborhood expansion (`GraphExpansionEngine`), and structural MCP tools (`get_symbol_context`, `get_impact_context`, `get_repository_map`).
- **Milestone 3: Vector Adapter, Staged Rank Fusion & Token Budget Packing** — Local vector adapter (`adapters/vector`), spatial deduplicator (`SpatialDeduplicator`), rank fusion (`RankFusionEngine`), and hybrid search pipeline.
- **Milestone 4: Git & Memory Adapters, Provenance & Freshness** — Git adapter (`adapters/git`), durable memory adapter (`adapters/memory`), provenance layer (`packages/provenance`), and full 8-tool MCP surface.
- **Milestone 5: Security Layer & Verification Swarm Harness** — Workspace boundary guard (`WorkspaceBoundaryGuard`), regex secret scrubber (`SecretScrubber`), permission validator, and 4-agent verification swarm (`tests/`).
- **Milestone 6: Upstream Maintenance Automation, Patch Ledger & Packaging** — Patch ledger governance linter, automated compatibility harness, Dockerfile containerization, CLI binary wrapper, and VS Code extension client.

---

## CI/CD & Publishing

- **Continuous Integration:** Automated GitHub Actions run across Ubuntu and Windows (`.github/workflows/ci.yml`).
- **Open VSX & VS Code Marketplace:** Automated package and release workflow (`.github/workflows/publish-extension.yml`).
- **Publishing Instructions:** See [PUBLISHING.md](PUBLISHING.md) for full step-by-step instructions on pushing to GitHub, claiming Open VSX namespaces, setting up PAT secrets, and releasing.

## License

This project is licensed under the [MIT License](LICENSE).
