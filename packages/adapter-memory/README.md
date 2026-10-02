# @unified-context-broker/adapter-memory

Durable architectural memory store supporting persistent Architectural Decision Records (ADRs), JSON-L append logging, and semantic decision recall.

## Overview

The `adapter-memory` package provides durable, cross-session memory for AI agent workflows. It ensures that technical decisions, architectural rationale, and discarded alternatives are persistently stored and proactively recalled before making breaking changes.

## Key Capabilities

- **Architectural Decision Records (ADRs):**
  - Stores structured decision records adhering to the `DecisionRecord` schema (title, decision, rationale, alternatives, tags, timestamp).
  - Preserved in a durable, append-only JSON-L file (`.data/memory/decisions.jsonl`).
- **Semantic & Keyword Recall (`recall_decisions`):**
  - Filters and ranks historical decisions by natural language query and tags.
- **Decision Persistence (`record_decision`):**
  - Appends reviewed architectural decisions to disk with deterministic IDs (`ADR-001`, `ADR-002`, etc.).
- **Zero Host Pollution:**
  - Storage is strictly encapsulated within the broker's designated `.data/` directory or user-configured database path.

## Dependencies

- `@unified-context-broker/contracts`
