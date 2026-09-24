import { describe, it, expect } from 'vitest';
import { WorkspaceBoundaryGuard, SecretScrubber, PermissionPolicyValidator } from '../src/index.js';
import { ContextCandidate } from '@context-broker/contracts';

describe('Security Package', () => {
  describe('WorkspaceBoundaryGuard', () => {
    const guard = new WorkspaceBoundaryGuard();
    const allowedWorkspaces = ['/projects/my-app', 'c:/Users/Dev/Workspace/ContextMCP'];

    it('permits files within the workspace root', () => {
      expect(guard.isWithinWorkspace('/projects/my-app/src/index.ts', allowedWorkspaces)).toBe(true);
      expect(guard.isWithinWorkspace('c:/Users/Dev/Workspace/ContextMCP/src/server.ts', allowedWorkspaces)).toBe(true);
    });

    it('blocks directory traversal attempts', () => {
      expect(guard.isWithinWorkspace('../../etc/passwd', allowedWorkspaces)).toBe(false);
      expect(guard.isWithinWorkspace('/projects/my-app/../../windows/system32', allowedWorkspaces)).toBe(false);
    });

    it('identifies sensitive and excluded files', () => {
      expect(guard.isExcludedPath('/projects/my-app/.env.production')).toBe(true);
      expect(guard.isExcludedPath('/projects/my-app/certs/server.key')).toBe(true);
      expect(guard.isExcludedPath('/projects/my-app/id_rsa')).toBe(true);
      expect(guard.isExcludedPath('/projects/my-app/src/services/call.ts')).toBe(false);
    });
  });

  describe('SecretScrubber', () => {
    const scrubber = new SecretScrubber();

    it('redacts API keys and bearer tokens', () => {
      const code = 'const apiKey = "sk-1234567890abcdef1234567890";\nconst token = bearer abcdef12345678901234567890;';
      const result = scrubber.scrub(code);
      expect(result.secretsDetectedCount).toBeGreaterThan(0);
      expect(result.scrubbedContent).not.toContain('sk-1234567890abcdef1234567890');
      expect(result.scrubbedContent).toContain('[REDACTED_SECRET]');
    });

    it('redacts embedded RSA private keys', () => {
      const pem = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1+example+key+content...
-----END RSA PRIVATE KEY-----`;
      const result = scrubber.scrub(pem);
      expect(result.secretsDetectedCount).toBe(1);
      expect(result.scrubbedContent).toBe('[REDACTED_PRIVATE_KEY]');
    });
  });

  describe('PermissionPolicyValidator', () => {
    const validator = new PermissionPolicyValidator();

    it('filters candidates based on matching access scope', () => {
      const candidateA: ContextCandidate = {
        id: 'c-1',
        sourceBackend: 'comp',
        sourceType: 'code',
        content: 'public code',
        permissions: ['workspace:read'],
        freshness: 'live',
        metadata: {}
      };

      const candidateB: ContextCandidate = {
        id: 'c-2',
        sourceBackend: 'comp',
        sourceType: 'code',
        content: 'restricted code',
        permissions: ['repo:admin'],
        freshness: 'live',
        metadata: {}
      };

      const filtered = validator.filterAuthorized([candidateA, candidateB], ['workspace:read']);
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.id).toBe('c-1');
    });
  });
});
