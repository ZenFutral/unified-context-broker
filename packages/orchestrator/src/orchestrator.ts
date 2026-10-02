import {
  ContextQuery,
  ContextPackage,
  BrokerConfig,
  BrokerConfigSchema,
  ContextCandidate,
  SymbolProvider,
  ImpactAnalysisProvider,
  RepositoryMapProvider,
  DurableMemoryProvider,
  DecisionInput,
  DecisionRecord,
  ContextProvider,
  SearchReplaceRequest,
  SearchReplaceResult
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
import { ASTOutlineExtractor } from './ast-outline.js';
import { FileReplacementEngine } from './mutation/index.js';

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
  private astOutlineExtractor: ASTOutlineExtractor;
  private replacementEngine: FileReplacementEngine;
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
    this.astOutlineExtractor = new ASTOutlineExtractor();
    this.replacementEngine = new FileReplacementEngine({
      boundaryGuard: this.boundaryGuard,
      secretScrubber: this.secretScrubber,
      astOutlineExtractor: this.astOutlineExtractor,
      budgetManager: this.budgetManager
    });
    this.config = BrokerConfigSchema.parse(config);
  }

  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  /**
   * Universal internal pipeline processor for Stages 4–9:
   * Spatial Deduplication -> Workspace Boundary Jail -> Secret Scrubbing ->
   * Permission Checks -> Knapsack Token Budgeting -> Provenance Hash Auditing -> Packaging.
   */
  private processCandidatesPipeline(
    rawCandidates: ContextCandidate[],
    query: ContextQuery,
    startTime: number
  ): ContextPackage {
    const requestedBudget = query.maxTokens || query.tokenBudget || this.config.defaultTokenBudget;
    const effectiveTokenBudget = Math.min(requestedBudget, this.config.maxTokenBudget);

    // Stage 4: Spatial Deduplication & Overlap Merging
    const deduplicated = this.deduplicator.deduplicate(rawCandidates);

    // Stage 5: Security, AST Outline Extraction & Workspace Boundary Filtering
    const sanitizedCandidates = deduplicated
      .filter((candidate) => {
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
        const contentToProcess = query.outlineOnly
          ? this.astOutlineExtractor.extractOutline(candidate.content, candidate.filePath)
          : candidate.content;

        const scrubResult = this.secretScrubber.scrub(contentToProcess);
        const contentHash = this.contentHasher.hash(scrubResult.scrubbedContent);

        return {
          ...candidate,
          content: scrubResult.scrubbedContent,
          contentHash,
          metadata: {
            ...candidate.metadata,
            secretsRedacted: scrubResult.secretsDetectedCount,
            outlineOnly: query.outlineOnly ?? false
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

    const expandedGraphCandidates = seedCandidates.length > 0 && neighborCandidates.length > 0
      ? [...this.graphExpansion.expandAndScore(seedCandidates, neighborCandidates), ...nonGraphCandidates]
      : authorizedCandidates;

    // Stage 7: Staged Rank Fusion & Safeguards
    const queryIntent = query.intent || 'hybrid';
    const rankedCandidates = this.rankFusion.fuseAndRank(
      expandedGraphCandidates,
      query.query,
      queryIntent
    );

    // Stage 8: Token Budget Knapsack Packing
    const packed = this.budgetManager.packCandidates(rankedCandidates, effectiveTokenBudget, {
      outlineOnly: query.outlineOnly
    });

    // Stage 9: Context Packaging
    return {
      queryId: query.queryId,
      queryText: query.query,
      intent: queryIntent,
      summary: `Retrieved ${packed.packedCandidates.length} candidate(s) in ${Date.now() - startTime}ms`,
      candidates: packed.packedCandidates,
      omittedCandidateCount: packed.omittedCandidateCount,
      estimatedTokens: packed.estimatedTokens,
      budgetUtilizationPct: packed.budgetUtilizationPct,
      warnings: [],
      retrievalTrace: [],
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Executes general context search queries.
   */
  async executeQuery(query: ContextQuery): Promise<ContextPackage> {
    const startTime = Date.now();
    const queryIntent = query.intent || this.classifier.classify(query.query);

    const plan = this.planner.createPlan(queryIntent, query.query);
    const executionResult = await this.executor.execute(plan, {
      ...query,
      intent: queryIntent
    });

    const contextPackage = this.processCandidatesPipeline(executionResult.rawCandidates, query, startTime);
    contextPackage.warnings = executionResult.warnings;
    contextPackage.retrievalTrace = executionResult.traces;
    contextPackage.summary = `Retrieved ${contextPackage.candidates.length} candidate(s) via ${executionResult.traces.length} provider(s) in ${Date.now() - startTime}ms`;

    return contextPackage;
  }

  /**
   * Universal tool handler: `search_context`
   */
  async executeSearch(query: ContextQuery): Promise<ContextPackage> {
    return this.executeQuery(query);
  }

  /**
   * Universal tool handler: `get_symbol_context`
   */
  async executeSymbolLookup(
    symbol: string,
    filePath?: string,
    options: Partial<ContextQuery> = {}
  ): Promise<ContextPackage> {
    const startTime = Date.now();
    const query: ContextQuery = {
      queryId: `symbol-${Date.now()}`,
      query: symbol,
      workspaceIds: options.workspaceIds || [process.cwd()],
      intent: 'exact_lookup',
      tokenBudget: options.tokenBudget || 4000,
      resultLimit: options.resultLimit ?? 25,
      accessScope: options.accessScope || ['workspace:read'],
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    };

    let rawCandidates: ContextCandidate[] = [];

    const activeProviders = this.registry.listActiveProviders();
    const symbolProviders = activeProviders.filter(
      (p: ContextProvider) =>
        typeof (p as unknown as SymbolProvider).getSymbolContext === 'function' ||
        typeof (p as any).getSymbolContext === 'function'
    );

    if (symbolProviders.length > 0) {
      const results = await Promise.all(
        symbolProviders.map((p: ContextProvider) => {
          const fn = (p as unknown as SymbolProvider).getSymbolContext || (p as any).getSymbolContext;
          return fn.call(p, symbol, filePath);
        })
      );
      rawCandidates = results.flat();
    } else {
      return this.executeQuery(query);
    }

    return this.processCandidatesPipeline(rawCandidates, query, startTime);
  }

  /**
   * Universal tool handler: `get_impact_context`
   */
  async executeImpactAnalysis(
    symbol?: string,
    filePath?: string,
    depth = 2,
    options: Partial<ContextQuery> = {}
  ): Promise<ContextPackage> {
    const startTime = Date.now();
    const targetQuery = symbol || filePath || 'impact_analysis';

    const query: ContextQuery = {
      queryId: `impact-${Date.now()}`,
      query: targetQuery,
      workspaceIds: options.workspaceIds || [process.cwd()],
      intent: 'impact_analysis',
      tokenBudget: options.tokenBudget || 4000,
      resultLimit: options.resultLimit ?? 25,
      accessScope: options.accessScope || ['workspace:read'],
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    };

    let rawCandidates: ContextCandidate[] = [];

    const activeProviders = this.registry.listActiveProviders();
    const impactProviders = activeProviders.filter(
      (p: ContextProvider) =>
        typeof (p as unknown as ImpactAnalysisProvider).getImpactContext === 'function' ||
        typeof (p as any).getImpactContext === 'function'
    );

    if (impactProviders.length > 0) {
      const results = await Promise.all(
        impactProviders.map((p: ContextProvider) => {
          const fn = (p as unknown as ImpactAnalysisProvider).getImpactContext || (p as any).getImpactContext;
          return fn.call(p, symbol, filePath, depth);
        })
      );
      rawCandidates = results.flat();
    } else {
      return this.executeQuery(query);
    }

    return this.processCandidatesPipeline(rawCandidates, query, startTime);
  }

  /**
   * Universal tool handler: `get_repository_map`
   */
  async executeRepositoryMap(options: Partial<ContextQuery> = {}): Promise<ContextPackage> {
    const startTime = Date.now();
    const query: ContextQuery = {
      queryId: `repomap-${Date.now()}`,
      query: 'repository_structure_map',
      workspaceIds: options.workspaceIds || [process.cwd()],
      intent: 'hybrid',
      tokenBudget: options.tokenBudget || 4000,
      resultLimit: options.resultLimit ?? 25,
      outlineOnly: options.outlineOnly ?? true,
      accessScope: options.accessScope || ['workspace:read'],
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    };

    let rawCandidates: ContextCandidate[] = [];

    const activeProviders = this.registry.listActiveProviders();
    const mapProviders = activeProviders.filter(
      (p: ContextProvider) =>
        typeof (p as unknown as RepositoryMapProvider).getRepositoryStructure === 'function' ||
        typeof (p as any).getRepositoryMap === 'function'
    );

    if (mapProviders.length > 0) {
      const results = await Promise.all(
        mapProviders.map((p: ContextProvider) => {
          const fn = (p as unknown as RepositoryMapProvider).getRepositoryStructure || (p as any).getRepositoryMap;
          return fn.call(p, { outlineOnly: query.outlineOnly });
        })
      );
      rawCandidates = results.flat();
    } else {
      return this.executeQuery(query);
    }

    return this.processCandidatesPipeline(rawCandidates, query, startTime);
  }

  /**
   * Universal tool handler: `recall_decisions`
   */
  async executeDecisionRecall(
    queryText: string,
    filter?: { components?: string[]; tags?: string[] },
    options: Partial<ContextQuery> = {}
  ): Promise<ContextPackage> {
    const startTime = Date.now();
    const query: ContextQuery = {
      queryId: `recall-${Date.now()}`,
      query: queryText,
      workspaceIds: options.workspaceIds || [process.cwd()],
      intent: 'decision_recall',
      tokenBudget: options.tokenBudget || 4000,
      resultLimit: options.resultLimit ?? 25,
      accessScope: options.accessScope || ['workspace:read'],
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    };

    let rawCandidates: ContextCandidate[] = [];

    const activeProviders = this.registry.listActiveProviders();
    const memoryProviders = activeProviders.filter(
      (p: ContextProvider) =>
        typeof (p as unknown as DurableMemoryProvider).recallDecisions === 'function' ||
        typeof (p as any).recallDecisions === 'function'
    );

    if (memoryProviders.length > 0) {
      const results = await Promise.all(
        memoryProviders.map((p: ContextProvider) => {
          const fn = (p as unknown as DurableMemoryProvider).recallDecisions || (p as any).recallDecisions;
          return fn.call(p, queryText, filter?.components, filter?.tags, options.resultLimit ?? 10);
        })
      );
      rawCandidates = results.flat();
    } else {
      return this.executeQuery(query);
    }

    return this.processCandidatesPipeline(rawCandidates, query, startTime);
  }

  /**
   * Universal tool handler: `record_decision`
   */
  async executeDecisionRecord(decision: DecisionInput): Promise<DecisionRecord> {
    const activeProviders = this.registry.listActiveProviders();
    const memoryProviders = activeProviders.filter(
      (p: ContextProvider) =>
        typeof (p as unknown as DurableMemoryProvider).recordDecision === 'function' ||
        typeof (p as any).recordDecision === 'function'
    );

    if (memoryProviders.length > 0) {
      const provider = memoryProviders[0]!;
      const fn = (provider as unknown as DurableMemoryProvider).recordDecision || (provider as any).recordDecision;
      return fn.call(provider, decision);
    }
    throw new Error('No DurableMemoryProvider available to record architectural decision.');
  }

  /**
   * Universal tool handler: `search_and_replace`
   */
  async executeSearchReplace(request: SearchReplaceRequest): Promise<SearchReplaceResult> {
    return this.replacementEngine.replace(request);
  }
}
