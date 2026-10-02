import { ContextCandidate, generateCandidateId } from '@context-broker/contracts';
import { GitFileDiff, GitBranchStatus } from './types.js';

export function mapGitDiffToCandidate(diff: GitFileDiff): ContextCandidate {
  const candidateId = generateCandidateId({
    sourceBackend: 'git',
    filePath: diff.file_path,
    uniqueSuffix: `diff-${diff.status}`
  });

  return {
    id: candidateId,
    sourceBackend: 'git',
    sourceType: 'git',
    filePath: diff.file_path,
    content: `// Uncommitted Git Diff (${diff.status}, staged: ${diff.staged})\n${diff.diff_text}`,
    freshness: 'live',
    compositeScore: 0.90,
    permissions: ['workspace:read'],
    metadata: {
      diffStatus: diff.status,
      staged: diff.staged,
      linesAdded: diff.lines_added,
      linesDeleted: diff.lines_deleted
    }
  };
}

export function mapGitStatusToCandidate(status: GitBranchStatus): ContextCandidate {
  const candidateId = generateCandidateId({
    sourceBackend: 'git',
    uniqueSuffix: `branch-${status.current_branch}`
  });

  return {
    id: candidateId,
    sourceBackend: 'git',
    sourceType: 'git',
    content: `Git Repository State:\n- Branch: ${status.current_branch}\n- HEAD Commit: ${status.commit_hash}\n- Message: ${status.commit_message}\n- Clean Tree: ${status.is_clean}`,
    freshness: 'live',
    compositeScore: 0.80,
    permissions: ['workspace:read'],
    metadata: {
      branch: status.current_branch,
      commitHash: status.commit_hash,
      isClean: status.is_clean
    }
  };
}
