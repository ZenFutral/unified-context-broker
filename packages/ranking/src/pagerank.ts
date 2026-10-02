export interface DependencyEdge {
  source: string; // File or module importing
  target: string; // File or module being imported
  weight?: number;
}

export interface PageRankOptions {
  dampingFactor?: number; // Standard d = 0.85
  maxIterations?: number; // Max power iterations (default: 100)
  tolerance?: number;     // Convergence threshold (default: 1e-6)
}

export interface PageRankNodeScore {
  node: string;
  score: number;
  rank: number;
}

export class PageRankSolver {
  private dampingFactor: number;
  private maxIterations: number;
  private tolerance: number;

  constructor(options: PageRankOptions = {}) {
    this.dampingFactor = options.dampingFactor ?? 0.85;
    this.maxIterations = options.maxIterations ?? 100;
    this.tolerance = options.tolerance ?? 1e-6;
  }

  /**
   * Solves node centrality across an import/dependency graph using power iteration.
   * Formula: P(v) = (1 - d) / N + d * sum(P(u) / OutDegree(u))
   */
  solve(edges: DependencyEdge[]): Map<string, number> {
    const nodes = new Set<string>();
    const outEdges = new Map<string, string[]>();
    const inEdges = new Map<string, string[]>();

    // Step 1: Build Adjacency Matrix
    for (const edge of edges) {
      nodes.add(edge.source);
      nodes.add(edge.target);

      if (!outEdges.has(edge.source)) outEdges.set(edge.source, []);
      outEdges.get(edge.source)!.push(edge.target);

      if (!inEdges.has(edge.target)) inEdges.set(edge.target, []);
      inEdges.get(edge.target)!.push(edge.source);
    }

    const nodeList = Array.from(nodes);
    const N = nodeList.length;

    if (N === 0) return new Map();
    if (N === 1) return new Map([[nodeList[0]!, 1.0]]);

    // Step 2: Initialize uniform rank distribution
    let ranks = new Map<string, number>();
    const initialRank = 1.0 / N;
    for (const node of nodeList) {
      ranks.set(node, initialRank);
    }

    // Step 3: Power Iteration Loop
    for (let iter = 0; iter < this.maxIterations; iter++) {
      const nextRanks = new Map<string, number>();
      let danglingSum = 0;

      // Handle dangling nodes (out-degree 0)
      for (const node of nodeList) {
        const outDegree = outEdges.get(node)?.length ?? 0;
        if (outDegree === 0) {
          danglingSum += ranks.get(node) ?? 0;
        }
      }

      let diff = 0;

      for (const node of nodeList) {
        const incoming = inEdges.get(node) || [];
        let inboundShare = 0;

        for (const inNode of incoming) {
          const outDegree = outEdges.get(inNode)?.length || 1;
          inboundShare += (ranks.get(inNode) ?? 0) / outDegree;
        }

        const newRank =
          (1 - this.dampingFactor) / N +
          this.dampingFactor * (inboundShare + danglingSum / N);

        nextRanks.set(node, newRank);
        diff += Math.abs(newRank - (ranks.get(node) ?? 0));
      }

      ranks = nextRanks;

      // Check convergence
      if (diff < this.tolerance) {
        break;
      }
    }

    return ranks;
  }

  /**
   * Returns sorted list of nodes ranked by centrality score.
   */
  rankNodes(edges: DependencyEdge[]): PageRankNodeScore[] {
    const rankMap = this.solve(edges);
    const sorted = Array.from(rankMap.entries())
      .map(([node, score]) => ({ node, score: Number(score.toFixed(6)) }))
      .sort((a, b) => b.score - a.score);

    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }
}
