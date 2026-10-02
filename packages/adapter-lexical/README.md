# @unified-context-broker/adapter-lexical

Lexical retrieval engine providing BM25 keyword matching, file-level chunking, and markdown/documentation indexing.

## Overview

The `adapter-lexical` package implements fast, deterministic keyword search and document chunking across codebases. It serves as the primary provider for exact terminology, function names, and markdown documentation searches.

## Key Capabilities

- **BM25 Inverted Index:** In-memory or persisted BM25 ranking model with query term frequency (TF) and inverse document frequency (IDF) weighting.
- **Smart Document Chunking:** Header-aware chunking for Markdown/MDX, and function/block chunking for source code.
- **Configurable Boundaries:** Token-limited chunk slicing with overlap retention to prevent fragmented context.

## Dependencies

- `@unified-context-broker/contracts`
