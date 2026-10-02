import { describe, it, expect } from 'vitest';
import { WorkspaceBoundaryGuard, SecretScrubber, PermissionPolicyValidator } from '../src/index.js';
import { ContextCandidate, loadPolicyExclusions } from '@context-broker/contracts';

describe('Security Package - Layer 1', () => {
  describe('WorkspaceBoundaryGuard', () => {
    const policy = loadPolicyExclusions();
    const guard = new WorkspaceBoundaryGuard({ policyExclusions: policy });
    const allowedWorkspaces = ['/projects/my-app', 'c:/Users/Dev/Workspace/ContextMCP'];

    it('permits files within the workspace root', () => {
      expect(guard.isWithinWorkspace('/projects/my-app/src/index.ts', allowedWorkspaces)).toBe(true);
      expect(guard.isWithinWorkspace('c:/Users/Dev/Workspace/ContextMCP/src/server.ts', allowedWorkspaces)).toBe(true);
    });

    it('blocks directory traversal attempts', () => {
      expect(guard.isWithinWorkspace('../../etc/passwd', allowedWorkspaces)).toBe(false);
      expect(guard.isWithinWorkspace('/projects/my-app/../../windows/system32', allowedWorkspaces)).toBe(false);
      expect(guard.isWithinWorkspace('/projects/my-app/src/..\\..\\..\\secret.txt', allowedWorkspaces)).toBe(false);
      expect(guard.isWithinWorkspace('/projects/my-app/src/../../../secret.txt', allowedWorkspaces)).toBe(false);
    });

    it('identifies sensitive and excluded files using glob patterns', () => {
      expect(guard.isExcludedPath('/projects/my-app/.env.production')).toBe(true);
      expect(guard.isExcludedPath('/projects/my-app/certs/server.key')).toBe(true);
      expect(guard.isExcludedPath('/projects/my-app/certs/tls.pem')).toBe(true);
      expect(guard.isExcludedPath('/projects/my-app/id_rsa')).toBe(true);
      expect(guard.isExcludedPath('/projects/my-app/node_modules/express/index.js')).toBe(true);
      expect(guard.isExcludedPath('/projects/my-app/.git/config')).toBe(true);
      expect(guard.isExcludedPath('/projects/my-app/src/services/call.ts')).toBe(false);
    });

    it('provides structured path validation helper', () => {
      const valid = guard.validatePath('/projects/my-app/src/services/call.ts', allowedWorkspaces);
      expect(valid.valid).toBe(true);

      const excluded = guard.validatePath('/projects/my-app/.env', allowedWorkspaces);
      expect(excluded.valid).toBe(false);
      expect(excluded.reason).toBe('EXCLUDED_PATH');

      const outside = guard.validatePath('/etc/passwd', allowedWorkspaces);
      expect(outside.valid).toBe(false);
      expect(outside.reason).toBe('OUTSIDE_WORKSPACE');
    });
  });

  describe('SecretScrubber', () => {
    const policy = loadPolicyExclusions();
    const scrubber = new SecretScrubber({ policyExclusions: policy });

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

    it('redacts JWT tokens and Authorization headers', () => {
      const jwt = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = scrubber.scrub(jwt);
      expect(result.secretsDetectedCount).toBeGreaterThan(0);
      expect(result.scrubbedContent).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('suppresses false positives for UUIDs, hex colors, and git commit hashes', () => {
      const benign = `
        const color = "#1e293b";
        const uuid = "123e4567-e89b-12d3-a456-426614174000";
        const commitHash = "ab21378cbf39186a1234567890abcdef12345678";
      `;
      const result = scrubber.scrub(benign);
      expect(result.scrubbedContent).toContain('#1e293b');
      expect(result.scrubbedContent).toContain('123e4567-e89b-12d3-a456-426614174000');
      expect(result.scrubbedContent).toContain('ab21378cbf39186a1234567890abcdef12345678');
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
