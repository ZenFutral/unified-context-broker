import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';

describe('Dashboard Pure Monitoring & Telemetry Server (Phase 7)', () => {
  let server: http.Server;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    // Import server module dynamically
    process.env['PORT'] = '0'; // Ephemeral port for isolated testing
    const dashboardModule = await import('../src/server.js');
    server = dashboardModule.server;

    // Wait until server is listening or obtain port
    await new Promise<void>((resolve) => {
      if (server.listening) {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 3333;
        baseUrl = `http://localhost:${port}`;
        resolve();
      } else {
        server.on('listening', () => {
          const addr = server.address();
          port = typeof addr === 'object' && addr ? addr.port : 3333;
          baseUrl = `http://localhost:${port}`;
          resolve();
        });
      }
    });
  });

  afterAll(async () => {
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('1. GET /api/logs returns sorted activity logs with request/response payloads', async () => {
    const res = await fetch(`${baseUrl}/api/logs?limit=10`);
    expect(res.status).toBe(200);

    const logs = await res.json();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);

    const first = logs[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('timestamp');
    expect(first).toHaveProperty('tool');
    expect(first).toHaveProperty('latency');
    expect(first).toHaveProperty('status');
    expect(first).toHaveProperty('tokensSaved');
    expect(first).toHaveProperty('requestPayload');
    expect(first).toHaveProperty('responsePayload');
  });

  it('2. GET /api/logs supports tool filter and limit query parameters', async () => {
    const res = await fetch(`${baseUrl}/api/logs?tool=search_context&limit=5`);
    expect(res.status).toBe(200);

    const logs = await res.json();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeLessThanOrEqual(5);

    for (const log of logs) {
      expect(log.tool.toLowerCase()).toContain('search_context');
    }
  });

  it('3. GET /api/metrics computes global token savings and latency statistics', async () => {
    const res = await fetch(`${baseUrl}/api/metrics`);
    expect(res.status).toBe(200);

    const metrics = await res.json();
    expect(metrics).toHaveProperty('cumulativeTokensSaved');
    expect(metrics).toHaveProperty('totalOperations');
    expect(metrics).toHaveProperty('averageReductionPct');
    expect(metrics).toHaveProperty('averageLatencyMs');
    expect(metrics.totalOperations).toBeGreaterThan(0);
  });

  it('4. GET /api/health provides clean operational status without raw memory dumps', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('health');

    const health = body.health;
    expect(health.comp).toBeDefined();
    expect(health.comp.status).toBe('Operational');
    expect(health.comp.indexedItemCount).toBeDefined();

    // Verify raw debugger dumps are not exposed
    expect(health.comp.health).toBeUndefined();
    expect(health.comp.diagnostics).toBeUndefined();
  });

  it('5. GET /api/decisions returns architectural memory records in read-only mode', async () => {
    const res = await fetch(`${baseUrl}/api/decisions`);
    expect(res.status).toBe(200);

    const decisions = await res.json();
    expect(Array.isArray(decisions)).toBe(true);
  });

  it('6. rejects deprecated test execution / mutation endpoints (pure monitoring mode)', async () => {
    // Deprecated query sandbox POST
    const queryRes = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' })
    });
    expect(queryRes.status).toBe(410);

    // Deprecated decision mutation POST
    const decisionRes = await fetch(`${baseUrl}/api/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'test', decision: 'test', rationale: 'test' })
    });
    expect(decisionRes.status).toBe(410);
  });

  it('7. serves static dashboard assets and prevents path traversal', async () => {
    const indexRes = await fetch(`${baseUrl}/index.html`);
    expect(indexRes.status).toBe(200);
    const html = await indexRes.text();
    expect(html).toContain('Live Activity & Telemetry Log');
    expect(html).toContain('id="payload-modal"');

    const cssRes = await fetch(`${baseUrl}/style.css`);
    expect(cssRes.status).toBe(200);

    const jsRes = await fetch(`${baseUrl}/app.js`);
    expect(jsRes.status).toBe(200);

    // Path traversal attempt
    const escapeRes = await fetch(`${baseUrl}/../../../../etc/passwd`);
    expect(escapeRes.status === 403 || escapeRes.status === 200).toBe(true);
    if (escapeRes.status === 200) {
      // Must have fallen back safely to index.html and NOT exposed external files
      const text = await escapeRes.text();
      expect(text).toContain('<!DOCTYPE html>');
    }
  });
});
