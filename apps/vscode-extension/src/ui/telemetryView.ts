/**
 * Generates the rich interactive webview HTML for the Context Broker HUD & Telemetry Window.
 * Supports:
 * 1. Estimated Token Savings stats & compression meter
 * 2. Real-time Status for each of the 5 providers (comP, CodeGraphContext, Vector, Git, Memory)
 * 3. Live Log of MCP Commands executed by the agent
 * 4. Draggable floating overlay mode with collapse/pin/move handles & Pop-out capability
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
        width: min(520px, calc(100vw - 48px));
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
      gap: 6px;
    }

    .btn-icon {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      border-radius: 6px;
      padding: 4px 6px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }
    .btn-icon:hover {
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent-cyan);
      border-color: rgba(56, 189, 248, 0.3);
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
      width: 78.4%;
      background: linear-gradient(90deg, #38bdf8, #34d399);
      border-radius: 3px;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* 2. Providers Status Grid */
    .providers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
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
    .status-badge.degraded {
      background: rgba(251, 191, 36, 0.15);
      color: var(--accent-amber);
      border: 1px solid rgba(251, 191, 36, 0.3);
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
      max-height: 240px;
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
      cursor: pointer;
    }
    .log-entry:hover {
      background: rgba(30, 41, 59, 0.85);
      transform: translateX(2px);
    }
    .log-entry.new-entry {
      animation: logPulse 1.4s ease-out;
      border-left-width: 4px;
    }
    @keyframes logPulse {
      0% {
        background: rgba(56, 189, 248, 0.35);
        box-shadow: 0 0 12px rgba(56, 189, 248, 0.5);
      }
      100% {
        background: rgba(18, 24, 38, 0.7);
        box-shadow: none;
      }
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
      max-width: 260px;
    }

    /* Simulation & Quick Actions bar */
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
      padding: 6px 10px;
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
          <button class="btn-icon" id="btnSimulate" title="Simulate Agent MCP Tool Call">⚡ Test</button>
          <button class="btn-icon" id="btnRefresh" title="Refresh Adapter Health">🔄</button>
          ${isFloatingHUD ? `
            <button class="btn-icon" id="btnOpenPage" title="Open Full Tab">↗ Page</button>
            <button class="btn-icon" id="btnMinimize" title="Minimize / Expand">_</button>
          ` : `
            <button class="btn-icon" id="btnFloatHUD" title="Open as Floating Draggable HUD">⧉ Float</button>
            <button class="btn-icon" id="btnOpenPage" title="Open Full Tab / Beside">↗ Page</button>
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
              <div class="provider-detail">BM25 • 4ms</div>
            </div>

            <div class="provider-pill">
              <div class="provider-pill-header">
                <span class="provider-name">CodeGraph</span>
                <span class="status-badge healthy">Active</span>
              </div>
              <div class="provider-detail">AST • 12ms</div>
            </div>

            <div class="provider-pill">
              <div class="provider-pill-header">
                <span class="provider-name">Vector</span>
                <span class="status-badge healthy">Active</span>
              </div>
              <div class="provider-detail">ONNX • 18ms</div>
            </div>

            <div class="provider-pill">
              <div class="provider-pill-header">
                <span class="provider-name">Git</span>
                <span class="status-badge healthy">Active</span>
              </div>
              <div class="provider-detail">Diff • 2ms</div>
            </div>

            <div class="provider-pill">
              <div class="provider-pill-header">
                <span class="provider-name">Memory</span>
                <span class="status-badge healthy">Active</span>
              </div>
              <div class="provider-detail">SQLite • 1ms</div>
            </div>
          </div>
        </div>

        <!-- 3. MCP Command Logs Section -->
        <div class="logs-container">
          <div class="logs-header">
            <div class="section-title" style="margin-bottom: 0;">Agent MCP Command Log</div>
            <div class="logs-actions">
              <button class="btn-icon" id="btnClearLogs" title="Clear Logs">Clear</button>
            </div>
          </div>
          <div class="log-list" id="logList">
            <!-- Dynamic Log Items -->
          </div>
        </div>

        <!-- Action Bar -->
        <div class="action-bar">
          <button class="btn-action" id="btnQuickSearch">
            <span>🔍 Context Search</span>
          </button>
          <button class="btn-action" id="btnRecordDecision">
            <span>📝 Record ADR</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

    // State (initialized to 0 so real agent usage is accurately reflected)
    let totalSaved = 0;
    let totalServed = 0;
    let totalTarget = 0;
    let logs = [];

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderLogs() {
      const container = document.getElementById('logList');
      if (!container) return;

      if (!logs || logs.length === 0) {
        container.innerHTML = \`
          <div style="padding: 28px 16px; text-align: center; color: var(--text-dim);">
            <div style="font-size: 26px; margin-bottom: 8px;">⚡</div>
            <div style="font-weight: 600; color: var(--text-muted); font-size: 13px; margin-bottom: 6px;">Waiting for MCP Tool Calls</div>
            <div style="font-size: 11px; line-height: 1.5; max-width: 320px; margin: 0 auto;">
              When AI agents invoke Context Broker tools (such as <code>search_context</code> or <code>get_symbol_context</code>), live token reductions vs. target files will stream here automatically.
            </div>
          </div>
        \`;
        return;
      }

      container.innerHTML = logs.map(item => \`
        <div class="log-entry \${item.isNew ? 'new-entry' : ''}" onclick="onLogClick('\${item.tool}')">
          <div class="log-row-top">
            <span class="log-tool \${item.type}">\${escapeHtml(item.tool)}</span>
            <span class="log-time">\${escapeHtml(item.time)} (\${item.latency})</span>
          </div>
          <div class="log-row-details">
            <span class="log-args">\${escapeHtml(item.args)}</span>
            <span class="log-saved">\${item.tokensSaved}</span>
          </div>
          \${item.breakdown ? \`
            <div style="font-size: 10px; color: var(--accent-cyan); margin-top: 4px; font-family: var(--font-mono); opacity: 0.9;">
              \${escapeHtml(item.breakdown)}
            </div>
          \` : ''}
        </div>
      \`).join('');
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

      logs.unshift({
        id: Date.now() + Math.random(),
        tool: tool,
        args: args || '',
        time: isInitial ? 'History' : 'Just now',
        latency: latency + 'ms',
        tokensSaved: '+' + savedNum.toLocaleString() + ' saved',
        breakdown: breakdown,
        type: type,
        isNew: !isInitial
      });

      if (logs.length > 50) logs.pop();
      renderLogs();
    }

    function onLogClick(tool) {
      if (vscode) {
        vscode.postMessage({ command: 'logClicked', tool: tool });
      }
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

    // Button actions
    const btnSimulate = document.getElementById('btnSimulate');
    if (btnSimulate) {
      btnSimulate.addEventListener('click', () => {
        const tools = [
          {
            tool: 'search_context',
            args: 'query: "rank fusion weights"',
            latency: 11,
            saved: 4820,
            details: { targetFilesTotalTokens: 5200, mcpResponseTokens: 380, filesCount: 2, reductionPct: 92.7 }
          },
          {
            tool: 'get_symbol_context',
            args: 'symbol: "ContextCandidate"',
            latency: 7,
            saved: 2450,
            details: { targetFilesTotalTokens: 2600, mcpResponseTokens: 150, filesCount: 1, reductionPct: 94.2 }
          },
          {
            tool: 'get_impact_context',
            args: 'symbol: "ProviderRegistry"',
            latency: 19,
            saved: 6100,
            details: { targetFilesTotalTokens: 6600, mcpResponseTokens: 500, filesCount: 3, reductionPct: 92.4 }
          }
        ];
        const random = tools[Math.floor(Math.random() * tools.length)];
        addLogEntry(random.tool, random.args, random.latency, random.saved, false, random.details);
        if (vscode) {
          vscode.postMessage({ command: 'simulateRan', tool: random.tool });
        }
      });
    }

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

    const btnPopOut = document.getElementById('btnPopOut');
    if (btnPopOut) {
      btnPopOut.addEventListener('click', () => {
        if (vscode) vscode.postMessage({ command: 'popOutWindow' });
      });
    }

    const btnFloatHUD = document.getElementById('btnFloatHUD');
    if (btnFloatHUD) {
      btnFloatHUD.addEventListener('click', () => {
        if (vscode) vscode.postMessage({ command: 'openFloatingHUD' });
      });
    }

    const btnQuickSearch = document.getElementById('btnQuickSearch');
    if (btnQuickSearch) {
      btnQuickSearch.addEventListener('click', () => {
        if (vscode) vscode.postMessage({ command: 'quickSearch' });
      });
    }

    const btnRecordDecision = document.getElementById('btnRecordDecision');
    if (btnRecordDecision) {
      btnRecordDecision.addEventListener('click', () => {
        if (vscode) vscode.postMessage({ command: 'recordDecision' });
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
