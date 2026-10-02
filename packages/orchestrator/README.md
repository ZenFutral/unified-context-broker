# @unified-context-broker/orchestrator

Query classification, parallel adapter execution, token budget knapsack allocation, CLI entry points, and the safe source mutation engine.

## Overview

The `orchestrator` package acts as the central brain of the Unified Context Broker. It plans retrieval strategies based on query intent, executes adapter queries concurrently with isolated error boundaries and timeouts, packs candidates into token budgets, and executes safe atomic search-and-replace file mutations.

## Key Capabilities

- **Intent Classifier (`QueryClassifier`):** Automatically distinguishes between symbol lookups, architectural queries, error debugging, and semantic code search.
- **Parallel Retrieval Executor (`RetrievalPlanner`):** Dispatches queries across lexical, vector, codegraph, git, and memory adapters simultaneously with per-adapter timeout guards.
- **Token Budget Knapsack (`BudgetManager`):** Greedy knapsack packing algorithm ensuring retrieved context strictly honors requested token limits without splitting tokens awkwardly.
- **Safe Mutation Engine (`search_and_replace`):** Atomic exact-match string replacement engine supporting dry-run previews, expected occurrence validation, and workspace boundary security.
- **CLI Binary (`bin/cli.js`):** Standalone zero-daemon CLI supporting `search`, `symbol`, `digest`, `memory`, and `--health`.

## Dependencies

- `@unified-context-broker/contracts`
- `@unified-context-broker/ranking`
- `@unified-context-broker/security`
- `@unified-context-broker/provenance`
- `@unified-context-broker/adapter-lexical`
- `@unified-context-broker/adapter-codegraph`
- `@unified-context-broker/adapter-vector`
- `@unified-context-broker/adapter-git`
- `@unified-context-broker/adapter-memory`
