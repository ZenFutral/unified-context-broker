# @unified-context-broker/security

Workspace boundary jail enforcement, real-time regex secret scrubber, permission & RBAC scope validator, and path sanitization.

## Overview

The `security` package protects host environments and AI agent workflows from file-access vulnerabilities, accidental secret exfiltration, and unauthorized mutation.

## Key Capabilities

- **Boundary Guard (`BoundaryGuard`):**
  - Path canonicalization and directory jail enforcement.
  - Resolves symlinks and rejects directory traversal attacks (`../`, `%2e%2e`, UNC paths) targeting files outside the workspace root.
- **Secret Scrubber (`SecretScrubber`):**
  - High-performance regex engine scanning emitted text and candidate chunks.
  - Automatically detects and redacts AWS keys, GitHub tokens, JWTs, private RSA/PEM keys, and connection strings (`[REDACTED_SECRET]`).
- **Permission & Policy Validator (`PolicyValidator`):**
  - Validates tool invocations against workspace permission policies.
  - Enforces read-only isolation on query endpoints and controls mutation scopes.

## Dependencies

- `@unified-context-broker/contracts`
