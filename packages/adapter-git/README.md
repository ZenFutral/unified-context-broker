# @unified-context-broker/adapter-git

Git version control adapter tracking active working tree diffs, commit history recency, author blame, and churn-based freshness scoring.

## Overview

The `adapter-git` package grounds context retrieval in real-time version control metadata. It allows the broker to prioritize recently edited files and actively staged code modifications during search and ranking.

## Key Capabilities

- **Working Tree Awareness:**
  - Detects unstaged and staged git diffs in the active workspace.
  - Slices uncommitted modifications so agents understand immediate in-progress edits.
- **Commit History & Recency Scoring:**
  - Evaluates commit age and author recency for files matching retrieval queries.
  - Applies a configurable freshness boost to active files.
- **File Churn & Blame Analysis:**
  - Computes file churn metrics to identify hotspots and frequent areas of refactoring.

## Dependencies

- `@unified-context-broker/contracts`
