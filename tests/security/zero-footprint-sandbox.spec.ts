import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { deploySingleIndicatorToAgentsMd } from '../../apps/vscode-extension/src/initWorkspace.js';
import { getBrokerRoot } from '../../packages/contracts/src/config.js';

describe('Phase 5: Zero-Footprint Acceptance & Confinement Test', () => {
  let tempHostDir: string;

  beforeEach(() => {
    // Create a temporary directory representing an external host project
    tempHostDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ucb-host-repo-'));
    
    // Seed host repository with source files
    fs.mkdirSync(path.join(tempHostDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempHostDir, 'src', 'index.ts'), 'console.log("hello host");', 'utf8');

    // Seed existing AGENTS.md file
    fs.writeFileSync(
      path.join(tempHostDir, 'AGENTS.md'),
      '# Host Project Guidelines\n\nExisting host content.\n',
      'utf8'
    );

    // Seed simulated broker folder inside host directory
    const brokerDir = path.join(tempHostDir, 'unified-context-broker');
    fs.mkdirSync(brokerDir, { recursive: true });
    fs.writeFileSync(path.join(brokerDir, 'package.json'), '{"name":"unified-context-broker"}', 'utf8');
  });

  afterEach(() => {
    if (tempHostDir && fs.existsSync(tempHostDir)) {
      try {
        fs.rmSync(tempHostDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors in test
      }
    }
  });

  it('guarantees single-indicator deployment to AGENTS.md without polluting host root', () => {
    // 1. Run deployment
    const updated = deploySingleIndicatorToAgentsMd(tempHostDir, 'unified-context-broker');
    expect(updated).toBe(true);

    // 2. Read contents of host root
    const hostEntries = fs.readdirSync(tempHostDir);

    // 3. Assert NO unexpected hidden or config directories were created at host root
    expect(hostEntries).not.toContain('.context-broker');
    expect(hostEntries).not.toContain('.vscode');
    expect(hostEntries).not.toContain('.agents');
    expect(hostEntries).not.toContain('.cursor');
    expect(hostEntries).not.toContain('.data');

    // 4. Assert AGENTS.md is updated idempotently with delimiter tags
    const agentsContent = fs.readFileSync(path.join(tempHostDir, 'AGENTS.md'), 'utf8');
    expect(agentsContent).toContain('<!-- CONTEXT_BROKER_START -->');
    expect(agentsContent).toContain('<!-- CONTEXT_BROKER_END -->');
    expect(agentsContent).toContain('# Host Project Guidelines');
  });

  it('verifies getBrokerRoot resolves internal broker directory safely', () => {
    const brokerRoot = getBrokerRoot();
    expect(fs.existsSync(brokerRoot)).toBe(true);
    const dataDir = path.join(brokerRoot, '.data');
    expect(dataDir.startsWith(brokerRoot)).toBe(true);
  });

  it('guarantees search/replace mutation does not write unexpected files outside target file and .data/', async () => {
    const { FileReplacementEngine } = await import('@context-broker/orchestrator');
    const { WorkspaceBoundaryGuard, SecretScrubber } = await import('@context-broker/security');

    const boundaryGuard = new WorkspaceBoundaryGuard();
    const secretScrubber = new SecretScrubber();
    const engine = new FileReplacementEngine({
      boundaryGuard,
      secretScrubber,
      workspaceRoots: [tempHostDir]
    });

    const testFile = path.join(tempHostDir, 'src', 'index.ts');
    const res = await engine.replace({
      targetFile: testFile,
      replacements: [
        {
          targetContent: 'hello host',
          replacementContent: 'hello confined host'
        }
      ]
    });

    expect(res.modified).toBe(true);
    expect(fs.readFileSync(testFile, 'utf8')).toBe('console.log("hello confined host");');

    // Confirm no stray files (no .tmp, .bak, .swap) created in tempHostDir or src
    const rootFiles = fs.readdirSync(tempHostDir);
    expect(rootFiles.sort()).toEqual(['AGENTS.md', 'src', 'unified-context-broker'].sort());
    const srcFiles = fs.readdirSync(path.join(tempHostDir, 'src'));
    expect(srcFiles).toEqual(['index.ts']);
  });
});

