import { PolicyExclusions } from '@context-broker/contracts';

export interface SecretScrubbingResult {
  scrubbedContent: string;
  secretsDetectedCount: number;
}

export interface SecretScrubberOptions {
  customPatterns?: string[];
  policyExclusions?: PolicyExclusions;
  enableEntropyCheck?: boolean;
}

export class SecretScrubber {
  private secretPatterns: { pattern: RegExp; redaction: string }[];
  private enableEntropyCheck: boolean;

  constructor(options: SecretScrubberOptions = {}) {
    this.enableEntropyCheck = options.enableEntropyCheck ?? true;
    this.secretPatterns = [
      // SSH / RSA / EC Private Keys
      {
        pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/gi,
        redaction: '[REDACTED_PRIVATE_KEY]'
      },
      // Authorization Headers
      {
        pattern: /Authorization:\s*(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi,
        redaction: 'Authorization: [REDACTED_SECRET]'
      },
      // JWT Tokens
      {
        pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
        redaction: '[REDACTED_JWT]'
      },
      // Known API Key Prefixes (OpenAI, GitHub, Slack)
      {
        pattern: /(?:sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|xox[baprs]-[a-zA-Z0-9]{10,})/g,
        redaction: '[REDACTED_API_KEY]'
      },
      // Bearer / Token / API Key assignments
      {
        pattern: /(?:bearer\s+|token\s*[:=]\s*['"]?|api[_-]?key\s*[:=]\s*['"]?)([a-zA-Z0-9_\-]{20,})/gi,
        redaction: '[REDACTED_SECRET]'
      },
      // Password assignments
      {
        pattern: /(?:password|passwd|pwd|client_secret)\s*[:=]\s*['"]([^'"]+)['"]/gi,
        redaction: '[REDACTED_PASSWORD]'
      },
      // AWS Secret Key pattern
      {
        pattern: /(?:aws_secret_access_key\s*[:=]\s*['"]?)([a-zA-Z0-9/+=]{40})/gi,
        redaction: '[REDACTED_SECRET]'
      }
    ];

    // Ingest custom patterns from options or PolicyExclusions
    const extraPatterns = [
      ...(options.customPatterns ?? []),
      ...(options.policyExclusions?.secretScrubbingPatterns ?? [])
    ];

    for (const patStr of extraPatterns) {
      try {
        const regex = new RegExp(patStr, 'gi');
        this.secretPatterns.push({ pattern: regex, redaction: '[REDACTED_SECRET]' });
      } catch {
        // Ignore invalid regex pattern
      }
    }
  }

  /**
   * Calculates Shannon Entropy of a string.
   */
  private calculateEntropy(str: string): number {
    if (!str) return 0;
    const len = str.length;
    const freqs: Record<string, number> = {};
    for (let i = 0; i < len; i++) {
      const char = str[i]!;
      freqs[char] = (freqs[char] || 0) + 1;
    }
    let entropy = 0;
    for (const char in freqs) {
      const p = freqs[char]! / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  /**
   * Evaluates if a high-entropy string is a false positive (UUID, hex color, git commit hash, data URI).
   */
  private isFalsePositive(token: string): boolean {
    if (/^#[0-9a-fA-F]{3,8}$/.test(token)) return true;
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(token)) return true;
    if (/^[0-9a-fA-F]{40}$/.test(token)) return true;
    if (token.startsWith('data:') || token.startsWith('file://')) return true;
    return false;
  }

  /**
   * Scans text and replaces any detected secrets with REDACTED tags.
   */
  scrub(content: string): SecretScrubbingResult {
    if (!content) {
      return { scrubbedContent: '', secretsDetectedCount: 0 };
    }

    let scrubbed = content;
    let count = 0;

    // 1. Multi-pattern regex detection
    for (const item of this.secretPatterns) {
      scrubbed = scrubbed.replace(item.pattern, (match, secretGroup) => {
        count++;
        if (secretGroup) {
          const secretStart = match.lastIndexOf(secretGroup);
          if (secretStart !== -1) {
            return (
              match.slice(0, secretStart) +
              item.redaction +
              match.slice(secretStart + secretGroup.length)
            );
          }
          return item.redaction;
        }
        return item.redaction;
      });
    }

    // 2. High-entropy token detection if enabled
    if (this.enableEntropyCheck) {
      const tokens = scrubbed.match(/[a-zA-Z0-9_+\-/=]{25,}/g);
      if (tokens) {
        for (const token of tokens) {
          if (this.isFalsePositive(token)) continue;
          const entropy = this.calculateEntropy(token);
          if (entropy > 4.5 && !token.includes('[REDACTED')) {
            scrubbed = scrubbed.split(token).join('[REDACTED_SECRET]');
            count++;
          }
        }
      }
    }

    return {
      scrubbedContent: scrubbed,
      secretsDetectedCount: count
    };
  }

  /**
   * Alias for scrub(content).
   */
  scrubText(content: string): SecretScrubbingResult {
    return this.scrub(content);
  }
}
