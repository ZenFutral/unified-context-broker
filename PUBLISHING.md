# Publishing & Standalone Distribution Guide

This guide documents the build, bundling, zero-dependency distribution, and marketplace release processes for the **Unified Context Broker MCP Server** and companion IDE extensions.

---

## 1. Architecture & Packaging Overview

Context Broker is engineered as a zero-daemon, zero-footprint MCP server. It can be distributed in three distinct formats:

1. **Standalone Zero-Dependency Node.js Bundle (`apps/mcp-server/dist/bundle.js`)**:
   - Single pre-bundled ESM file with all dependencies and adapters inlined.
   - Requires only a Node.js runtime (`>= 20.0.0`) on the target machine.
   - Ideal for direct inclusion in Cursor, Claude Desktop, Windsurf, Antigravity IDE, or CI environments.
2. **Monorepo Source / CLI (`packages/orchestrator/bin/cli.js`)**:
   - Zero-daemon CLI for scripted CI and agent execution without starting an MCP server.
3. **VS Code Extension (`.vsix`)**:
   - Packaged extension for Visual Studio Code, VSCodium, Eclipse Theia, and Antigravity IDE.

---

## 2. Building the Standalone Bundle

The standalone bundle bundles all TypeScript source code, Zod contracts, ranking engines, AST analyzers, and upstream adapters into a single portable JavaScript bundle.

### Build Command
```bash
# Build all monorepo packages and standalone bundle
pnpm run build

# Or directly bundle apps/mcp-server
pnpm --filter @context-broker/mcp-server run bundle
```

Under the hood, this executes `esbuild`:
```bash
esbuild apps/mcp-server/src/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=esm \
  --outfile=apps/mcp-server/dist/bundle.js
```

### Bundle Output
- Location: `apps/mcp-server/dist/bundle.js`
- Size: ~6.1 MB (includes bundled tokenizer, schemas, and in-memory fallback indexes)
- External Dependencies: **None** (zero `node_modules` required at runtime).

---

## 3. Host Runtime Configurations

### 1. Antigravity IDE & Gemini CLI
Add to `.agents/mcp_config.json`:
```json
{
  "mcpServers": {
    "context-broker": {
      "command": "node",
      "args": ["./apps/mcp-server/dist/bundle.js"],
      "env": {
        "CONTEXT_BROKER_MOCK": "false"
      }
    }
  }
}
```

### 2. Visual Studio Code & Claude Desktop
Add to `.vscode/mcp.json` or `%APPDATA%\Claude\claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "context-broker": {
      "command": "node",
      "args": ["./apps/mcp-server/dist/bundle.js"]
    }
  }
}
```

### 3. Cursor AI & Windsurf
Add to `.cursor/mcp.json` or `.windsurf/mcp.json`:
```json
{
  "mcpServers": {
    "context-broker": {
      "command": "node",
      "args": ["./apps/mcp-server/dist/bundle.js"]
    }
  }
}
```

---

## 4. Packaging the VS Code Extension (`.vsix`)

The companion extension provides telemetry dashboards, status bar indicators, and automatic rule scaffolding.

### Prerequisites
- Node.js `>= 20.0.0`
- pnpm `>= 9.0.0`
- `@vscode/vsce`

### Packaging Steps
```bash
# 1. Ensure all packages are built
pnpm run build

# 2. Package the extension .vsix
pnpm run package:extension
```

This compiles the extension and outputs `apps/vscode-extension/unified-context-broker-0.1.0.vsix`.

### Testing Local Installation
```bash
code --install-extension apps/vscode-extension/unified-context-broker-0.1.0.vsix
```

---

## 5. Marketplace Publishing

### Open VSX Registry (Antigravity IDE, VSCodium, Eclipse Theia)
1. Generate an Open VSX Access Token from [open-vsx.org](https://open-vsx.org).
2. Set `OVSX_PAT` in your CI environment secrets.
3. Publish using `ovsx`:
   ```bash
   npx ovsx publish apps/vscode-extension/unified-context-broker-0.1.0.vsix -p $OVSX_PAT
   ```

### Visual Studio Marketplace
1. Generate a Personal Access Token (PAT) with `Marketplace (Manage)` permissions in Azure DevOps.
2. Set `VSCE_PAT` in your CI environment secrets.
3. Publish using `vsce`:
   ```bash
   npx vsce publish --packagePath apps/vscode-extension/unified-context-broker-0.1.0.vsix -p $VSCE_PAT
   ```

---

## 6. Zero-Pollution Confinement Mandate

Context Broker enforces strict containment rules to prevent polluting host projects:

- **Isolated Internal Storage**: All operational databases, SQLite indexes, telemetry logs (`events.jsonl`), and durable decision records (`decisions.jsonl`) are strictly confined to `<brokerRoot>/.data/`.
- **Single External Indicator (`AGENTS.md`)**: The broker never generates loose files or hidden folders in target repositories. Only a single optional directive block in the host's `AGENTS.md` is utilized to instruct AI models to invoke broker tools.
- **Dry-Run Default for Mutations**: The `search_and_replace` engine defaults to previewing mutations via unified diffs unless explicitly committed, preventing inadvertent modifications.
