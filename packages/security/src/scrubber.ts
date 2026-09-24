export interface SecretScrubbingResult {
  scrubbedContent: string;
  secretsDetectedCount: number;
}

export class SecretScrubber {
  private secretPatterns: RegExp[] = [
    // Bearer / Token / API Key patterns
    /(?:bearer\s+|token\s*[:=]\s*['"]?|api[_-]?key\s*[:=]\s*['"]?)([a-zA-Z0-9_\-]{20,})/gi,
    // Generic password patterns
    /(?:password\s*[:=]\s*['"])([^'"]+)(?:['"])/gi,
    // AWS Secret Key pattern
    /(?:aws_secret_access_key\s*[:=]\s*['"]?)([a-zA-Z0-9/+=]{40})/gi,
    // SSH / RSA / EC Private Keys
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gi
  ];

  /**
   * Scans text and replaces any detected secrets with [REDACTED_SECRET].
   */
  scrub(content: string): SecretScrubbingResult {
    let scrubbed = content;
    let count = 0;

    for (const pattern of this.secretPatterns) {
      scrubbed = scrubbed.replace(pattern, (match, secretGroup) => {
        count++;
        if (secretGroup) {
          // Use a replacer function to avoid treating secretGroup as a regex pattern,
          // and to correctly handle cases where the secret value contains special chars.
          const secretStart = match.lastIndexOf(secretGroup);
          if (secretStart !== -1) {
            return (
              match.slice(0, secretStart) +
              '[REDACTED_SECRET]' +
              match.slice(secretStart + secretGroup.length)
            );
          }
          return '[REDACTED_SECRET]';
        }
        return '[REDACTED_PRIVATE_KEY]';
      });
    }

    return {
      scrubbedContent: scrubbed,
      secretsDetectedCount: count
    };
  }
}
