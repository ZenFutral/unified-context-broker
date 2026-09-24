import {
  ContextQuery,
  ContextCandidate,
  RetrievalStepTrace
} from '@context-broker/contracts';
import { ProviderRegistry } from './registry.js';
import { RetrievalExecutionPlan } from './planner.js';

export interface PlanExecutionResult {
  rawCandidates: ContextCandidate[];
  traces: RetrievalStepTrace[];
  warnings: string[];
}

export class PlanExecutor {
  private registry: ProviderRegistry;

  constructor(registry: ProviderRegistry) {
    this.registry = registry;
  }

  async execute(plan: RetrievalExecutionPlan, query: ContextQuery): Promise<PlanExecutionResult> {
    const traces: RetrievalStepTrace[] = [];
    const rawCandidates: ContextCandidate[] = [];
    const warnings: string[] = [];

    const tasks = plan.steps.map(async (step) => {
      const stepStart = Date.now();
      const provider = this.registry.get(step.provider);

      if (!provider) {
        traces.push({
          provider: step.provider,
          operation: step.operation,
          durationMs: 0,
          candidatesReturned: 0,
          status: 'skipped',
          error: `Provider '${step.provider}' is disabled or not registered`
        });
        return [];
      }

      const entry = this.registry.getEntry(step.provider);
      const timeoutMs = entry?.timeoutMs || 2000;

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
        );

        const candidates = await Promise.race([
          provider.search(query),
          timeoutPromise
        ]);

        traces.push({
          provider: step.provider,
          operation: step.operation,
          durationMs: Date.now() - stepStart,
          candidatesReturned: candidates.length,
          status: 'success'
        });

        return candidates;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown provider error';
        traces.push({
          provider: step.provider,
          operation: step.operation,
          durationMs: Date.now() - stepStart,
          candidatesReturned: 0,
          status: 'degraded',
          error: errMsg
        });
        warnings.push(`Provider '${step.provider}' degraded during ${step.operation}: ${errMsg}`);
        return [];
      }
    });

    const results = await Promise.all(tasks);
    for (const list of results) {
      rawCandidates.push(...list);
    }

    return {
      rawCandidates,
      traces,
      warnings
    };
  }
}
