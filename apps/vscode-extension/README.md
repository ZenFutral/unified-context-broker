# Context Broker MCP Companion for VS Code

Official companion extension for the **Unified Context Broker MCP Server**.

Provides real-time visibility into token budget savings, active provider statuses (comP, CodeGraphContext, Vector, Git, Memory), and a live stream of agent MCP retrieval operations directly in your editor.

---

## Features

### 1. Three Flexible Window Modes
- **Full Extension Page Tab (`contextBroker.openPage`)**: Open a persistent, stable telemetry dashboard directly in an editor column.
- **Dockable Sidebar / Panel (`contextBrokerContainer`)**: Embedded in the VS Code Activity Bar with a dedicated icon. Can be docked to the primary sidebar, secondary sidebar, or bottom panel.
- **Floating Draggable HUD Overlay (`contextBroker.openDraggableHUD`)**: In-editor overlay card that can be dragged anywhere on screen, minimized to a compact status pill, or expanded.

### 2. Live Telemetry
- **Estimated Token Savings**: Visualizes tokens pruned vs raw source AST and monitors context budget utilization.
- **Provider Status Grid**: Real-time health across all 5 adapters:
  - **comP**: BM25 & full text extraction
  - **CodeGraph**: AST symbol and caller graph
  - **Vector**: Dense semantic embedding similarity
  - **Git**: Branch status, diffs, and freshness
  - **Memory**: Durable architectural decisions & facts
- **Live MCP Command Log**: Streaming feed of tool calls (`search_context`, `get_symbol_context`, `get_impact_context`, `record_decision`) with execution latency and tokens saved.

---

## Commands

- `Context Broker: Open Extension Page (Telemetry & Monitoring)`: Open full telemetry tab.
- `Context Broker: Show Quick Menu`: Interactive menu from the status bar.
- `Context Broker: Open Floating Draggable HUD Window`: Open overlay HUD.
- `Context Broker: Open Beside / Detached Window`: Open side-by-side view.
- `Context Broker: Quick Hybrid Context Search`: Search context across all active adapters.
- `Context Broker: Check Backend Health`: Check status of all backend adapters.
- `Context Broker: Record Architectural Decision`: Save an architectural decision to durable memory.

---

## Installation & Setup

### From Open VSX Registry (VSCodium, Eclipse Theia, Antigravity IDE)
Search for `Unified Context Broker MCP Companion` in the Extensions view, or install via command line:
```bash
ovsx get unified-context-broker.unified-context-broker
```

### Manual Installation (.vsix)
Download the latest `.vsix` from the [GitHub Releases](https://github.com/ZenFutral/unified-context-broker/releases) page and run:
```bash
code --install-extension unified-context-broker-0.1.0.vsix
```

## Requirements
- VS Code `^1.85.0` or compatible editor (e.g. Antigravity IDE, VSCodium).
- Node.js `20.x` or later.
- Context Broker MCP Server running locally via stdio or HTTP telemetry bridge.

## License
MIT License. Copyright (c) 2026 Zen Futral and Unified Context Broker Contributors.
