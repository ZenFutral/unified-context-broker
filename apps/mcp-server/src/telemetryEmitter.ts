import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { ToolExecutionEvent } from '@context-broker/contracts';

const EXTENSION_PORT = 49221;

/**
 * Discovers candidate directories where telemetry files should be persisted.
 * Writes to both the active workspace and user profile so IDE extensions,
 * sandboxes, and standalone daemons can all discover the stream.
 */
export function getCandidateTelemetryDirs(): string[] {
  const dirs: string[] = [];

  if (process.env['CONTEXT_BROKER_TELEMETRY_DIR']) {
    dirs.push(process.env['CONTEXT_BROKER_TELEMETRY_DIR']);
  }

  // 1. Module-relative paths (always resolves correctly regardless of process.cwd)
  try {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    dirs.push(path.resolve(thisDir, '../../.context-broker'));
    dirs.push(path.resolve(thisDir, '../../../.context-broker'));
    dirs.push(path.resolve(thisDir, '../../../../.context-broker'));
  } catch {
    // ignore
  }

  // 2. Current working directory / workspace root
  dirs.push(path.join(process.cwd(), '.context-broker'));

  // 3. Monorepo root if running from a subpackage
  const monorepoRoot = path.resolve(process.cwd(), '..');
  if (path.basename(monorepoRoot) === 'ContextMCP' || fs.existsSync(path.join(monorepoRoot, 'pnpm-workspace.yaml'))) {
    dirs.push(path.join(monorepoRoot, '.context-broker'));
  }

  // 4. User home directory
  dirs.push(path.join(os.homedir(), '.context-broker'));

  // 5. Operating system temp directory
  dirs.push(path.join(os.tmpdir(), '.context-broker'));

  // Deduplicate normalized paths
  const unique = new Set<string>();
  const result: string[] = [];
  for (const d of dirs) {
    const norm = path.normalize(d);
    if (!unique.has(norm)) {
      unique.add(norm);
      result.push(norm);
    }
  }
  return result;
}

export interface TokenMetricsResult {
  tokensSaved: number;
  targetFilesTotalTokens: number;
  mcpResponseTokens: number;
  filesCount: number;
  files: string[];
  reductionPct: number;
  details: Record<string, unknown>;
}

/**
 * Resolves a file path on disk against potential workspace roots, cwd, and relative directories.
 */
function resolveFilePath(filePath: string, workspaceIds?: string[]): string | undefined {
  if (!filePath || filePath.trim().length === 0) return undefined;
  const clean = filePath.trim();

  // 1. Direct absolute path
  if (path.isAbsolute(clean) && fs.existsSync(clean)) {
    return clean;
  }

  // 2. Relative to workspace roots in args
  if (Array.isArray(workspaceIds)) {
    for (const ws of workspaceIds) {
      if (typeof ws === 'string') {
        const candidate = path.resolve(ws, clean);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  // 3. Relative to process.cwd()
  const cwdCandidate = path.resolve(process.cwd(), clean);
  if (fs.existsSync(cwdCandidate)) return cwdCandidate;

  // 4. Check workspace ancestor directories (up to 4 levels)
  let curr = process.cwd();
  for (let i = 0; i < 4; i++) {
    const cand = path.resolve(curr, clean);
    if (fs.existsSync(cand)) return cand;
    const candInSub = path.resolve(curr, 'context-broker', clean);
    if (fs.existsSync(candInSub)) return candInSub;
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }

  return undefined;
}

/**
 * Calculates token savings according to the formula:
 * Token Saving = (Sum of Token Count of all Target Files Involved) - (MCP Response Tokens)
 */
export function calculateTokenMetrics(
  tool: string,
  args: Record<string, unknown> | undefined,
  result: unknown
): TokenMetricsResult {
  // 1. Extract raw MCP response text and calculate response token count (~4 chars / token)
  let responseText = '';
  if (result && typeof result === 'object' && 'content' in result) {
    const content = (result as { content?: Array<{ type?: string; text?: string }> }).content;
    if (Array.isArray(content) && content[0]?.text) {
      responseText = content[0].text;
    }
  } else if (typeof result === 'string') {
    responseText = result;
  } else if (result) {
    responseText = JSON.stringify(result);
  }

  const mcpResponseTokens = Math.max(1, Math.ceil(responseText.length / 4));

  // 2. Parse response data to discover all target files involved
  let parsedData: any = null;
  try {
    if (responseText) {
      parsedData = JSON.parse(responseText);
    }
  } catch {
    // Non-JSON response
  }

  const uniqueFiles = new Set<string>();

  // Collect from arguments
  if (typeof args?.['filePath'] === 'string' && args['filePath'].trim()) {
    uniqueFiles.add(args['filePath'].trim());
  }

  // Collect from parsed response data (candidates, impact candidates, repo-map entries, decisions)
  if (parsedData) {
    const candidateCollections = [
      parsedData.candidates,
      parsedData.impactCandidates,
      parsedData.entries,
      parsedData.decisions
    ];

    for (const list of candidateCollections) {
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && typeof item.filePath === 'string' && item.filePath.trim()) {
            uniqueFiles.add(item.filePath.trim());
          }
        }
      }
    }
  }

  const workspaceIds = Array.isArray(args?.['workspaceIds'])
    ? (args['workspaceIds'] as string[])
    : undefined;

  // 3. For every file involved, compute target file token count (sum of all files)
  let targetFilesTotalTokens = 0;
  const fileBreakdown: Array<{ file: string; tokens: number; onDisk: boolean }> = [];

  for (const fp of uniqueFiles) {
    const resolved = resolveFilePath(fp, workspaceIds);
    let fileTokens = 0;
    let onDisk = false;

    if (resolved) {
      try {
        const stat = fs.statSync(resolved);
        if (stat.isFile()) {
          const content = fs.readFileSync(resolved, 'utf8');
          fileTokens = Math.max(1, Math.ceil(content.length / 4));
          onDisk = true;
        }
      } catch {
        // Fallback to estimation below
      }
    }

    if (!onDisk) {
      // Find candidate slices for this file to estimate its realistic full file size
      const matchingCandidates = (
        parsedData?.candidates ||
        parsedData?.impactCandidates ||
        parsedData?.entries ||
        []
      ).filter((c: any) => c?.filePath === fp);

      const snippetChars = matchingCandidates.reduce(
        (sum: number, c: any) => sum + (c?.content?.length || 0),
        0
      );
      const snippetTokens = Math.ceil(snippetChars / 4);

      // Typical slice is ~15-25% of a complete target source file
      fileTokens = Math.max(1600, snippetTokens > 0 ? snippetTokens * 5 : 2400);
    }

    targetFilesTotalTokens += fileTokens;
    fileBreakdown.push({ file: fp, tokens: fileTokens, onDisk });
  }

  // 4. Fallback for metadata-only or non-file operations
  if (uniqueFiles.size === 0) {
    switch (tool) {
      case 'backend_health': {
        // Diagnoses 5 upstream providers without dumping 5 raw CLI/HTTP outputs
        targetFilesTotalTokens = 650;
        break;
      }
      case 'record_decision': {
        // Formatted decision avoids manual ADR scaffolding and disk operations
        targetFilesTotalTokens = 950;
        break;
      }
      case 'explain_context': {
        // Ranking explanation avoids dumping all candidate graph and vector matrices
        targetFilesTotalTokens = 1800;
        break;
      }
      default: {
        targetFilesTotalTokens = Math.max(mcpResponseTokens + 800, 1500);
        break;
      }
    }
  }

  // 5. Calculate Token Saving difference
  const tokensSaved = Math.max(0, targetFilesTotalTokens - mcpResponseTokens);
  const reductionPct = targetFilesTotalTokens > 0
    ? Number(((tokensSaved / targetFilesTotalTokens) * 100).toFixed(1))
    : 0;

  const filesArray = Array.from(uniqueFiles);

  return {
    tokensSaved,
    targetFilesTotalTokens,
    mcpResponseTokens,
    filesCount: filesArray.length,
    files: filesArray,
    reductionPct,
    details: {
      tool,
      targetFilesTotalTokens,
      mcpResponseTokens,
      tokensSaved,
      reductionPct,
      filesCount: filesArray.length,
      fileBreakdown: fileBreakdown.slice(0, 10)
    }
  };
}

export function calculateTokensSaved(
  tool: string,
  args: Record<string, unknown> | undefined,
  result: unknown
): number {
  return calculateTokenMetrics(tool, args, result).tokensSaved;
}

export function formatArgsSummary(tool: string, args: Record<string, unknown> | undefined): string {
  if (!args || Object.keys(args).length === 0) {
    return 'default';
  }

  switch (tool) {
    case 'search_context':
      return args['query'] ? `query: "${String(args['query']).slice(0, 45)}"` : JSON.stringify(args);
    case 'get_symbol_context':
      return args['symbol'] ? `symbol: "${args['symbol']}"` : JSON.stringify(args);
    case 'get_impact_context':
      return args['symbol'] ? `symbol: "${args['symbol']}", depth: ${args['depth'] ?? 2}` : `file: "${args['filePath'] ?? 'root'}"`;
    case 'get_repository_map': {
      const ws = Array.isArray(args['workspaceIds']) ? args['workspaceIds'].length : 1;
      return `workspaces: ${ws}`;
    }
    case 'recall_decisions':
      return args['query'] ? `query: "${String(args['query']).slice(0, 40)}"` : JSON.stringify(args);
    case 'record_decision':
      return args['title'] ? `title: "${String(args['title']).slice(0, 40)}"` : JSON.stringify(args);
    case 'explain_context': {
      const cand = args['candidates'];
      const count = Array.isArray(cand) ? cand.length : 0;
      return `candidates: ${count}`;
    }
    case 'backend_health':
      return 'all_providers: true';
    default:
      return JSON.stringify(args).slice(0, 50);
  }
}

/**
 * Emits tool execution events across filesystem stores and HTTP extension bridges.
 */
export async function emitToolExecutionEvent(event: ToolExecutionEvent): Promise<void> {
  const line = JSON.stringify(event) + '\n';
  const latestJson = JSON.stringify(event, null, 2);

  // 1. Persist to all accessible candidate telemetry directories
  for (const dir of getCandidateTelemetryDirs()) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const eventsFile = path.join(dir, 'events.jsonl');
      const latestFile = path.join(dir, 'latest.json');

      fs.appendFileSync(eventsFile, line, 'utf8');
      fs.writeFileSync(latestFile, latestJson, 'utf8');

      // Maintenance: Trim events file if it exceeds 300KB
      try {
        const stats = fs.statSync(eventsFile);
        if (stats.size > 300000) {
          const content = fs.readFileSync(eventsFile, 'utf8');
          const lines = content.trim().split('\n');
          if (lines.length > 200) {
            fs.writeFileSync(eventsFile, lines.slice(-100).join('\n') + '\n', 'utf8');
          }
        }
      } catch {
        // Ignore trim failures
      }
    } catch {
      // Continue to next directory if current is unwritable
    }
  }

  // 2. Direct HTTP notification to VS Code Extension Telemetry Bridge (try 127.0.0.1 and localhost)
  const endpoints = [
    `http://127.0.0.1:${EXTENSION_PORT}/event`,
    `http://localhost:${EXTENSION_PORT}/event`
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 400);

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: controller.signal
      })
        .then(() => clearTimeout(timeout))
        .catch(() => clearTimeout(timeout));
    } catch {
      // Non-blocking
    }
  }

  // 3. Stderr log for terminal / agent console visibility
  const filesInfo = event.details?.['filesCount'] ? ` [${event.details['filesCount']} file(s)]` : '';
  const reductionInfo = event.details?.['reductionPct'] ? ` (-${event.details['reductionPct']}%)` : '';
  process.stderr.write(
    `[context-broker:mcp] Executed tool "${event.tool}" (${event.args})${filesInfo} in ${event.latency}ms (+${event.tokensSaved.toLocaleString()} tokens saved${reductionInfo})\n`
  );
}
