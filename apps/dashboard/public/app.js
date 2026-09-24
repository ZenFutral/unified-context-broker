// Context Broker Dashboard Interactive Controller

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initHealth();
  initSandbox();
  initMemory();
});

// Navigation
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('page-title');
  const pageDesc = document.getElementById('page-desc');

  const titles = {
    overview: { title: 'Adapter Health & Telemetry', desc: 'Live status, diagnostics, and item counts across all 5 registered upstream providers' },
    sandbox: { title: 'Multi-Engine Query Sandbox', desc: 'Simulate AI queries, test intent classification, and inspect token knapsack packing' },
    memory: { title: 'Architectural Decision Records (ADRs)', desc: 'Inspect durable project memory, historical rationale, and record new decisions' }
  };

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      navItems.forEach((b) => b.classList.remove('active'));
      panes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`tab-${tab}`);
      if (targetPane) targetPane.classList.add('active');

      if (titles[tab]) {
        pageTitle.textContent = titles[tab].title;
        pageDesc.textContent = titles[tab].desc;
      }
    });
  });
}

// 1. Health Monitoring
async function initHealth() {
  const refreshBtn = document.getElementById('refresh-health-btn');
  refreshBtn.addEventListener('click', fetchHealth);
  await fetchHealth();
}

async function fetchHealth() {
  const grid = document.getElementById('adapter-grid');
  const activeCount = document.getElementById('active-providers-count');
  const modeLabel = document.getElementById('runtime-mode-label');

  try {
    const res = await fetch('/api/health');
    const data = await res.json();

    if (data.mockMode) {
      modeLabel.textContent = 'Mock Mode (Local Data)';
    } else {
      modeLabel.textContent = 'Live Mode (Connected)';
    }

    grid.innerHTML = '';
    const entries = Object.entries(data.health || {});
    let operational = 0;

    entries.forEach(([name, info]) => {
      if (info.enabled && info.health?.status === 'healthy') {
        operational++;
      }

      const card = document.createElement('div');
      card.className = 'adapter-card';

      const status = info.health?.status || 'unknown';
      const statusClass = `status-${status}`;

      const diagRows = Object.entries(info.health?.diagnostics || {})
        .map(([k, v]) => `
          <div class="diag-row">
            <span class="diag-key">${k}:</span>
            <span class="diag-val">${typeof v === 'object' ? JSON.stringify(v) : v}</span>
          </div>
        `).join('');

      card.innerHTML = `
        <div class="adapter-header">
          <div class="adapter-name">
            ${name}
            <span class="adapter-tag">${info.version || 'v0.1.0'}</span>
          </div>
          <span class="adapter-status-badge ${statusClass}">
            <span class="status-dot"></span>
            ${status.toUpperCase()}
          </span>
        </div>
        <p class="adapter-message">${info.health?.message || 'Adapter operational and responding to queries.'}</p>
        <div class="adapter-diagnostics">
          <div class="diag-row">
            <span class="diag-key">indexed_items:</span>
            <span class="diag-val">${info.health?.indexedItemCount ?? 'N/A'}</span>
          </div>
          ${diagRows}
        </div>
      `;
      grid.appendChild(card);
    });

    activeCount.textContent = `${operational} / ${entries.length}`;
  } catch (err) {
    grid.innerHTML = `<div class="card" style="color: var(--accent-rose)">Failed to fetch adapter telemetry: ${err.message}</div>`;
  }
}

// 2. Query Sandbox
function initSandbox() {
  const runBtn = document.getElementById('run-query-btn');
  const queryInput = document.getElementById('query-input');
  const intentSelect = document.getElementById('intent-select');
  const budgetInput = document.getElementById('budget-input');
  const budgetVal = document.getElementById('budget-val');
  const resultsDiv = document.getElementById('sandbox-results');

  budgetInput.addEventListener('input', () => {
    budgetVal.textContent = budgetInput.value;
  });

  runBtn.addEventListener('click', async () => {
    const q = queryInput.value.trim();
    if (!q) return;

    runBtn.disabled = true;
    runBtn.innerHTML = 'Executing Query...';
    resultsDiv.innerHTML = '<div class="empty-state">Running multi-provider parallel retrieval & rank fusion...</div>';

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          intent: intentSelect.value || undefined,
          tokenBudget: Number(budgetInput.value)
        })
      });
      const data = await res.json();
      renderSandboxResults(data);
    } catch (err) {
      resultsDiv.innerHTML = `<div class="card" style="color: var(--accent-rose)">Execution Error: ${err.message}</div>`;
    } finally {
      runBtn.disabled = false;
      runBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Execute Orchestrated Query
      `;
    }
  });
}

function renderSandboxResults(data) {
  const container = document.getElementById('sandbox-results');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'result-header';
  header.innerHTML = `
    <div>
      <span class="stat-badge purple">${data.intent}</span>
      <strong style="margin-left: 10px">${data.summary}</strong>
    </div>
    <div style="font-size: 13px; color: var(--text-secondary)">
      Tokens: <strong>${data.estimatedTokens}</strong> (${data.budgetUtilizationPct}%)
    </div>
  `;
  container.appendChild(header);

  if (!data.candidates || data.candidates.length === 0) {
    container.innerHTML += '<div class="empty-state">No candidates returned for this query.</div>';
    return;
  }

  data.candidates.forEach((cand, idx) => {
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.innerHTML = `
      <div class="candidate-top">
        <div class="candidate-title">
          #${idx + 1} [${cand.sourceBackend.toUpperCase()}] ${cand.symbol || cand.filePath || 'Candidate'}
        </div>
        <div class="score-badge">Score: ${cand.compositeScore ?? 'N/A'}</div>
      </div>
      <div style="font-size: 12px; color: var(--text-muted); display: flex; gap: 14px">
        <span>File: ${cand.filePath || 'In-Memory / Synthesized'}</span>
        <span>Freshness: ${cand.freshness}</span>
        ${cand.startLine ? `<span>Lines: ${cand.startLine}-${cand.endLine}</span>` : ''}
      </div>
      <pre class="candidate-snippet"><code>${escapeHtml(cand.content)}</code></pre>
    `;
    container.appendChild(card);
  });
}

// 3. ADR Memory
async function initMemory() {
  const searchInput = document.getElementById('memory-search-input');
  const searchBtn = document.getElementById('search-memory-btn');
  const openModalBtn = document.getElementById('open-record-modal-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelModalBtn = document.getElementById('cancel-modal-btn');
  const modal = document.getElementById('record-modal');
  const form = document.getElementById('record-decision-form');

  searchBtn.addEventListener('click', () => loadDecisions(searchInput.value.trim()));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadDecisions(searchInput.value.trim());
  });

  openModalBtn.addEventListener('click', () => modal.classList.add('active'));
  closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
  cancelModalBtn.addEventListener('click', () => modal.classList.remove('active'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('adr-title').value,
      decision: document.getElementById('adr-decision').value,
      rationale: document.getElementById('adr-rationale').value,
      rejectedAlternatives: document.getElementById('adr-alternatives').value.split(',').map(s => s.trim()).filter(Boolean),
      affectedComponents: document.getElementById('adr-components').value.split(',').map(s => s.trim()).filter(Boolean)
    };

    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        modal.classList.remove('active');
        form.reset();
        await loadDecisions();
      }
    } catch (err) {
      alert('Failed to record decision: ' + err.message);
    }
  });

  await loadDecisions();
}

async function loadDecisions(q = '') {
  const grid = document.getElementById('memory-grid');
  grid.innerHTML = '<div class="empty-state">Loading decisions...</div>';

  try {
    const res = await fetch(`/api/decisions?q=${encodeURIComponent(q)}`);
    const candidates = await res.json();
    grid.innerHTML = '';

    if (candidates.length === 0) {
      grid.innerHTML = '<div class="empty-state">No architectural decision records found.</div>';
      return;
    }

    candidates.forEach((cand) => {
      const card = document.createElement('div');
      card.className = 'adr-card';
      const meta = cand.metadata || {};

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span class="adr-id">${cand.symbol || meta.decisionId || 'ADR'}</span>
          <span style="font-size: 11px; color: var(--text-muted)">${meta.author || 'Architecture Team'}</span>
        </div>
        <div class="adr-title">${meta.title || cand.symbol || 'Decision Record'}</div>
        <pre class="candidate-snippet"><code>${escapeHtml(cand.content)}</code></pre>
        <div class="tags-row">
          ${(meta.tags || []).map(t => `<span class="tag-badge">#${t}</span>`).join('')}
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<div class="card" style="color: var(--accent-rose)">Error: ${err.message}</div>`;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
