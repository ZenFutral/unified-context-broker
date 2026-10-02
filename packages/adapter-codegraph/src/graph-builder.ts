import * as path from 'node:path';
import { DependencyEdge, PageRankSolver } from '@context-broker/ranking';

export interface GraphAnalysisResult {
  edges: DependencyEdge[];
  centralityScores: Map<string, number>;
}

export class CodebaseDependencyGraphCrawler {
  private solver: PageRankSolver;

  constructor() {
    this.solver = new PageRankSolver({ dampingFactor: 0.85, maxIterations: 50 });
  }

  /**
   * Scans imports/requires in file contents to extract directed dependency edges.
   */
  extractEdges(fileContents: Map<string, string>): DependencyEdge[] {
    const edges: DependencyEdge[] = [];

    for (const [filePath, content] of fileContents.entries()) {
      if (!content) continue;

      const normSource = filePath.replace(/\\/g, '/');

      // Match ES imports: import ... from '...' or import '...'
      const importRegex = /(?:import\s+(?:[\s\S]*?\s+from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g;
      let match: RegExpExecArray | null;

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (!importPath) continue;

        // Skip non-relative node_modules imports unless mapped
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
          edges.push({ source: normSource, target: importPath, weight: 1 });
          continue;
        }

        // Resolve relative import target relative to source file
        const dir = path.dirname(normSource);
        let resolvedTarget = path.join(dir, importPath).replace(/\\/g, '/');

        // Add default extensions if omitted
        if (!path.extname(resolvedTarget)) {
          resolvedTarget += '.ts';
        }

        edges.push({
          source: normSource,
          target: resolvedTarget,
          weight: 1
        });
      }
    }

    return edges;
  }

  /**
   * Builds dependency graph and solves PageRank centrality scores.
   */
  analyzeGraph(fileContents: Map<string, string>): GraphAnalysisResult {
    const edges = this.extractEdges(fileContents);
    const centralityScores = this.solver.solve(edges);

    return {
      edges,
      centralityScores
    };
  }
}
