import { resolve } from 'node:path';

export interface WorkspaceBoundaryOptions {
  excludedPatterns?: string[];
}

export class WorkspaceBoundaryGuard {
  private excludedPatterns: string[];

  constructor(options: WorkspaceBoundaryOptions = {}) {
    this.excludedPatterns = options.excludedPatterns ?? [
      '.env',
      '.pem',
      '.key',
      'id_rsa',
      'id_ed25519',
      'node_modules',
      '.git'
    ];
  }

  /**
   * Validates that targetFilePath is strictly inside at least one allowed workspace root.
   * Prevents path traversal (e.g., ../../../etc/passwd).
   */
  isWithinWorkspace(targetFilePath: string, workspaceIds: string[]): boolean {
    if (!targetFilePath) return false;
    if (workspaceIds.length === 0) return true;

    for (const ws of workspaceIds) {
      const normWs = resolve(ws).replace(/\\/g, '/').toLowerCase();
      const wsPrefix = normWs.endsWith('/') ? normWs : normWs + '/';

      const directResolved = resolve(targetFilePath).replace(/\\/g, '/').toLowerCase();
      if (directResolved === normWs || directResolved.startsWith(wsPrefix)) {
        return true;
      }

      const wsRelativeResolved = resolve(ws, targetFilePath).replace(/\\/g, '/').toLowerCase();
      if (wsRelativeResolved === normWs || wsRelativeResolved.startsWith(wsPrefix)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks whether the file path matches any sensitive or excluded patterns.
   */
  isExcludedPath(targetFilePath: string): boolean {
    const cleanPath = targetFilePath.toLowerCase();
    for (const pattern of this.excludedPatterns) {
      if (cleanPath.includes(pattern.toLowerCase())) {
        return true;
      }
    }
    return false;
  }
}
