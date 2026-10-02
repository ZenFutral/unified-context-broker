# @unified-context-broker/adapter-vector

Semantic vector retrieval adapter supporting local ONNX/LanceDB embeddings, vector similarity search, and natural language intent matching.

## Overview

The `adapter-vector` package enables semantic concept search across codebases without requiring exact keyword matches. It integrates local embedding pipelines and embedded vector storage.

## Key Capabilities

- **Local Embedding Pipelines:** Compatible with ONNX runtime models (e.g., all-MiniLM-L6-v2) for zero-cloud, fully offline vector inference.
- **Embedded Vector Store:** Fast cosine and L2 similarity nearest-neighbor retrieval using LanceDB or local vector indexes.
- **Hybrid Fusion Ready:** Returns normalized cosine scores ready for Reciprocal Rank Fusion (RRF) and Weighted Linear Scoring alongside lexical and structural results.

## Dependencies

- `@unified-context-broker/contracts`
