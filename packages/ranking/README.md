# @unified-context-broker/ranking

Spatial candidate deduplication, graph neighborhood expansion, and staged rank fusion.

## Overview

The `ranking` package synthesizes context candidates produced by heterogeneous adapters into an optimal, non-redundant, ranked set of code slices.

## Key Capabilities

- **Spatial Candidate Deduplicator (`SpatialDeduplicator`):**
  - Line-range overlap detection and suppression.
  - Merges adjacent or overlapping code spans from the same file into unified slices to prevent token waste.
- **Graph Neighborhood Expander (`GraphExpander`):**
  - Traverses caller/callee trees and symbol dependencies.
  - Applies exponential or distance-decay weighting ($1 / (1 + \alpha \cdot d)$) to incorporate contextual neighbors into the candidate pool.
- **Staged Rank Fusion (`RankFusionEngine`):**
  - Combines BM25 scores, vector similarity cosine scores, graph proximity, and git freshness.
  - Supports Reciprocal Rank Fusion (RRF) and configurable Weighted Linear Scoring.

## Dependencies

- `@unified-context-broker/contracts`
