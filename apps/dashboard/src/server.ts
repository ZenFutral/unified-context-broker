import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProviderRegistry, ContextOrchestrator } from '@context-broker/orchestrator';
import { CompAdapter } from '@context-broker/adapter-comp';
import { CodeGraphContextAdapter } from '@context-broker/adapter-codegraphcontext';
import { VectorAdapter } from '@context-broker/adapter-vector';
import { GitAdapter } from '@context-broker/adapter-git';
import { MemoryAdapter } from '@context-broker/adapter-memory';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const PORT = Number(process.env['PORT'] || 3333);
const isMock = process.env['CONTEXT_BROKER_MOCK'] !== 'false';

// Initialize Registry and Adapters
const registry = new ProviderRegistry();
const compAdapter = new CompAdapter({ mockMode: isMock });
const codeGraphAdapter = new CodeGraphContextAdapter({ mockMode: isMock });
const vectorAdapter = new VectorAdapter({ mockMode: isMock });
const gitAdapter = new GitAdapter({ mockMode: isMock });
const memoryAdapter = new MemoryAdapter({ mockMode: isMock });

registry.register(compAdapter, true);
registry.register(codeGraphAdapter, true);
registry.register(vectorAdapter, true);
registry.register(gitAdapter, true);
registry.register(memoryAdapter, true);

const orchestrator = new ContextOrchestrator(registry, {
  defaultTokenBudget: 4000,
  maxTokenBudget: 16000
});

const server = http.createServer(async (req, res) => {
  // Enable CORS for local integration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  try {
    // API Route: Health
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const health = await registry.checkAllHealth();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ mockMode: isMock, health }));
      return;
    }

    // API Route: Query Sandbox
    if (req.method === 'POST' && url.pathname === '/api/query') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const result = await orchestrator.executeQuery({
            queryId: `dash-${Date.now()}`,
            query: parsed.query || 'search',
            workspaceIds: parsed.workspaceIds?.length ? parsed.workspaceIds : ['/workspace'],
            intent: parsed.intent ? parsed.intent : 'hybrid',
            tokenBudget: Number(parsed.tokenBudget) || 4000,
            accessScope: ['workspace:read'],
            resultLimit: 20,
            includeHistory: false,
            freshnessRequirement: 'either',
            metadata: {}
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Invalid query payload';
          console.error('[Dashboard Query Error]:', msg);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: msg }));
        }
      });
      return;
    }

    // API Route: Decisions List
    if (req.method === 'GET' && url.pathname === '/api/decisions') {
      const q = url.searchParams.get('q') || '';
      const decisions = await memoryAdapter.recallDecisions(q);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(decisions));
      return;
    }

    // API Route: Record Decision
    if (req.method === 'POST' && url.pathname === '/api/decisions') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const record = await memoryAdapter.recordDecision({
            title: parsed.title,
            decision: parsed.decision,
            rationale: parsed.rationale,
            rejectedAlternatives: parsed.rejectedAlternatives || [],
            affectedComponents: parsed.affectedComponents || [],
            author: parsed.author || 'User',
            tags: parsed.tags || []
          });
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(record));
        } catch (err: unknown) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to record decision' }));
        }
      });
      return;
    }

    // Static File Serving with path traversal prevention
    const sanitizedPath = path.normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[\/\\])+/, '');
    const resolvedPath = path.resolve(PUBLIC_DIR, '.' + sanitizedPath);

    // Enforce that resolved path stays strictly within PUBLIC_DIR
    if (!resolvedPath.startsWith(path.resolve(PUBLIC_DIR))) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access denied: Path traversal detected' }));
      return;
    }

    let filePath = resolvedPath;
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml'
    };

    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(data);
  } catch (err: unknown) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`[Context Broker Dashboard] Server running at http://localhost:${PORT}`);
});
