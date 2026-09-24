export class ContextBrokerError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code = 'INTERNAL_BROKER_ERROR', details?: Record<string, unknown>) {
    super(message);
    this.name = 'ContextBrokerError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProviderUnavailableError extends ContextBrokerError {
  constructor(providerName: string, reason?: string) {
    super(
      `Provider '${providerName}' is unavailable: ${reason || 'Not reachable'}`,
      'PROVIDER_UNAVAILABLE',
      { providerName, reason }
    );
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderTimeoutError extends ContextBrokerError {
  constructor(providerName: string, timeoutMs: number) {
    super(
      `Provider '${providerName}' timed out after ${timeoutMs}ms`,
      'PROVIDER_TIMEOUT',
      { providerName, timeoutMs }
    );
    this.name = 'ProviderTimeoutError';
  }
}

export class InvalidQueryError extends ContextBrokerError {
  constructor(message: string, validationErrors?: unknown) {
    super(message, 'INVALID_QUERY', { validationErrors });
    this.name = 'InvalidQueryError';
  }
}

export class SecurityViolationError extends ContextBrokerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SECURITY_VIOLATION', details);
    this.name = 'SecurityViolationError';
  }
}
