# Upstream Patch Ledger & Governance Rules

To preserve upstream compatibility and eliminate manual fork maintenance, any local overlay or temporary patch must be recorded in this directory.

## Governance Invariant
**A patch without a documented `removal_condition` and `upstream_issue` will fail automated CI governance review.**

## Mandatory Patch Schema
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
  - "tests/contract/provider-contract.spec.ts"
```
