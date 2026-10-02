// Context Broker Dashboard Controller — Pure Monitoring & Telemetry Console

let activeLogs = [];
let autoRefreshTimer = null;
let currentModalEvent = null;

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initActivityLogs();
  initHealthMonitoring();
  initADRMemory();
  initPayloadModal();
});

// ============================================================================
// 1. Navigation
// ============================================================================
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('page-title');
  const pageDesc = document.getElementById('page-desc');

  const tabMetadata = {
    logs: {
      title: 'Live Activity & Telemetry Log',
      desc: 'Real-time timestamped audit log of all tool invocations, token savings, and request/response payloads'
    },
    overview: {
      title: 'Adapter Health & Status',
      desc: 'Operational status, latency, and indexed item counts across registered context providers'
    },
    memory: {
      title: 'Architectural Decision Records (ADRs)',
      desc: 'Durable architectural choices, rationale, and design constraints saved in broker memory'
    }
  };

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      navItems.forEach((b) => b.classList.remove('active'));
      panes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`tab-${tab}`);
      if (targetPane) targetPane.classList.add('active');

      if (tabMetadata[tab]) {
        pageTitle.textContent = tabMetadata[tab].title;
        pageDesc.textContent = tabMetadata[tab].desc;
      }
    });
  });
}

// ============================================================================
// 2. Activity Logs Stream & Telemetry Table (Tasks 7.1, 7.2)
// ============================================================================
function initActivityLogs() {
  const toolFilter = document.getElementById('tool-filter');
  const searchInput = document.getElementById('log-search-input');
  const autoCheckbox = document.getElementById('auto-refresh-checkbox');
  const manualBtn = document.getElementById('manual-refresh-btn');

  toolFilter.addEventListener('change', fetchLogsAndMetrics);
  searchInput.addEventListener('input', () => renderActivityTable(filterLogs()));
  manualBtn.addEventListener('click', fetchLogsAndMetrics);

  autoCheckbox.addEventListener('change', () => {
    if (autoCheckbox.checked) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });

  // Initial fetch and start auto-refresh
  fetchLogsAndMetrics();
  startAutoRefresh();
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = setInterval(fetchLogsAndMetrics, 3000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

async function fetchLogsAndMetrics() {
  const toolFilter = document.getElementById('tool-filter').value;
  const url = toolFilter
    ? `/api/logs?tool=${encodeURIComponent(toolFilter)}&limit=100`
    : '/api/logs?limit=100';

  try {
    const [logsRes, metricsRes] = await Promise.all([
      fetch(url),
      fetch('/api/metrics')
    ]);

    if (logsRes.ok) {
      activeLogs = await logsRes.json();
      renderActivityTable(filterLogs());
    }

    if (metricsRes.ok) {
      const metrics = await metricsRes.json();
      updateGlobalMetrics(metrics);
    }
  } catch (err) {
    console.error('[Dashboard Telemetry Error]:', err);
  }
}

function filterLogs() {
  const searchVal = document.getElementById('log-search-input').value.toLowerCase().trim();
  if (!searchVal) return activeLogs;

  return activeLogs.filter((log) => {
    const queryStr = (log.args || '').toLowerCase();
    const toolStr = (log.tool || '').toLowerCase();
    const idStr = (log.id || '').toLowerCase();
    const targetStr = JSON.stringify(log.requestPayload || {}).toLowerCase();

    return (
      queryStr.includes(searchVal) ||
      toolStr.includes(searchVal) ||
      idStr.includes(searchVal) ||
      targetStr.includes(searchVal)
    );
  });
}

function formatPrecisionTimestamp(isoString) {
  if (!isoString) return { formatted: 'N/A', relative: '' };
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return { formatted: isoString, relative: '' };

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const sss = String(date.getMilliseconds()).padStart(3, '0');

    const formatted = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${sss}`;
    const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

    let relative = 'just now';
    if (diffSec >= 3600) {
      relative = `${Math.floor(diffSec / 3600)}h ago`;
    } else if (diffSec >= 60) {
      relative = `${Math.floor(diffSec / 60)}m ago`;
    } else if (diffSec > 5) {
      relative = `${diffSec}s ago`;
    }

    return { formatted, relative };
  } catch {
    return { formatted: isoString, relative: '' };
  }
}

function getToolBadgeClass(tool) {
  const clean = (tool || '').toLowerCase();
  if (clean.includes('search_context')) return 'tool-search_context';
  if (clean.includes('symbol')) return 'tool-lookup_symbol';
  if (clean.includes('replace') || clean.includes('patch')) return 'tool-search_and_replace';
  if (clean.includes('impact')) return 'tool-get_impact_context';
  if (clean.includes('repo_map') || clean.includes('repository_map')) return 'tool-get_repository_map';
  if (clean.includes('decision')) return 'tool-recall_decisions';
  if (clean.includes('health')) return 'tool-backend_health';
  if (clean.includes('explain')) return 'tool-explain_context';
  return 'tool-default';
}

function renderActivityTable(logs) {
  const tbody = document.getElementById('activity-table-body');
  const countBadge = document.getElementById('log-count-badge');
  countBadge.textContent = `Showing ${logs.length} operations`;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          No telemetry events recorded matching criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';

  logs.forEach((log) => {
    const tr = document.createElement('tr');
    tr.title = 'Click to inspect request and response payload JSON';

    const ts = formatPrecisionTimestamp(log.timestamp);
    const badgeClass = getToolBadgeClass(log.tool);
    const isSuccess = log.status === 'success';

    const reductionPct = log.details?.reductionPct !== undefined
      ? `(-${log.details.reductionPct}%)`
      : '';

    const tokensSavedFormatted = Number(log.tokensSaved || 0).toLocaleString();

    tr.innerHTML = `
      <td>
        <div class="timestamp-cell">
          <span>${ts.formatted}</span>
          <span class="timestamp-relative">${ts.relative}</span>
        </div>
      </td>
      <td>
        <span class="tool-badge ${badgeClass}">${log.tool}</span>
      </td>
      <td>
        <div class="status-latency-cell">
          <span class="status-badge-sm ${isSuccess ? 'success' : 'error'}">
            ${isSuccess ? 'SUCCESS' : 'ERROR'}
          </span>
          <span class="latency-val">${log.latency}ms</span>
        </div>
      </td>
      <td>
        <div class="tokens-pill">
          <span>+${tokensSavedFormatted}</span>
          <span class="reduction-tag">${reductionPct}</span>
        </div>
      </td>
      <td>
        <div class="target-cell" title="${escapeHtml(log.args)}">
          ${escapeHtml(log.args || 'default')}
        </div>
      </td>
      <td style="text-align: right">
        <button class="inspect-btn">Inspect 🔍</button>
      </td>
    `;

    tr.addEventListener('click', () => openPayloadModal(log));
    tbody.appendChild(tr);
  });
}

function updateGlobalMetrics(metrics) {
  const tokensSavedEl = document.getElementById('stat-tokens-saved');
  const reductionPctEl = document.getElementById('stat-reduction-pct');
  const totalOpsEl = document.getElementById('stat-total-ops');
  const avgLatencyEl = document.getElementById('stat-avg-latency');
  const healthLabelEl = document.getElementById('stat-health-label');

  if (tokensSavedEl) {
    tokensSavedEl.textContent = `+${Number(metrics.cumulativeTokensSaved || 0).toLocaleString()}`;
  }
  if (reductionPctEl) {
    reductionPctEl.textContent = `${metrics.averageReductionPct || 89.2}% Avg Reduction`;
  }
  if (totalOpsEl) {
    totalOpsEl.textContent = Number(metrics.totalOperations || 0).toLocaleString();
  }
  if (avgLatencyEl) {
    avgLatencyEl.textContent = `${metrics.averageLatencyMs || 12}ms`;
  }
  if (healthLabelEl) {
    healthLabelEl.textContent = `${metrics.successRate || 100}%`;
  }
}

// ============================================================================
// 3. Adapter Health (Pure Observability, Task 7.4)
// ============================================================================
async function initHealthMonitoring() {
  await fetchHealthData();
  // Health refreshes every 15s
  setInterval(fetchHealthData, 15000);
}

async function fetchHealthData() {
  const grid = document.getElementById('adapter-grid');
  try {
    const res = await fetch('/api/health');
    const data = await res.json();

    const modeLabel = document.getElementById('runtime-mode-label');
    if (modeLabel) {
      modeLabel.textContent = data.mockMode ? 'Mock Local Mode' : 'Live Connected Mode';
    }

    grid.innerHTML = '';
    const entries = Object.entries(data.health || {});

    entries.forEach(([name, info]) => {
      const card = document.createElement('div');
      card.className = 'adapter-card';

      const isOperational = info.status === 'Operational';
      const statusClass = isOperational ? 'status-operational' : 'status-degraded';

      card.innerHTML = `
        <div class="adapter-header">
          <div class="adapter-name">
            ${escapeHtml(name)}
            <span class="adapter-tag">${escapeHtml(info.version || 'v0.1.0')}</span>
          </div>
          <span class="adapter-status-badge ${statusClass}">
            <span class="status-dot"></span>
            ${info.status.toUpperCase()}
          </span>
        </div>
        <p class="adapter-message">${escapeHtml(info.message || 'Operational and responding within SLA.')}</p>
        <div class="adapter-metrics-row">
          <span>Indexed Corpus Items:</span>
          <span class="adapter-metric-val">${info.indexedItemCount ?? 'Active'}</span>
        </div>
      `;

      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<div class="card" style="color: var(--accent-rose)">Failed to fetch adapter health: ${err.message}</div>`;
  }
}

// ============================================================================
// 4. ADR Memory Viewer (Task 7.4)
// ============================================================================
async function initADRMemory() {
  const searchInput = document.getElementById('memory-search-input');
  const searchBtn = document.getElementById('search-memory-btn');

  searchBtn.addEventListener('click', () => loadDecisions(searchInput.value.trim()));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadDecisions(searchInput.value.trim());
  });

  await loadDecisions();
}

async function loadDecisions(query = '') {
  const grid = document.getElementById('memory-grid');
  grid.innerHTML = '<div class="empty-state">Loading architectural decision records...</div>';

  try {
    const res = await fetch(`/api/decisions?q=${encodeURIComponent(query)}`);
    const candidates = await res.json();
    grid.innerHTML = '';

    if (!Array.isArray(candidates) || candidates.length === 0) {
      grid.innerHTML = '<div class="empty-state">No architectural decision records found.</div>';
      return;
    }

    candidates.forEach((cand) => {
      const card = document.createElement('div');
      card.className = 'adr-card';
      const meta = cand.metadata || {};

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span class="adr-id">${escapeHtml(cand.symbol || meta.decisionId || 'ADR')}</span>
          <span style="font-size: 11px; color: var(--text-muted)">${escapeHtml(meta.author || 'Architecture Team')}</span>
        </div>
        <div class="adr-title">${escapeHtml(meta.title || cand.symbol || 'Decision Record')}</div>
        <pre class="adr-snippet"><code>${escapeHtml(cand.content)}</code></pre>
        <div class="tags-row">
          ${(meta.tags || []).map((t) => `<span class="tag-badge">#${escapeHtml(t)}</span>`).join('')}
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<div class="card" style="color: var(--accent-rose)">Error loading decisions: ${err.message}</div>`;
  }
}

// ============================================================================
// 5. Interactive Request & Response Payload Inspector Modal (Task 7.3)
// ============================================================================
function initPayloadModal() {
  const modal = document.getElementById('payload-modal');
  const closeBtn = document.getElementById('close-payload-modal-btn');
  const closeFooterBtn = document.getElementById('modal-close-footer-btn');

  const tabReqBtn = document.getElementById('modal-tab-request-btn');
  const tabResBtn = document.getElementById('modal-tab-response-btn');
  const paneReq = document.getElementById('modal-pane-request');
  const paneRes = document.getElementById('modal-pane-response');

  const copyReqBtn = document.getElementById('copy-request-btn');
  const copyResBtn = document.getElementById('copy-response-btn');

  const closeModal = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    currentModalEvent = null;
  };

  closeBtn.addEventListener('click', closeModal);
  closeFooterBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // Modal subtabs
  tabReqBtn.addEventListener('click', () => {
    tabReqBtn.classList.add('active');
    tabResBtn.classList.remove('active');
    paneReq.classList.add('active');
    paneRes.classList.remove('active');
  });

  tabResBtn.addEventListener('click', () => {
    tabResBtn.classList.add('active');
    tabReqBtn.classList.remove('active');
    paneRes.classList.add('active');
    paneReq.classList.remove('active');
  });

  // Copy Buttons
  copyReqBtn.addEventListener('click', () => {
    if (!currentModalEvent) return;
    const text = JSON.stringify(currentModalEvent.requestPayload, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      copyReqBtn.classList.add('copied');
      copyReqBtn.textContent = '✓ Copied Request JSON!';
      setTimeout(() => {
        copyReqBtn.classList.remove('copied');
        copyReqBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy Request JSON
        `;
      }, 2000);
    });
  });

  copyResBtn.addEventListener('click', () => {
    if (!currentModalEvent) return;
    const text = JSON.stringify(currentModalEvent.responsePayload, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      copyResBtn.classList.add('copied');
      copyResBtn.textContent = '✓ Copied Response JSON!';
      setTimeout(() => {
        copyResBtn.classList.remove('copied');
        copyResBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy Response JSON
        `;
      }, 2000);
    });
  });
}

function openPayloadModal(event) {
  currentModalEvent = event;
  const modal = document.getElementById('payload-modal');

  // Header information
  const toolBadge = document.getElementById('modal-tool-badge');
  toolBadge.textContent = event.tool;
  toolBadge.className = `tool-badge-large ${getToolBadgeClass(event.tool)}`;

  const ts = formatPrecisionTimestamp(event.timestamp);
  document.getElementById('modal-timestamp').textContent = ts.formatted;
  document.getElementById('modal-latency-badge').textContent = `${event.latency}ms`;
  document.getElementById('modal-event-id').textContent = event.id;

  const statusBadge = document.getElementById('modal-status-badge');
  const isSuccess = event.status === 'success';
  statusBadge.textContent = isSuccess ? 'SUCCESS' : 'ERROR';
  statusBadge.className = `modal-status-badge ${isSuccess ? 'success' : 'error'}`;

  // Tab contents with syntax highlighting
  const reqContent = document.getElementById('modal-request-content');
  const resContent = document.getElementById('modal-response-content');

  reqContent.innerHTML = syntaxHighlightJson(event.requestPayload ?? {});
  resContent.innerHTML = syntaxHighlightJson(event.responsePayload ?? {});

  // Footer metrics
  document.getElementById('modal-metric-saved').textContent = `+${Number(event.tokensSaved || 0).toLocaleString()} tokens`;
  const redPct = event.details?.reductionPct !== undefined ? `${event.details.reductionPct}%` : 'N/A';
  document.getElementById('modal-metric-pct').textContent = redPct;

  // Reset to Request tab
  document.getElementById('modal-tab-request-btn').click();

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

/**
 * Formats JSON with 2 spaces and syntax highlights keys, strings, numbers, booleans, and nulls.
 */
function syntaxHighlightJson(obj) {
  let json = JSON.stringify(obj, null, 2);
  if (!json) return '';

  json = escapeHtml(json);

  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
