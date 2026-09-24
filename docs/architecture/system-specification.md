Build this as a thin MCP context broker with replaceable upstream adapters, not as a merged monolith. Keep comP and the graph/vector engines close to upstream, place custom behavior in your own orchestration layer, and automate upstream compatibility testing so updates are pulled rather than manually patched.

1. Target Architecture

comP already provides local indexing, BM25 retrieval, a Rust daemon, SQLite-backed code relationships, document extraction, incremental workspace monitoring, session memory, and MCP configuration generation.

CodeGraphContext provides Tree-sitter and optional SCIP indexing, graph persistence, incremental filesystem synchronization, CLI access, MCP tools, and an HTTP API.

Use those capabilities behind a stable broker contract:

Agent / IDE
    |
    v
Unified MCP Context Broker
    |
    +-- Query classifier
    +-- Retrieval planner
    +-- Context ranker
    +-- Token-budget manager
    +-- Citation/provenance layer
    +-- Policy and access-control layer
    |
    +-- comP adapter
    |     +-- BM25 and file retrieval
    |     +-- document extraction
    |     +-- session memory
    |     +-- impact graph
    |
    +-- CodeGraphContext adapter
    |     +-- symbols
    |     +-- definitions and references
    |     +-- calls and dependencies
    |     +-- structural graph expansion
    |
    +-- Vector adapter
    |     +-- semantic code retrieval
    |     +-- documentation retrieval
    |     +-- cross-repository similarity
    |
    +-- Git adapter
    |     +-- repository state
    |     +-- diffs
    |     +-- commit history
    |
    +-- Memory adapter
          +-- architectural decisions
          +-- session summaries
          +-- known problems
          +-- verified project facts


This follows MCP’s composable model: servers expose focused resources, tools, and prompts, while the host coordinates clients and context aggregation. MCP’s architecture also preserves server isolation rather than giving every backend unrestricted access to the complete conversation.

2. Agentic Development Workflow
Phase 0: Establish the Control Repository
Agent: Repository Architect

Objective: Create the repository that owns contracts, orchestration, testing, configuration, and packaging.

Actions

Create a new repository for the broker.
Add upstream projects as independently versioned dependencies or services.
Define a strict rule that upstream source is not copied into the broker.
Record upstream version, commit, license, API surface, and health status.
Establish directories:
context-broker/
├── apps/
│   ├── mcp-server/
│   └── vscode-extension/
├── packages/
│   ├── contracts/
│   ├── orchestrator/
│   ├── ranking/
│   ├── provenance/
│   ├── security/
│   └── telemetry/
├── adapters/
│   ├── comp/
│   ├── codegraphcontext/
│   ├── vector/
│   ├── git/
│   └── memory/
├── config/
│   ├── schemas/
│   ├── defaults/
│   └── policies/
├── tests/
│   ├── contract/
│   ├── integration/
│   ├── retrieval/
│   ├── security/
│   └── fixtures/
├── upstream/
│   ├── manifests/
│   └── compatibility/
├── docs/
│   ├── architecture/
│   ├── decisions/
│   └── operations/
└── .github/
    └── workflows/

Completion gate
PASS when:
- The broker builds without modifying upstream code.
- Every backend can be disabled through configuration.
- Backend-specific types do not escape their adapters.
- All external responses map to shared contracts.

Phase 1: Inventory Before Implementation
Agent: Upstream Auditor

Objective: Prevent duplicate implementation.

Inputs
- comP repository
- CodeGraphContext repository
- MCP specification
- Candidate vector engine
- Candidate embedding provider

Required output
capabilities:
  lexical_search:
    owner: comp
    status: available
  document_extraction:
    owner: comp
    status: available
  code_graph:
    owner: codegraphcontext
    status: available
  semantic_search:
    owner: vector-adapter
    status: required
  context_fusion:
    owner: broker
    status: custom
  provenance:
    owner: broker
    status: custom
  access_policy:
    owner: broker
    status: custom

Audit questions
Does the capability already exist upstream?
Is it accessible through MCP, CLI, HTTP, or a library API?
Is the interface documented and versioned?
Can it operate locally?
Does it support incremental indexing?
Can it return stable file, symbol, or chunk identifiers?
Can its output include source locations?
Can it be replaced without changing the broker’s MCP interface?
Does its license permit the intended distribution model?
Completion gate

No feature enters the custom backlog until the auditor records why an upstream implementation cannot satisfy it.

Phase 2: Define Canonical Context Contracts
Agent: Contract Designer

Objective: Normalize all backend results before building orchestration.

interface ContextQuery {
  query: string;
  workspaceIds: string[];
  repositoryIds?: string[];
  intent?: QueryIntent;
  tokenBudget: number;
  resultLimit?: number;
  accessScope: string[];
  includeHistory?: boolean;
  freshnessRequirement?: "live" | "indexed" | "either";
}

type QueryIntent =
  | "exact_lookup"
  | "semantic_discovery"
  | "dependency_analysis"
  | "impact_analysis"
  | "implementation_search"
  | "documentation_search"
  | "decision_recall"
  | "hybrid";

interface ContextCandidate {
  id: string;
  sourceBackend: string;
  sourceType: "code" | "document" | "graph" | "memory" | "git";
  repositoryId?: string;
  filePath?: string;
  symbol?: string;
  startLine?: number;
  endLine?: number;
  content: string;
  lexicalScore?: number;
  semanticScore?: number;
  graphDistance?: number;
  freshness: "live" | "indexed" | "stale" | "unknown";
  contentHash?: string;
  permissions: string[];
  metadata: Record<string, unknown>;
}

interface ContextPackage {
  queryId: string;
  intent: QueryIntent;
  summary: string;
  candidates: ContextCandidate[];
  omittedCandidateCount: number;
  estimatedTokens: number;
  warnings: string[];
  retrievalTrace: RetrievalTrace[];
}

Design rule

Every backend result must become a ContextCandidate. Agents should never need to understand native graph records, embedding payloads, SQLite rows, or backend-specific MCP response formats.

Phase 3: Implement Backend Adapters
Agent: Adapter Builder

Implement each adapter independently.

interface ContextProvider {
  name: string;
  version(): Promise<ProviderVersion>;
  health(): Promise<HealthResult>;
  capabilities(): Promise<ProviderCapabilities>;
  search(query: ContextQuery): Promise<ContextCandidate[]>;
}

Adapter sequence
1. comP adapter

Use it for:

Full-text retrieval
File and document retrieval
Existing project map
Existing impact results
Session recall

comP advertises BM25 search across code, Markdown, Office formats, PDF, and Parquet, plus incremental indexing and session memory.

2. CodeGraphContext adapter

Use it for:

Symbol lookup
Call-chain traversal
Imports
Inheritance
Dependency expansion
Cross-file structural analysis

CodeGraphContext represents files, symbols, calls, inheritance, imports, and relationships in a queryable graph exposed through CLI and MCP.

3. Vector adapter

Use it for:

Conceptual retrieval
Similar implementations
Cross-repository matches
Documentation-to-code association
Queries with weak keyword overlap
4. Memory adapter

Use it for durable, explicitly recorded knowledge:

- Architectural decisions
- Rejected approaches
- Known limitations
- Ownership records
- Troubleshooting outcomes
- Session handoff summaries


Do not silently convert every model response into durable memory. Require an explicit memory classification and preserve the source.

5. Git adapter

Use it for:

Current branch and commit
Changed files
Blame and commit history
Diff-aware retrieval
Invalidating stale context
Completion gate

Each adapter must pass the same contract suite without the orchestrator containing backend-specific branching.

Phase 4: Build the Retrieval Planner
Agent: Query Planner

The planner determines which providers to invoke.

Incoming query
    |
    v
Normalize and classify
    |
    +-- Exact identifier? --------> comP + graph
    +-- Conceptual question? -----> vector + comP
    +-- "What calls this?" -------> graph
    +-- "What breaks?" ----------> graph + git
    +-- "Why did we choose?" ----> memory + documents
    +-- Broad/ambiguous? ---------> all read-only providers

Example plan

User query:

Find the Teams call-record logic and identify what would be affected
if the Call ID extraction function changed.


Planner output:

{
  "intent": "impact_analysis",
  "steps": [
    {
      "provider": "vector",
      "operation": "semantic_search",
      "purpose": "Locate conceptually related implementations"
    },
    {
      "provider": "comp",
      "operation": "lexical_search",
      "purpose": "Locate exact Call ID references"
    },
    {
      "provider": "code_graph",
      "operation": "expand_dependencies",
      "purpose": "Trace callers and downstream dependencies"
    },
    {
      "provider": "git",
      "operation": "validate_freshness",
      "purpose": "Identify changed or unindexed files"
    }
  ]
}


The plan should be deterministic by default. Use a model-based planner only as a fallback for unclassified requests.

Phase 5: Add Rank Fusion and Graph Expansion
Agent: Retrieval Engineer

Use a staged pipeline:

Retrieve
  -> Normalize
  -> Deduplicate
  -> Fuse rankings
  -> Expand graph neighbors
  -> Re-rank
  -> Apply permissions
  -> Apply token budget
  -> Package context


Suggested initial scoring model:

final_score =
    lexical_weight  * normalized_lexical_score
  + semantic_weight * normalized_semantic_score
  + graph_weight    * graph_relevance
  + recency_weight  * freshness_score
  + path_weight     * repository_path_priority
  + intent_weight   * intent_match
  - duplicate_penalty
  - stale_penalty


Treat these weights as configuration, not compiled behavior.

Required safeguards
Exact symbol matches outrank loose semantic matches for symbol queries.
Graph proximity influences ranking only after a valid seed is found.
Stale results remain visible but clearly marked.
Duplicate chunks collapse under a canonical file-and-location identity.
Permissions are applied before content enters the final context package.
Memory records never override current source code without an explicit warning.
Phase 6: Expose the Unified MCP Surface
Agent: MCP Interface Builder

Keep the first release small:

search_context
get_symbol_context
get_impact_context
get_repository_map
recall_decisions
record_decision
explain_context
backend_health

Tool purposes
search_context: hybrid retrieval across enabled providers.
get_symbol_context: definition, references, callers, and related files.
get_impact_context: downstream and upstream change analysis.
get_repository_map: concise project structure and important entry points.
recall_decisions: retrieve durable project decisions.
record_decision: explicitly persist a reviewed decision.
explain_context: show why each result was selected.
backend_health: report provider availability and indexed state.

Keep read operations separate from mutations. MCP defines servers as focused providers of tools, resources, and prompts, while authorization and orchestration belong at the host boundary.

Phase 7: Create the Verification Swarm
Agent: Test Coordinator

Run specialized verification agents after every implementation change.

Contract Test Agent

Checks:

Schema compliance
Stable identifiers
Error normalization
Optional backend behavior
Version negotiation
Retrieval Evaluation Agent

Runs a fixed benchmark set:

- Exact symbol lookup
- Concept-only lookup
- Cross-file dependency question
- Impact-analysis question
- Documentation-to-code question
- Cross-repository implementation search
- Prior-decision recall
- Freshly modified file query


Evaluate:

Did the correct source appear?
Was it ranked near the top?
Were irrelevant results excluded?
Was provenance retained?
Did the result fit the token budget?
Was stale content identified?
Security Agent

Checks:

Workspace boundaries
Path traversal
Symlink escape
Secret-file exclusions
Repository access controls
Cross-tenant leakage
MCP input validation
Prompt injection contained in indexed documents
Failure Injection Agent

Simulates:

Graph backend offline
Vector store unavailable
Embedding provider unavailable
Corrupt database
Partial index
Deleted repository
Changed response schema
Backend timeout
Release gate

A backend failure may reduce retrieval quality, but it must not disable unrelated providers or corrupt the shared index.

3. Upstream Maintenance Workflow

This is the critical portion for reducing patch frequency.

Avoid long-lived source divergence

Preferred order:

1. Consume official release
2. Wrap stable CLI, HTTP, library, or MCP interface
3. Contribute generally useful changes upstream
4. Maintain a tiny overlay patch only when unavoidable
5. Fork core upstream code only as a last resort

Automated upstream agent

Run on a schedule and on dependency update pull requests.

Detect upstream release
    |
    v
Read release notes and API changes
    |
    v
Build disposable compatibility environment
    |
    v
Run adapter contract tests
    |
    +-- PASS -> open version-update PR
    |
    +-- FAIL -> produce compatibility report
                   |
                   +-- configuration change
                   +-- adapter change
                   +-- upstream regression
                   +-- intentional breaking change

Compatibility report format
upstream: codegraphcontext
current_version: "<current>"
candidate_version: "<candidate>"

status: incompatible

breaking_surfaces:
  - endpoint: graph_query
    expected: ContextGraphResultV1
    received: ContextGraphResultV2

affected_contracts:
  - get_symbol_context
  - get_impact_context

recommended_resolution:
  type: adapter_translation
  broker_contract_change: false

required_tests:
  - graph-symbol-contract
  - impact-expansion-contract

Patch ledger

Every local patch must include:

patch_id: PATCH-CGC-001
reason: "Required behavior unavailable through public interface"
upstream_issue: "<link or identifier>"
introduced_against: "<version>"
owner: "<maintainer>"
removal_condition: "Remove when upstream release exposes required field"
covered_by:
  - "tests/contract/test_symbol_locations"


A patch without a removal condition should fail governance review.

4. Parallel Agent Workstreams

After contracts are frozen, run these concurrently:

Workstream A: comP adapter
Workstream B: graph adapter
Workstream C: vector adapter
Workstream D: memory adapter
Workstream E: rank fusion
Workstream F: MCP interface
Workstream G: security controls
Workstream H: benchmark harness
Workstream I: upstream automation


Integrate only through canonical contracts. Agents must not modify another workstream’s implementation directly.

5. Recommended Implementation Order
Milestone 1
- Control repository
- Canonical contracts
- MCP server shell
- comP adapter
- backend health

Milestone 2
- Code graph adapter
- exact symbol lookup
- dependency expansion
- impact context

Milestone 3
- vector adapter
- hybrid retrieval
- rank fusion
- deduplication

Milestone 4
- durable decision memory
- provenance
- freshness validation
- context explanation

Milestone 5
- multi-repository federation
- access policies
- benchmark suite
- failure injection

Milestone 6
- automated upstream updates
- patch ledger enforcement
- compatibility reports
- packaged VS Code experience


Do not begin the UI integration until the MCP contracts and backend compatibility tests are stable.

6. Core Agent Instruction

Use this as the controlling instruction for the implementation agents:

<system_objective>
Build a local-first, backend-neutral context broker that serves ranked,
source-grounded context to AI agents through MCP.
</system_objective>

<architecture_constraints>
Treat the broker contract as the stable product boundary.
Integrate upstream projects through adapters.
Keep upstream source unmodified whenever a supported interface exists.
Keep every context provider optional and replaceable.
Normalize provider results before orchestration.
Separate read-only retrieval from state-changing operations.
Preserve source path, location, backend, freshness, and content hash.
Apply authorization before returning retrieved content.
</architecture_constraints>

<reuse_policy>
Audit existing upstream capabilities before implementing a feature.
Record the reason whenever custom implementation is selected.
Contribute generally useful fixes upstream.
Track unavoidable local patches with an owner and removal condition.
Avoid copying parser, database, embedding, or MCP implementation code.
</reuse_policy>

<execution_pipeline>
<extract>
Inspect the target contract, provider capabilities, repository state,
existing tests, and relevant architectural decisions.
</extract>

<reason>
Identify the smallest compatible change.
Evaluate whether configuration, adaptation, or upstream contribution
can satisfy the requirement before changing broker behavior.
</reason>

<produce>
Implement the bounded change.
Add contract, integration, failure, and security tests.
Update the capability matrix and architectural decision records.
Return modified files, test results, known limitations, and patch status.
</produce>
</execution_pipeline>

<validation_requirements>
Reject backend-specific objects outside their adapter.
Reject context without provenance.
Reject silent stale-index results.
Reject unrestricted cross-repository retrieval.
Reject local patches without documented removal conditions.
Reject MCP contract changes without compatibility tests.
</validation_requirements>

<primary_directive>
Preserve a thin orchestration layer so upstream releases can be adopted
by changing adapters rather than repeatedly patching forked source.
</primary_directive>

Primary Architecture Decision

Use your comP fork as the distribution and developer-experience layer, but keep the context broker as an independent package with adapters. comP should not become the permanent home of graph parsing, vector storage, embedding generation, and every future connector. That separation gives you one stable MCP surface while allowing individual retrieval engines to advance upstream without forcing repeated cross-cutting patches.