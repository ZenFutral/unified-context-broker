import {
  ContextQuery,
  ContextPackage,
  BrokerConfig,
  BrokerConfigSchema
} from '@context-broker/contracts';
import {
  SpatialDeduplicator,
  RankFusionEngine,
  GraphExpansionEngine
} from '@context-broker/ranking';
import {
  WorkspaceBoundaryGuard,
  SecretScrubber,
  PermissionPolicyValidator
} from '@context-broker/security';
import { ContentHasher } from '@context-broker/provenance';
import { ProviderRegistry } from './registry.js';
import { QueryClassifier } from './classifier.js';
import { RetrievalPlanner } from './planner.js';
import { PlanExecutor } from './executor.js';
import { TokenBudgetManager } from './budget.js';

export class ContextOrchestrator {
  private registry: ProviderRegistry;
  private classifier: QueryClassifier;
  private planner: RetrievalPlanner;
  private executor: PlanExecutor;
  private deduplicator: SpatialDeduplicator;
  private rankFusion: RankFusionEngine;
  private graphExpansion: GraphExpansionEngine;
  private budgetManager: TokenBudgetManager;
  private boundaryGuard: WorkspaceBoundaryGuard;
  private secretScrubber: SecretScrubber;
  private permissionValidator: PermissionPolicyValidator;
  private contentHasher: ContentHasher;
  private config: BrokerConfig;

  constructor(
    registry: ProviderRegistry,
    config: Partial<BrokerConfig> = {}
  ) {
    this.registry = registry;
    this.classifier = new QueryClassifier();
    this.planner = new RetrievalPlanner();
    this.executor = new PlanExecutor(registry);
    this.deduplicator = new SpatialDeduplicator();
    this.rankFusion = new RankFusionEngine({ weights: config.scoring });
    this.graphExpansion = new GraphExpansionEngine();
    this.budgetManager = new TokenBudgetManager();
    this.boundaryGuard = new WorkspaceBoundaryGuard({
      excludedPatterns: config.security?.excludedPatterns
    });
    this.secretScrubber = new SecretScrubber();
    this.permissionValidator = new PermissionPolicyValidator();
    this.contentHasher = new ContentHasher();
    this.config = BrokerConfigSchema.parse(config);
  }

  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  async executeQuery(query: ContextQuery): Promise<ContextPackage> {
    const startTime = Date.now();

    // Stage 1: Normalize & Classify Query Intent
    const queryIntent = query.intent || this.classifier.classify(query.query);
    const effectiveTokenBudget = Math.min(
      query.tokenBudget || this.config.defaultTokenBudget,
      this.config.maxTokenBudget
    );

    // Stage 2: Retrieval Planning
    const plan = this.planner.createPlan(queryIntent, query.query);

    // Stage 3: Multi-Provider Parallel Retrieval
    const executionResult = await this.executor.execute(plan, {
      ...query,
      intent: queryIntent
    });

    // Stage 4: Spatial Candidate Deduplication & Overlap Merging
    const deduplicated = this.deduplicator.deduplicate(executionResult.rawCandidates);

    // Stage 5: Security & Workspace Boundary Filtering
    const sanitizedCandidates = deduplicated
      .filter((candidate) => {
        // Enforce boundary jail on file paths if present
        if (candidate.filePath) {
          if (!this.boundaryGuard.isWithinWorkspace(candidate.filePath, query.workspaceIds)) {
            return false;
          }
          if (this.boundaryGuard.isExcludedPath(candidate.filePath)) {
            return false;
          }
        }
        return true;
      })
      .map((candidate) => {
        // Scrub secrets & API keys
        const scrubResult = this.secretScrubber.scrub(candidate.content);
        const contentHash = this.contentHasher.hash(scrubResult.scrubbedContent);

        return {
          ...candidate,
          content: scrubResult.scrubbedContent,
          contentHash,
          metadata: {
            ...candidate.metadata,
            secretsRedacted: scrubResult.secretsDetectedCount
          }
        };
      });

    // Permission scope check
    const authorizedCandidates = this.permissionValidator.filterAuthorized(
      sanitizedCandidates,
      query.accessScope
    );

    // Stage 6: Graph Expansion & Neighborhood Seeding
    const seedCandidates = authorizedCandidates.filter(
      (c) => c.graphDistance === 0 || (c.symbol && query.query.toLowerCase().includes(c.symbol.toLowerCase()))
    );
    const neighborCandidates = authorizedCandidates.filter((c) => (c.graphDistance ?? 0) > 0);
    const nonGraphCandidates = authorizedCandidates.filter(
      (c) => !seedCandidates.includes(c) && !neighborCandidates.includes(c)
    );

    const expandedGraphCandidates = seedCandidates.length > 0
      ? [...this.graphExpansion.expandAndScore(seedCandidates, neighborCandidates), ...nonGraphCandidates]
      : authorizedCandidates;

    // Stage 7: Staged Rank Fusion & Safeguards
    const rankedCandidates = this.rankFusion.fuseAndRank(
      expandedGraphCandidates,
      query.query,
      queryIntent
    );

    // Stage 8: Token Budget Knapsack Packing
    const packed = this.budgetManager.packCandidates(rankedCandidates, effectiveTokenBudget);

    // Stage 9: Context Packaging
    return {
      queryId: query.queryId,
      queryText: query.query,
      intent: queryIntent,
      summary: `Retrieved ${packed.packedCandidates.length} candidate(s) via ${executionResult.traces.length} provider(s) in ${Date.now() - startTime}ms`,
      candidates: packed.packedCandidates,
      omittedCandidateCount: packed.omittedCandidateCount,
      estimatedTokens: packed.estimatedTokens,
      budgetUtilizationPct: packed.budgetUtilizationPct,
      warnings: executionResult.warnings,
      retrievalTrace: executionResult.traces,
      generatedAt: new Date().toISOString()
    };
  }
}
