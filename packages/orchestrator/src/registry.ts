import {
  ContextProvider,
  HealthResult,
  ProviderVersion,
  SourceBackend,
  HealthStatus
} from '@context-broker/contracts';

export interface ProviderEntry {
  provider: ContextProvider;
  enabled: boolean;
  timeoutMs: number;
}

export interface ProviderHealthReport {
  name: SourceBackend;
  enabled: boolean;
  version?: ProviderVersion;
  health: HealthResult;
}

export class ProviderRegistry {
  private providers = new Map<SourceBackend, ProviderEntry>();

  register(provider: ContextProvider, enabled = true, timeoutMs = 2000): void {
    this.providers.set(provider.name, {
      provider,
      enabled,
      timeoutMs
    });
  }

  unregister(name: SourceBackend): boolean {
    return this.providers.delete(name);
  }

  get(name: SourceBackend): ContextProvider | undefined {
    const entry = this.providers.get(name);
    return entry?.enabled ? entry.provider : undefined;
  }

  getEntry(name: SourceBackend): ProviderEntry | undefined {
    return this.providers.get(name);
  }

  setEnabled(name: SourceBackend, enabled: boolean): void {
    const entry = this.providers.get(name);
    if (entry) {
      entry.enabled = enabled;
    }
  }

  listActiveProviders(): ContextProvider[] {
    const active: ContextProvider[] = [];
    for (const entry of this.providers.values()) {
      if (entry.enabled) {
        active.push(entry.provider);
      }
    }
    return active;
  }

  async checkAllHealth(): Promise<Record<SourceBackend, ProviderHealthReport>> {
    const report: Partial<Record<SourceBackend, ProviderHealthReport>> = {};

    for (const [name, entry] of this.providers.entries()) {
      if (!entry.enabled) {
        report[name] = {
          name,
          enabled: false,
          health: {
            status: 'disabled' as HealthStatus,
            message: 'Provider is disabled by configuration',
            diagnostics: {}
          }
        };
        continue;
      }

      try {
        const [version, health] = await Promise.all([
          entry.provider.version().catch(() => undefined),
          entry.provider.health().catch((err: Error) => ({
            status: 'unhealthy' as HealthStatus,
            message: err.message,
            diagnostics: {}
          }))
        ]);

        report[name] = {
          name,
          enabled: true,
          version,
          health
        };
      } catch (err: unknown) {
        report[name] = {
          name,
          enabled: true,
          health: {
            status: 'unhealthy' as HealthStatus,
            message: err instanceof Error ? err.message : 'Health check failed',
            diagnostics: {}
          }
        };
      }
    }

    return report as Record<SourceBackend, ProviderHealthReport>;
  }
}
