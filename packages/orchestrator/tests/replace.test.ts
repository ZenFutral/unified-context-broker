import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileReplacementEngine } from '../src/mutation/index.js';
import { WorkspaceBoundaryGuard, SecretScrubber } from '@context-broker/security';

describe('FileReplacementEngine (Phase 6 Mutation Core)', () => {
  let tempDir: string;
  let engine: FileReplacementEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-broker-replace-test-'));
    engine = new FileReplacementEngine({
      boundaryGuard: new WorkspaceBoundaryGuard({
        excludedPatterns: ['**/.env*', '**/node_modules/**', '**/.git/**']
      }),
      secretScrubber: new SecretScrubber(),
      workspaceRoots: [tempDir]
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('1. performs single contiguous replacement atomically', async () => {
    const filePath = path.join(tempDir, 'sample.ts');
    const initialContent = `export function calculateTax(amount: number): number {\n  const rate = 0.05;\n  return amount * rate;\n}\n`;
    fs.writeFileSync(filePath, initialContent, 'utf8');

    const result = await engine.replace({
      targetFile: filePath,
      replacements: [
        {
          targetContent: 'const rate = 0.05;',
          replacementContent: 'const rate = 0.08;'
        }
      ],
      dryRun: false,
      workspaceIds: [tempDir]
    });

    expect(result.modified).toBe(true);
    expect(result.chunksApplied).toBe(1);
    expect(result.unifiedDiff).toContain('-  const rate = 0.05;');
    expect(result.unifiedDiff).toContain('+  const rate = 0.08;');

    const onDisk = fs.readFileSync(filePath, 'utf8');
    expect(onDisk).toContain('const rate = 0.08;');
    expect(onDisk).not.toContain('const rate = 0.05;');
  });

  it('2. performs multi-chunk non-contiguous replacement in a single pass', async () => {
    const filePath = path.join(tempDir, 'multi.ts');
    const initialContent = [
      '// Header line 1',
      'import { a } from "module-a";',
      '// Line 3',
      'const foo = "bar";',
      '// Line 5',
      'export function run() {',
      '  return "original";',
      '}'
    ].join('\n');
    fs.writeFileSync(filePath, initialContent, 'utf8');

    const result = await engine.replace({
      targetFile: filePath,
      replacements: [
        {
          targetContent: 'import { a } from "module-a";',
          replacementContent: 'import { a, b } from "module-a";'
        },
        {
          targetContent: 'const foo = "bar";',
          replacementContent: 'const foo = "baz";'
        },
        {
          targetContent: 'return "original";',
          replacementContent: 'return "updated";'
        }
      ],
      dryRun: false,
      workspaceIds: [tempDir]
    });

    expect(result.modified).toBe(true);
    expect(result.chunksApplied).toBe(3);

    const onDisk = fs.readFileSync(filePath, 'utf8');
    expect(onDisk).toContain('import { a, b } from "module-a";');
    expect(onDisk).toContain('const foo = "baz";');
    expect(onDisk).toContain('return "updated";');
    expect(onDisk).toContain('// Header line 1');
    expect(onDisk).toContain('// Line 5');
  });

  it('3. rejects ambiguous target matches when allowMultiple is false', async () => {
    const filePath = path.join(tempDir, 'ambiguous.ts');
    const initialContent = `const val = 10;\nconsole.log(val);\nconst val2 = val;\n`;
    fs.writeFileSync(filePath, initialContent, 'utf8');

    await expect(
      engine.replace({
        targetFile: filePath,
        replacements: [
          {
            targetContent: 'val',
            replacementContent: 'valRenamed',
            allowMultiple: false
          }
        ],
        workspaceIds: [tempDir]
      })
    ).rejects.toThrow(/Ambiguous match/);

    // When allowMultiple is true, it should succeed
    const result = await engine.replace({
      targetFile: filePath,
      replacements: [
        {
          targetContent: 'val',
          replacementContent: 'valRenamed',
          allowMultiple: true
        }
      ],
      workspaceIds: [tempDir]
    });

    expect(result.modified).toBe(true);
    const onDisk = fs.readFileSync(filePath, 'utf8');
    expect(onDisk).not.toContain('const val = 10;');
    expect(onDisk).toContain('const valRenamed = 10;');
  });

  it('4. executes dry-run mode without modifying file on disk', async () => {
    const filePath = path.join(tempDir, 'dryrun.ts');
    const initialContent = `export const VERSION = "1.0.0";\n`;
    fs.writeFileSync(filePath, initialContent, 'utf8');

    const result = await engine.replace({
      targetFile: filePath,
      replacements: [
        {
          targetContent: '"1.0.0"',
          replacementContent: '"2.0.0"'
        }
      ],
      dryRun: true,
      workspaceIds: [tempDir]
    });

    expect(result.modified).toBe(false);
    expect(result.unifiedDiff).toContain('-export const VERSION = "1.0.0";');
    expect(result.unifiedDiff).toContain('+export const VERSION = "2.0.0";');

    const onDisk = fs.readFileSync(filePath, 'utf8');
    expect(onDisk).toBe(initialContent);
  });

  it('5. rejects modifications outside workspace boundaries or on excluded paths', async () => {
    // Attempt edit on excluded .env file
    const envFile = path.join(tempDir, '.env');
    fs.writeFileSync(envFile, 'PORT=3000\n', 'utf8');

    await expect(
      engine.replace({
        targetFile: envFile,
        replacements: [
          {
            targetContent: '3000',
            replacementContent: '4000'
          }
        ],
        workspaceIds: [tempDir]
      })
    ).rejects.toThrow(/Path security violation/);

    // Attempt edit outside workspace
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-ws-'));
    const outsideFile = path.join(outsideDir, 'external.ts');
    fs.writeFileSync(outsideFile, 'let x = 1;\n', 'utf8');

    try {
      await expect(
        engine.replace({
          targetFile: outsideFile,
          replacements: [
            {
              targetContent: '1',
              replacementContent: '2'
            }
          ],
          workspaceIds: [tempDir] // only tempDir allowed
        })
      ).rejects.toThrow(/Path security violation/);
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('6. detects and blocks accidental secret injection via SecretScrubber', async () => {
    const filePath = path.join(tempDir, 'config.ts');
    fs.writeFileSync(filePath, 'export const apiKey = "";\n', 'utf8');

    // Attempt injecting simulated OpenAI key
    const secretKey = 'sk-1234567890abcdef1234567890abcdef1234';

    await expect(
      engine.replace({
        targetFile: filePath,
        replacements: [
          {
            targetContent: 'apiKey = ""',
            replacementContent: `apiKey = "${secretKey}"`
          }
        ],
        workspaceIds: [tempDir]
      })
    ).rejects.toThrow(/Security rejection: replacementContent contains detected secret credential/);

    // Ensure file remains unchanged
    const onDisk = fs.readFileSync(filePath, 'utf8');
    expect(onDisk).toBe('export const apiKey = "";\n');
  });
});
