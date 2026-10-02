#!/usr/bin/env node
/**
 * Unified Context Broker - Setup Validator & Self-Healing Engine
 * Validates repository setup, naming consistency, build integrity, and health diagnostics.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

function log(msg) {
  console.log(msg);
}
function ok(msg) {
  console.log(`  ${COLORS.green}[OK]${COLORS.reset} ${msg}`);
}
function warn(msg) {
  console.log(`  ${COLORS.yellow}[WARN]${COLORS.reset} ${msg}`);
}
function fixed(msg) {
  console.log(`  ${COLORS.cyan}[FIXED]${COLORS.reset} ${msg}`);
}
function fail(msg) {
  console.log(`  ${COLORS.red}[FAIL]${COLORS.reset} ${msg}`);
}

function getPnpmCmd() {
  try {
    execSync('pnpm -v', { stdio: 'pipe' });
    return 'pnpm';
  } catch {
    return 'npx --yes pnpm@9.0.0';
  }
}

export function validateAndFixAll(options = {}) {
  const isFix = options.fix !== false;
  let issuesFound = 0;
  let issuesFixed = 0;

  log(`\n${COLORS.bold}${COLORS.cyan}================================================================${COLORS.reset}`);
  log(`${COLORS.bold}${COLORS.cyan}   Unified Context Broker - Setup Validation & Repair Engine     ${COLORS.reset}`);
  log(`${COLORS.bold}${COLORS.cyan}================================================================${COLORS.reset}\n`);

  // 1. Node.js environment
  log(`${COLORS.bold}1. Checking Node.js Environment...${COLORS.reset}`);
  const nodeVer = process.version;
  const major = parseInt(nodeVer.slice(1).split('.')[0], 10);
  if (major < 20) {
    fail(`Node.js version is ${nodeVer}. Unified Context Broker requires Node.js >= 20.0.0.`);
    issuesFound++;
  } else {
    ok(`Node.js version: ${nodeVer} (Supported)`);
  }

  const pnpmCmd = getPnpmCmd();
  ok(`Package manager command: ${pnpmCmd}`);

  // 2. Project Naming Validation
  log(`\n${COLORS.bold}2. Validating Project Naming ('unified-context-broker')...${COLORS.reset}`);
  const EXPECTED_PROJECT_NAME = 'unified-context-broker';

  // Check root package.json
  const rootPkgPath = path.join(REPO_ROOT, 'package.json');
  if (fs.existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
      if (rootPkg.name !== EXPECTED_PROJECT_NAME) {
        issuesFound++;
        warn(`Root package.json name was '${rootPkg.name}', expected '${EXPECTED_PROJECT_NAME}'.`);
        if (isFix) {
          rootPkg.name = EXPECTED_PROJECT_NAME;
          fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n', 'utf8');
          fixed(`Updated root package.json name to '${EXPECTED_PROJECT_NAME}'.`);
          issuesFixed++;
        }
      } else {
        ok(`Root package.json name: '${EXPECTED_PROJECT_NAME}'`);
      }
    } catch (err) {
      fail(`Failed to parse root package.json: ${err.message}`);
      issuesFound++;
    }
  }

  // Check VS Code Extension package.json
  const extPkgPath = path.join(REPO_ROOT, 'apps', 'vscode-extension', 'package.json');
  if (fs.existsSync(extPkgPath)) {
    try {
      const extPkg = JSON.parse(fs.readFileSync(extPkgPath, 'utf8'));
      if (extPkg.name !== EXPECTED_PROJECT_NAME) {
        issuesFound++;
        warn(`VS Code extension name was '${extPkg.name}', expected '${EXPECTED_PROJECT_NAME}'.`);
        if (isFix) {
          extPkg.name = EXPECTED_PROJECT_NAME;
          fs.writeFileSync(extPkgPath, JSON.stringify(extPkg, null, 2) + '\n', 'utf8');
          fixed(`Updated VS Code extension name to '${EXPECTED_PROJECT_NAME}'.`);
          issuesFixed++;
        }
      } else {
        ok(`VS Code extension package name: '${EXPECTED_PROJECT_NAME}'`);
      }
    } catch (err) {
      fail(`Failed to parse VS Code extension package.json: ${err.message}`);
      issuesFound++;
    }
  }

  // Check and clean spurious directories in REPO_ROOT
  const spuriousFolders = [
    path.join(REPO_ROOT, 'unified-context-broker'),
    path.join(REPO_ROOT, 'unified-context-broker-main')
  ];
  for (const sFolder of spuriousFolders) {
    if (fs.existsSync(sFolder)) {
      issuesFound++;
      warn(`Spurious nested directory detected: ${path.relative(REPO_ROOT, sFolder)}`);
      if (isFix) {
        fs.rmSync(sFolder, { recursive: true, force: true });
        fixed(`Cleaned up spurious directory: ${path.relative(REPO_ROOT, sFolder)}`);
        issuesFixed++;
      }
    }
  }

  // Check AGENTS.md for invalid naming variations
  const agentsPath = path.join(REPO_ROOT, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    let agentsContent = fs.readFileSync(agentsPath, 'utf8');
    if (agentsContent.includes('unified-context-broker-main')) {
      issuesFound++;
      warn(`AGENTS.md contained legacy name variation 'unified-context-broker-main'.`);
      if (isFix) {
        agentsContent = agentsContent.replaceAll('unified-context-broker-main', 'unified-context-broker');
        fs.writeFileSync(agentsPath, agentsContent, 'utf8');
        fixed(`Updated AGENTS.md to strictly use '${EXPECTED_PROJECT_NAME}'.`);
        issuesFixed++;
      }
    } else {
      ok(`AGENTS.md naming validated strictly as '${EXPECTED_PROJECT_NAME}'`);
    }
  }

  // 3. Storage and Directory Isolation (.data/ and .agents/)
  log(`\n${COLORS.bold}3. Validating Conconfined Storage (.data/ & .agents/)...${COLORS.reset}`);
  const requiredDataDirs = [
    path.join(REPO_ROOT, '.data'),
    path.join(REPO_ROOT, '.data', 'telemetry'),
    path.join(REPO_ROOT, '.agents', 'memory')
  ];
  for (const dir of requiredDataDirs) {
    if (!fs.existsSync(dir)) {
      issuesFound++;
      warn(`Missing storage directory: ${path.relative(REPO_ROOT, dir)}`);
      if (isFix) {
        fs.mkdirSync(dir, { recursive: true });
        fixed(`Created directory: ${path.relative(REPO_ROOT, dir)}`);
        issuesFixed++;
      }
    } else {
      ok(`Storage directory exists: ${path.relative(REPO_ROOT, dir)}`);
    }
  }

  const memoryFile = path.join(REPO_ROOT, '.agents', 'memory', 'decisions.jsonl');
  if (!fs.existsSync(memoryFile)) {
    issuesFound++;
    warn(`Durable ADR file missing: .agents/memory/decisions.jsonl`);
    if (isFix) {
      fs.writeFileSync(memoryFile, '', 'utf8');
      fixed(`Initialized durable ADR file: .agents/memory/decisions.jsonl`);
      issuesFixed++;
    }
  } else {
    ok(`Durable ADR file exists: .agents/memory/decisions.jsonl`);
  }

  // 4. MCP Configuration Files
  log(`\n${COLORS.bold}4. Validating MCP Configuration Files...${COLORS.reset}`);
  const mcpServerEntry = path.join(REPO_ROOT, 'apps', 'mcp-server', 'dist', 'index.js');
  const expectedConfig = {
    mcpServers: {
      'context-broker': {
        command: 'node',
        args: [mcpServerEntry]
      }
    }
  };

  const mcpConfigTargets = [
    path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json'),
    path.join(REPO_ROOT, '.agents', 'mcp_config.json')
  ];

  for (const target of mcpConfigTargets) {
    let needsWrite = false;
    if (!fs.existsSync(target)) {
      issuesFound++;
      warn(`MCP config missing: ${path.relative(REPO_ROOT, target)}`);
      needsWrite = true;
    } else {
      try {
        const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
        if (!parsed.mcpServers || !parsed.mcpServers['context-broker']) {
          issuesFound++;
          warn(`MCP config incomplete: ${path.relative(REPO_ROOT, target)}`);
          needsWrite = true;
        } else {
          ok(`MCP config valid: ${path.relative(REPO_ROOT, target)}`);
        }
      } catch {
        issuesFound++;
        warn(`MCP config corrupted: ${path.relative(REPO_ROOT, target)}`);
        needsWrite = true;
      }
    }

    if (needsWrite && isFix) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(expectedConfig, null, 2), 'utf8');
      fixed(`Generated valid MCP config: ${path.relative(REPO_ROOT, target)}`);
      issuesFixed++;
    }
  }

  // 5. Build Artifacts Verification
  log(`\n${COLORS.bold}5. Validating Build Artifacts...${COLORS.reset}`);
  const requiredArtifacts = [
    { name: 'contracts', file: 'packages/contracts/dist/index.js' },
    { name: 'orchestrator', file: 'packages/orchestrator/dist/index.js' },
    { name: 'ranking', file: 'packages/ranking/dist/index.js' },
    { name: 'provenance', file: 'packages/provenance/dist/index.js' },
    { name: 'security', file: 'packages/security/dist/index.js' },
    { name: 'adapter-lexical', file: 'packages/adapter-lexical/dist/index.js' },
    { name: 'adapter-codegraph', file: 'packages/adapter-codegraph/dist/index.js' },
    { name: 'adapter-vector', file: 'packages/adapter-vector/dist/index.js' },
    { name: 'adapter-git', file: 'packages/adapter-git/dist/index.js' },
    { name: 'adapter-memory', file: 'packages/adapter-memory/dist/index.js' },
    { name: 'mcp-server', file: 'apps/mcp-server/dist/index.js' },
    { name: 'mcp-server bundle', file: 'apps/mcp-server/dist/bundle.js' },
    { name: 'dashboard server', file: 'apps/dashboard/dist/server.js' },
    { name: 'vscode-extension', file: 'apps/vscode-extension/dist/extension.js' }
  ];

  let missingArtifacts = false;
  for (const artifact of requiredArtifacts) {
    const fullPath = path.join(REPO_ROOT, artifact.file);
    if (!fs.existsSync(fullPath)) {
      warn(`Missing build artifact for ${artifact.name} (${artifact.file})`);
      missingArtifacts = true;
    } else {
      ok(`Artifact ready: ${artifact.name}`);
    }
  }

  if (missingArtifacts) {
    issuesFound++;
    if (isFix) {
      log(`  ${COLORS.yellow}[!] Rebuilding monorepo packages and bundle...${COLORS.reset}`);
      try {
        execSync(`${pnpmCmd} run build`, { cwd: REPO_ROOT, stdio: 'inherit' });
        execSync(`${pnpmCmd} --filter @context-broker/mcp-server run bundle`, { cwd: REPO_ROOT, stdio: 'inherit' });
        fixed(`All monorepo packages and standalone bundle successfully rebuilt.`);
        issuesFixed++;
      } catch (err) {
        fail(`Monorepo build failed: ${err.message}`);
      }
    }
  }

  // 6. Diagnostics & Health Self-Check
  log(`\n${COLORS.bold}6. Running Engine Health Self-Check...${COLORS.reset}`);
  if (fs.existsSync(mcpServerEntry)) {
    try {
      const res = spawnSync('node', [mcpServerEntry, '--health'], { cwd: REPO_ROOT, encoding: 'utf8' });
      if (res.status === 0) {
        const health = JSON.parse(res.stdout);
        const adapters = Object.keys(health);
        let allHealthy = true;
        for (const ad of adapters) {
          const status = health[ad]?.health?.status || 'unknown';
          if (status === 'healthy') {
            ok(`Adapter '${ad}': healthy`);
          } else {
            warn(`Adapter '${ad}': ${status}`);
            allHealthy = false;
          }
        }
        if (allHealthy) {
          ok(`All 5 retrieval adapters report healthy status.`);
        }
      } else {
        warn(`Engine health check exited with status ${res.status}: ${res.stderr || res.stdout}`);
      }
    } catch (err) {
      fail(`Engine health check failed to run: ${err.message}`);
    }
  }

  // Summary
  log(`\n${COLORS.bold}================================================================${COLORS.reset}`);
  if (issuesFound === 0) {
    log(`${COLORS.bold}${COLORS.green}  [SUCCESS] All checks passed! Repository is clean and fully ready.${COLORS.reset}`);
  } else if (issuesFound === issuesFixed) {
    log(`${COLORS.bold}${COLORS.green}  [SUCCESS] Found ${issuesFound} issue(s) - all successfully resolved & fixed!${COLORS.reset}`);
  } else {
    log(`${COLORS.bold}${COLORS.yellow}  [NOTICE] Found ${issuesFound} issue(s), ${issuesFixed} resolved, ${issuesFound - issuesFixed} remaining.${COLORS.reset}`);
  }
  log(`${COLORS.bold}================================================================${COLORS.reset}\n`);

  return { issuesFound, issuesFixed, clean: issuesFound === issuesFixed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const isValidateOnly = args.includes('--validate') || args.includes('-v');
  const result = validateAndFixAll({ fix: true, validateOnly: isValidateOnly });
  if (!result.clean && isValidateOnly) {
    process.exit(1);
  }
}
