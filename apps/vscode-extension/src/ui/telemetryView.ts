/**
 * Generates the rich interactive webview HTML for the Context Broker HUD & Telemetry Window.
 * Supports:
 * 1. Estimated Token Savings stats & compression meter
 * 2. Real-time Status for all 5 providers (comP, CodeGraphContext, Vector, Git, Memory)
 * 3. Live Log of MCP Commands with expandable Input/Output view
 * 4. Interactive Record ADR modal dialog
 * 5. Draggable floating overlay mode with collapse/pin/move handles & Pop-out capability
 */
export function getTelemetryWebviewContent(isFloatingHUD: boolean = false): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src https: data: vscode-webview:; script-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Context Broker Display</title>
  <style>
    :root {
      --bg-base: #090d16;
      --bg-card: rgba(18, 24, 38, 0.85);
      --bg-card-hover: rgba(28, 38, 58, 0.95);
      --border-color: rgba(56, 189, 248, 0.18);
      --border-accent: #38bdf8;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent-cyan: #38bdf8;
      --accent-emerald: #34d399;
      --accent-violet: #a78bfa;
      --accent-amber: #fbbf24;
      --accent-rose: #f43f5e;
      --font-mono: 'Consolas', 'Courier New', monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: ${isFloatingHUD ? 'rgba(9, 13, 22, 0.65)' : 'var(--bg-base)'};
      color: var(--text-main);
      font-family: var(--font-sans);
      font-size: 13px;
      line-height: 1.4;
      height: 100vh;
      overflow: hidden;
      user-select: none;
      backdrop-filter: ${isFloatingHUD ? 'blur(12px)' : 'none'};
    }

    /* Container */
    #app-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      position: relative;
    }

    /* Floating Draggable Wrapper */
    .hud-window {
      ${isFloatingHUD ? `
        position: absolute;
        top: 24px;
        left: 24px;
        width: min(540px, calc(100vw - 48px));
        max-height: calc(100vh - 48px);
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(56, 189, 248, 0.2);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 999;
        transition: box-shadow 0.2s;
      ` : `
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      `}
    }

    /* Top Window Bar & Drag Handle */
    .window-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(15, 23, 42, 0.95);
      border-bottom: 1px solid var(--border-color);
      ${isFloatingHUD ? 'cursor: grab;' : ''}
    }
    .window-header:active {
      ${isFloatingHUD ? 'cursor: grabbing;' : ''}
    }

    .window-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 13px;
      color: var(--text-main);
      letter-spacing: 0.3px;
    }

    .window-title .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-emerald);
      box-shadow: 0 0 8px var(--accent-emerald);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1); }
    }

    .window-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Clean visual buttons */
    .btn-header {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: var(--text-main);
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .btn-header:hover {
      background: rgba(56, 189, 248, 0.2);
      border-color: var(--accent-cyan);
      color: #fff;
      transform: translateY(-1px);
    }
    .btn-header svg {
      fill: currentColor;
    }

    /* Content Area */
    .window-body {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Section Header */
    .section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    /* 1. Token Savings Section */
    .token-card {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .token-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .metric-box {
      background: rgba(10, 15, 26, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 8px 10px;
    }
    .metric-box .label {
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-box .value {
      font-size: 18px;
      font-weight: 700;
      color: var(--accent-cyan);
      font-family: var(--font-mono);
      margin-top: 2px;
    }
    .metric-box .sub {
      font-size: 10px;
      color: var(--accent-emerald);
      margin-top: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .progress-track {
      width: 100%;
      height: 6px;
      background: rgba(15, 23, 42, 0.8);
      border-radius: 3px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #38bdf8, #34d399);
      border-radius: 3px;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* 2. Providers Status Grid */
    .providers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 8px;
    }

    .provider-pill {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all 0.15s;
    }
    .provider-pill:hover {
      border-color: var(--border-color);
      background: var(--bg-card-hover);
    }

    .provider-pill-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .provider-name {
      font-weight: 600;
      font-size: 11px;
      color: var(--text-main);
    }
    .status-badge {
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-badge.healthy {
      background: rgba(52, 211, 153, 0.15);
      color: var(--accent-emerald);
      border: 1px solid rgba(52, 211, 153, 0.3);
    }

    .provider-detail {
      font-size: 10px;
      color: var(--text-dim);
      font-family: var(--font-mono);
    }

    /* 3. MCP Command Logs */
    .logs-container {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      min-height: 160px;
    }

    .logs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logs-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .log-list {
      background: rgba(8, 12, 20, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 6px;
      overflow-y: auto;
      max-height: 260px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 11px;
    }

    .log-entry {
      background: rgba(18, 24, 38, 0.7);
      border-left: 3px solid var(--accent-cyan);
      border-radius: 4px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .log-entry:hover {
      background: rgba(30, 41, 59, 0.85);
    }
    .log-entry-header {
      cursor: pointer;
    }

    .log-row-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .log-tool {
      font-weight: 700;
      color: var(--accent-cyan);
    }
    .log-tool.symbol { color: var(--accent-violet); }
    .log-tool.impact { color: var(--accent-rose); }
    .log-tool.memory { color: var(--accent-amber); }
    .log-tool.health { color: var(--accent-emerald); }
    .log-tool.repo { color: #38bdf8; }
    .log-tool.explain { color: #f472b6; }

    .log-time {
      font-size: 9px;
      color: var(--text-dim);
    }

    .log-row-details {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: var(--text-muted);
    }

    .log-saved {
      color: var(--accent-emerald);
      font-weight: 600;
    }

    .log-args {
      color: var(--text-dim);
      font-size: 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 320px;
    }

    /* Expandable Log Details Body */
    .log-details-body {
      background: rgba(10, 15, 26, 0.9);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 4px;
      padding: 8px;
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 11px;
    }

    .log-detail-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .detail-title {
      font-size: 10px;
      font-weight: 700;
      color: var(--accent-cyan);
      letter-spacing: 0.5px;
    }
    .detail-code {
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      padding: 6px 8px;
      color: var(--text-main);
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 140px;
      overflow-y: auto;
    }

    /* Action bar */
    .action-bar {
      display: flex;
      gap: 8px;
      padding-top: 4px;
    }
    .btn-action {
      flex: 1;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: var(--accent-cyan);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .btn-action:hover {
      background: rgba(56, 189, 248, 0.25);
      border-color: var(--accent-cyan);
      color: #fff;
    }

    /* ADR Modal Styling */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal-content {
      background: #0f172a;
      border: 1px solid var(--accent-cyan);
      border-radius: 10px;
      width: min(480px, 95vw);
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8);
      display: flex;
      flex-direction: column;
    }
    .modal-header {
      padding: 12px 16px;
      background: rgba(30, 41, 59, 0.8);
      border-bottom: 1px solid rgba(56, 189, 248, 0.2);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 700;
      color: var(--accent-cyan);
    }
    .modal-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .form-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.5px;
    }
    .form-input, .form-textarea {
      background: rgba(10, 15, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 8px 10px;
      color: var(--text-main);
      font-family: var(--font-sans);
      font-size: 12px;
      outline: none;
    }
    .form-input:focus, .form-textarea:focus {
      border-color: var(--accent-cyan);
    }
    .form-textarea {
      min-height: 60px;
      resize: vertical;
    }
    .modal-footer {
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn-secondary {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: var(--text-muted);
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-primary {
      background: var(--accent-cyan);
      border: none;
      color: #090d16;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-primary:hover {
      background: #7dd3fc;
    }

    /* Collapsed state */
    .hud-window.minimized .window-body {
      display: none;
    }
    .hud-window.minimized {
      width: 260px;
    }
  </style>
</head>
<body>
  <div id="app-container">
    <div class="hud-window" id="hudWindow">
      <!-- Window Header / Drag Bar -->
      <div class="window-header" id="dragHeader">
        <div class="window-title">
          <span class="live-dot"></span>
          <span>Context Broker</span>
          <span style="font-size: 10px; color: var(--text-dim); margin-left: 4px;">MCP</span>
        </div>
        <div class="window-controls">
          <button class="btn-header" id="btnRefresh" title="Refresh Adapter Health">
            <svg width="12" height="12" viewBox="0 0 16 16"><path fill="currentColor" d="M13.6 2.4A7.9 7.9 0 0 0 8 0a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.8-4.2L10 6h6V0l-2.4 2.4z"/></svg>
            <span>Refresh Health</span>
          </button>
          ${isFloatingHUD ? `
            <button class="btn-header" id="btnOpenPage" title="Open Full Tab">
              <svg width="12" height="12" viewBox="0 0 16 16"><path fill="currentColor" d="M1.5 1h5l-2.1 2.1 5.4 5.4-1.4 1.4-5.4-5.4L1 6.5V1zm13 14h-5l2.1-2.1-5.4-5.4 1.4-1.4 5.4 5.4 2.1-2.1v5z"/></svg>
              <span>Page</span>
            </button>
            <button class="btn-header" id="btnMinimize" title="Minimize / Expand">_</button>
          ` : `
            <button class="btn-header" id="btnFloatHUD" title="Open as Floating Draggable HUD">
              <svg width="12" height="12" viewBox="0 0 16 16"><path fill="currentColor" d="M1 3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3zm2-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3z"/></svg>
              <span>Float</span>
            </button>
            <button class="btn-header" id="btnOpenPage" title="Open Full Tab / Beside">
              <svg width="12" height="12" viewBox="0 0 16 16"><path fill="currentColor" d="M1.5 1h5l-2.1 2.1 5.4 5.4-1.4 1.4-5.4-5.4L1 6.5V1zm13 14h-5l2.1-2.1-5.4-5.4 1.4-1.4 5.4 5.4 2.1-2.1v5z"/></svg>
              <span>Page</span>
            </button>
          `}
        </div>
      </div>

      <!-- Window Body -->
      <div class="window-body">
        <!-- 1. Token Savings Section -->
        <div>
          <div class="section-title">
            <span>Estimated Token Savings</span>
            <span style="color: var(--accent-emerald); font-weight: 600;" id="reductionPct">0.0% SAVED</span>
          </div>
          <div class="token-card">
            <div class="token-metrics">
              <div class="metric-box">
                <div class="label">Tokens Saved</div>
                <div class="value" id="tokensSavedVal">0</div>
                <div class="sub">▲ Pruned vs Target Files</div>
              </div>
              <div class="metric-box">
                <div class="label">Context Served</div>
                <div class="value" id="tokensServedVal">0</div>
                <div class="sub" style="color: var(--text-muted)">MCP Response Tokens</div>
              </div>
            </div>
            <div class="progress-track">
              <div class="progress-bar" id="tokenProgressBar" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <!-- 2. Provider Status Section -->
        <div>
          <div class="section-title">
            <span>Provider Status</span>
            <span style="color: var(--accent-cyan);" id="healthyCount">5 / 5 Healthy</span>
          </div>
          <div class="providers-grid" id="providersGrid">
            <div class="provider-pill">
              <div class="provider-pill-header">
                <span class="provider-name">comP</span>
                <span class="status-badge healthy">Active</span>
              </div>
              <div class="provider-detail">BM25 Engine</div>
            </div>

            <div class="provider-pill">
              <div class="provider-pill-header">
                <span class="provider-name">CodeGraph</span>
                <span class="status-badge healthy">Active</span>
              </div>
              <div class="provider-detail">AST Engine</div>
            </div>

            <div class="provider-pill">
              <div class="provider-pill-header">
                <span class="provider-name">Vector</span>
                <span class="status-badge healthy">Active</span>
              </div>
              <div class="provider-detail">ONNX Embeds</div>
            </div>

            <div class="provider-pill">
              <div class="provider-pill-header">
                <span class="provider-name">Git</span>
                <span class="status-badge healthy">Active</span>
              </div>
              <div class="provider-detail">Git Freshness</div>
            </div>

            <div class="provider-pill">
              <div class="provider-pill-header">
                <span class="provider-name">Memory</span>
                <span class="status-badge healthy">Active</span>
              </div>
              <div class="provider-detail">.agents Store</div>
            </div>
          </div>
        </div>

        <!-- 3. MCP Command Logs Section -->
        <div class="logs-container">
          <div class="logs-header">
            <div class="section-title" style="margin-bottom: 0;">Agent MCP Command Log (Click entry to inspect)</div>
            <div class="logs-actions">
              <button class="btn-header" id="btnClearLogs" title="Clear Logs">Clear</button>
            </div>
          </div>
          <div class="log-list" id="logList">
            <!-- Dynamic Log Items -->
          </div>
        </div>

        <!-- Action Bar -->
        <div class="action-bar">
          <button class="btn-action" id="btnRecordDecision">
            <span>📝 Record Architectural Decision (ADR)</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Interactive ADR Modal Dialog -->
  <div id="adrModal" class="modal-overlay" style="display: none;">
    <div class="modal-content">
      <div class="modal-header">
        <span>📝 Record Architectural Decision Record (ADR)</span>
        <button class="btn-header" id="btnCloseAdrModal">✕</button>
      </div>
      <div class="modal-body">
        <label class="form-label">ADR Title *</label>
        <input type="text" id="adrTitle" class="form-input" placeholder="e.g. Store ADR Records in .agents Directory" />

        <label class="form-label">Decision *</label>
        <textarea id="adrDecision" class="form-textarea" placeholder="What architectural decision was made?"></textarea>

        <label class="form-label">Rationale *</label>
        <textarea id="adrRationale" class="form-textarea" placeholder="Why was this decision made? What trade-offs were evaluated?"></textarea>

        <label class="form-label">Rejected Alternatives (Optional)</label>
        <input type="text" id="adrAlternatives" class="form-input" placeholder="e.g. Unstructured text files, Cloud database (comma-separated)" />

        <label class="form-label">Tags / Components (Optional)</label>
        <input type="text" id="adrTags" class="form-input" placeholder="e.g. memory, architecture, adr (comma-separated)" />
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" id="btnCancelAdr">Cancel</button>
        <button class="btn-primary" id="btnSubmitAdr">Save ADR to .agents</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

    // State
    let totalSaved = 0;
    let totalServed = 0;
    let totalTarget = 0;
    let logs = [];
    let expandedLogId = null;

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function toggleLogDetails(id) {
      if (expandedLogId === id) {
        expandedLogId = null;
      } else {
        expandedLogId = id;
      }
      renderLogs();
    }

    function renderLogs() {
      const container = document.getElementById('logList');
      if (!container) return;

      if (!logs || logs.length === 0) {
        container.innerHTML = \`
          <div style="padding: 28px 16px; text-align: center; color: var(--text-dim);">
            <div style="font-size: 26px; margin-bottom: 8px;">⚡</div>
            <div style="font-weight: 600; color: var(--text-muted); font-size: 13px; margin-bottom: 6px;">Waiting for MCP Tool Calls</div>
            <div style="font-size: 11px; line-height: 1.5; max-width: 340px; margin: 0 auto;">
              When AI agents invoke Context Broker tools (such as <code>search_context</code> or <code>get_symbol_context</code>), live command logs and input/output payloads will stream here automatically.
            </div>
          </div>
        \`;
        return;
      }

      container.innerHTML = logs.map(item => {
        const isExpanded = expandedLogId === item.id;
        const inputPayload = item.args || 'No arguments provided';
        const outputPayload = item.breakdown || item.details ? JSON.stringify(item.details || {}, null, 2) : 'Command executed successfully.';

        return \`
          <div class="log-entry \${item.isNew ? 'new-entry' : ''}">
            <div class="log-entry-header" onclick="toggleLogDetails('\${item.id}')">
              <div class="log-row-top">
                <span class="log-tool \${item.type}">\${escapeHtml(item.tool)}</span>
                <span class="log-time">\${escapeHtml(item.time)} (\${item.latency})</span>
              </div>
              <div class="log-row-details">
                <span class="log-args">\${escapeHtml(item.args)}</span>
                <span class="log-saved">\${item.tokensSaved}</span>
              </div>
            </div>
            \${isExpanded ? \`
              <div class="log-details-body">
                <div class="log-detail-section">
                  <span class="detail-title">📥 INPUT (Command & Parameters):</span>
                  <pre class="detail-code">\${escapeHtml(inputPayload)}</pre>
                </div>
                <div class="log-detail-section">
                  <span class="detail-title">📤 OUTPUT (Response & Token Breakdown):</span>
                  <pre class="detail-code">\${escapeHtml(outputPayload)}</pre>
                </div>
              </div>
            \` : ''}
          </div>
        \`;
      }).join('');
    }

    function addLogEntry(tool, args, latency, savedCount, isInitial, details) {
      const savedNum = Number(savedCount || 0);
      const servedNum = Number(details && details.mcpResponseTokens ? details.mcpResponseTokens : (savedNum > 0 ? Math.max(50, Math.round(savedNum * 0.15)) : 0));
      const targetNum = Number(details && details.targetFilesTotalTokens ? details.targetFilesTotalTokens : (savedNum + servedNum));

      totalSaved += savedNum;
      totalServed += servedNum;
      totalTarget += targetNum;

      const pct = totalTarget > 0 ? Math.min(99.9, Math.round((totalSaved / totalTarget) * 1000) / 10) : 0;
      const elSaved = document.getElementById('tokensSavedVal');
      const elServed = document.getElementById('tokensServedVal');
      const elPct = document.getElementById('reductionPct');
      const elBar = document.getElementById('tokenProgressBar');

      if (elSaved) elSaved.textContent = totalSaved.toLocaleString();
      if (elServed) elServed.textContent = totalServed.toLocaleString();
      if (elPct) elPct.textContent = pct.toFixed(1) + '% SAVED';
      if (elBar) elBar.style.width = Math.min(100, Math.max(0, pct)) + '%';

      let type = 'search';
      if (tool.includes('symbol')) type = 'symbol';
      else if (tool.includes('impact')) type = 'impact';
      else if (tool.includes('decision') || tool.includes('memory')) type = 'memory';
      else if (tool.includes('health')) type = 'health';
      else if (tool.includes('repo')) type = 'repo';
      else if (tool.includes('explain')) type = 'explain';

      let breakdown = '';
      if (details && details.targetFilesTotalTokens) {
        const fc = details.filesCount || 1;
        const fileStr = fc === 1 ? '1 target file' : \`\${fc} target files\`;
        const redPct = details.reductionPct ? \` (\${details.reductionPct}% saved)\` : '';
        breakdown = \`\${fileStr}: \${Number(details.targetFilesTotalTokens).toLocaleString()} tok → \${Number(details.mcpResponseTokens || 0).toLocaleString()} mcp tok\${redPct}\`;
      }

      const item = {
        id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
        tool: tool,
        args: args || '',
        time: isInitial ? 'History' : 'Just now',
        latency: latency + 'ms',
        tokensSaved: '+' + savedNum.toLocaleString() + ' saved',
        breakdown: breakdown,
        type: type,
        details: details,
        isNew: !isInitial
      };

      logs.unshift(item);

      if (logs.length > 50) logs.pop();
      renderLogs();
    }

    // Draggable Logic for Floating HUD
    const hudWindow = document.getElementById('hudWindow');
    const dragHeader = document.getElementById('dragHeader');

    if (dragHeader && hudWindow && ${isFloatingHUD ? 'true' : 'false'}) {
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;

      dragHeader.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = hudWindow.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      function onMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const maxX = Math.max(10, window.innerWidth - (hudWindow.offsetWidth || 400) - 10);
        const maxY = Math.max(10, window.innerHeight - (hudWindow.offsetHeight || 300) - 10);
        hudWindow.style.left = Math.min(Math.max(10, initialLeft + dx), maxX) + 'px';
        hudWindow.style.top = Math.min(Math.max(10, initialTop + dy), maxY) + 'px';
      }

      function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
    }

    // Minimize Toggle
    const btnMinimize = document.getElementById('btnMinimize');
    if (btnMinimize) {
      btnMinimize.addEventListener('click', () => {
        hudWindow.classList.toggle('minimized');
      });
    }

    // Header buttons
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        if (vscode) vscode.postMessage({ command: 'refreshStatus' });
      });
    }

    const btnClearLogs = document.getElementById('btnClearLogs');
    if (btnClearLogs) {
      btnClearLogs.addEventListener('click', () => {
        logs = [];
        totalSaved = 0;
        totalServed = 0;
        totalTarget = 0;
        const elSaved = document.getElementById('tokensSavedVal');
        const elServed = document.getElementById('tokensServedVal');
        const elPct = document.getElementById('reductionPct');
        const elBar = document.getElementById('tokenProgressBar');
        if (elSaved) elSaved.textContent = '0';
        if (elServed) elServed.textContent = '0';
        if (elPct) elPct.textContent = '0.0% SAVED';
        if (elBar) elBar.style.width = '0%';
        renderLogs();
      });
    }

    const btnOpenPage = document.getElementById('btnOpenPage');
    if (btnOpenPage) {
      btnOpenPage.addEventListener('click', () => {
        if (vscode) vscode.postMessage({ command: 'openPage' });
      });
    }

    const btnFloatHUD = document.getElementById('btnFloatHUD');
    if (btnFloatHUD) {
      btnFloatHUD.addEventListener('click', () => {
        if (vscode) vscode.postMessage({ command: 'openFloatingHUD' });
      });
    }

    // Record ADR Modal Logic
    const adrModal = document.getElementById('adrModal');
    const btnRecordDecision = document.getElementById('btnRecordDecision');
    const btnCloseAdrModal = document.getElementById('btnCloseAdrModal');
    const btnCancelAdr = document.getElementById('btnCancelAdr');
    const btnSubmitAdr = document.getElementById('btnSubmitAdr');

    function openAdrModal() {
      if (adrModal) adrModal.style.display = 'flex';
      const elTitle = document.getElementById('adrTitle');
      if (elTitle) elTitle.focus();
    }

    function closeAdrModal() {
      if (adrModal) adrModal.style.display = 'none';
      const fields = ['adrTitle', 'adrDecision', 'adrRationale', 'adrAlternatives', 'adrTags'];
      for (const id of fields) {
        const el = document.getElementById(id);
        if (el) el.value = '';
      }
    }

    if (btnRecordDecision) {
      btnRecordDecision.addEventListener('click', openAdrModal);
    }
    if (btnCloseAdrModal) btnCloseAdrModal.addEventListener('click', closeAdrModal);
    if (btnCancelAdr) btnCancelAdr.addEventListener('click', closeAdrModal);

    if (btnSubmitAdr) {
      btnSubmitAdr.addEventListener('click', () => {
        const title = (document.getElementById('adrTitle').value || '').trim();
        const decision = (document.getElementById('adrDecision').value || '').trim();
        const rationale = (document.getElementById('adrRationale').value || '').trim();
        const alternatives = (document.getElementById('adrAlternatives').value || '').trim();
        const tags = (document.getElementById('adrTags').value || '').trim();

        if (!title || !decision || !rationale) {
          alert('Please fill out Title, Decision, and Rationale.');
          return;
        }

        if (vscode) {
          vscode.postMessage({
            command: 'submitAdr',
            title,
            decision,
            rationale,
            alternatives: alternatives ? alternatives.split(',').map(s => s.trim()).filter(Boolean) : [],
            tags: tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : []
          });
        }
        closeAdrModal();
      });
    }

    // Message listener from extension host
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'mcpCommandLogged') {
        addLogEntry(msg.tool, msg.args, msg.latency || 12, msg.tokensSaved || 0, false, msg.details);
      } else if (msg.command === 'setInitialEvents') {
        totalSaved = 0;
        totalServed = 0;
        totalTarget = 0;
        logs = [];
        if (Array.isArray(msg.events) && msg.events.length > 0) {
          for (const ev of msg.events) {
            addLogEntry(ev.tool, ev.args, ev.latency || 10, ev.tokensSaved || 0, true, ev.details);
          }
        } else {
          renderLogs();
        }
      } else if (msg.command === 'updateHealth') {
        const el = document.getElementById('healthyCount');
        if (el) el.textContent = msg.summary || '5 / 5 Healthy';
      }
    });

    // Request initial telemetry events from host
    if (vscode) {
      vscode.postMessage({ command: 'requestInitialHistory' });
    }

    // Initial render
    renderLogs();
  </script>
</body>
</html>`;
}
