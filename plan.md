# Implementation Plan: Thin MCP Context Broker Architecture

## 1. Executive Summary & Core Tenets

This plan establishes the architecture and execution roadmap for building a **local-first, backend-neutral, thin Model Context Protocol (MCP) Context Broker**. Rather than building a monolith or heavily forking upstream codebases (such as comP or CodeGraphContext), this broker coordinates specialized retrieval engines behind an extensible, typed abstraction layer.

```
+-------------------------------------------------------------------------------+
|                                  Agent / IDE                                  |
+---------------------------------------+---------------------------------------+
                                        | JSON-RPC (stdio / SSE)
                                        v
+-------------------------------------------------------------------------------+
|                          Unified MCP Context Broker                           |
|  - MCP Server Surface (@modelcontextprotocol/sdk)                             |
|  - Query Classification & Retrieval Planner                                   |
|  - Reciprocal / Configurable Rank Fusion & Graph Neighborhood Expansion       |
|  - Token Budget & Context Window Packing                                      |
|  - Provenance, Content Hashing & Citation Generation                          |
|  - Workspace Boundary, Secret Scrubbing & RBAC Security Layer                 |
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

### Architectural Tenets
1. **Zero Upstream Divergence:** Upstream engines (`comP`, `CodeGraphContext`) are consumed strictly via their public interfaces (CLI, JSON-RPC/MCP, HTTP, or stable libraries). No upstream source files are copied or vendored into the broker.
2. **Canonical Candidate Normalization:** Every retrieval backend normalizes results into a universal `ContextCandidate` schema before entering the ranking and fusion pipelines. Internal backend structures (AST nodes, SQLite rows, raw embedding vectors) never leak past adapter boundaries.
3. **Deterministic Planning First:** Query routing uses deterministic rules and AST/intent classification before falling back to model-assisted classification.
4. **Resilient Degradation:** If any adapter fails, times out, or reports an unindexed state, the broker must continue serving degraded results from remaining healthy providers without process termination or index corruption.
5. **Auditable Provenance & Security:** Every token served into the model context carries origin provenance, file boundaries, content hashes, freshness indicators, and authorization verification.

---

## 2. Monorepo Architecture & Technology Choices

### 2.1 Workspace Structure
The project will be structured as a TypeScript/Node.js monorepo using `pnpm` workspaces for ultra-fast, deterministic, hard-linked package management and isolation.

```text
context-broker/
├── apps/
│   ├── mcp-server/                   # MCP stdio & SSE host application
│   └── vscode-extension/             # Optional client-side VS Code companion
├── packages/
│   ├── contracts/                    # Core Zod schemas and TypeScript interfaces
│   ├── orchestrator/                 # Retrieval planner, execution coordinator
│   ├── ranking/                      # RRF, weighted scoring, graph re-ranking
│   ├── provenance/                   # Citation, hashing, freshness verification
│   ├── security/                     # Path traversal, secret filter, access rules
│   └── telemetry/                    # Tracing, latency metrics, failure telemetry
├── adapters/
│   ├── comp/                         # Adapter for comP (BM25, files, docs, impact)
│   ├── codegraphcontext/             # Adapter for CodeGraphContext (symbols, calls)
│   ├── vector/                       # Adapter for local embeddings & vector store
│   ├── git/                          # Adapter for Git state, diffs, blame, freshness
│   └── memory/                       # Adapter for durable decisions and facts
├── config/
│   ├── schemas/                      # JSON Schemas for broker configuration
│   ├── defaults/                     # Default scoring weights, budgets, ports
│   └── policies/                     # Security and exclusion rules (.env, secrets)
├── tests/
│   ├── contract/                     # Provider contract compliance suite
│   ├── integration/                  # Multi-adapter end-to-end integration tests
│   ├── retrieval/                    # Retrieval quality benchmarks & goldens
│   ├── security/                     # Security, boundary, and injection tests
│   └── fixtures/                     # Test workspaces, repos, and mock backends
├── upstream/
│   ├── manifests/                    # Manifest tracking upstream versions & hashes
│   ├── patches/                      # Patch ledger and temporary overlay diffs
│   └── compatibility/                # Automated upstream compatibility test runner
├── docs/
│   ├── architecture/                 # Architecture Decision Records (ADRs)
│   ├── decisions/                    # Project knowledge & rationale
│   └── operations/                   # Setup, deployment, troubleshooting guides
├── .github/
│   └── workflows/                    # CI/CD, upstream checks, release pipelines
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── vitest.workspace.ts
└── turbo.json                        # Monorepo build cache orchestration
```

### 2.2 Technology Stack
- **Runtime:** Node.js (v20+ LTS) / TypeScript (v5.4+ with strict null checks).
- **Package Manager:** `pnpm` (v9+) with Turborepo for incremental task caching.
- **Protocol:** `@modelcontextprotocol/sdk` (v1.x) supporting both `stdio` and `SSE` transports.
- **Validation & Serialization:** `zod` (v3.23+) for runtime contract validation and schema inference.
- **Testing:** `vitest` (fast execution, native TS/ESM support) + `msw` (for HTTP mock backends).
- **Local Storage / Vector Subsystem:**
  - Memory & Decisions: SQLite via `better-sqlite3` or local append-only JSON-L.
  - Vector Store: `vectordb` (LanceDB) or `@sqlite.org/sqlite-wasm` with vector extensions, paired with local ONNX runtime (`@xenova/transformers`) for zero-external-dependency local embeddings.
- **Code Utilities:** `tree-sitter` bindings for lightweight local fallback tokenization.

---

## 3. Canonical Contracts & Data Schemas (`packages/contracts`)

All inter-package communication relies strictly on versioned contracts defined in `packages/contracts/src`.

### 3.1 Context Query & Intent
```typescript
export type QueryIntent =
  | "exact_lookup"           // Precise symbol, identifier, or declaration search
  | "semantic_discovery"      // High-level conceptual explanation or algorithm search
  | "dependency_analysis"     // Call hierarchy, imports, downstream dependencies
  | "impact_analysis"         // Breaking change blast radius, affected tests
  | "implementation_search"   // Locating concrete implementations of patterns
  | "documentation_search"    // Markdown, PDF, docstrings, architectural rationale
  | "decision_recall"         // Historical ADRs, architectural decisions, postmortems
  | "hybrid";                 // Combined discovery requiring multi-stage retrieval

export interface ContextQuery {
  queryId: string;
  query: string;
  workspaceIds: string[];
  repositoryIds?: string[];
  intent?: QueryIntent;
  tokenBudget: number;
  resultLimit?: number;
  accessScope: string[];
  includeHistory?: boolean;
  freshnessRequirement?: "live" | "indexed" | "either";
  metadata?: Record<string, unknown>;
}
```

### 3.2 Context Candidate & Provenance
```typescript
export type SourceBackend = "comp" | "codegraphcontext" | "vector" | "git" | "memory";
export type SourceType = "code" | "document" | "graph" | "memory" | "git";
export type FreshnessStatus = "live" | "indexed" | "stale" | "unknown";

export interface ContextCandidate {
  id: string;                                // Deterministic hash: SHA256(backend + file + lines)
  sourceBackend: SourceBackend;
  sourceType: SourceType;
  repositoryId?: string;
  filePath?: string;
  symbol?: string;
  startLine?: number;
  endLine?: number;
  content: string;
  
  // Scoring signals
  lexicalScore?: number;                     // Normalized 0.0 - 1.0 (from BM25)
  semanticScore?: number;                    // Normalized 0.0 - 1.0 (from Cosine similarity)
  graphDistance?: number;                    // Integer distance from seed node (0 = seed)
  graphRelevance?: number;                   // Normalized PageRank / Degree centrality
  
  // Freshness & Provenance
  freshness: FreshnessStatus;
  contentHash?: string;                      // SHA-256 of candidate content
  indexedAt?: string;                        // ISO timestamp
  modifiedAt?: string;                       // ISO timestamp from filesystem/git
  
  // Security & Permissions
  permissions: string[];                     // Required access scopes (e.g., ["repo:read"])
  metadata: Record<string, unknown>;
}
```

### 3.3 Context Package & Retrieval Trace
```typescript
export interface RetrievalStepTrace {
  provider: SourceBackend;
  operation: string;
  durationMs: number;
  candidatesReturned: number;
  status: "success" | "degraded" | "failed" | "skipped";
  error?: string;
}

export interface ContextPackage {
  queryId: string;
  intent: QueryIntent;
  summary: string;
  candidates: ContextCandidate[];
  omittedCandidateCount: number;
  estimatedTokens: number;
  budgetUtilizationPct: number;
  warnings: string[];
  retrievalTrace: RetrievalStepTrace[];
  generatedAt: string;                       // ISO-8601
}
```

### 3.4 Provider Contract
```typescript
export interface ProviderVersion {
  name: string;
  version: string;
  protocolVersion: string;
  commitHash?: string;
}

export interface HealthResult {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  lastSyncTimestamp?: string;
  indexedItemCount?: number;
  diagnostics?: Record<string, unknown>;
}

export interface ProviderCapabilities {
  supportsLexicalSearch: boolean;
  supportsSemanticSearch: boolean;
  supportsGraphTraversal: boolean;
  supportsDocumentExtraction: boolean;
  supportsFreshnessCheck: boolean;
  supportsMutations: boolean;
  supportedSourceTypes: SourceType[];
}

export interface ContextProvider {
  readonly name: SourceBackend;
  version(): Promise<ProviderVersion>;
  health(): Promise<HealthResult>;
  capabilities(): Promise<ProviderCapabilities>;
  search(query: ContextQuery): Promise<ContextCandidate[]>;
  dispose?(): Promise<void>;
}
```

---

## 4. Phased Implementation Roadmap

### Phase Overview & Milestone Schedule

```
+-----------------------------------------------------------------------------------------+
| Milestone 1: Monorepo Setup, Canonical Contracts, comP Adapter & Basic MCP Server       |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| Milestone 2: CodeGraphContext Adapter, Graph Traversal & Structural MCP Tools          |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| Milestone 3: Vector Adapter, Staged Rank Fusion & Token Budget Packing                  |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| Milestone 4: Git & Memory Adapters, Provenance Engine, Freshness Validation             |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| Milestone 5: Security Layer, Multi-Repo Federation & Verification Swarm Harness        |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| Milestone 6: Upstream Maintenance Automation, Patch Ledger & Packaged Experience        |
+-----------------------------------------------------------------------------------------+
```

---

### Milestone 1: Control Repository, Canonical Contracts, comP Adapter & MCP Server Shell

#### 1.1 Goal
Establish the production monorepo infrastructure, define and freeze the canonical contracts, implement the `comP` adapter to provide lexical/document search, wire up the basic MCP server shell, and deliver the `backend_health` tool.

#### 1.2 Step-by-Step Task Breakdown
1. **Task 1.1: Monorepo Foundation & Tooling**
   - Create monorepo root structure (`apps/`, `packages/`, `adapters/`, `config/`, `tests/`, `upstream/`, `docs/`).
   - Configure `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, `turbo.json`.
   - Setup Vitest workspace configuration (`vitest.workspace.ts`) for unified test execution.
   - Configure ESLint, Prettier, and TypeScript project references.
   - Files to create:
     - `pnpm-workspace.yaml`
     - `package.json`
     - `tsconfig.base.json`
     - `turbo.json`
     - `vitest.workspace.ts`
     - `.editorconfig`, `.gitignore`

2. **Task 1.2: Canonical Contracts Package (`packages/contracts`)**
   - Implement Zod schemas and TypeScript interfaces for:
     - `ContextQuery`, `QueryIntent`, `ContextCandidate`, `ContextPackage`, `RetrievalTrace`.
     - `ContextProvider`, `ProviderCapabilities`, `HealthResult`, `ProviderVersion`.
     - Configuration schemas: `BrokerConfig`, `AdapterConfig`, `ScoringWeightsConfig`.
   - Implement deterministic ID generator: `candidateId(backend, filePath, startLine, endLine, contentHash)`.
   - Files to create:
     - `packages/contracts/package.json`
     - `packages/contracts/src/query.ts`
     - `packages/contracts/src/candidate.ts`
     - `packages/contracts/src/provider.ts`
     - `packages/contracts/src/config.ts`
     - `packages/contracts/src/index.ts`
     - `packages/contracts/tests/contracts.test.ts`

3. **Task 1.3: comP Adapter Implementation (`adapters/comp`)**
   - Implement `CompAdapter` implementing the `ContextProvider` interface.
   - Connection strategies:
     - Direct RPC / CLI bridge to comP Rust daemon or SQLite index reader.
     - Execute BM25 search queries across indexed code, Markdown, PDF, docx, and Office formats.
   - Result mapper: Convert native comP hits into `ContextCandidate` objects (`sourceBackend: "comp"`, `sourceType: "code"` or `"document"`).
   - Health check: Query comP daemon status, SQLite DB readability, and indexed file count.
   - Fallback: Graceful degradation with clear warning if comP daemon is not running or SQLite DB is locked.
   - Files to create:
     - `adapters/comp/package.json`
     - `adapters/comp/src/client.ts`
     - `adapters/comp/src/mapper.ts`
     - `adapters/comp/src/comp-adapter.ts`
     - `adapters/comp/src/index.ts`
     - `adapters/comp/tests/comp-adapter.test.ts`
     - `adapters/comp/tests/fixtures/mock-comp-db.sqlite`

4. **Task 1.4: Orchestrator Shell (`packages/orchestrator`)**
   - Implement `ProviderRegistry` capable of loading, initializing, and tracking active adapters dynamically.
   - Implement configuration-driven enabling/disabling of adapters (e.g. `adapters.comp.enabled: true`).
   - Implement basic pass-through query execution and error boundary.
   - Files to create:
     - `packages/orchestrator/package.json`
     - `packages/orchestrator/src/registry.ts`
     - `packages/orchestrator/src/orchestrator.ts`
     - `packages/orchestrator/src/index.ts`
     - `packages/orchestrator/tests/registry.test.ts`

5. **Task 1.5: MCP Server Shell (`apps/mcp-server`)**
   - Build MCP server using `@modelcontextprotocol/sdk`.
   - Setup `stdio` transport for standard IDE/desktop consumption and `SSE` transport for remote/web agents.
   - Implement initial MCP tools:
     - `backend_health`: Returns the health, status, version, and item counts of all registered adapters.
     - `search_context` (Phase 1 version: delegates lexical search to comP).
   - Implement structured error responses complying with MCP JSON-RPC standard.
   - Files to create:
     - `apps/mcp-server/package.json`
     - `apps/mcp-server/src/server.ts`
     - `apps/mcp-server/src/transports/stdio.ts`
     - `apps/mcp-server/src/transports/sse.ts`
     - `apps/mcp-server/src/tools/health.ts`
     - `apps/mcp-server/src/tools/search.ts`
     - `apps/mcp-server/src/index.ts`
     - `apps/mcp-server/tests/server.test.ts`

#### 1.3 Milestone 1 Completion Gate
- [ ] Monorepo installs cleanly via `pnpm install` and compiles with zero TypeScript errors.
- [ ] All unit and contract tests in `packages/contracts` and `adapters/comp` pass.
- [ ] Running `apps/mcp-server` over `stdio` allows executing `backend_health` via MCP inspector or test client.
- [ ] Disabling `comp` in config results in `backend_health` reporting it disabled without crashing the server.
- [ ] Native comP records never escape `adapters/comp` - only `ContextCandidate` is returned.

---

### Milestone 2: Code Graph Adapter, Graph Traversal & Structural MCP Tools

#### 2.1 Goal
Integrate `CodeGraphContext` through an independent adapter, implement symbol resolution, call-graph expansion, and dependency tracing, and expose the `get_symbol_context` and `get_impact_context` MCP tools.

#### 2.2 Step-by-Step Task Breakdown
1. **Task 2.1: CodeGraphContext Adapter (`adapters/codegraphcontext`)**
   - Implement `CodeGraphContextAdapter` implementing `ContextProvider`.
   - Interface with CodeGraphContext via its HTTP API or CLI/MCP client.
   - Provide capabilities:
     - Symbol definition & reference lookup.
     - Caller & callee relationship extraction.
     - Inheritance and import dependency graph traversal.
   - Result mapper:
     - Map graph nodes and edges into `ContextCandidate` (`sourceBackend: "codegraphcontext"`, `sourceType: "graph"`).
     - Calculate `graphDistance` relative to query seed node.
   - Files to create:
     - `adapters/codegraphcontext/package.json`
     - `adapters/codegraphcontext/src/client.ts`
     - `adapters/codegraphcontext/src/mapper.ts`
     - `adapters/codegraphcontext/src/graph-adapter.ts`
     - `adapters/codegraphcontext/src/index.ts`
     - `adapters/codegraphcontext/tests/graph-adapter.test.ts`

2. **Task 2.2: Structural Neighborhood Expansion Engine (`packages/ranking/src/graph-expansion.ts`)**
   - Implement 1-hop and 2-hop neighborhood expansion algorithms:
     - Given a seed symbol candidate, fetch immediate callers, callees, definitions, and interface implementations.
     - Assign decaying relevance weights based on graph distance: $Score_{graph} = \frac{1}{1 + \alpha \cdot \text{distance}}$.
   - Enforce safety limit: Cap maximum expanded nodes per query to avoid context explosion.
   - Files to create:
     - `packages/ranking/src/graph-expansion.ts`
     - `packages/ranking/tests/graph-expansion.test.ts`

3. **Task 2.3: Deterministic Query Classification (`packages/orchestrator/src/classifier.ts`)**
   - Classify incoming queries based on pattern heuristics:
     - Symbol/Identifier pattern (e.g. `CallIdExtractor`, `foo.bar()`) -> `exact_lookup`.
     - "Who calls...", "where is ... used" -> `dependency_analysis`.
     - "What breaks if...", "affected by changing..." -> `impact_analysis`.
     - Conceptual / architectural questions -> `semantic_discovery` / `decision_recall`.
   - Fallback: Default to `hybrid` when ambiguous.
   - Files to create:
     - `packages/orchestrator/src/classifier.ts`
     - `packages/orchestrator/tests/classifier.test.ts`

4. **Task 2.4: Dedicated MCP Tools (`apps/mcp-server/src/tools/`)**
   - Implement `get_symbol_context`:
     - Parameters: `symbol: string`, `filePath?: string`, `includeReferences?: boolean`, `includeCallers?: boolean`.
     - Fetches exact definition, documentation comments, callers, and surrounding context.
   - Implement `get_impact_context`:
     - Parameters: `symbol?: string`, `filePath?: string`, `depth?: number`.
     - Traces upstream dependents and downstream dependencies; reports potential blast radius.
   - Implement `get_repository_map`:
     - Generates a structural overview of key modules, entry points, and directory hierarchies.
   - Files to create:
     - `apps/mcp-server/src/tools/symbol.ts`
     - `apps/mcp-server/src/tools/impact.ts`
     - `apps/mcp-server/src/tools/repo-map.ts`
     - `apps/mcp-server/tests/tools.test.ts`

#### 2.3 Milestone 2 Completion Gate
- [ ] Exact symbol queries reliably route to CodeGraphContext and return definitions with line numbers.
- [ ] Impact analysis queries correctly identify callers and dependents in test workspace fixtures.
- [ ] Graph expansion gracefully stops if CodeGraphContext is offline, returning lexical results with a warning.
- [ ] All new tools validate inputs using Zod and format output compliant with MCP standard.

---

### Milestone 3: Vector Adapter, Hybrid Retrieval, Rank Fusion & Token Budgeting

#### 3.1 Goal
Implement the vector adapter for local semantic retrieval, construct the multi-stage ranking pipeline (Reciprocal Rank Fusion + configurable weighted linear model), implement candidate deduplication, and enforce token budget constraints.

#### 3.2 Step-by-Step Task Breakdown
1. **Task 3.1: Vector Adapter (`adapters/vector`)**
   - Implement `VectorAdapter` implementing `ContextProvider`.
   - Integrate embedded vector engine (LanceDB / SQLite-vec with local ONNX transformer embeddings):
     - Generate chunk embeddings for code and markdown without external API dependencies.
     - Store chunk vectors with metadata: `filePath`, `startLine`, `endLine`, `contentHash`.
     - Support cosine similarity semantic search with query embedding generation.
   - Mapper: Convert vector matches to `ContextCandidate` with `semanticScore` (normalized 0.0 to 1.0).
   - Files to create:
     - `adapters/vector/package.json`
     - `adapters/vector/src/embedder.ts`
     - `adapters/vector/src/store.ts`
     - `adapters/vector/src/vector-adapter.ts`
     - `adapters/vector/src/index.ts`
     - `adapters/vector/tests/vector-adapter.test.ts`

2. **Task 3.2: Retrieval Planner (`packages/orchestrator/src/planner.ts`)**
   - Translate classified `ContextQuery` into an execution plan containing discrete provider steps:
     - Exact lookup: comP (lexical) + CodeGraphContext (symbol).
     - Conceptual query: Vector (semantic) + comP (lexical).
     - Impact analysis: Vector (concept) + comP (terms) + CodeGraphContext (caller graph) + Git (diff).
   - Support parallel execution of independent provider calls via `Promise.allSettled()`.
   - Files to create:
     - `packages/orchestrator/src/planner.ts`
     - `packages/orchestrator/src/executor.ts`
     - `packages/orchestrator/tests/planner.test.ts`

3. **Task 3.3: Deduplication & Candidate Merging (`packages/ranking/src/dedup.ts`)**
   - Identify duplicate candidates across backends covering identical file regions:
     - Criteria: Same `filePath` and overlapping line ranges $[startLine, endLine]$.
   - Collapse duplicates into a single canonical `ContextCandidate`:
     - Merge scores: Preserve `lexicalScore`, `semanticScore`, and `graphDistance` on the merged candidate.
     - Combine tags and metadata.
   - Files to create:
     - `packages/ranking/src/dedup.ts`
     - `packages/ranking/tests/dedup.test.ts`

4. **Task 3.4: Staged Rank Fusion Engine (`packages/ranking/src/fusion.ts`)**
   - Implement configurable weighted scoring model:
     $$\text{Score} = w_{lex} \cdot S_{lex} + w_{sem} \cdot S_{sem} + w_{graph} \cdot S_{graph} + w_{rec} \cdot S_{rec} + w_{path} \cdot S_{path} - P_{dup} - P_{stale}$$
   - Support Reciprocal Rank Fusion (RRF) as alternative fusion strategy:
     $$RRF(d) = \sum_{m \in M} \frac{1}{k + r_m(d)}$$
   - Implement ranking safeguards:
     - Exact symbol match hard-override: symbol matches on exact queries receive an automatic boost guarantee.
     - Unseed graph suppression: graph proximity only scores after a verified seed candidate is present.
   - Files to create:
     - `packages/ranking/src/fusion.ts`
     - `packages/ranking/src/weights.ts`
     - `packages/ranking/tests/fusion.test.ts`

5. **Task 3.5: Token Budget Manager (`packages/orchestrator/src/budget.ts`)**
   - Fast local token estimation (cl100k_base estimation or character-ratio heuristic ~3.8 chars/token).
   - Greedy packing algorithm: Pack highest-ranked candidates until `tokenBudget` is reached.
   - Candidate truncator: Intelligently truncate large candidates to symbol headers + critical lines if budget is constrained.
   - Count omitted candidates and record budget utilization percentage.
   - Files to create:
     - `packages/orchestrator/src/budget.ts`
     - `packages/orchestrator/tests/budget.test.ts`

6. **Task 3.6: Enhanced `search_context` MCP Tool**
   - Upgrade `search_context` in `apps/mcp-server` to run full hybrid retrieval:
     - Query planning -> Parallel search -> Deduplication -> Rank Fusion -> Budget packing -> Package generation.
   - Files to update:
     - `apps/mcp-server/src/tools/search.ts`
     - `apps/mcp-server/tests/search.test.ts`

#### 3.3 Milestone 3 Completion Gate
- [ ] Hybrid search returns combined results from lexical (comP), structural (CodeGraphContext), and semantic (Vector) providers.
- [ ] Overlapping chunks from multiple backends are collapsed into a single candidate with multi-engine scores.
- [ ] Result sets strictly honor the specified `tokenBudget` (e.g. 4000 tokens) with zero token overflow.
- [ ] Exact identifier queries prioritize the exact declaration over loosely related semantic hits.

---

### Milestone 4: Git & Memory Adapters, Provenance & Decision Recall

#### 4.1 Goal
Implement the Git adapter (state, diffs, blame, freshness) and Memory adapter (durable decisions, rejected approaches, project facts), introduce the citation and provenance layer, and add freshness validation.

#### 4.2 Step-by-Step Task Breakdown
1. **Task 4.1: Git Adapter (`adapters/git`)**
   - Implement `GitAdapter` implementing `ContextProvider`.
   - Use local `simple-git` or direct git CLI execution:
     - Query current branch, HEAD commit hash, and working tree status.
     - Retrieve modified/uncommitted files and staged diffs.
     - Query file commit history and git blame for given lines.
   - Freshness detection service:
     - Given a `filePath` and `indexedAt` timestamp, determine if the file has been modified in git since indexing.
     - Return status: `"live"` (up to date), `"stale"` (modified since index), or `"unknown"`.
   - Files to create:
     - `adapters/git/package.json`
     - `adapters/git/src/client.ts`
     - `adapters/git/src/git-adapter.ts`
     - `adapters/git/src/index.ts`
     - `adapters/git/tests/git-adapter.test.ts`

2. **Task 4.2: Memory Adapter (`adapters/memory`)**
   - Implement `MemoryAdapter` implementing `ContextProvider`.
   - SQLite/JSON-L storage schema for explicitly curated decisions:
     ```typescript
     interface DecisionRecord {
       id: string;
       title: string;
       decision: string;
       rationale: string;
       rejectedAlternatives: string[];
       affectedComponents: string[];
       author: string;
       timestamp: string;
       tags: string[];
       sourceFile?: string;
     }
     ```
   - Enforce task constraint: Memory must be explicitly recorded with classification. Never silently save raw agent chat turns.
   - Retrieval: Semantic and keyword lookup over recorded decisions.
   - Files to create:
     - `adapters/memory/package.json`
     - `adapters/memory/src/schema.ts`
     - `adapters/memory/src/store.ts`
     - `adapters/memory/src/memory-adapter.ts`
     - `adapters/memory/src/index.ts`
     - `adapters/memory/tests/memory-adapter.test.ts`

3. **Task 4.3: Provenance, Citation & Transparency Layer (`packages/provenance`)**
   - Calculate SHA-256 `contentHash` for all returned candidate chunks.
   - Generate standard markdown/JSON citations: `[file:line-range](file:///path#L1-L10)`.
   - Provide explanation metadata: Include breakdown of why each candidate was selected and scored.
   - Files to create:
     - `packages/provenance/package.json`
     - `packages/provenance/src/citation.ts`
     - `packages/provenance/src/hasher.ts`
     - `packages/provenance/src/explainer.ts`
     - `packages/provenance/src/index.ts`
     - `packages/provenance/tests/provenance.test.ts`

4. **Task 4.4: MCP Tools for Memory & Explanation**
   - Implement `record_decision`:
     - Parameters: `title`, `decision`, `rationale`, `rejectedAlternatives`, `affectedComponents`, `tags`.
     - Validates and writes durable decision record to memory store.
   - Implement `recall_decisions`:
     - Parameters: `query`, `components?`, `tags?`, `limit?`.
     - Retrieves relevant historical decisions with rationale and alternatives.
   - Implement `explain_context`:
     - Parameters: `queryId` or `candidates`.
     - Explains score contributions (lexical vs semantic vs graph) and provider origin for each item.
   - Files to create:
     - `apps/mcp-server/src/tools/memory.ts`
     - `apps/mcp-server/src/tools/explain.ts`
     - `apps/mcp-server/tests/memory-tools.test.ts`

#### 4.3 Milestone 4 Completion Gate
- [ ] Candidates from files modified in git since indexing are marked with `freshness: "stale"` and display a warning in the context package.
- [ ] Explicitly recorded decisions are durable across server restarts and retrievable via `recall_decisions`.
- [ ] Memory records never silently override current source code; provenance clearly distinguishes code from historical notes.
- [ ] `explain_context` returns a transparent score breakdown for any query result.

---

### Milestone 5: Security Layer, Multi-Repo Federation & Verification Swarm

#### 5.1 Goal
Implement comprehensive security policies (path traversal protection, secret redaction, workspace boundaries), multi-repository federation, and build the 4-agent Verification Swarm test suite.

#### 5.2 Step-by-Step Task Breakdown
1. **Task 5.1: Security & Policy Enforcement Layer (`packages/security`)**
   - Workspace boundary verification:
     - Validate all candidate `filePath` values are strictly within configured `workspaceIds`.
     - Prevent directory traversal (`../`) and symlink escapes outside the workspace root.
   - Secret & sensitive file exclusion:
     - Automatic exclusion patterns: `.env*`, `*.pem`, `*.key`, `id_rsa*`, credentials files.
     - Content regex scrubber: Automatically detect and mask API keys, tokens, and private keys within candidate content before packaging.
   - Access control & scopes:
     - Verify candidate permissions against `ContextQuery.accessScope`.
   - Files to create:
     - `packages/security/package.json`
     - `packages/security/src/boundary.ts`
     - `packages/security/src/scrubber.ts`
     - `packages/security/src/permissions.ts`
     - `packages/security/src/index.ts`
     - `packages/security/tests/security.test.ts`

2. **Task 5.2: Multi-Repository Federation**
   - Enable `workspaceIds` and `repositoryIds` filtering across adapters.
   - Ensure adapters tag candidates with `repositoryId`.
   - Cross-repository similarity search support in `VectorAdapter`.
   - Prevent cross-tenant data leakage when multiple repositories are loaded.
   - Files to update:
     - `packages/orchestrator/src/orchestrator.ts`
     - `packages/orchestrator/tests/multi-repo.test.ts`

3. **Task 5.3: Verification Swarm Suite (`tests/`)**
   - **Contract Test Agent (`tests/contract/`)**:
     - Tests all adapters against universal test suites: schema compliance, stable IDs, error normalization, graceful offline handling.
   - **Retrieval Evaluation Agent (`tests/retrieval/`)**:
     - Fixed golden query benchmarks:
       1. Exact symbol lookup (`CallIdExtractor`)
       2. Concept-only lookup ("audio streaming buffer synchronization")
       3. Cross-file dependency ("which handlers consume EventDispatcher")
       4. Impact analysis question ("blast radius of altering TokenPayload")
       5. Documentation-to-code question ("how to configure OAuth provider")
       6. Cross-repo implementation search ("shared logging client pattern")
       7. Prior-decision recall ("why was SQLite chosen over Redis")
       8. Freshly modified file query (verifying `"stale"` flag)
     - Metrics: Top-1 precision, Top-5 recall, MRR, token budget adherence.
   - **Security Agent (`tests/security/`)**:
     - Attempt path traversal (`../../etc/passwd`).
     - Symlink escape attempts.
     - Ingestion of dummy `.env` files with API keys (verifying redaction).
     - Cross-repository unauthorized query attempts.
   - **Failure Injection Agent (`tests/failure/`)**:
     - Simulate CodeGraphContext crash / HTTP 500.
     - Simulate comP SQLite locked / unavailable.
     - Simulate Vector store corruption or timeout.
     - Verify broker remains online, serves partial results, and flags appropriate warnings.
   - Files to create:
     - `tests/contract/provider-contract.spec.ts`
     - `tests/retrieval/benchmark-runner.ts`
     - `tests/retrieval/goldens/benchmark-cases.json`
     - `tests/security/sandbox-attacks.spec.ts`
     - `tests/failure/chaos-injection.spec.ts`

#### 5.3 Milestone 5 Completion Gate
- [ ] 100% of benchmark golden queries pass quality thresholds (Top-3 recall >= 0.85).
- [ ] Security test suite rejects all traversal, secret exposure, and symlink attacks.
- [ ] Failure injection verifies broker serves 100% of queries successfully in degraded mode when 1 or 2 backends are terminated.

---

### Milestone 6: Upstream Maintenance Automation, Patch Ledger & Packaged Experience

#### 6.1 Goal
Automate upstream version tracking and compatibility reporting, establish the patch ledger governance tooling, package the standalone server for distribution, and build the VS Code client extension integration.

#### 6.2 Step-by-Step Task Breakdown
1. **Task 6.1: Upstream Manifest & Patch Ledger Governance (`upstream/`)**
   - Create upstream registry manifest `upstream/manifests/upstream.json`:
     - Tracks upstream repository URLs, tracked tags/commits, API schemas, and license terms for comP, CodeGraphContext, and vector dependencies.
   - Build Patch Ledger validator (`upstream/scripts/validate-patches.ts`):
     - Linter enforcing mandatory fields on any patch or overlay:
       - `patch_id`, `reason`, `upstream_issue`, `introduced_against`, `owner`, `removal_condition`, `covered_by`.
     - CI fails if any local patch lacks an upstream issue reference or removal condition.
   - Files to create:
     - `upstream/manifests/upstream.json`
     - `upstream/patches/README.md`
     - `upstream/scripts/validate-patches.ts`
     - `upstream/tests/patch-governance.test.ts`

2. **Task 6.2: Automated Upstream Compatibility Harness (`upstream/compatibility/`)**
   - Implement CLI tool to test new upstream releases against broker adapter contracts:
     - Checks new upstream releases against GitHub APIs.
     - Spawns a sandboxed test runner with candidate upstream release.
     - Executes `tests/contract/provider-contract.spec.ts`.
     - Generates automated markdown `compatibility-report.md` specifying breaking surfaces and required adapter translations.
   - GitHub Actions workflow: Scheduled weekly run + dispatch trigger.
   - Files to create:
     - `upstream/compatibility/runner.ts`
     - `upstream/compatibility/reporter.ts`
     - `.github/workflows/upstream-compat.yml`

3. **Task 6.3: Packaging & Distribution (`apps/mcp-server`)**
   - Package `mcp-server` into a self-contained executable binary or zero-config `npx context-broker-mcp` CLI.
   - Provide configuration file loading from `.contextbroker.json` or environment variables.
   - Build health check script and Dockerfile for containerized deployment.
   - Files to create:
     - `apps/mcp-server/bin/cli.js`
     - `apps/mcp-server/Dockerfile`
     - `README.md` (root installation & configuration guide)

4. **Task 6.4: VS Code Extension Client (`apps/vscode-extension`)**
   - Light client extension connecting to local context broker via stdio.
   - Status bar indicator displaying broker health and indexed repository status.
   - Command palette shortcuts: "Record Architectural Decision", "Inspect Symbol Context", "Run Impact Analysis".
   - Files to create:
     - `apps/vscode-extension/package.json`
     - `apps/vscode-extension/src/extension.ts`
     - `apps/vscode-extension/src/client.ts`

#### 6.3 Milestone 6 Completion Gate
- [ ] Patch ledger validator prevents committing patches without removal conditions.
- [ ] Upstream compatibility harness generates valid reports against test mock releases.
- [ ] `npx context-broker-mcp` or direct binary launch starts cleanly and responds to MCP client handshakes.
- [ ] VS Code extension successfully connects to broker and displays health in status bar.

---

## 5. Adapter Integration Specifications

### 5.1 comP Adapter (`adapters/comp`)
- **Primary Role:** High-speed BM25 keyword search, file/directory discovery, full document text extraction (Markdown, PDF, DOCX, Parquet), and fast session memory.
- **Protocol:** Local SQLite direct query or IPC to `comp` Rust daemon.
- **Query Mapping:**
  - `ContextQuery.query` -> comP BM25 query string.
  - `ContextQuery.workspaceIds` -> scoped path prefixes.
- **Candidate Normalization:**
  - `sourceBackend`: `"comp"`
  - `sourceType`: `"code"` | `"document"`
  - `lexicalScore`: Normalized BM25 score divided by max score in result set.
  - `freshness`: Verified against filesystem `mtime`.

### 5.2 CodeGraphContext Adapter (`adapters/codegraphcontext`)
- **Primary Role:** Tree-sitter / SCIP code intelligence, symbol definitions, reference graphs, call hierarchies, inheritance, and import chains.
- **Protocol:** HTTP API or MCP client over stdio to `codegraphcontext`.
- **Query Mapping:**
  - Exact symbol extraction from `ContextQuery.query`.
  - Intent `dependency_analysis` -> `get_callers` / `get_callees`.
  - Intent `impact_analysis` -> recursive downstream dependency traversal.
- **Candidate Normalization:**
  - `sourceBackend`: `"codegraphcontext"`
  - `sourceType`: `"graph"`
  - `graphDistance`: Number of hops from origin query symbol.
  - `graphRelevance`: Calculated structural centrality.

### 5.3 Vector Adapter (`adapters/vector`)
- **Primary Role:** Dense semantic similarity, conceptual search, cross-repository pattern matching, documentation-to-code bridging.
- **Protocol:** Embedded LanceDB or SQLite-vec with local ONNX transformer model.
- **Candidate Normalization:**
  - `sourceBackend`: `"vector"`
  - `sourceType`: `"code"` | `"document"`
  - `semanticScore`: Cosine similarity $[0.0, 1.0]$.

### 5.4 Git Adapter (`adapters/git`)
- **Primary Role:** Working tree status, diff-aware indexing, commit history, blame attribution, and index freshness validation.
- **Protocol:** In-process `simple-git` or direct git CLI.
- **Candidate Normalization:**
  - `sourceBackend`: `"git"`
  - `sourceType`: `"git"`
  - Computes `freshness`: `"live" | "stale" | "indexed"`.

### 5.5 Memory Adapter (`adapters/memory`)
- **Primary Role:** Durable repository knowledge: architectural decisions, rejected alternatives, known technical debt, and verified project facts.
- **Protocol:** Embedded SQLite database or append-only JSON-L with schema validation.
- **Candidate Normalization:**
  - `sourceBackend`: `"memory"`
  - `sourceType`: `"memory"`
  - Guardrail: Always includes explicit metadata warning indicating it is durable memory, not live source code.

---

## 6. Retrieval, Ranking & Token Budget Pipeline

The retrieval pipeline processes every query through 8 sequential stages:

```
[ Incoming Query ]
        |
        v
 Stage 1: Normalize & Classify Intent (exact_lookup, semantic_discovery, impact_analysis, etc.)
        |
        v
 Stage 2: Retrieval Planning & Multi-Adapter Dispatch (Parallel async execution)
        |
        v
 Stage 3: Candidate Normalization (Every result becomes a ContextCandidate)
        |
        v
 Stage 4: Deduplication & Spatial Overlap Merging (Canonical file + line hashing)
        |
        v
 Stage 5: Graph Expansion & Neighborhood Seeding (1-hop / 2-hop caller/callee traversal)
        |
        v
 Stage 6: Staged Rank Fusion & Safeguard Adjustments (Weighted formula + exact match override)
        |
        v
 Stage 7: Security Policy & Workspace Boundary Filtering (Path checks, secret scrubbing, RBAC)
        |
        v
 Stage 8: Token Budget Optimization & Context Packaging (Greedy knapsack packing + provenance)
        |
        v
[ Return ContextPackage via MCP ]
```

### 6.1 Scoring Formula & Configuration
The default scoring model in `packages/ranking/src/weights.ts`:

```typescript
export interface ScoringWeights {
  lexicalWeight: number;      // default: 0.30
  semanticWeight: number;     // default: 0.35
  graphWeight: number;        // default: 0.20
  recencyWeight: number;      // default: 0.10
  pathPriorityWeight: number; // default: 0.05
  intentMatchBoost: number;   // default: 0.15
  stalePenalty: number;       // default: 0.25
  duplicatePenalty: number;   // default: 0.10
}
```

$$\text{FinalScore} = w_{lex} \cdot S_{lex} + w_{sem} \cdot S_{sem} + w_{graph} \cdot S_{graph} + w_{rec} \cdot S_{rec} + w_{path} \cdot S_{path} + w_{intent} \cdot S_{intent} - P_{stale}$$

### 6.2 Essential Safeguards
1. **Exact Symbol Override:** If query matches an exact symbol identifier, exact definition candidates are guaranteed minimum rank 1, regardless of loose semantic scores.
2. **Graph Expansion Gating:** Graph proximity only contributes to score if a verified seed candidate exists in the lexical or symbol set.
3. **Stale Flagging:** Stale results are never hidden; they are penalized in score and tagged with `freshness: "stale"` with git diff summary in metadata.
4. **Token Knapsack Packing:** Packing prioritizes top-ranked candidates, truncating content gracefully at syntax boundaries (functions/blocks) when nearing budget limits.

---

## 7. Unified MCP Surface Specification

The broker exposes 8 focused tools via `@modelcontextprotocol/sdk`:

| Tool Name | Operation Type | Input Parameters | Primary Purpose |
| :--- | :--- | :--- | :--- |
| `search_context` | Read-only | `query`, `workspaceIds`, `intent?`, `tokenBudget?`, `freshness?` | Hybrid retrieval across all active providers with rank fusion. |
| `get_symbol_context` | Read-only | `symbol`, `filePath?`, `includeCallers?`, `includeReferences?` | Definition, references, and call hierarchy for an identifier. |
| `get_impact_context` | Read-only | `symbol?`, `filePath?`, `depth?` | Downstream and upstream blast radius of modifying a component. |
| `get_repository_map` | Read-only | `workspaceIds`, `depth?` | Structural map of workspace directories, entry points, and modules. |
| `recall_decisions` | Read-only | `query`, `components?`, `tags?`, `limit?` | Retrieve durable architectural decisions and rejected alternatives. |
| `record_decision` | Mutation | `title`, `decision`, `rationale`, `rejectedAlternatives`, `tags` | Explicitly persist an architectural decision into durable memory. |
| `explain_context` | Read-only | `queryId` or `candidates` | Inspect scoring breakdown and provenance traces for a query. |
| `backend_health` | Read-only | *(none)* | Status, version, index state, and item counts of all adapters. |

---

## 8. Verification Swarm & Benchmark Harness

The verification suite runs as four distinct agents:

```
                          [ Verification Swarm ]
                                    |
     +-----------------+------------+------------+-----------------+
     |                 |                         |                 |
     v                 v                         v                 v
[ Contract Agent ] [ Benchmark Agent ]   [ Security Agent ]   [ Failure Chaos ]
  - Zod schemas      - Top-1 Precision     - Path traversal     - Engine offline
  - Stable IDs       - Top-5 Recall        - Symlink escape     - Index lock
  - Error codes      - Token budget fit    - Secret scrub       - Corrupt DB
  - Degradation      - Freshness check     - Cross-repo leak    - Network latency
```

### 8.1 Retrieval Evaluation Benchmark Suite
Located in `tests/retrieval/goldens/benchmark-cases.json`:
- **TC-01 (Exact Symbol):** Query `extractCallRecordId` -> Must rank exact declaration at #1.
- **TC-02 (Concept Discovery):** Query `audio stream buffering synchronization` -> Semantic results locate buffer manager with zero exact keyword match required.
- **TC-03 (Cross-file Dependency):** Query `callers of dispatchSessionEvent` -> Graph adapter identifies all 4 upstream controller callers.
- **TC-04 (Impact Blast Radius):** Query `impact of modifying CallRecordDTO` -> Returns serialization layer, 3 database repos, and 2 controller routes.
- **TC-05 (Documentation-to-Code):** Query `OAuth token refresh flow` -> Connects `auth.md` architectural specification to `token-service.ts`.
- **TC-06 (Decision Recall):** Query `why do we avoid Redis for local memory` -> Recalls ADR-003 specifying SQLite local persistence.
- **TC-07 (Stale Modification):** Query on a file modified 2 minutes ago -> Result labeled with `freshness: "stale"` and diff snippet present.

---

## 9. Upstream Maintenance Automation & Patch Ledger

### 9.1 Patch Ledger Standard (`upstream/patches/`)
Every unavoidable local patch or adapter overlay must maintain a machine-readable entry:

```yaml
patch_id: PATCH-CGC-001
component: codegraphcontext
target_version: "v0.8.2"
reason: "Upstream HTTP API does not expose caller line numbers"
upstream_issue: "https://github.com/upstream/codegraphcontext/issues/142"
introduced_against: "commit 4f1a9b2"
owner: "Architecture Team"
removal_condition: "Remove when upstream issue #142 is merged and released in v0.9.0+"
covered_by:
  - "tests/contract/graph-symbol-contract.spec.ts"
```

### 9.2 Automated Upstream Compatibility Workflow
1. Scheduled GitHub Action checks upstream release tags weekly.
2. Spawns ephemeral test container running candidate upstream version.
3. Executes `tests/contract/provider-contract.spec.ts`.
4. If passing: Opens automated PR upgrading manifest version.
5. If failing: Generates `compatibility-report.md` detailing breaking endpoint schemas and affected broker contracts.

---

## 10. Workstream Execution Matrix & Team Parallelization

Once Milestone 1 freezes canonical contracts in `packages/contracts`, implementation proceeds in parallel across dedicated workstreams:

| Workstream | Focus Area | Primary Deliverables | Dependencies |
| :--- | :--- | :--- | :--- |
| **Stream A** | comP Adapter | `adapters/comp`, BM25 query, document extraction | Milestone 1 contracts |
| **Stream B** | CodeGraph Adapter | `adapters/codegraphcontext`, symbol/caller traversal | Milestone 1 contracts |
| **Stream C** | Vector Adapter | `adapters/vector`, ONNX embedding, LanceDB storage | Milestone 1 contracts |
| **Stream D** | Memory & Git Adapters | `adapters/memory`, `adapters/git`, freshness check | Milestone 1 contracts |
| **Stream E** | Rank Fusion & Budget | `packages/ranking`, `packages/orchestrator/budget.ts` | Milestone 1 contracts |
| **Stream F** | MCP Interface | `apps/mcp-server`, stdio & SSE tools | Milestone 1 contracts |
| **Stream G** | Security & Policy | `packages/security`, secret scrubber, boundary filter | Milestone 1 contracts |
| **Stream H** | Benchmark Harness | `tests/retrieval`, `tests/failure`, golden test set | Streams A, B, C |
| **Stream I** | Upstream Automation | `upstream/compatibility`, patch ledger validator | Milestone 1 repo |

---

## 11. Risk Analysis & Mitigation Strategies

| Risk | Impact | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Upstream Breaking Changes** | High | High | Strict isolation behind `ContextProvider` contract; automated compatibility CI runner; patch ledger with removal conditions. |
| **Local Daemon Desynchronization** | Medium | Medium | Filesystem `mtime` and git status validation on every query; explicit `"stale"` flag rather than silent stale context. |
| **Embedding Computation Latency** | High | Medium | Use small, quantized local ONNX models (e.g. `all-MiniLM-L6-v2`); asynchronously index files in background; cache chunk hashes. |
| **Token Budget Overruns** | High | Low | Deterministic token estimator with safety margin (5% buffer); greedy knapsack packing; syntax-aware chunk truncation. |
| **Sensitive Data Leakage** | Critical | Low | Hardcoded secret redaction patterns (`.env`, private keys); workspace boundary jail check prior to returning any candidate. |
| **Engine Crash / Deadlock** | High | Medium | Every provider call is wrapped with strict timeout (e.g. 1500ms) and `Promise.allSettled()`; broker degrades gracefully. |

---

## 12. Immediate Next Steps

1. **Initialize Monorepo:** Create directory layout, `pnpm-workspace.yaml`, and build tooling.
2. **Implement Contracts Package:** Code `packages/contracts` with all Zod models and tests.
3. **Build MCP Server Shell & comP Adapter:** Wire up `apps/mcp-server` and `adapters/comp` to achieve Milestone 1 completion gate.
