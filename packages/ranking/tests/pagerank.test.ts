import { describe, it, expect } from 'vitest';
import { PageRankSolver, DependencyEdge } from '../src/index.js';

describe('Roadmap Step 3: Graph Centrality & Structural Reconnaissance', () => {
  describe('PageRankSolver Power Iteration', () => {
    it('solves node centrality over import dependency graph', () => {
      const solver = new PageRankSolver({ dampingFactor: 0.85 });

      // Core module 'util.ts' is imported by many modules
      const edges: DependencyEdge[] = [
        { source: 'app.ts', target: 'server.ts' },
        { source: 'app.ts', target: 'util.ts' },
        { source: 'server.ts', target: 'util.ts' },
        { source: 'auth.ts', target: 'util.ts' },
        { source: 'db.ts', target: 'util.ts' }
      ];

      const ranked = solver.rankNodes(edges);

      expect(ranked.length).toBe(5);
      // 'util.ts' should have the highest centrality rank (#1)
      expect(ranked[0]?.node).toBe('util.ts');
      expect(ranked[0]?.rank).toBe(1);
    });

    it('handles empty graphs gracefully', () => {
      const solver = new PageRankSolver();
      const ranked = solver.rankNodes([]);
      expect(ranked).toEqual([]);
    });

    it('handles single node graph correctly', () => {
      const solver = new PageRankSolver();
      const ranks = solver.solve([{ source: 'main.ts', target: 'main.ts' }]);
      expect(ranks.get('main.ts')).toBe(1.0);
    });
  });
});
