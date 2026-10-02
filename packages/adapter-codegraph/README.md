# @unified-context-broker/adapter-codegraph

Structural code intelligence adapter providing AST symbol resolution, caller/callee graphs, and blast-radius impact analysis.

## Overview

The `adapter-codegraph` package analyzes the syntactic and semantic structure of source code using Tree-sitter / SCIP AST models. It powers high-precision symbol inspection and upstream/downstream impact analysis.

## Key Capabilities

- **Exact Symbol Resolution (`get_symbol_context`, `lookup_symbol`):**
  - Resolves definitions, interfaces, classes, functions, and method signatures.
  - Extracts accompanying docstrings, types, and parameter declarations.
- **Dependency & Call Graph Navigation:**
  - Identifies direct and indirect callers and references across files.
- **Blast Radius & Impact Analysis (`get_impact_context`, `analyze_impact`):**
  - Traverses the dependency tree to compute upstream consumers and downstream dependencies before refactoring.
- **Repository Architecture Synthesis (`get_repository_map`, `get_repo_map`):**
  - Synthesizes top-level directory layout, key interfaces, and entry point modules.

## Dependencies

- `@unified-context-broker/contracts`
