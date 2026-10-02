import { execSync } from 'node:child_process';
import { GitBranchStatus, GitFileDiff, GitBlameLine } from './types.js';

export interface GitClientConfig {
  workspaceRoot?: string;
  mockMode?: boolean;
}

export class GitClient {
  private config: GitClientConfig;

  constructor(config: GitClientConfig = {}) {
    this.config = config;
  }

  async getStatus(): Promise<GitBranchStatus> {
    if (this.config.mockMode) {
      return {
        current_branch: 'main',
        commit_hash: 'a1b2c3d4e5f67890',
        commit_message: 'feat: add call record extraction and session dispatcher',
        is_clean: false,
        ahead: 0,
        behind: 0
      };
    }

    try {
      const cwd = this.config.workspaceRoot || process.cwd();
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const hash = execSync('git rev-parse HEAD', { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const msg = execSync('git log -1 --pretty=%s', { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const statusOut = execSync('git status --porcelain', { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

      return {
        current_branch: branch || 'main',
        commit_hash: hash || 'HEAD',
        commit_message: msg || 'Working commit',
        is_clean: statusOut.length === 0,
        ahead: 0,
        behind: 0
      };
    } catch {
      return {
        current_branch: 'main',
        commit_hash: 'HEAD',
        commit_message: 'Working commit',
        is_clean: true,
        ahead: 0,
        behind: 0
      };
    }
  }

  async getDiffs(): Promise<GitFileDiff[]> {
    if (this.config.mockMode) {
      return [
        {
          file_path: 'src/services/call-record.ts',
          status: 'modified',
          staged: false,
          diff_text: '@@ -15,4 +15,6 @@\n+ // Added header validation check\n+ if (!rawHeader) return "";',
          lines_added: 2,
          lines_deleted: 0
        }
      ];
    }

    try {
      const cwd = this.config.workspaceRoot || process.cwd();
      const porcelain = execSync('git status --porcelain', { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
      const diffs: GitFileDiff[] = [];
      const lines = porcelain.split('\n').filter((l) => l.trim().length > 0);

      for (const line of lines.slice(0, 20)) {
        const code = line.substring(0, 2).trim();
        const filePath = line.substring(3).trim();
        let status: GitFileDiff['status'] = 'modified';
        if (code.includes('A') || code.includes('?')) status = 'added';
        if (code.includes('D')) status = 'deleted';
        if (code.includes('R')) status = 'renamed';

        diffs.push({
          file_path: filePath,
          status,
          staged: line.startsWith('M') || line.startsWith('A'),
          diff_text: `+ ${line}`,
          lines_added: 1,
          lines_deleted: 0
        });
      }
      return diffs;
    } catch {
      return [];
    }
  }

  async getBlame(_filePath: string, startLine = 1, endLine = 10): Promise<GitBlameLine[]> {
    if (this.config.mockMode) {
      const lines: GitBlameLine[] = [];
      for (let l = startLine; l <= endLine; l++) {
        lines.push({
          line_number: l,
          commit_hash: 'a1b2c3d',
          author: 'Platform Architecture Team',
          timestamp: new Date().toISOString(),
          content: `// code on line ${l}`
        });
      }
      return lines;
    }
    return [];
  }

  /**
   * Evaluates freshness of a file: live, stale, or indexed.
   */
  async checkFreshness(filePath: string, indexedAt?: string): Promise<'live' | 'stale' | 'indexed'> {
    if (!indexedAt) return 'live';

    if (this.config.mockMode) {
      // If the file is in modified diffs, it is stale relative to old index
      if (filePath.includes('call-record.ts')) {
        return 'stale';
      }
      return 'live';
    }

    try {
      const diffs = await this.getDiffs();
      const isModified = diffs.some((d) => d.file_path.includes(filePath));
      if (isModified) return 'stale';
    } catch {
      // ignore
    }

    return 'live';
  }
}
