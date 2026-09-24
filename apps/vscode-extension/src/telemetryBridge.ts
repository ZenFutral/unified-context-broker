import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ToolExecutionEvent } from '@context-broker/contracts';

function parseToolExecutionEvent(
  raw: unknown
): { success: true; data: ToolExecutionEvent } | { success: false; error: { message: string } } {
  if (!raw || typeof raw !== 'object') {
    return { success: false, error: { message: 'Payload must be an object' } };
  }
  const obj = raw as Record<string, unknown>;
  const id = obj['id'];
  const tool = obj['tool'];
  const args = obj['args'];
  const latency = obj['latency'];
  const tokensSaved = obj['tokensSaved'];
  const timestamp = obj['timestamp'];
  const status = obj['status'];
  const details = obj['details'];

  if (
    typeof id !== 'string' ||
    typeof tool !== 'string' ||
    typeof args !== 'string' ||
    typeof latency !== 'number' ||
    typeof tokensSaved !== 'number' ||
    typeof timestamp !== 'string' ||
    (status !== 'success' && status !== 'error')
  ) {
    return { success: false, error: { message: 'Invalid ToolExecutionEvent fields' } };
  }
  return {
    success: true,
    data: {
      id,
      tool,
      args,
      latency,
      tokensSaved,
      timestamp,
      status,
      details: details && typeof details === 'object' ? (details as Record<string, unknown>) : undefined
    }
  };
}

const BRIDGE_PORT = 49221;

export class TelemetryBridge {
  private server?: http.Server;
  private listeners: Array<(event: ToolExecutionEvent) => void> = [];
  private lastProcessedEventId: string = '';
  private watchedFiles: string[] = [];
  private pollIntervalTimer?: NodeJS.Timeout;
  private candidateDirs: string[] = [];

  constructor(workspaceFolders: string[] = []) {
    this.candidateDirs = this.discoverTelemetryDirs(workspaceFolders);
    this.startHttpServer();
    this.startFileWatcher();
    this.startPolling();
  }

  private discoverTelemetryDirs(workspaceFolders: string[]): string[] {
    const dirs: string[] = [];

    if (process.env['CONTEXT_BROKER_TELEMETRY_DIR']) {
      dirs.push(process.env['CONTEXT_BROKER_TELEMETRY_DIR']);
    }

    for (const folder of workspaceFolders) {
      if (folder) dirs.push(path.join(folder, '.context-broker'));
    }

    try {
      dirs.push(path.resolve(__dirname, '../../.context-broker'));
      dirs.push(path.resolve(__dirname, '../../../.context-broker'));
      dirs.push(path.resolve(__dirname, '../../../../.context-broker'));
    } catch {
      // ignore
    }

    dirs.push(path.join(process.cwd(), '.context-broker'));

    // Check parent directories if running from subpackage
    let curr = process.cwd();
    for (let i = 0; i < 3; i++) {
      const parent = path.dirname(curr);
      if (parent === curr) break;
      dirs.push(path.join(parent, '.context-broker'));
      curr = parent;
    }

    dirs.push(path.join(os.homedir(), '.context-broker'));
    dirs.push(path.join(os.tmpdir(), '.context-broker'));

    const unique = new Set<string>();
    const res: string[] = [];
    for (const d of dirs) {
      const norm = path.normalize(d);
      if (!unique.has(norm)) {
        unique.add(norm);
        res.push(norm);
      }
    }
    return res;
  }

  public onToolEvent(callback: (event: ToolExecutionEvent) => void) {
    this.listeners.push(callback);
  }

  private dispatchEvent(event: ToolExecutionEvent) {
    if (event.id === this.lastProcessedEventId) {
      return;
    }
    this.lastProcessedEventId = event.id;

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[ContextBroker TelemetryBridge] Listener error:', err);
      }
    }
  }

  private startHttpServer() {
    this.server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/event') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', () => {
          try {
            const raw = JSON.parse(body);
            const parsed = parseToolExecutionEvent(raw);
            if (parsed.success) {
              this.dispatchEvent(parsed.data);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'ok', received: parsed.data.id }));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: parsed.error.message }));
            }
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
          }
        });
        return;
      }

      if (req.method === 'GET' && req.url === '/events') {
        const history = this.getRecentHistory(50);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(history));
        return;
      }

      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ready', port: BRIDGE_PORT, dirs: this.candidateDirs }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    this.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[ContextBroker TelemetryBridge] Port ${BRIDGE_PORT} in use, relying on real-time file watcher.`);
      } else {
        console.warn('[ContextBroker TelemetryBridge] Server error:', err.message);
      }
    });

    this.server.listen(BRIDGE_PORT, '127.0.0.1', () => {
      console.log(`[ContextBroker TelemetryBridge] Listening on http://127.0.0.1:${BRIDGE_PORT}/event`);
    });
  }

  private startFileWatcher() {
    for (const dir of this.candidateDirs) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const latestFile = path.join(dir, 'latest.json');
        if (!fs.existsSync(latestFile)) {
          fs.writeFileSync(latestFile, '{}', 'utf8');
        }

        fs.watchFile(latestFile, { interval: 250 }, () => {
          this.readLatestFileFrom(latestFile);
        });
        this.watchedFiles.push(latestFile);
      } catch {
        // Continue if directory unwritable
      }
    }
  }

  private startPolling() {
    // Proactive 1s heartbeat check to ensure zero missed events across all files
    this.pollIntervalTimer = setInterval(() => {
      for (const dir of this.candidateDirs) {
        const latestFile = path.join(dir, 'latest.json');
        this.readLatestFileFrom(latestFile);
      }
    }, 1000);
  }

  private readLatestFileFrom(latestPath: string) {
    try {
      if (!fs.existsSync(latestPath)) return;
      const content = fs.readFileSync(latestPath, 'utf8').trim();
      if (!content || content === '{}') return;

      const raw = JSON.parse(content);
      const parsed = parseToolExecutionEvent(raw);
      if (parsed.success && parsed.data.id !== this.lastProcessedEventId) {
        this.dispatchEvent(parsed.data);
      }
    } catch {
      // Ignore partial/transient write reads
    }
  }

  public getRecentHistory(limit: number = 30): ToolExecutionEvent[] {
    const eventsById = new Map<string, ToolExecutionEvent>();

    for (const dir of this.candidateDirs) {
      const eventsFile = path.join(dir, 'events.jsonl');
      try {
        if (!fs.existsSync(eventsFile)) continue;
        const content = fs.readFileSync(eventsFile, 'utf8');
        const lines = content.trim().split('\n').filter((l) => l.trim().length > 0);

        for (const line of lines) {
          try {
            const parsed = parseToolExecutionEvent(JSON.parse(line));
            if (parsed.success) {
              eventsById.set(parsed.data.id, parsed.data);
            }
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    const allEvents = Array.from(eventsById.values());
    allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return allEvents.slice(-limit);
  }

  public dispose() {
    if (this.server) {
      this.server.close();
      this.server = undefined;
    }

    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = undefined;
    }

    for (const f of this.watchedFiles) {
      try {
        fs.unwatchFile(f);
      } catch {
        // ignore
      }
    }
    this.watchedFiles = [];
    this.listeners = [];
  }
}
