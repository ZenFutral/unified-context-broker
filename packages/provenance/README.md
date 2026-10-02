# @unified-context-broker/provenance

SHA-256 cryptographic chunk fingerprinting, IDE-clickable markdown citations, and score explainability telemetry.

## Overview

The `provenance` package ensures full auditability and traceability for all code slices and context items emitted by the Unified Context Broker.

## Key Capabilities

- **Cryptographic Chunk Fingerprinting (`ProvenanceHasher`):**
  - Computes deterministic SHA-256 hashes over source content, file paths, and line spans.
  - Enables deduplication verification and content immutability checks across agent turns.
- **Clickable Markdown Citations (`CitationFormatter`):**
  - Formats source locations into clickable IDE markdown links (`[filename.ts:L10-L45](file:///workspace/filename.ts#L10-L45)`).
- **Score Explainer Engine (`ScoreExplainer`):**
  - Powers the `explain_context` tool.
  - Emits detailed mathematical breakdowns for every candidate (BM25 lexical weight, vector cosine similarity, graph hop penalty, git recency boost, final fused score).

## Dependencies

- `@unified-context-broker/contracts`
