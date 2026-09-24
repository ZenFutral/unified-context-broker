import { ContextCandidate } from '@context-broker/contracts';

export class PermissionPolicyValidator {
  /**
   * Evaluates if a candidate is permitted given the caller's accessScope.
   */
  isPermitted(candidate: ContextCandidate, accessScope: string[]): boolean {
    if (!candidate.permissions || candidate.permissions.length === 0) {
      return true;
    }

    const scopeSet = new Set(accessScope);
    // Caller must satisfy at least one required permission or have admin/wildcard
    if (scopeSet.has('*') || scopeSet.has('admin')) {
      return true;
    }

    return candidate.permissions.some((perm) => scopeSet.has(perm));
  }

  /**
   * Filters a candidate list, removing candidates that violate caller permissions.
   */
  filterAuthorized(candidates: ContextCandidate[], accessScope: string[]): ContextCandidate[] {
    return candidates.filter((c) => this.isPermitted(c, accessScope));
  }
}
