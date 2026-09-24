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

Viewed README.md:1-145

Here is the expanded **Feature Set Outline** structured by functional capability domains:

---

# Unified Context Broker: Feature Set Outline

### 1. Multi-Provider Hybrid Retrieval Engine
* **Lexical & Documentation Search ([`adapters/comp`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/adapters/comp)):**
  * Fast BM25 keyword matching across codebase files and documentation.
  * Markdown and documentation chunking with header-aware context extraction.
* **Semantic Vector Search ([`adapters/vector`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/adapters/vector)):**
  * Local embedding-based vector similarity search (LanceDB / ONNX) for natural language queries.
  * Semantic concept discovery for intent-based code search without exact keyword matches.
* **Query Classification & Execution Planning ([`packages/orchestrator`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/packages/orchestrator)):**
  * Automatic query intent classification (symbol lookup, architectural query, conceptual search).
  * Concurrent multi-adapter retrieval execution with per-provider timeouts and isolated error boundaries for graceful degradation.

---

### 2. Structural Code Intelligence & Graph Analysis
* **Symbol & AST Resolution ([`adapters/codegraphcontext`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/adapters/codegraphcontext)):**
  * Precise symbol definition, type signature, and docstring resolution.
  * Hierarchical caller/callee trees and cross-file reference tracking.
* **Graph Neighborhood Expansion:**
  * Contextual neighborhood traversal using distance decay scoring ($1 / (1 + \alpha \cdot d)$) to include relevant call-chain neighbors.
* **Impact & Blast Radius Analysis:**
  * Upstream and downstream dependency mapping to analyze the blast radius of changes to symbols or files.
* **Repository Architecture Mapping:**
  * High-level codebase structure, module boundaries, and entry-point topology synthesis.

---

### 3. Intelligent Ranking, Deduplication & Budget Packing
* **Spatial Candidate Deduplication ([`packages/ranking`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/packages/ranking)):**
  * Overlapping line-range merging and containment suppression to prevent duplicate token consumption.
* **Staged Rank Fusion:**
  * Multi-source hybrid ranking using Reciprocal Rank Fusion (RRF) and Weighted Linear Scoring (combining BM25, vector similarity, graph proximity, and recency).
* **Token Budget Knapsack Packing:**
  * Greedy knapsack packing algorithm that strictly honors client token limits while maximizing context density.

---

### 4. Security, Isolation & Access Governance
* **Workspace Boundary Guard ([`packages/security`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/packages/security)):**
  * Path jail enforcement and symlink verification to prevent directory traversal and unauthorized file access.
* **Real-time Secret Scrubber:**
  * Regex-based automatic detection and redaction of API keys, bearer tokens, passwords, and private PEM certificates from emitted context.
* **Permission & RBAC Scope Validation:**
  * Strict distinction between read-only inspection tools and state-mutating operations.
  * Configurable exclusion rules via [exclusions.json](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/config/policies/exclusions.json).

---

### 5. Provenance, Freshness & Explainability
* **Git Recency & Diff Awareness ([`adapters/git`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/adapters/git)):**
  * Freshness scoring factoring in commit history, active working tree diffs, and file churn.
* **Cryptographic Source Grounding ([`packages/provenance`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/packages/provenance)):**
  * SHA-256 chunk fingerprinting for verifiable context origin.
  * IDE-clickable citation generation (`file:///path#Lstart-Lend`).
* **Score Explainer Engine:**
  * Transparent telemetry revealing exact score breakdowns (BM25, vector, graph distance, recency) behind ranked results.

---

### 6. Durable Architectural Memory
* **Decision Tracking (ADRs) ([`adapters/memory`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/adapters/memory)):**
  * Persistent storage and semantic recall of Architectural Decision Records, historical constraints, and technical rationale.
  * Structured recording of new decisions during agent workflows.

---

### 7. Unified Protocol & Client Integration Surface
* **The 8 Unified MCP Tools:**
  * Retrieval: `search_context`, `get_symbol_context`, `get_impact_context`, `get_repository_map`.
  * Memory: `recall_decisions`, `record_decision`.
  * Telemetry & Inspection: `explain_context`, `backend_health`.
* **Client Ecosystem Support:**
  * **AntiGravity IDE:** Native rule injection (`.agents/rules/context-broker.md`) prioritizing broker tools over brute-force file reads.
  * **VS Code Companion Extension ([`apps/vscode-extension`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/apps/vscode-extension)):** One-click workspace initialization, status bar health monitor, and Command Palette actions.
  * **Broad MCP Support:** Compatibility with Cursor AI, Claude Desktop, Continue, Cline, and stdio/SSE hosts.
* **Codebase Scaffolding & CLI:**
  * `init` command, PowerShell, and npx scripts to scaffold policies and rules into any target workspace.

---

### 8. Governance, Containerization & Verification Swarm
* **Upstream Patch Governance ([`upstream/`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/upstream)):**
  * Upstream manifest tracking with automated patch ledger validation linter.
* **4-Agent Verification Swarm ([`tests/`](file:///c:/Users/ZenFutral/OneDrive%20-%20Platform%20Accounting%20Group-Subs/Documents/context-broker/tests)):**
  * Automated suites for contract compliance, 8-case golden retrieval benchmarks, security penetration attacks, and chaos failure injection.
* **Packaging & Containerization:**
  * Standalone CLI binary, Dockerfile deployment, and automated CI/CD marketplace publishing.
---

## CI/CD & Publishing

- **Continuous Integration:** Automated GitHub Actions run across Ubuntu and Windows (`.github/workflows/ci.yml`).
- **Open VSX & VS Code Marketplace:** Automated package and release workflow (`.github/workflows/publish-extension.yml`).
- **Publishing Instructions:** See [PUBLISHING.md](PUBLISHING.md) for full step-by-step instructions on pushing to GitHub, claiming Open VSX namespaces, setting up PAT secrets, and releasing.

## License

This project is licensed under the [MIT License](LICENSE).
