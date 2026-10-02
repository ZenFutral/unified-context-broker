# Unified Context Broker (MCP)

A thin, local-first, backend-neutral Model Context Protocol (MCP) context broker that serves ranked, source-grounded code and documentation context to AI agents.

## Architecture

```
Agent / IDE / VS Code Extension / CLI
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
|  - Safe Mutation Engine (Atomic Search/Replace, Dry-Run, Secret Check)       |
|  - Telemetry Ring Buffer & Companion GUI Inspector (:4100)                    |
+---+-------------------+-------------------+-------------------+---------------+
    |                   |                   |                   |               |
    v                   v                   v                   v               v
+----------+   +-------------------+   +----------+        +----------+   +------------+
| Lexical  |   |     CodeGraph     |   |  Vector  |        |   Git    |   |   Memory   |
| Adapter  |   |      Adapter      |   | Adapter  |        | Adapter  |   |  Adapter   |
+----+-----+   +--------+----------+   +----+-----+        +----+-----+   +-----+------+
     |                  |                   |                   |               |
     v                  v                   v                   v               v
 [Rust/BM25/        [Tree-sitter/       [Local Vector       [Local Git      [Durable
  Docs/SQLite]       SCIP / Graph]       LanceDB/ONNX]       Repository]     JSON-L/ADR]
```

## Monorepo Layout

```text
unified-context-broker/
├── apps/
│   ├── mcp-server/                   # MCP stdio/SSE server, zero-dependency bundle & CLI binary
│   ├── vscode-extension/             # VS Code companion client extension
│   └── companion-gui/                # Localhost telemetry visualizer & payload inspector
├── packages/
│   ├── contracts/                    # Canonical Zod schemas and TypeScript interfaces
│   ├── orchestrator/                 # Planner, parallel executor, classifier, budgeter
│   ├── ranking/                      # Spatial deduplicator, graph expansion, rank fusion
│   ├── provenance/                   # SHA-256 hashing, markdown citations, score explainer
│   ├── security/                     # Boundary jail, secret scrubber, scope validator
│   ├── adapter-lexical/              # BM25 keyword search, file-level chunking, doc indexing
│   ├── adapter-codegraph/            # AST symbol resolution, call graphs & blast-radius analysis
│   ├── adapter-vector/               # Local embeddings & semantic vector similarity
│   ├── adapter-git/                  # Git state, working tree diffs, churn freshness
│   └── adapter-memory/               # Durable architectural decision records (ADRs)
├── config/
│   ├── defaults/broker.json          # Default scoring weights & adapter timeouts
│   └── policies/exclusions.json      # Secret scrubbing patterns & path exclusions
├── tests/                            # 4-Agent Verification Swarm
│   ├── contract/                     # Provider contract compliance suite
│   ├── retrieval/                    # 8-Case golden benchmark suite
│   ├── security/                     # Directory traversal & secret exfiltration attacks
│   └── failure/                      # Chaos injection & graceful degradation tests
└── .data/                            # Conconfined local runtime storage (zero host pollution)
    ├── memory/decisions.jsonl        # Durable ADR storage
    └── telemetry/events.jsonl        # Ring buffer query & mutation events
```

## The 13 Unified MCP Tools

The Context Broker exposes 13 tools divided into core retrieval, structural analysis, architectural memory, transparent inspection, and safe source mutation:

| Tool Name | Aliases | Operation Type | Primary Purpose |
| :--- | :--- | :--- | :--- |
| `search_context` | — | Read-only | Multi-engine hybrid ranked retrieval strictly adhering to token budget |
| `get_symbol_context` | `lookup_symbol` | Read-only | Exact symbol definitions, docstrings, type signatures, and callers |
| `get_impact_context` | `analyze_impact` | Read-only | Upstream and downstream blast radius analysis for symbols or files |
| `get_repository_map` | `get_repo_map` | Read-only | Architectural overview of workspace modules and entry points |
| `recall_decisions` | — | Read-only | Retrieve durable architectural decisions (ADRs), rationale, and alternatives |
| `record_decision` | — | Mutation | Explicitly persist a reviewed architectural decision into durable memory |
| `explain_context` | — | Read-only | Inspect transparent scoring breakdowns, rationale, and provenance traces |
| `backend_health` | `check_health` | Read-only | Operational status, version, and indexed counts across all 5 adapters |
| `search_and_replace` | `replace_in_file`, `patch_file` | Mutation | Atomic exact-match dry-run verified file replacement with boundary enforcement and secret scrubbing |

---

## Single External Indicator Mandate (`AGENTS.md`)

Context Broker adheres strictly to the **Single External Indicator Mandate** and **Zero Host-Root Pollution** philosophy:

1. **Single Point of Presence:** When Context Broker is embedded or initialized in any host repository, it leaves only a **single** indicator file in the workspace root: [`AGENTS.md`](./AGENTS.md).
2. **Zero Host Pollution:** All persistent databases, vector caches, telemetry logs, and durable ADR storage are strictly confined inside `.data/` within the broker's own directory (or designated OS user cache). No hidden dotfiles or cache directories are ever created in the host repository root.
3. **Agent Guidance:** `AGENTS.md` instructs all AI coding assistants (Antigravity, Cursor, Windsurf, Copilot, Claude) to prioritize Context Broker's CLI or MCP tools over brute-force filesystem scans or unbounded grep queries.

---

## Client Environments & IDE Configuration

### Standalone Bundle Distribution

The MCP server is distributed as a zero-dependency standalone bundle compiled via esbuild:

- **Bundle Path:** `./apps/mcp-server/dist/bundle.js`
- **Portability:** Requires only `node` (Node.js >= 18). No `node_modules` required at runtime.

### Primary / Default Environments

#### 1. AntiGravity IDE (Default)

The broker is pre-configured for the Antigravity Agentic IDE via workspace customizations in [`.agents/mcp_config.json`](./.agents/mcp_config.json):

```json
{
  "mcpServers": {
    "context-broker": {
      "command": "node",
      "args": ["./apps/mcp-server/dist/bundle.js"],
      "env": { "CONTEXT_BROKER_MOCK": "true" }
    }
  }
}
```

- **Rule Enforcement (`.agents/rules/context-broker.md`):** Automatically populates an authoritative agent rule that forces all AI agents to use the Context Broker MCP tools (hybrid search, symbol lookup, blast radius impact, architectural memory, safe search/replace) instead of raw grep or massive file reads.

#### 2. Visual Studio Code (Default)

Pre-configured via workspace configuration in [`.vscode/mcp.json`](./.vscode/mcp.json) and supported by the companion extension in [`apps/vscode-extension/`](./apps/vscode-extension):

- **Automatic Initialization:** On extension activation, automatically detects if the workspace has `context-broker.md` and auto-populates it.
- **Command Palette:** Run `Context Broker: Initialize / Populate Workspace Rules (context-broker.md)` anytime to scaffold or refresh rules.
- **Status Bar & Menus:** Interactive quick pick with one-click workspace initialization and live telemetry.
- **AI Tool Calling:** Native discovery for GitHub Copilot, Continue, and Cline.

---

### Non-Default / Alternative Clients

- **Cursor AI:** Pre-configured via [`.cursor/mcp.json`](./.cursor/mcp.json):

  ```json
  {
    "mcpServers": {
      "context-broker": {
        "command": "node",
        "args": ["./apps/mcp-server/dist/bundle.js"]
      }
    }
  }
  ```

- **Windsurf IDE:** Configure in `~/.codeium/windsurf/mcp_config.json`:

  ```json
  {
    "mcpServers": {
      "context-broker": {
        "command": "node",
        "args": ["<absolute-path-to>/apps/mcp-server/dist/bundle.js"]
      }
    }
  }
  ```

- **Claude Desktop:** Add entry to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

  ```json
  {
    "mcpServers": {
      "context-broker": {
        "command": "node",
        "args": ["<absolute-path-to>/apps/mcp-server/dist/bundle.js"]
      }
    }
  }
  ```

---

## Initializing Into Any Codebase

You can initialize Context Broker into any new or existing codebase in three ways:

1. **VS Code / AntiGravity IDE Extension:** Automatically runs upon opening the folder, or trigger `Context Broker: Initialize / Populate Workspace Rules (context-broker.md)` from the Command Palette.
2. **CLI Initialization:** Run `node ./apps/mcp-server/dist/bundle.js init [targetPath]` or `npx context-broker-mcp init [targetPath]`.
3. **PowerShell Script:** Run `powershell -ExecutionPolicy Bypass -File scripts\init-codebase.ps1 -Target "C:\path\to\codebase"`.

---

# Feature Set Outline

### 1. Multi-Provider Hybrid Retrieval Engine

- **Lexical & Documentation Search ([`packages/adapter-lexical`](./packages/adapter-lexical)):**
  - Fast BM25 keyword matching across codebase files and documentation.
  - Markdown and documentation chunking with header-aware context extraction.
- **Semantic Vector Search ([`packages/adapter-vector`](./packages/adapter-vector)):**
  - Local embedding-based vector similarity search (LanceDB / ONNX) for natural language queries.
  - Semantic concept discovery for intent-based code search without exact keyword matches.
- **Query Classification & Execution Planning ([`packages/orchestrator`](./packages/orchestrator)):**
  - Automatic query intent classification (symbol lookup, architectural query, conceptual search).
  - Concurrent multi-adapter retrieval execution with per-provider timeouts and isolated error boundaries for graceful degradation.

---

### 2. Structural Code Intelligence & Graph Analysis

- **Symbol & AST Resolution ([`packages/adapter-codegraph`](./packages/adapter-codegraph)):**
  - Precise symbol definition, type signature, and docstring resolution.
  - Hierarchical caller/callee trees and cross-file reference tracking.
- **Graph Neighborhood Expansion:**
  - Contextual neighborhood traversal using distance decay scoring ($1 / (1 + \alpha \cdot d)$) to include relevant call-chain neighbors.
- **Impact & Blast Radius Analysis:**
  - Upstream and downstream dependency mapping to analyze the blast radius of changes to symbols or files.
- **Repository Architecture Mapping:**
  - High-level codebase structure, module boundaries, and entry-point topology synthesis.

---

### 3. Intelligent Ranking, Deduplication & Budget Packing

- **Spatial Candidate Deduplication ([`packages/ranking`](./packages/ranking)):**
  - Overlapping line-range merging and containment suppression to prevent duplicate token consumption.
- **Staged Rank Fusion:**
  - Multi-source hybrid ranking using Reciprocal Rank Fusion (RRF) and Weighted Linear Scoring (combining BM25, vector similarity, graph proximity, and recency).
- **Token Budget Knapsack Packing:**
  - Greedy knapsack packing algorithm that strictly honors client token limits while maximizing context density.

---

### 4. Security, Isolation & Access Governance

- **Workspace Boundary Guard ([`packages/security`](./packages/security)):**
  - Path jail enforcement and symlink verification to prevent directory traversal and unauthorized file access outside workspace root.
- **Real-time Secret Scrubber:**
  - Regex-based automatic detection and redaction of API keys, bearer tokens, passwords, and private PEM certificates from emitted context.
- **Permission & RBAC Scope Validation:**
  - Strict distinction between read-only inspection tools and state-mutating operations.
  - Configurable exclusion rules via [exclusions.json](./config/policies/exclusions.json).

---

### 5. Provenance, Freshness & Explainability

- **Git Recency & Diff Awareness ([`packages/adapter-git`](./packages/adapter-git)):**
  - Freshness scoring factoring in commit history, active working tree diffs, and file churn.
- **Cryptographic Source Grounding ([`packages/provenance`](./packages/provenance)):**
  - SHA-256 chunk fingerprinting for verifiable context origin.
  - IDE-clickable citation generation (`file:///path#Lstart-Lend`).
- **Score Explainer Engine:**
  - Transparent telemetry revealing exact score breakdowns (BM25, vector, graph distance, recency) behind ranked results.

---

### 6. Durable Architectural Memory

- **Decision Tracking (ADRs) ([`packages/adapter-memory`](./packages/adapter-memory)):**
  - Persistent storage and semantic recall of Architectural Decision Records, historical constraints, and technical rationale.
  - Structured recording of new decisions during agent workflows into `.data/memory/decisions.jsonl`.

---

### 7. Safe Source Mutation Engine

- **Exact Match Verification ([`packages/orchestrator`](./packages/orchestrator)):**
  - Atomic, character-exact string search-and-replace preventing destructive multi-line hallucinated edits.
- **Pre-Mutation Guards:**
  - In-flight secret scanning blocks accidental credential writes.
  - Boundary jail verification ensures modifications remain inside workspace root.
  - Dry-run verification mode returns unified diff preview without mutating disk state.

---

### 8. Companion GUI & Telemetry Inspector

- **Local Web Inspector ([`apps/companion-gui`](./apps/companion-gui)):**
  - Lightweight embedded HTTP server (`http://localhost:4100`) with zero external runtime dependencies.
  - Live event stream showing retrieval queries, score breakdowns, token budget utilization, and mutation diffs.

---

### 9. 4-Agent Verification Swarm

- **Comprehensive Test Harness ([`tests/`](./tests)):**
  - Automated suites for contract compliance, 8-case golden retrieval benchmarks, security penetration attacks, and chaos failure injection.
  - 100% test pass rate across 27 test files and 138+ automated specs.

---

## CI/CD & Publishing

- **Continuous Integration:** Automated GitHub Actions run across Ubuntu and Windows (`.github/workflows/ci.yml`).
- **Open VSX & VS Code Marketplace:** Automated package and release workflow (`.github/workflows/publish-extension.yml`).
- **Publishing Instructions:** See [PUBLISHING.md](PUBLISHING.md) for full step-by-step instructions on standalone bundle builds, pushing to GitHub, claiming Open VSX namespaces, setting up PAT secrets, and releasing.

## License

This project is licensed under the [MIT License](LICENSE).
