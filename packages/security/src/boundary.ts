import { resolve } from 'node:path';
import * as fs from 'node:fs';
import { PolicyExclusions } from '@context-broker/contracts';

export interface WorkspaceBoundaryOptions {
  excludedPatterns?: string[];
  policyExclusions?: PolicyExclusions;
}

export class WorkspaceBoundaryGuard {
  private excludedPatterns: string[];

  constructor(options: WorkspaceBoundaryOptions = {}) {
    if (options.policyExclusions?.pathExclusions) {
      this.excludedPatterns = options.policyExclusions.pathExclusions;
    } else {
      this.excludedPatterns = options.excludedPatterns ?? [
        '**/.env*',
        '**/*.pem',
        '**/*.key',
        '**/*.p12',
        '**/id_rsa*',
        '**/id_ed25519*',
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**'
      ];
    }
  }

  /**
   * Converts a glob pattern into a RegExp for path exclusion matching.
   */
  private globToRegExp(pattern: string): RegExp {
    const normalizedPattern = pattern.replace(/\\/g, '/');
    let regexStr = normalizedPattern
      .replace(/[\-+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '___GLOB_STAR_STAR___')
      .replace(/\*/g, '___GLOB_STAR___')
      .replace(/\?/g, '___GLOB_QUESTION___');

    regexStr = regexStr
      .replace(/___GLOB_STAR_STAR___/g, '.*')
      .replace(/___GLOB_STAR___/g, '[^/]*')
      .replace(/___GLOB_QUESTION___/g, '[^/]');

    return new RegExp(`(?:^|/)${regexStr}(?:$|/)`, 'i');
  }

  /**
   * Validates that targetFilePath is strictly inside at least one allowed workspace root.
   * Prevents path traversal (e.g., ../../../etc/passwd) and symlink escapes.
   */
  isWithinWorkspace(targetFilePath: string, workspaceIds: string[]): boolean {
    if (!targetFilePath) return false;
    if (workspaceIds.length === 0) return true;
    if (targetFilePath.includes('\0')) return false;

    for (const ws of workspaceIds) {
      const normWs = resolve(ws).replace(/\\/g, '/').toLowerCase();
      const wsPrefix = normWs.endsWith('/') ? normWs : normWs + '/';

      const directResolved = resolve(targetFilePath).replace(/\\/g, '/').toLowerCase();
      const relativeResolved = resolve(ws, targetFilePath).replace(/\\/g, '/').toLowerCase();

      const isDirectInside = directResolved === normWs || directResolved.startsWith(wsPrefix);
      const isRelativeInside = relativeResolved === normWs || relativeResolved.startsWith(wsPrefix);

      if (isDirectInside || isRelativeInside) {
        // Symlink verification if file exists on disk
        if (fs.existsSync(targetFilePath)) {
          try {
            const realTarget = fs.realpathSync(targetFilePath).replace(/\\/g, '/').toLowerCase();
            const realWs = fs.existsSync(ws) ? fs.realpathSync(ws).replace(/\\/g, '/').toLowerCase() : normWs;
            const realWsPrefix = realWs.endsWith('/') ? realWs : realWs + '/';

            if (realTarget !== realWs && !realTarget.startsWith(realWsPrefix)) {
              return false; // Symlink escapes workspace root
            }
          } catch {
            // Ignore realpath errors
          }
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Checks whether the file path matches any sensitive or excluded patterns.
   */
  isExcludedPath(targetFilePath: string): boolean {
    if (!targetFilePath) return false;
    const cleanPath = targetFilePath.replace(/\\/g, '/').toLowerCase();

    for (const pattern of this.excludedPatterns) {
      const cleanPattern = pattern.replace(/\\/g, '/').toLowerCase();

      if (!cleanPattern.includes('*') && !cleanPattern.includes('?')) {
        const basePattern = cleanPattern.startsWith('/') ? cleanPattern.slice(1) : cleanPattern;
        if (cleanPath.includes(basePattern)) {
          return true;
        }
      } else {
        const regex = this.globToRegExp(pattern);
        if (regex.test(cleanPath)) {
          return true;
        }
        const strippedPattern = cleanPattern.replace(/\*/g, '').replace(/\?/g, '');
        if (strippedPattern.length > 2 && cleanPath.includes(strippedPattern)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Helper returning path validity and explicit failure reason.
   */
  validatePath(targetFilePath: string, workspaceIds: string[]): { valid: boolean; reason?: string } {
    if (!targetFilePath) {
      return { valid: false, reason: 'EMPTY_PATH' };
    }
    if (this.isExcludedPath(targetFilePath)) {
      return { valid: false, reason: 'EXCLUDED_PATH' };
    }
    if (!this.isWithinWorkspace(targetFilePath, workspaceIds)) {
      return { valid: false, reason: 'OUTSIDE_WORKSPACE' };
    }
    return { valid: true };
  }

  /**
   * Returns true if targetFilePath is within workspace and not excluded.
   */
  isPathPermitted(targetFilePath: string, workspaceIds: string[] = []): boolean {
    return this.validatePath(targetFilePath, workspaceIds).valid;
  }
}
