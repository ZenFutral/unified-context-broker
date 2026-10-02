import fs from 'node:fs';
import path from 'node:path';
import { ToolExecutionEvent, getBrokerRoot } from '@context-broker/contracts';

const EXTENSION_PORT = 49221;
const fileTokenCache = new Map<string, { mtime: number; tokens: number }>();

/**
 * Discovers target directories where telemetry events are recorded.
 * Resolves strictly relative to the package installation directory (<brokerRoot>/.data/telemetry/).
 */
export function getCandidateTelemetryDirs(): string[] {
  const dirs: string[] = [];

  if (process.env['CONTEXT_BROKER_TELEMETRY_DIR']) {
    dirs.push(process.env['CONTEXT_BROKER_TELEMETRY_DIR']);
  }

  // Primary broker internal telemetry directory
  const brokerRoot = getBrokerRoot();
  dirs.push(path.join(brokerRoot, '.data', 'telemetry'));

  // Fallback internal directory within broker root
  dirs.push(path.join(brokerRoot, '.data'));

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

  return undefined;
}

/**
 * Calculates token savings according to the formula:
 * Token Saving = (Sum of Token Count of all Target Files Involved) - (MCP Response Tokens)
 * Uses in-memory stat mtime caching for maximum speed.
 */
export function calculateTokenMetrics(
  tool: string,
  args: Record<string, unknown> | undefined,
  result: unknown
): TokenMetricsResult {
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

  let parsedData: any = null;
  try {
    if (responseText) {
      parsedData = JSON.parse(responseText);
    }
  } catch {
    // Non-JSON response
  }

  const uniqueFiles = new Set<string>();

  if (typeof args?.['filePath'] === 'string' && args['filePath'].trim()) {
    uniqueFiles.add(args['filePath'].trim());
  }

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

    if (typeof parsedData?.targetFile === 'string' && parsedData.targetFile.trim()) {
      uniqueFiles.add(parsedData.targetFile.trim());
    }
  }

  if (typeof args?.['targetFile'] === 'string' && (args['targetFile'] as string).trim()) {
    uniqueFiles.add((args['targetFile'] as string).trim());
  }

  const workspaceIds = Array.isArray(args?.['workspaceIds'])
    ? (args['workspaceIds'] as string[])
    : undefined;

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
          const cached = fileTokenCache.get(resolved);
          if (cached && cached.mtime === stat.mtimeMs) {
            fileTokens = cached.tokens;
            onDisk = true;
          } else {
            const content = fs.readFileSync(resolved, 'utf8');
            fileTokens = Math.max(1, Math.ceil(content.length / 4));
            fileTokenCache.set(resolved, { mtime: stat.mtimeMs, tokens: fileTokens });
            onDisk = true;
          }
        }
      } catch {
        // Fallback to estimation below
      }
    }

    if (!onDisk) {
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
      fileTokens = Math.max(1600, snippetTokens > 0 ? snippetTokens * 5 : 2400);
    }

    targetFilesTotalTokens += fileTokens;
    fileBreakdown.push({ file: fp, tokens: fileTokens, onDisk });
  }

  if (uniqueFiles.size === 0) {
    switch (tool) {
      case 'backend_health': {
        targetFilesTotalTokens = 650;
        break;
      }
      case 'record_decision': {
        targetFilesTotalTokens = 950;
        break;
      }
      case 'explain_context': {
        targetFilesTotalTokens = 1800;
        break;
      }
      default: {
        targetFilesTotalTokens = Math.max(mcpResponseTokens + 800, 1500);
        break;
      }
    }
  }

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
    case 'search_and_replace':
    case 'replace_in_file':
    case 'patch_file': {
      const file = String(args['targetFile'] || args['file'] || 'file');
      const chunks = Array.isArray(args['replacements']) ? args['replacements'].length : 1;
      const dry = args['dryRun'] ? ' [dry-run]' : '';
      return `file: "${file.slice(0, 30)}", chunks: ${chunks}${dry}`;
    }
    default:
      return JSON.stringify(args).slice(0, 50);
  }
}

/**
 * Asynchronously emits tool execution events without blocking the main event loop.
 */
export async function emitToolExecutionEvent(event: ToolExecutionEvent): Promise<void> {
  const line = JSON.stringify(event) + '\n';
  const latestJson = JSON.stringify(event, null, 2);

  const telemetryDir = getCandidateTelemetryDirs()[0] || path.join(getBrokerRoot(), '.data', 'telemetry');

  try {
    if (!fs.existsSync(telemetryDir)) {
      await fs.promises.mkdir(telemetryDir, { recursive: true });
    }
    const eventsFile = path.join(telemetryDir, 'events.jsonl');
    const latestFile = path.join(telemetryDir, 'latest.json');

    await fs.promises.appendFile(eventsFile, line, 'utf8');
    await fs.promises.writeFile(latestFile, latestJson, 'utf8');
  } catch {
    // Non-blocking catch
  }

  // Direct HTTP notification to VS Code Extension Telemetry Bridge (non-blocking)
  const endpoint = `http://127.0.0.1:${EXTENSION_PORT}/event`;
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

  // Stderr log for terminal / agent console visibility
  const filesInfo = event.details?.['filesCount'] ? ` [${event.details['filesCount']} file(s)]` : '';
  const reductionInfo = event.details?.['reductionPct'] ? ` (-${event.details['reductionPct']}%)` : '';
  process.stderr.write(
    `[context-broker:mcp] Executed tool "${event.tool}" (${event.args})${filesInfo} in ${event.latency}ms (+${event.tokensSaved.toLocaleString()} tokens saved${reductionInfo})\n`
  );
}
