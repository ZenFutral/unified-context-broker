import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProviderRegistry, ContextOrchestrator } from '@context-broker/orchestrator';
import { handleSearchAndReplace } from '../src/tools/replace.js';
import { createMcpServer } from '../src/server.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

describe('MCP search_and_replace Tool & Aliases (Phase 6)', () => {
  let tempDir: string;
  let orchestrator: ContextOrchestrator;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-replace-test-'));
    const registry = new ProviderRegistry();
    orchestrator = new ContextOrchestrator(registry, {
      security: {
        excludedPatterns: ['**/.env*']
      }
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('1. executes search_and_replace tool via handleSearchAndReplace', async () => {
    const testFile = path.join(tempDir, 'service.ts');
    fs.writeFileSync(testFile, 'export const timeoutMs = 5000;\n', 'utf8');

    const response = await handleSearchAndReplace(orchestrator, {
      targetFile: testFile,
      replacements: [
        {
          targetContent: 'timeoutMs = 5000',
          replacementContent: 'timeoutMs = 10000'
        }
      ],
      workspaceIds: [tempDir]
    });

    expect(response.isError).toBeFalsy();
    const result = JSON.parse(response.content[0]?.text || '{}');
    expect(result.modified).toBe(true);
    expect(result.chunksApplied).toBe(1);
    expect(result.unifiedDiff).toContain('-export const timeoutMs = 5000;');
    expect(result.unifiedDiff).toContain('+export const timeoutMs = 10000;');

    const onDisk = fs.readFileSync(testFile, 'utf8');
    expect(onDisk).toBe('export const timeoutMs = 10000;\n');
  });

  it('2. supports shorthand find and replace parameters', async () => {
    const testFile = path.join(tempDir, 'shorthand.ts');
    fs.writeFileSync(testFile, 'const mode = "development";\n', 'utf8');

    const response = await handleSearchAndReplace(orchestrator, {
      targetFile: testFile,
      find: '"development"',
      replace: '"production"',
      workspaceIds: [tempDir]
    });

    expect(response.isError).toBeFalsy();
    const result = JSON.parse(response.content[0]?.text || '{}');
    expect(result.modified).toBe(true);
    const onDisk = fs.readFileSync(testFile, 'utf8');
    expect(onDisk).toBe('const mode = "production";\n');
  });

  it('3. lists search_and_replace and canonical aliases replace_in_file and patch_file', async () => {
    const server = createMcpServer(orchestrator);

    // Test ListTools handler directly
    const listHandler = (server as any)._requestHandlers?.get(ListToolsRequestSchema.shape.method.value);
    expect(listHandler).toBeDefined();

    const toolsResult = await listHandler({ method: 'tools/list' });
    const toolNames = toolsResult.tools.map((t: any) => t.name);

    expect(toolNames).toContain('search_and_replace');
    expect(toolNames).toContain('replace_in_file');
    expect(toolNames).toContain('patch_file');
  });

  it('4. executes canonical aliases replace_in_file and patch_file via server CallTool', async () => {
    const server = createMcpServer(orchestrator);
    const callHandler = (server as any)._requestHandlers?.get(CallToolRequestSchema.shape.method.value);
    expect(callHandler).toBeDefined();

    const testFile = path.join(tempDir, 'alias-test.ts');
    fs.writeFileSync(testFile, 'let count = 0;\n', 'utf8');

    // Test replace_in_file alias
    const replaceResult = await callHandler({
      method: 'tools/call',
      params: {
        name: 'replace_in_file',
        arguments: {
          targetFile: testFile,
          find: 'count = 0',
          replace: 'count = 1',
          workspaceIds: [tempDir]
        }
      }
    });

    expect(replaceResult.isError).toBeFalsy();
    let onDisk = fs.readFileSync(testFile, 'utf8');
    expect(onDisk).toBe('let count = 1;\n');

    // Test patch_file alias
    const patchResult = await callHandler({
      method: 'tools/call',
      params: {
        name: 'patch_file',
        arguments: {
          targetFile: testFile,
          replacements: [
            {
              targetContent: 'count = 1',
              replacementContent: 'count = 2'
            }
          ],
          workspaceIds: [tempDir]
        }
      }
    });

    expect(patchResult.isError).toBeFalsy();
    onDisk = fs.readFileSync(testFile, 'utf8');
    expect(onDisk).toBe('let count = 2;\n');
  });

  it('5. handles dry-run mode via MCP tool without disk mutation', async () => {
    const testFile = path.join(tempDir, 'mcp-dryrun.ts');
    const initial = 'const maxRetries = 3;\n';
    fs.writeFileSync(testFile, initial, 'utf8');

    const response = await handleSearchAndReplace(orchestrator, {
      targetFile: testFile,
      find: 'maxRetries = 3',
      replace: 'maxRetries = 5',
      dryRun: true,
      workspaceIds: [tempDir]
    });

    expect(response.isError).toBeFalsy();
    const result = JSON.parse(response.content[0]?.text || '{}');
    expect(result.modified).toBe(false);
    expect(result.unifiedDiff).toContain('-const maxRetries = 3;');
    expect(result.unifiedDiff).toContain('+const maxRetries = 5;');

    const onDisk = fs.readFileSync(testFile, 'utf8');
    expect(onDisk).toBe(initial);
  });
});
