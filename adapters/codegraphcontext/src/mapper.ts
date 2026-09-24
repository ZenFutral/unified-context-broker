import { ContextCandidate, generateCandidateId } from '@context-broker/contracts';
import { NativeGraphQueryResult, GraphNode } from './types.js';

export function mapGraphNodeToCandidate(
  node: GraphNode,
  distanceFromSeed: number,
  isSeed = false
): ContextCandidate {
  // Graph relevance decay formula: 1 / (1 + 0.5 * distance)
  const graphRelevance = Number((1 / (1 + 0.5 * distanceFromSeed)).toFixed(4));

  const candidateId = generateCandidateId({
    sourceBackend: 'codegraphcontext',
    filePath: node.file_path,
    startLine: node.start_line,
    endLine: node.end_line,
    symbol: node.name
  });

  const content = node.docstring
    ? `${node.docstring}\n${node.content_snippet || node.name}`
    : node.content_snippet || `// Symbol: ${node.name} (${node.type})\n// File: ${node.file_path}`;

  return {
    id: candidateId,
    sourceBackend: 'codegraphcontext',
    sourceType: 'graph',
    filePath: node.file_path,
    symbol: node.name,
    startLine: node.start_line,
    endLine: node.end_line,
    content,
    graphDistance: distanceFromSeed,
    graphRelevance,
    compositeScore: isSeed ? 0.95 : graphRelevance * 0.8,
    freshness: 'indexed',
    permissions: ['workspace:read'],
    metadata: {
      graphNodeType: node.type,
      isSeedNode: isSeed,
      containerSymbol: node.container_symbol
    }
  };
}

export function mapGraphResultToCandidates(result: NativeGraphQueryResult): ContextCandidate[] {
  const candidates: ContextCandidate[] = [];
  const seedId = result.seed_node?.id;

  for (const node of result.nodes) {
    const isSeed = node.id === seedId;
    const distance = isSeed ? 0 : 1;
    candidates.push(mapGraphNodeToCandidate(node, distance, isSeed));
  }

  return candidates;
}
