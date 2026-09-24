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

    return {
      current_branch: 'main',
      commit_hash: 'HEAD',
      commit_message: 'Working commit',
      is_clean: true,
      ahead: 0,
      behind: 0
    };
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
    return [];
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

    return 'live';
  }
}
