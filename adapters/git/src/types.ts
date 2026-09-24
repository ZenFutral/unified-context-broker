/**
 * Native Git repository inspection data structures.
 * These types MUST NOT be exported outside of the @context-broker/adapter-git package.
 */

export interface GitBranchStatus {
  current_branch: string;
  commit_hash: string;
  commit_message: string;
  is_clean: boolean;
  ahead: number;
  behind: number;
}

export interface GitFileDiff {
  file_path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
  diff_text: string;
  lines_added: number;
  lines_deleted: number;
}

export interface GitBlameLine {
  line_number: number;
  commit_hash: string;
  author: string;
  timestamp: string;
  content: string;
}
